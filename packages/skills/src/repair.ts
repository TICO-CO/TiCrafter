import type { ActionOutcome, Result, Vec3 } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillBuildTarget,
    SkillCheckpoint,
    SkillConstructionOperation,
    SkillContext,
    SkillGrant,
    SkillInput,
    SkillRepairDiff,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

interface RepairState {
    operations: SkillConstructionOperation[];
    cursor: number;
    activeKey: string | null;
    applied: string[];
    skipped: string[];
    grant: SkillGrant | null;
}

export class RepairSkill implements Skill {
    readonly id = 'repair';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.services?.buildExecution === undefined) return [false, null];
        if (input.blocks !== undefined) return [true, null];
        if (context.services?.repairDiff !== undefined) return [true, null];
        return [false, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (context.services?.buildExecution === undefined) {
            return [null, 'repair requires a build execution service'];
        }
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
        if (diff.extra.length > 0) {
            const grantError = this.validateGrant(context, input.grant ?? null);
            if (grantError !== null) {
                return [
                    SkillSharedUtilities.failed(
                        { skillId: this.id, state: {} },
                        'unsafe',
                        grantError,
                    ),
                    null,
                ];
            }
        }
        const operations = this.operations(context, diff, input);
        if (operations === null) {
            return [
                SkillSharedUtilities.failed(
                    { skillId: this.id, state: {} },
                    'target-missing',
                    'repair target block is unavailable',
                ),
                null,
            ];
        }
        const run: SkillRun = {
            skillId: this.id,
            state: {
                operations,
                cursor: 0,
                activeKey: null,
                applied: [],
                skipped: [],
                grant: input.grant ?? null,
            },
        };
        if (operations.some((operation) => operation.kind === 'break')) {
            const grantError = this.validateGrant(context, input.grant ?? null);
            if (grantError !== null) {
                return [SkillSharedUtilities.failed(run, 'unsafe', grantError), null];
            }
        }
        const missing = Blueprint.missingMaterials(
            context.inventory,
            operations
                .filter((operation) => operation.kind === 'place')
                .map((operation) => operation.target),
        );
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
        return [this.advance(context, run), null];
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
        if (context.lastAction?.status !== 'completed' || state.activeKey === null) {
            return [this.advance(context, run), null];
        }
        const operation = this.operationFor(state, state.activeKey);
        if (operation === null) {
            return [
                SkillSharedUtilities.failed(run, 'execution-failed', 'repair operation is missing'),
                null,
            ];
        }
        const execution = context.services?.buildExecution;
        if (execution === undefined) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'unsupported',
                    'build execution service is unavailable',
                ),
                null,
            ];
        }
        const [completed, completeError] = execution.complete(
            context,
            this.withGrant(operation, state.grant),
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
                SkillSharedUtilities.failed(run, 'execution-failed', 'repair completion missing'),
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
        if (state === null) return [null, 'repair checkpoint state is invalid'];
        return [
            {
                botId: context.botId,
                taskId: context.taskId ?? 'default',
                skillId: this.id,
                state: {
                    operations: state.operations,
                    cursor: state.cursor,
                    activeKey: state.activeKey,
                    applied: state.applied,
                    skipped: state.skipped,
                    grant: state.grant,
                },
                updatedAt: context.at,
            },
            null,
        ];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        const run: SkillRun = { skillId: this.id, state: checkpoint.state };
        const state = this.readState(run);
        if (state === null) return [null, 'checkpoint has an invalid repair state'];
        const remainingBreaks = state.operations
            .slice(state.cursor)
            .some((operation) => operation.kind === 'break');
        if (remainingBreaks) {
            const grantError = this.validateGrant(context, state.grant);
            if (grantError !== null) return [null, grantError];
        }
        if (state.operations.some((operation) => operation.kind === 'place')) {
            const missing = Blueprint.missingMaterials(
                context.inventory,
                state.operations
                    .filter((operation) => operation.kind === 'place')
                    .map((operation) => operation.target),
            );
            if (missing.length > 0) {
                return [null, `missing repair materials: ${missing.join(', ')}`];
            }
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

    private operations(
        context: SkillContext,
        diff: SkillRepairDiff,
        input: SkillInput,
    ): SkillConstructionOperation[] | null {
        const extras = diff.extra.flatMap((position) => {
            const actual = context.world.blockStateAt?.(position) ?? {
                name: context.world.blockAt(position) ?? '',
                properties: {},
            };
            if (actual.name.length === 0) return [];
            return [
                this.operation(
                    'break',
                    {
                        position,
                        itemName: actual.name,
                        expectedBlockId: actual.name,
                        ...(Object.keys(actual.properties).length === 0
                            ? {}
                            : { properties: actual.properties }),
                    },
                    input,
                ),
            ];
        });
        if (extras.length !== diff.extra.length) return null;
        const placements = Blueprint.sortSupportFirst(
            [...diff.missing, ...diff.mismatched],
            context.position,
        );
        return [...extras, ...placements.map((target) => this.operation('place', target, input))];
    }

    private operation(
        kind: 'place' | 'break',
        target: SkillBuildTarget,
        input: SkillInput,
    ): SkillConstructionOperation {
        return {
            kind,
            target,
            ...(input.claimId === undefined ? {} : { claimId: input.claimId }),
            ...(input.grant === undefined ? {} : { grantId: input.grant.id, grant: input.grant }),
            ...(input.grant?.fencingToken === undefined
                ? {}
                : { grantFencingToken: input.grant.fencingToken }),
            ...(input.structureId === undefined ? {} : { structureId: input.structureId }),
            ...(input.blueprintId === undefined ? {} : { blueprintId: input.blueprintId }),
            ...(input.blueprintRevision === undefined
                ? {}
                : { blueprintRevision: input.blueprintRevision }),
            ...(input.planId === undefined ? {} : { planId: input.planId }),
            ...(input.fencingToken === undefined ? {} : { fencingToken: input.fencingToken }),
        };
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

    private advance(context: SkillContext, run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(run, 'execution-failed', 'repair state is invalid');
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
                this.withGrant(operation, state.grant),
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
                    'repair preparation returned null',
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
                    'repair preparation has no action',
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
            state.operations.length === 0
                ? 'repair found no changes'
                : `completed ${state.applied.length} repair operations`,
        );
    }

    private withGrant(
        operation: SkillConstructionOperation,
        grant: SkillGrant | null,
    ): SkillConstructionOperation {
        if (grant === null) return operation;
        const fencingToken = grant.fencingToken ?? operation.grantFencingToken;
        return {
            ...operation,
            grantId: grant.id,
            grant,
            ...(fencingToken === undefined ? {} : { grantFencingToken: fencingToken }),
        };
    }

    private operationFor(state: RepairState, key: string): SkillConstructionOperation | null {
        return state.operations.find((operation) => this.operationKey(operation) === key) ?? null;
    }

    private operationKey(operation: SkillConstructionOperation): string {
        return `${operation.kind}:${Blueprint.targetKey(operation.target.position)}`;
    }

    private labelFor(operation: SkillConstructionOperation): string {
        if (operation.kind === 'break') return 'removing extra block';
        return `replacing ${operation.target.itemName}`;
    }

    private failureClass(message: string): 'unsafe' | 'missing-item' | 'execution-failed' {
        const lowercase = message.toLowerCase();
        if (lowercase.includes('safety') || lowercase.includes('grant')) return 'unsafe';
        if (lowercase.includes('claim') || lowercase.includes('fencing')) return 'unsafe';
        if (lowercase.includes('missing item')) return 'missing-item';
        return 'execution-failed';
    }

    private readState(run: SkillRun): RepairState | null {
        const operations = this.readOperations(run.state.operations);
        const applied = Blueprint.readKeys(run.state.applied);
        const skipped = Blueprint.readKeys(run.state.skipped);
        const grantResult = this.readGrant(run.state.grant);
        if (operations === null || applied === null || skipped === null || grantResult === null) {
            return null;
        }
        const cursor = run.state.cursor;
        if (typeof cursor !== 'number' || !Number.isInteger(cursor)) return null;
        if (cursor < 0 || cursor > operations.length) return null;
        const activeValue = run.state.activeKey;
        let activeKey: string | null = null;
        if (activeValue !== null && activeValue !== undefined) {
            activeKey = SkillSharedUtilities.readString(activeValue);
            if (activeKey === null) return null;
        }
        return { operations, cursor, activeKey, applied, skipped, grant: grantResult.grant };
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
            const claimId = SkillSharedUtilities.readString(entry.claimId) ?? undefined;
            const grantResult = this.readGrant(entry.grant);
            if (grantResult === null) return null;
            const grant = grantResult.grant;
            const grantId = SkillSharedUtilities.readString(entry.grantId) ?? undefined;
            const structureId = SkillSharedUtilities.readString(entry.structureId) ?? undefined;
            const blueprintId = SkillSharedUtilities.readString(entry.blueprintId) ?? undefined;
            const planId = SkillSharedUtilities.readString(entry.planId) ?? undefined;
            const blueprintRevision =
                typeof entry.blueprintRevision === 'number' ? entry.blueprintRevision : undefined;
            const grantFencingToken =
                typeof entry.grantFencingToken === 'number' ? entry.grantFencingToken : undefined;
            const fencingToken =
                typeof entry.fencingToken === 'number' ? entry.fencingToken : undefined;
            operations.push({
                kind,
                target,
                ...(claimId === undefined ? {} : { claimId }),
                ...(grantId === undefined ? {} : { grantId }),
                ...(grant === null ? {} : { grant }),
                ...(structureId === undefined ? {} : { structureId }),
                ...(blueprintId === undefined ? {} : { blueprintId }),
                ...(blueprintRevision === undefined ? {} : { blueprintRevision }),
                ...(planId === undefined ? {} : { planId }),
                ...(grantFencingToken === undefined ? {} : { grantFencingToken }),
                ...(fencingToken === undefined ? {} : { fencingToken }),
            });
        }
        return operations;
    }

    private readGrant(value: unknown): { grant: SkillGrant | null } | null {
        if (value === null || value === undefined) return { grant: null };
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const id = SkillSharedUtilities.readString(value.id);
        if (id === null) return null;
        const expiresAt = SkillSharedUtilities.readString(value.expiresAt) ?? undefined;
        const fencingToken =
            typeof value.fencingToken === 'number' ? value.fencingToken : undefined;
        return {
            grant: {
                id,
                ...(expiresAt === undefined ? {} : { expiresAt }),
                ...(fencingToken === undefined ? {} : { fencingToken }),
            },
        };
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }
}
