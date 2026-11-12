import type { ActionOutcome, Result, Vec3 } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillBuildTarget,
    SkillCheckpoint,
    SkillConstructionOperation,
    SkillConstructionPhase,
    SkillConstructionPlan,
    SkillContext,
    SkillGrant,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

interface ConstructionState {
    blueprintId: string;
    blueprintRevision: number;
    planId: string;
    planRevision: number;
    workPackageId: string;
    phase: SkillConstructionPhase | null;
    operations: SkillConstructionOperation[];
    scaffoldPositions: Vec3[];
    cursor: number;
    activeKey: string | null;
    applied: string[];
    skipped: string[];
    grant: SkillGrant | null;
}

export class ConstructionSkill implements Skill {
    readonly id = 'construction';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.services?.construction === undefined) return [false, null];
        if (context.services.buildExecution === undefined) return [false, null];
        if (input.planId === undefined) return [false, null];
        if (input.planRevision === undefined) return [false, null];
        if (input.workPackageId === undefined) return [false, null];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (context.services?.construction === undefined) {
            return [null, 'construction requires a construction source'];
        }
        if (context.services.buildExecution === undefined) {
            return [null, 'construction requires a build execution service'];
        }
        if (input.planId === undefined) {
            return [null, 'construction requires a plan id'];
        }
        if (input.planRevision === undefined) {
            return [null, 'construction requires a plan revision'];
        }
        if (input.workPackageId === undefined) {
            return [null, 'construction requires a work package id'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const planResult = this.resolvePlan(context, input);
        if (planResult[1] !== null) return [null, planResult[1]];
        const plan = planResult[0];
        if (plan === null) return [null, 'construction plan returned null'];
        const missing = Blueprint.missingMaterials(
            context.inventory,
            plan.operations
                .filter((operation) => operation.kind === 'place')
                .map((operation) => operation.target),
        );
        if (missing.length > 0) {
            return [
                SkillSharedUtilities.failed(
                    { skillId: this.id, state: {} },
                    'missing-item',
                    `missing build materials: ${missing.join(', ')}`,
                ),
                null,
            ];
        }
        const run: SkillRun = {
            skillId: this.id,
            state: this.stateFor(plan, input.grant ?? null),
        };
        return [this.advance(context, run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const state = this.readState(run);
        if (state === null) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'construction state is invalid',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'construction action failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'cancelled') {
            return [SkillSharedUtilities.cancelled(run, 'construction action was cancelled'), null];
        }
        if (context.lastAction?.status !== 'completed' || state.activeKey === null) {
            return [this.advance(context, run), null];
        }
        const operation = this.operationFor(state, state.activeKey);
        if (operation === null) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'construction operation is missing',
                ),
                null,
            ];
        }
        const [completed, completeError] = this.completeOperation(
            context,
            state.grant === null ? operation : { ...operation, grant: state.grant },
            context.lastAction,
        );
        if (completeError !== null) {
            return [
                SkillSharedUtilities.failed(run, this.failureClass(completeError), completeError),
                null,
            ];
        }
        if (completed === null) {
            return [
                SkillSharedUtilities.failed(run, 'execution-failed', 'completion missing'),
                null,
            ];
        }
        const applied = state.applied.includes(state.activeKey)
            ? state.applied
            : [...state.applied, state.activeKey];
        const nextRun: SkillRun = {
            skillId: this.id,
            state: {
                ...run.state,
                cursor: state.cursor + 1,
                activeKey: null,
                applied,
            },
        };
        return [this.advance(context, nextRun), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        const state = this.readState(run);
        if (state === null) return [null, 'construction checkpoint state is invalid'];
        return [
            {
                botId: context.botId,
                taskId: context.taskId ?? 'default',
                skillId: this.id,
                state: {
                    blueprintId: state.blueprintId,
                    blueprintRevision: state.blueprintRevision,
                    planId: state.planId,
                    planRevision: state.planRevision,
                    workPackageId: state.workPackageId,
                    grant: state.grant,
                },
                updatedAt: context.at,
            },
            null,
        ];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        const blueprintId = SkillSharedUtilities.readString(checkpoint.state.blueprintId);
        const blueprintRevision = checkpoint.state.blueprintRevision;
        const planId = SkillSharedUtilities.readString(checkpoint.state.planId);
        const planRevision = checkpoint.state.planRevision;
        const workPackageId = SkillSharedUtilities.readString(checkpoint.state.workPackageId);
        if (
            blueprintId === null ||
            typeof blueprintRevision !== 'number' ||
            planId === null ||
            typeof planRevision !== 'number' ||
            workPackageId === null
        ) {
            return [null, 'construction checkpoint is invalid'];
        }
        const grant = this.readGrant(checkpoint.state.grant);
        if (
            grant === null &&
            checkpoint.state.grant !== null &&
            checkpoint.state.grant !== undefined
        ) {
            return [null, 'construction checkpoint grant is invalid'];
        }
        const input: SkillInput = {
            blueprintId,
            blueprintRevision,
            planId,
            planRevision,
            workPackageId,
            ...(grant === null ? {} : { grant }),
            ...(checkpoint.taskId.length === 0 ? {} : { taskId: checkpoint.taskId }),
        };
        const planResult = this.resolvePlan(context, input);
        if (planResult[1] !== null) return [null, planResult[1]];
        const plan = planResult[0];
        if (plan === null) return [null, 'construction plan returned null'];
        return [{ skillId: this.id, state: this.stateFor(plan, grant) }, null];
    }

    private resolvePlan(
        context: SkillContext,
        input: SkillInput,
    ): Result<SkillConstructionPlan | null, string> {
        const source = context.services?.construction;
        if (source === undefined) return [null, 'construction source is unavailable'];
        return source.resolve(context, input);
    }

    private completeOperation(
        context: SkillContext,
        operation: SkillConstructionOperation,
        outcome: ActionOutcome,
    ): Result<void, string> {
        const execution = context.services?.buildExecution;
        if (execution === undefined) return [null, 'build execution service is unavailable'];
        return execution.complete(context, operation, outcome);
    }

    private advance(context: SkillContext, run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'construction state is invalid',
            );
        }
        let cursor = state.cursor;
        const skipped = [...state.skipped];
        while (cursor < state.operations.length) {
            const operation = state.operations[cursor];
            if (operation === undefined) break;
            const key = this.operationKey(operation);
            const execution = context.services?.buildExecution;
            if (execution === undefined) {
                return SkillSharedUtilities.failed(
                    run,
                    'unsupported',
                    'build execution service is unavailable',
                );
            }
            const [preparation, prepareError] = execution.prepare(
                context,
                state.grant === null ? operation : { ...operation, grant: state.grant },
            );
            if (prepareError !== null) {
                return SkillSharedUtilities.failed(
                    run,
                    this.failureClass(prepareError),
                    prepareError,
                );
            }
            if (preparation === null) {
                return SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'build preparation returned null',
                );
            }
            if (preparation.status === 'skipped') {
                if (!skipped.includes(key)) skipped.push(key);
                cursor += 1;
                continue;
            }
            if (preparation.action === null) {
                return SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'build preparation has no action',
                );
            }
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, cursor, activeKey: key, skipped },
            };
            return SkillSharedUtilities.running(
                nextRun,
                preparation.action,
                state.applied.length,
                state.operations.length,
                this.labelFor(operation),
            );
        }
        return SkillSharedUtilities.completed(
            { skillId: this.id, state: { ...run.state, cursor, skipped, activeKey: null } },
            `completed ${state.applied.length} construction operations`,
        );
    }

    private stateFor(
        plan: SkillConstructionPlan,
        grant: SkillGrant | null,
    ): Record<string, unknown> {
        return {
            blueprintId: plan.blueprintId,
            blueprintRevision: plan.blueprintRevision,
            planId: plan.planId,
            planRevision: plan.planRevision,
            workPackageId: plan.workPackageId,
            phase: plan.phase,
            operations: plan.operations,
            scaffoldPositions: plan.scaffoldPositions,
            cursor: 0,
            activeKey: null,
            applied: [],
            skipped: [],
            grant,
        };
    }

    private readState(run: SkillRun): ConstructionState | null {
        const blueprintId = SkillSharedUtilities.readString(run.state.blueprintId);
        const blueprintRevision = run.state.blueprintRevision;
        const planId = SkillSharedUtilities.readString(run.state.planId);
        const planRevision = run.state.planRevision;
        const workPackageId = SkillSharedUtilities.readString(run.state.workPackageId);
        const operations = this.readOperations(run.state.operations);
        const scaffoldPositions = this.readPositions(run.state.scaffoldPositions);
        const applied = Blueprint.readKeys(run.state.applied);
        const skipped = Blueprint.readKeys(run.state.skipped);
        const grant = this.readGrant(run.state.grant);
        const cursor = run.state.cursor;
        if (
            blueprintId === null ||
            typeof blueprintRevision !== 'number' ||
            planId === null ||
            typeof planRevision !== 'number' ||
            workPackageId === null ||
            operations === null ||
            scaffoldPositions === null ||
            applied === null ||
            skipped === null
        ) {
            return null;
        }
        if (typeof cursor !== 'number' || !Number.isInteger(cursor)) return null;
        if (cursor < 0 || cursor > operations.length) return null;
        const activeValue = run.state.activeKey;
        let activeKey: string | null = null;
        if (activeValue !== null && activeValue !== undefined) {
            activeKey = SkillSharedUtilities.readString(activeValue);
            if (activeKey === null) return null;
        }
        const phase = this.readPhase(run.state.phase);
        if (phase === undefined) return null;
        return {
            blueprintId,
            blueprintRevision,
            planId,
            planRevision,
            workPackageId,
            phase,
            operations,
            scaffoldPositions,
            cursor,
            activeKey,
            applied,
            skipped,
            grant,
        };
    }

    private readOperations(value: unknown): SkillConstructionOperation[] | null {
        if (!Array.isArray(value)) return null;
        const operations: SkillConstructionOperation[] = [];
        for (const entry of value) {
            if (!SkillSharedUtilities.isRecord(entry)) return null;
            const kind = SkillSharedUtilities.readString(entry.kind);
            const targets = Blueprint.readTargets([entry.target]);
            const target = targets?.[0];
            if (kind === null || target === undefined) return null;
            if (kind !== 'place' && kind !== 'break') return null;
            const phase = this.readPhase(entry.phase);
            if (phase === undefined) return null;
            const claimId = SkillSharedUtilities.readString(entry.claimId) ?? undefined;
            const grantId = SkillSharedUtilities.readString(entry.grantId) ?? undefined;
            const grant = this.readGrant(entry.grant);
            if (entry.grant !== null && entry.grant !== undefined && grant === null) return null;
            const structureId = SkillSharedUtilities.readString(entry.structureId) ?? undefined;
            const blueprintId = SkillSharedUtilities.readString(entry.blueprintId) ?? undefined;
            const planId = SkillSharedUtilities.readString(entry.planId) ?? undefined;
            const planRevision =
                typeof entry.planRevision === 'number' ? entry.planRevision : undefined;
            const grantFencingToken =
                typeof entry.grantFencingToken === 'number' ? entry.grantFencingToken : undefined;
            const workPackageId = SkillSharedUtilities.readString(entry.workPackageId) ?? undefined;
            const blueprintRevision =
                typeof entry.blueprintRevision === 'number' ? entry.blueprintRevision : undefined;
            const fencingToken =
                typeof entry.fencingToken === 'number' ? entry.fencingToken : undefined;
            operations.push({
                kind,
                target,
                ...(phase === null ? {} : { phase }),
                ...(claimId === undefined ? {} : { claimId }),
                ...(grantId === undefined ? {} : { grantId }),
                ...(grant === null ? {} : { grant }),
                ...(structureId === undefined ? {} : { structureId }),
                ...(blueprintId === undefined ? {} : { blueprintId }),
                ...(planId === undefined ? {} : { planId }),
                ...(planRevision === undefined ? {} : { planRevision }),
                ...(workPackageId === undefined ? {} : { workPackageId }),
                ...(grantFencingToken === undefined ? {} : { grantFencingToken }),
                ...(blueprintRevision === undefined ? {} : { blueprintRevision }),
                ...(fencingToken === undefined ? {} : { fencingToken }),
            });
        }
        return operations;
    }

    private readPositions(value: unknown): Vec3[] | null {
        if (!Array.isArray(value)) return null;
        const positions: Vec3[] = [];
        for (const entry of value) {
            const position = SkillSharedUtilities.readVec3(entry);
            if (position === null) return null;
            positions.push(position);
        }
        return positions;
    }

    private readPhase(value: unknown): SkillConstructionPhase | null | undefined {
        if (value === null || value === undefined) return null;
        const phase = SkillSharedUtilities.readString(value);
        if (phase === null) return undefined;
        switch (phase) {
            case 'site-clear':
            case 'foundation':
            case 'scaffold':
            case 'walls':
            case 'floors':
            case 'roof':
            case 'openings':
            case 'access':
            case 'interior':
            case 'decoration':
            case 'scaffold-removal':
            case 'cleanup':
                return phase;
            default:
                return undefined;
        }
    }

    private readGrant(value: unknown): SkillGrant | null {
        if (value === null || value === undefined) return null;
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const id = SkillSharedUtilities.readString(value.id);
        if (id === null) return null;
        const expiresAt = SkillSharedUtilities.readString(value.expiresAt) ?? undefined;
        const fencingToken =
            typeof value.fencingToken === 'number' ? value.fencingToken : undefined;
        return {
            id,
            ...(expiresAt === undefined ? {} : { expiresAt }),
            ...(fencingToken === undefined ? {} : { fencingToken }),
        };
    }

    private operationFor(state: ConstructionState, key: string): SkillConstructionOperation | null {
        return state.operations.find((operation) => this.operationKey(operation) === key) ?? null;
    }

    private operationKey(operation: SkillConstructionOperation): string {
        const target = operation.target.position;
        return `${operation.kind}:${Blueprint.targetKey(target)}`;
    }

    private labelFor(operation: SkillConstructionOperation): string {
        if (operation.kind === 'break') return 'removing block';
        return `placing ${operation.target.itemName}`;
    }

    private failureClass(message: string): 'unsafe' | 'missing-item' | 'execution-failed' {
        const lowercase = message.toLowerCase();
        if (lowercase.includes('safety') || lowercase.includes('grant')) return 'unsafe';
        if (lowercase.includes('claim') || lowercase.includes('fencing')) return 'unsafe';
        if (lowercase.includes('missing item')) return 'missing-item';
        return 'execution-failed';
    }
}
