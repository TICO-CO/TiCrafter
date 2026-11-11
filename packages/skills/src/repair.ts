import type { ActionRequest, Result, Vec3 } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillBuildTarget,
    SkillCheckpoint,
    SkillContext,
    SkillGrant,
    SkillInput,
    SkillRepairDiff,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

type RepairOperation =
    | { kind: 'break-block'; position: Vec3 }
    | { kind: 'place-block'; position: Vec3; target: SkillBuildTarget };

interface RepairState {
    operations: RepairOperation[];
    cursor: number;
    activeKey: string | null;
    applied: string[];
    grant: SkillGrant | null;
}

export class RepairSkill implements Skill {
    readonly id = 'repair';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.blocks !== undefined) return [true, null];
        if (context.services?.repairDiff !== undefined) return [true, null];
        return [false, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.blocks !== undefined) return [input, null];
        if (context.services?.repairDiff !== undefined) return [input, null];
        return [null, 'repair requires blocks or a repair diff source'];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const [diff, diffError] = this.resolveDiff(context, input);
        if (diffError !== null) return [null, diffError];
        if (diff === null) {
            return [this.unsupported('repair requires a diff or a block scan source'), null];
        }
        const placements = Blueprint.sortSupportFirst(
            [...diff.missing, ...diff.mismatched],
            context.position,
        );
        const operations: RepairOperation[] = [
            ...diff.extra.map((position) => ({ kind: 'break-block' as const, position })),
            ...placements.map((target) => ({
                kind: 'place-block' as const,
                position: target.position,
                target,
            })),
        ];
        const run: SkillRun = {
            skillId: this.id,
            state: {
                operations,
                cursor: 0,
                activeKey: null,
                applied: [],
                grant: input.grant ?? null,
            },
        };
        if (diff.extra.length > 0) {
            const grantError = this.validateGrant(context, input.grant ?? null);
            if (grantError !== null) {
                return [SkillSharedUtilities.failed(run, 'unsafe', grantError), null];
            }
        }
        const missing = Blueprint.missingMaterials(context.inventory, placements);
        if (missing.length > 0) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'missing-item',
                    `missing repair materials: ${missing.join(', ')}`,
                ),
                null,
            ];
        }
        return [this.advance(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const state = this.readState(run);
        if (state === null) {
            return [
                SkillSharedUtilities.failed(run, 'execution-failed', 'repair state is invalid'),
                null,
            ];
        }
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'repair operation failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'cancelled') {
            return [SkillSharedUtilities.cancelled(run, 'repair was cancelled'), null];
        }
        if (context.lastAction?.status === 'completed' && state.activeKey !== null) {
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
            return [this.advance(nextRun), null];
        }
        if (state.activeKey !== null) {
            const operation = state.operations.find(
                (candidate) => this.operationKey(candidate) === state.activeKey,
            );
            if (operation === undefined) {
                return [
                    SkillSharedUtilities.failed(
                        run,
                        'execution-failed',
                        'repair operation is missing',
                    ),
                    null,
                ];
            }
            return [
                SkillSharedUtilities.running(
                    run,
                    this.actionFor(operation),
                    state.applied.length,
                    state.operations.length,
                    this.labelFor(operation),
                ),
                null,
            ];
        }
        return [this.advance(run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        const run: SkillRun = { skillId: this.id, state: checkpoint.state };
        const state = this.readState(run);
        if (state === null) return [null, 'checkpoint has an invalid repair state'];
        const remainingBreaks = state.operations
            .slice(state.cursor)
            .some((operation) => operation.kind === 'break-block');
        if (remainingBreaks) {
            const grantError = this.validateGrant(context, state.grant);
            if (grantError !== null) return [null, grantError];
        }
        return [run, null];
    }

    private resolveDiff(
        context: SkillContext,
        input: SkillInput,
    ): Result<SkillRepairDiff | null, string> {
        const source = context.services?.repairDiff;
        if (source !== undefined) return source.diff(input);
        if (input.blocks === undefined) return [null, null];
        return this.computeDiff(context, input);
    }

    private computeDiff(context: SkillContext, input: SkillInput): Result<SkillRepairDiff, string> {
        const missing: SkillBuildTarget[] = [];
        const mismatched: SkillBuildTarget[] = [];
        for (const target of input.blocks ?? []) {
            const blockName = Blueprint.blockNameAt(context.world, target.position);
            if (Blueprint.isAir(blockName)) {
                missing.push(target);
                continue;
            }
            if (blockName !== Blueprint.expectedBlockName(target)) mismatched.push(target);
        }
        return [{ missing, extra: this.scanExtras(context, input), mismatched }, null];
    }

    private scanExtras(context: SkillContext, input: SkillInput): Vec3[] {
        if (input.bbox === undefined) return [];
        const blocksInBox = context.world.blocksInBox;
        if (blocksInBox === undefined) return [];
        const expected = new Set(
            (input.blocks ?? []).map((target) => Blueprint.targetKey(target.position)),
        );
        return blocksInBox(input.bbox)
            .filter(
                (block) =>
                    !Blueprint.isAir(block.name) &&
                    !expected.has(Blueprint.targetKey(block.position)),
            )
            .map((block) => block.position);
    }

    private validateGrant(context: SkillContext, grant: SkillGrant | null): string | null {
        if (grant === null) return 'repair grant is required to remove extra blocks';
        const grants = context.services?.grants;
        if (grants === undefined) return 'repair grant service is unavailable';
        const [valid, validationError] = grants.validate(grant, context.botId);
        if (validationError !== null) return validationError;
        if (valid !== true) return 'repair grant is not valid';
        return null;
    }

    private advance(run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(run, 'execution-failed', 'repair state is invalid');
        }
        if (state.cursor >= state.operations.length) {
            return SkillSharedUtilities.completed(
                { skillId: this.id, state: { ...run.state, activeKey: null } },
                `applied ${state.applied.length} repair operations`,
            );
        }
        const operation = state.operations[state.cursor];
        if (operation === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'repair operation is missing',
            );
        }
        const activeKey = this.operationKey(operation);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, activeKey },
        };
        return SkillSharedUtilities.running(
            nextRun,
            this.actionFor(operation),
            state.applied.length,
            state.operations.length,
            this.labelFor(operation),
        );
    }

    private actionFor(operation: RepairOperation): ActionRequest {
        if (operation.kind === 'break-block') {
            return { kind: 'break-block', position: operation.position };
        }
        return Blueprint.placementAction(operation.target);
    }

    private labelFor(operation: RepairOperation): string {
        if (operation.kind === 'break-block') return 'removing extra block';
        return `replacing ${operation.target.itemName}`;
    }

    private operationKey(operation: RepairOperation): string {
        return `${operation.kind}:${Blueprint.targetKey(operation.position)}`;
    }

    private readState(run: SkillRun): RepairState | null {
        const operations = this.readOperations(run.state.operations);
        const applied = Blueprint.readKeys(run.state.applied);
        const grantResult = this.readGrant(run.state.grant);
        if (operations === null || applied === null || grantResult === null) return null;
        const cursor = run.state.cursor;
        if (typeof cursor !== 'number' || !Number.isInteger(cursor)) return null;
        if (cursor < 0 || cursor > operations.length) return null;
        const activeValue = run.state.activeKey;
        let activeKey: string | null = null;
        if (activeValue !== null && activeValue !== undefined) {
            activeKey = SkillSharedUtilities.readString(activeValue);
            if (activeKey === null) return null;
        }
        return { operations, cursor, activeKey, applied, grant: grantResult.grant };
    }

    private readOperations(value: unknown): RepairOperation[] | null {
        if (!Array.isArray(value)) return null;
        const operations: RepairOperation[] = [];
        for (const entry of value) {
            if (!SkillSharedUtilities.isRecord(entry)) return null;
            const kind = SkillSharedUtilities.readString(entry.kind);
            const position = SkillSharedUtilities.readVec3(entry.position);
            if (position === null) return null;
            if (kind === 'break-block') {
                operations.push({ kind, position });
                continue;
            }
            if (kind !== 'place-block') return null;
            const targets = Blueprint.readTargets([entry.target]);
            const target = targets?.[0];
            if (target === undefined) return null;
            operations.push({ kind, position, target });
        }
        return operations;
    }

    private readGrant(value: unknown): { grant: SkillGrant | null } | null {
        if (value === null || value === undefined) return { grant: null };
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const id = SkillSharedUtilities.readString(value.id);
        if (id === null) return null;
        const expiresAt = SkillSharedUtilities.readString(value.expiresAt) ?? undefined;
        return {
            grant: {
                id,
                ...(expiresAt === undefined ? {} : { expiresAt }),
            },
        };
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }
}
