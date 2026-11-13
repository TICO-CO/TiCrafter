import type { Result } from '@ticrafter/core';
import type { BoundingBox } from '@ticrafter/worldmodel';
import {
    type FarmPermissionDecision,
    FarmPermissionPolicy,
    type PlayerConfidence,
    type PlotOwnership,
    type Region,
} from '@ticrafter/worldmodel';

import { PermissionReplyParser } from '../chat/index.js';
import type { BehaviorTracePort } from '../index.js';

export interface FarmPlotRef {
    id: string;
    bbox: BoundingBox;
}

export interface FarmPermissionOptions {
    policy: FarmPermissionPolicy;
    confidenceThreshold: number;
    grantTtlMilliseconds: number;
    askCooldownMilliseconds: number;
    inquiryTimeoutMilliseconds: number;
    ownership: (plot: FarmPlotRef) => Promise<Result<PlotOwnership, string>>;
    inquiry: (plotId: string, usernames: readonly string[]) => Result<void, string>;
    now?: () => number;
    trace?: BehaviorTracePort;
    allowedRegions?: () => readonly Region[];
    onOutcome?: (playerId: string, plotId: string, kept: boolean, at: string) => void;
}

interface PendingInquiry {
    plot: FarmPlotRef;
    ownership: Extract<PlotOwnership, { kind: 'unknown' }>;
    candidates: readonly PlayerConfidence[];
    createdAt: number;
}

interface Grant {
    expiresAt: number;
    consumed: boolean;
}

export type FarmPermissionVerdict = 'allow' | 'deny' | 'ask';

export class FarmPermissionService {
    private readonly grants = new Map<string, Grant>();
    private readonly askedAt = new Map<string, number>();
    private readonly pending = new Map<string, PendingInquiry>();

    constructor(private readonly options: FarmPermissionOptions) {}

    async authorize(plot: FarmPlotRef): Promise<Result<FarmPermissionVerdict, string>> {
        const now = this.now();
        this.expire(now);
        if (this.isPermitted(plot.id, now)) return ['allow', null];
        const pending = this.pending.get(plot.id);
        if (
            pending !== undefined &&
            now - pending.createdAt <= this.options.inquiryTimeoutMilliseconds
        ) {
            return ['ask', null];
        }
        const [ownership, ownershipError] = await this.options.ownership(plot);
        if (ownershipError) {
            this.options.trace?.record('permission', 'farm-permission', {
                plotId: plot.id,
                decision: 'error',
                reason: ownershipError,
            });
            return [null, ownershipError];
        }
        if (ownership === null) return [null, 'plot ownership missing'];
        const decision = this.decide(ownership, plot.bbox, null);
        this.traceDecision(plot.id, ownership, decision);
        if (decision.decision === 'allow') {
            this.grant(plot.id, now);
            return ['allow', null];
        }
        if (decision.decision === 'deny') return ['deny', null];
        const lastAsked = this.askedAt.get(plot.id);
        if (lastAsked !== undefined && now - lastAsked < this.options.askCooldownMilliseconds) {
            return ['deny', null];
        }
        if (ownership.kind !== 'unknown') return ['deny', null];
        const candidates = ownership.linkedPlayers.filter(
            (player) => player.score >= this.options.confidenceThreshold,
        );
        if (candidates.length === 0) {
            this.traceDecision(plot.id, ownership, {
                decision: 'deny',
                reason:
                    ownership.linkedPlayers.length === 0
                        ? 'no-linked-player'
                        : 'low-player-confidence',
            });
            return ['deny', null];
        }
        const [sent, sendError] = this.options.inquiry(
            plot.id,
            candidates.map((player) => player.username),
        );
        if (sendError) return [null, sendError];
        if (sent === null) return [null, 'permission inquiry returned null'];
        this.askedAt.set(plot.id, now);
        this.pending.set(plot.id, {
            plot,
            ownership,
            candidates,
            createdAt: now,
        });
        return ['ask', null];
    }

    handleReply(playerId: string, message: string, now = this.now()): Result<boolean, string> {
        const reply = PermissionReplyParser.parse(message);
        if (reply === null) return [false, null];
        for (const [plotId, pending] of this.pending) {
            if (now - pending.createdAt > this.options.inquiryTimeoutMilliseconds) {
                this.pending.delete(plotId);
                continue;
            }
            const player = pending.candidates.find((candidate) => candidate.playerId === playerId);
            if (player === undefined) continue;
            const decision = this.decide(pending.ownership, pending.plot.bbox, {
                player,
                affirmative: reply === 'affirmative',
            });
            this.traceDecision(plotId, pending.ownership, decision);
            this.pending.delete(plotId);
            if (decision.decision !== 'allow') return [true, null];
            this.grant(plotId, now);
            this.options.onOutcome?.(player.playerId, plotId, true, new Date(now).toISOString());
            return [true, null];
        }
        return [false, null];
    }

    isPermitted(plotId: string, now = this.now()): boolean {
        const grant = this.grants.get(plotId);
        if (grant === undefined) return false;
        if (now >= grant.expiresAt) {
            this.grants.delete(plotId);
            return false;
        }
        return !grant.consumed;
    }

    consume(plotId: string, now = this.now()): boolean {
        if (!this.isPermitted(plotId, now)) return false;
        const grant = this.grants.get(plotId);
        if (grant === undefined) return false;
        grant.consumed = true;
        this.traceDecision(
            plotId,
            { kind: 'self', ownerId: 'permission-cache' },
            { decision: 'allow', reason: 'grant-consumed' },
        );
        return true;
    }

    expire(now = this.now()): void {
        for (const [plotId, pending] of this.pending) {
            if (now - pending.createdAt > this.options.inquiryTimeoutMilliseconds) {
                this.pending.delete(plotId);
                this.traceDecision(plotId, pending.ownership, {
                    decision: 'deny',
                    reason: 'inquiry-timeout',
                });
            }
        }
        for (const [plotId, grant] of this.grants) {
            if (now >= grant.expiresAt) {
                this.grants.delete(plotId);
                this.traceDecision(
                    plotId,
                    { kind: 'self', ownerId: 'permission-cache' },
                    { decision: 'deny', reason: 'grant-expired' },
                );
            }
        }
    }

    private decide(
        ownership: PlotOwnership,
        plot: BoundingBox,
        reply: { player: PlayerConfidence; affirmative: boolean } | null,
    ): FarmPermissionDecision {
        return this.options.policy.decide({
            ownership,
            plot,
            reply,
            allowedRegions: this.options.allowedRegions?.() ?? [],
            confidenceThreshold: this.options.confidenceThreshold,
        });
    }

    private traceDecision(
        plotId: string,
        ownership: PlotOwnership,
        decision: FarmPermissionDecision,
    ): void {
        this.options.trace?.record('permission', 'farm-permission', {
            plotId,
            ownership: ownership.kind,
            decision: decision.decision,
            reason: decision.reason,
        });
    }

    private grant(plotId: string, now: number): void {
        this.grants.set(plotId, {
            expiresAt: now + this.options.grantTtlMilliseconds,
            consumed: false,
        });
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }
}
