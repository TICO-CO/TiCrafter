import type { ActionDispatchPort, ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import type { ActionVetoGate, SafetySnapshot } from '@ticrafter/safety';

import { type BlockChange, BlockVerifier } from './block-verifier.js';
import type { BuildingFailure } from './failures.js';
import type { RollbackJournal } from './rollback-journal.js';
import type { WorldBlockState } from './schematic-diff.js';

export interface BuildingClock {
    now(): number;
}

export interface BlockExecutorOptions {
    rateLimitMilliseconds?: number;
    clock?: BuildingClock;
}

export interface PreparedBlockExecution {
    change: BlockChange;
    action: ActionRequest;
    before: WorldBlockState | null;
}

export interface BlockExecution extends PreparedBlockExecution {
    handleId: string;
}

export interface BlockPrepareResult {
    status: 'ready' | 'skipped';
    execution: PreparedBlockExecution | null;
}

export interface BlockBeginResult {
    status: 'dispatched' | 'skipped';
    execution: BlockExecution | null;
}

export interface BlockCompletion {
    status: 'completed' | 'failed';
    change: BlockChange;
    before: WorldBlockState | null;
    after: WorldBlockState | null;
}

const DEFAULT_RATE_LIMIT_MILLISECONDS = 100;

export class BlockExecutor {
    private readonly clock: BuildingClock;
    private readonly rateLimitMilliseconds: number;
    private lastDispatchAt = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly verifier: BlockVerifier,
        private readonly dispatcher: ActionDispatchPort,
        private readonly safety: Pick<ActionVetoGate, 'evaluate'>,
        private readonly journal: RollbackJournal,
        options: BlockExecutorOptions = {},
    ) {
        this.clock = options.clock ?? { now: () => Date.now() };
        this.rateLimitMilliseconds =
            options.rateLimitMilliseconds ?? DEFAULT_RATE_LIMIT_MILLISECONDS;
    }

    prepare(
        change: BlockChange,
        snapshot: SafetySnapshot,
    ): Result<BlockPrepareResult, BuildingFailure> {
        const [verification, verificationError] = this.verifier.verifyBefore(change);
        if (verificationError) return [null, verificationError];
        if (verification === null) {
            return [null, { type: 'VERIFICATION_FAILED', message: 'no verification result' }];
        }
        if (verification.satisfied) {
            return [{ status: 'skipped', execution: null }, null];
        }
        const now = this.clock.now();
        if (now - this.lastDispatchAt < this.rateLimitMilliseconds) {
            return [null, { type: 'RATE_LIMITED', message: 'block executor rate limit exceeded' }];
        }
        const action = this.actionFor(change, verification.actual);
        const decision = this.safety.evaluate(snapshot, action);
        if (!decision.allowed) return [null, { type: 'SAFETY_VETO', reason: decision.reason }];
        const [entry, journalError] = this.journal.record(change, verification.actual);
        if (journalError) return [null, journalError];
        if (entry === null) {
            return [null, { type: 'JOURNAL_FAILED', message: 'journal returned no entry' }];
        }
        this.lastDispatchAt = now;
        return [
            {
                status: 'ready',
                execution: { change, action, before: verification.actual },
            },
            null,
        ];
    }

    begin(
        change: BlockChange,
        snapshot: SafetySnapshot,
    ): Result<BlockBeginResult, BuildingFailure> {
        const [prepared, prepareError] = this.prepare(change, snapshot);
        if (prepareError) return [null, prepareError];
        if (prepared === null) {
            return [null, { type: 'ACTION_REJECTED', message: 'prepare returned no result' }];
        }
        if (prepared.status === 'skipped' || prepared.execution === null) {
            return [{ status: 'skipped', execution: null }, null];
        }
        const [handleId, dispatchError] = this.dispatcher.dispatch(prepared.execution.action);
        if (dispatchError) return [null, { type: 'ACTION_REJECTED', message: dispatchError }];
        if (handleId === null) {
            return [null, { type: 'ACTION_REJECTED', message: 'action handle is missing' }];
        }
        return [
            {
                status: 'dispatched',
                execution: { ...prepared.execution, handleId },
            },
            null,
        ];
    }

    complete(
        execution: PreparedBlockExecution,
        outcome: ActionOutcome,
    ): Result<BlockCompletion, BuildingFailure> {
        if (outcome.status !== 'completed') {
            return [
                null,
                {
                    type: 'ACTION_FAILED',
                    message: outcome.message ?? `block action ${outcome.status}`,
                },
            ];
        }
        const [verification, verificationError] = this.verifier.verifyAfter(execution.change);
        if (verificationError) return [null, verificationError];
        if (verification === null) {
            return [null, { type: 'VERIFICATION_FAILED', message: 'no verification result' }];
        }
        if (!verification.satisfied) {
            return [
                null,
                {
                    type: 'VERIFICATION_FAILED',
                    message: `block did not match after ${execution.change.kind}`,
                },
            ];
        }
        return [
            {
                status: 'completed',
                change: execution.change,
                before: execution.before,
                after: verification.actual,
            },
            null,
        ];
    }

    rollback(
        execution: PreparedBlockExecution,
        snapshot: SafetySnapshot,
    ): Result<string, BuildingFailure> {
        const action = this.rollbackAction(execution);
        const decision = this.safety.evaluate(snapshot, action);
        if (!decision.allowed) return [null, { type: 'SAFETY_VETO', reason: decision.reason }];
        const [handleId, dispatchError] = this.dispatcher.dispatch(action);
        if (dispatchError) return [null, { type: 'ACTION_REJECTED', message: dispatchError }];
        if (handleId === null) {
            return [null, { type: 'ACTION_REJECTED', message: 'rollback handle is missing' }];
        }
        return [handleId, null];
    }

    private actionFor(change: BlockChange, before: WorldBlockState | null): ActionRequest {
        const position = this.position(change);
        if (change.kind === 'break') {
            const expectedBlockId = before?.name ?? change.target.state.name;
            return { kind: 'break-block', position, expectedBlockId };
        }
        return {
            kind: 'place-block',
            position,
            itemName: change.target.state.name,
            expectedBlockId: change.target.state.name,
            ...(change.target.state.properties === undefined
                ? {}
                : { properties: change.target.state.properties }),
        };
    }

    private rollbackAction(execution: PreparedBlockExecution): ActionRequest {
        const position = this.position(execution.change);
        if (execution.before === null) {
            return {
                kind: 'break-block',
                position,
                expectedBlockId: execution.change.target.state.name,
            };
        }
        return {
            kind: 'place-block',
            position,
            itemName: execution.before.name,
            expectedBlockId: execution.before.name,
            ...(execution.before.properties === undefined
                ? {}
                : { properties: execution.before.properties }),
        };
    }

    private position(change: BlockChange): { x: number; y: number; z: number } {
        return { x: change.target.x, y: change.target.y, z: change.target.z };
    }
}
