import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { BotFailure, BotPresenceTracker, BotProfile } from '../bots/index.js';
import type { ClaimRecord } from '../claims/index.js';
import type { EditGrantRecord } from '../grants/index.js';
import type { SipSnapshot } from '../sip/index.js';
import type { TaskRecord, TaskStatus } from '../tasks/index.js';
import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsDecisionStatusPort, OpsFailure } from './types.js';

export interface OpsStatusPorts {
    bots: Pick<BotPresenceTracker, 'list'>;
    tasks: { list(): Result<readonly TaskRecord[], StorageFailure> };
    claims: { listActive(): Result<readonly ClaimRecord[], StorageFailure> };
    grants: { listActive(): Result<readonly EditGrantRecord[], StorageFailure> };
    sip: { loadSnapshot(): Result<SipSnapshot, StorageFailure> };
    decisions: OpsDecisionStatusPort;
    metrics?: OpsMetricsRegistry;
    now?: () => string;
}

export interface OpsBotStatus {
    botId: string;
    username: string;
    role: string;
    status: string;
    currentTaskId: string | null;
    currentSkill: string | null;
    lastSeen: string;
}

export interface OpsStatusSnapshot {
    at: string;
    bots: {
        total: number;
        online: number;
        suspended: number;
        offline: number;
        items: readonly OpsBotStatus[];
    };
    tasks: {
        total: number;
        byStatus: Record<TaskStatus, number>;
    };
    claims: {
        active: number;
        items: readonly {
            id: string;
            botId: string;
            resourceType: string;
            resourceId: string;
            leaseUntil: string;
        }[];
    };
    grants: {
        active: number;
        items: readonly {
            id: string;
            structureId: string;
            granteeBotId: string;
            expiresAt: string;
        }[];
    };
    sip: {
        revision: number;
        zones: number;
        structures: number;
        roads: number;
        farms: number;
        containers: number;
        pathNodes: number;
        pathEdges: number;
    };
    decisions: ReturnType<OpsDecisionStatusPort['status']>;
}

export class OpsStatusAggregator {
    constructor(private readonly ports: OpsStatusPorts) {}

    snapshot(): Result<OpsStatusSnapshot, OpsFailure> {
        const startedAt = Date.now();
        const [snapshot, snapshotError] = this.build();
        this.ports.metrics?.observe('ops_status_aggregator_latency_ms', Date.now() - startedAt);
        if (snapshotError) {
            this.ports.metrics?.increment('ops_status_aggregator_errors_total');
            return [null, snapshotError];
        }
        return [snapshot, null];
    }

    private build(): Result<OpsStatusSnapshot, OpsFailure> {
        const [bots, botsError] = this.ports.bots.list();
        if (botsError || bots === null) return [null, OpsStatusAggregator.failure(botsError)];
        const [tasks, tasksError] = this.ports.tasks.list();
        if (tasksError || tasks === null) return [null, OpsStatusAggregator.failure(tasksError)];
        const [claims, claimsError] = this.ports.claims.listActive();
        if (claimsError || claims === null) return [null, OpsStatusAggregator.failure(claimsError)];
        const [grants, grantsError] = this.ports.grants.listActive();
        if (grantsError || grants === null) return [null, OpsStatusAggregator.failure(grantsError)];
        const [sip, sipError] = this.ports.sip.loadSnapshot();
        if (sipError || sip === null) return [null, OpsStatusAggregator.failure(sipError)];
        const decisions = this.ports.decisions.status();
        const status = this.status(bots, tasks, claims, grants, sip, decisions);
        this.recordGauges(status);
        return [status, null];
    }

    private status(
        bots: readonly BotProfile[],
        tasks: readonly TaskRecord[],
        claims: readonly ClaimRecord[],
        grants: readonly EditGrantRecord[],
        sip: SipSnapshot,
        decisions: OpsStatusSnapshot['decisions'],
    ): OpsStatusSnapshot {
        const online = bots.filter((bot) => bot.status === 'online').length;
        const suspended = bots.filter((bot) => bot.status === 'suspended').length;
        return {
            at: this.ports.now?.() ?? new Date().toISOString(),
            bots: {
                total: bots.length,
                online,
                suspended,
                offline: bots.length - online - suspended,
                items: bots.map((bot) => ({
                    botId: bot.botId,
                    username: bot.username,
                    role: bot.temporaryRole ?? bot.role,
                    status: bot.status,
                    currentTaskId: bot.currentTaskId,
                    currentSkill: bot.currentSkill,
                    lastSeen: bot.lastSeen,
                })),
            },
            tasks: {
                total: tasks.length,
                byStatus: OpsStatusAggregator.countTasks(tasks),
            },
            claims: {
                active: claims.length,
                items: claims.map((claim) => ({
                    id: claim.id,
                    botId: claim.botId,
                    resourceType: claim.resourceType,
                    resourceId: claim.resourceId,
                    leaseUntil: claim.leaseUntil,
                })),
            },
            grants: {
                active: grants.length,
                items: grants.map((grant) => ({
                    id: grant.id,
                    structureId: grant.structureId,
                    granteeBotId: grant.granteeBotId,
                    expiresAt: grant.expiresAt,
                })),
            },
            sip: {
                revision: sip.revision,
                zones: sip.zones.length,
                structures: sip.structures.length,
                roads: sip.roads.length,
                farms: sip.farms.length,
                containers: sip.containers.length,
                pathNodes: sip.pathGraph.nodes.length,
                pathEdges: sip.pathGraph.edges.length,
            },
            decisions,
        };
    }

    private recordGauges(status: OpsStatusSnapshot): void {
        this.ports.metrics?.setGauge('ops_bots_online', status.bots.online);
        this.ports.metrics?.setGauge('ops_bots_suspended', status.bots.suspended);
        this.ports.metrics?.setGauge('ops_tasks_total', status.tasks.total);
        this.ports.metrics?.setGauge('ops_claims_active', status.claims.active);
        this.ports.metrics?.setGauge('ops_grants_active', status.grants.active);
        this.ports.metrics?.setGauge('ops_sip_revision', status.sip.revision);
    }

    private static countTasks(tasks: readonly TaskRecord[]): Record<TaskStatus, number> {
        const counts: Record<TaskStatus, number> = {
            pending: 0,
            ready: 0,
            claimed: 0,
            running: 0,
            completed: 0,
            failed: 0,
            dead_letter: 0,
            cancelled: 0,
        };
        for (const task of tasks) counts[task.status] += 1;
        return counts;
    }

    private static failure(failure: StorageFailure | BotFailure | null): OpsFailure {
        if (failure === null) return { type: 'UNAVAILABLE', message: 'status source unavailable' };
        if ('failure' in failure) return { type: 'STORAGE', failure: failure.failure };
        const message = 'message' in failure ? failure.message : failure.type;
        return { type: 'STORAGE', failure: { type: 'READ_FAILED', message } };
    }
}
