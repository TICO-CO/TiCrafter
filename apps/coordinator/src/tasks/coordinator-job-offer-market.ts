import type { Result } from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { EditGrantRecord, EditRequestInput, GrantFailure } from '../grants/index.js';
import type {
    JobAssignment,
    JobDecision,
    JobOffer,
    JobOfferContext,
    JobOfferPort,
} from './job-offer-service.js';
import type { TaskBoard } from './task-board.js';
import type { TaskRecord } from './types.js';

export interface HelperGrantPort {
    request(input: EditRequestInput, now?: string): Result<EditGrantRecord, GrantFailure>;
}

const HELPER_GRANT_TTL_MILLISECONDS = 24 * 60 * 60 * 1000;

export class CoordinatorJobOfferMarket implements JobOfferPort {
    constructor(
        private readonly tasks: TaskBoard,
        private readonly events: EventLogWriter,
        private readonly now: () => string = () => new Date().toISOString(),
        private readonly helperGrants?: HelperGrantPort,
    ) {}

    offers(context: JobOfferContext): Result<readonly JobOffer[], string> {
        const [activeTaskCount, countError] = this.tasks.activeTaskCount(context.botId);
        if (countError) return [null, CoordinatorJobOfferMarket.describe(countError)];
        if (activeTaskCount === null) return [null, 'active task count missing'];
        if (activeTaskCount > 0) return [[], null];
        const [tasks, offerError] = this.tasks.offers({
            botId: context.botId,
            botRole: context.role,
            botPosition: context.position,
            inventory: context.inventory,
            activeTaskCount,
        });
        if (offerError) return [null, CoordinatorJobOfferMarket.describe(offerError)];
        if (tasks === null) return [null, 'job offers missing'];
        return [tasks.map((task) => this.offer(task, context)), null];
    }

    accept(context: JobOfferContext, taskId: string): Result<JobAssignment, string> {
        const [activeTaskCount, countError] = this.tasks.activeTaskCount(context.botId);
        if (countError) return [null, CoordinatorJobOfferMarket.describe(countError)];
        if (activeTaskCount === null) return [null, 'active task count missing'];
        const [lease, claimError] = this.tasks.claimOffered(taskId, {
            botId: context.botId,
            botRole: context.role,
            botPosition: context.position,
            inventory: context.inventory,
            activeTaskCount,
        });
        if (claimError) return [null, CoordinatorJobOfferMarket.describe(claimError)];
        if (lease === null) return [null, `job ${taskId} is no longer available`];
        const now = this.now();
        const [payload, grantError] = this.acceptPayload(context, lease, now);
        if (grantError !== null) {
            this.tasks.requeue(taskId, context.botId, grantError, now);
            return [null, grantError];
        }
        if (payload === null) return [null, 'accepted task payload missing'];
        const offer = this.offer(lease.task, context);
        this.append(context.botId, 'job.accepted', taskId, `accepted ${lease.task.title}`);
        return [
            {
                offer,
                task: {
                    id: lease.task.id,
                    title: lease.task.title,
                    priority: lease.task.priority,
                    payload,
                    target: lease.task.target,
                    requiredRole: lease.task.requiredRole,
                    ...CoordinatorJobOfferMarket.taskMetadata(lease.task),
                },
                fencingToken: lease.fencingToken,
                leaseUntil: lease.leaseUntil,
            },
            null,
        ];
    }

    private acceptPayload(
        context: JobOfferContext,
        lease: { task: TaskRecord; fencingToken: number },
        now: string,
    ): Result<Readonly<Record<string, unknown>>, string> {
        const task = lease.task;
        const ownerBotId = CoordinatorJobOfferMarket.readString(task.payload.ownerBotId);
        if (
            this.helperGrants === undefined ||
            ownerBotId === null ||
            ownerBotId === context.botId ||
            task.payload.visibleTo !== 'helpers'
        ) {
            return [task.payload, null];
        }
        const structureId = CoordinatorJobOfferMarket.readString(task.payload.structureId);
        const workPackageId = CoordinatorJobOfferMarket.readString(task.payload.workPackageId);
        const claimId = CoordinatorJobOfferMarket.readString(task.payload.claimId);
        const blueprintRevision = CoordinatorJobOfferMarket.readNumber(
            task.payload.blueprintRevision,
        );
        const bbox = CoordinatorJobOfferMarket.readBbox(task.payload.bbox);
        if (
            structureId === null ||
            workPackageId === null ||
            claimId === null ||
            blueprintRevision === null ||
            bbox === null
        ) {
            return [null, 'helper project task metadata is incomplete'];
        }
        const [grant, grantError] = this.helperGrants.request(
            {
                id: `grant.${task.id}.${lease.fencingToken}`,
                structureId,
                requesterBotId: context.botId,
                observedDesignRevision: blueprintRevision,
                intent: `execute construction package ${workPackageId}`,
                proposedOps: ['place', 'break'],
                bbox,
                taskId: task.id,
                allowClaimIds: [claimId],
                ttlMilliseconds: HELPER_GRANT_TTL_MILLISECONDS,
            },
            now,
        );
        if (grantError) return [null, CoordinatorJobOfferMarket.describe(grantError)];
        if (grant === null) return [null, 'helper grant returned null'];
        const payload = {
            ...task.payload,
            grantId: grant.id,
            grant: {
                id: grant.id,
                expiresAt: grant.expiresAt,
                fencingToken: grant.fencingToken,
            },
        };
        const [updated, updateError] = this.tasks.withPayload(task.id, payload, context.botId, now);
        if (updateError) return [null, CoordinatorJobOfferMarket.describe(updateError)];
        if (updated === null) return [null, 'helper task payload update returned null'];
        return [updated.payload, null];
    }

    decide(
        context: JobOfferContext,
        taskId: string,
        decision: JobDecision,
        reason: string,
    ): Result<void, string> {
        const normalized = reason.trim().length === 0 ? `${decision} without reason` : reason;
        this.append(context.botId, `job.${decision}`, taskId, normalized);
        return [undefined, null];
    }

    private offer(task: TaskRecord, context: JobOfferContext): JobOffer {
        const skillId = task.payload.skillId;
        return {
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            skillId: typeof skillId === 'string' && skillId.length > 0 ? skillId : null,
            target: task.target,
            requiredRole: task.requiredRole,
            distance: CoordinatorJobOfferMarket.distance(task.target, context.position),
            ...CoordinatorJobOfferMarket.taskMetadata(task),
        };
    }

    private static taskMetadata(task: TaskRecord): {
        projectId?: string;
        structureId?: string;
    } {
        const projectId = CoordinatorJobOfferMarket.readString(task.payload.projectId);
        const structureId = CoordinatorJobOfferMarket.readString(task.payload.structureId);
        return {
            ...(projectId === null ? {} : { projectId }),
            ...(structureId === null ? {} : { structureId }),
        };
    }

    private static readString(value: unknown): string | null {
        return typeof value === 'string' && value.length > 0 ? value : null;
    }

    private static readNumber(value: unknown): number | null {
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    private static readBbox(value: unknown): {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    } | null {
        if (typeof value !== 'object' || value === null) return null;
        const bbox = value as {
            min?: { x?: unknown; y?: unknown; z?: unknown };
            max?: { x?: unknown; y?: unknown; z?: unknown };
        };
        if (!CoordinatorJobOfferMarket.isPosition(bbox.min)) return null;
        if (!CoordinatorJobOfferMarket.isPosition(bbox.max)) return null;
        return bbox as {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
    }

    private static isPosition(
        value:
            | {
                  x?: unknown;
                  y?: unknown;
                  z?: unknown;
              }
            | undefined,
    ): boolean {
        if (value === undefined) return false;
        return (
            typeof value.x === 'number' &&
            typeof value.y === 'number' &&
            typeof value.z === 'number'
        );
    }

    private append(botId: string, type: string, taskId: string, reason: string): void {
        this.events.append({
            botId,
            type,
            payload: { taskId, reason },
            actor: botId,
            createdAt: this.now(),
        });
    }

    private static distance(
        target: TaskRecord['target'],
        position: JobOfferContext['position'],
    ): number | null {
        if (target === null || position === null) return null;
        return Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z);
    }

    private static describe(failure: unknown): string {
        if (typeof failure === 'string') return failure;
        if (typeof failure === 'object' && failure !== null && 'type' in failure) {
            const typed = failure as { type: string; taskId?: string; message?: string };
            if (typed.message !== undefined) return `${typed.type}: ${typed.message}`;
            if (typed.taskId !== undefined) return `${typed.type}: ${typed.taskId}`;
            return typed.type;
        }
        return String(failure);
    }
}
