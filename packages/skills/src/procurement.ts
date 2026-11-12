import type { Result, Vec3 } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillConstructionOperation,
    SkillConstructionPlan,
    SkillContext,
    SkillInput,
    SkillMaterialNeed,
    SkillProcurementAction,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const MAXIMUM_STEPS = 256;
const GATHER_RADIUS = 32;
const GATHER_REACH = 2;
const COLLECT_RADIUS = 4;

interface GatherState {
    position: Vec3;
    expectedBlockId: string;
    phase: 'move' | 'break' | 'collect';
}

interface ProcurementState {
    blueprintId: string;
    blueprintRevision: number;
    planId: string;
    planRevision: number;
    workPackageId: string;
    operations: readonly SkillConstructionOperation[];
    extraNeeds: SkillMaterialNeed[];
    active: SkillProcurementAction | null;
    gather: GatherState | null;
    steps: number;
}

export class ProcurementSkill implements Skill {
    readonly id = 'procurement';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.services?.construction === undefined) return [false, null];
        if (context.services.procurement === undefined) return [false, null];
        if (input.planId === undefined) return [false, null];
        if (input.planRevision === undefined) return [false, null];
        if (input.workPackageId === undefined) return [false, null];
        return [true, null];
    }

    plan(_context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.planId === undefined) return [null, 'procurement requires a plan id'];
        if (input.planRevision === undefined) {
            return [null, 'procurement requires a plan revision'];
        }
        if (input.workPackageId === undefined) {
            return [null, 'procurement requires a work package id'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (context.services?.construction === undefined) {
            return [null, 'procurement requires a construction source'];
        }
        if (context.services.procurement === undefined) {
            return [null, 'procurement requires a procurement service'];
        }
        const planResult = this.resolvePlan(context, input);
        if (planResult[1] !== null) return [null, planResult[1]];
        const plan = planResult[0];
        if (plan === null) return [null, 'procurement plan returned null'];
        return [this.advance(context, this.stateFor(plan)), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const state = this.readState(run);
        if (state === null) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'execution-failed',
                    'procurement state is invalid',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'failed') {
            this.record(context, state.active, 'failed');
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'procurement action failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'cancelled') {
            this.record(context, state.active, 'failed');
            return [SkillSharedUtilities.cancelled(run, 'procurement was cancelled'), null];
        }
        if (context.lastAction?.status === 'completed') {
            if (state.gather !== null) {
                return [this.advanceGather(context, run, state), null];
            }
            this.record(context, state.active, 'completed');
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, active: null },
            };
            return [this.advance(context, this.readState(nextRun) ?? state), null];
        }
        if (state.gather !== null) {
            return [this.gatherStep(run, state.gather), null];
        }
        if (state.active !== null) {
            return [this.actionStep(run, state.active, state.steps), null];
        }
        return [this.advance(context, state), null];
    }

    cancel(_context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        const state = this.readState(run);
        if (state === null) return [null, 'procurement checkpoint state is invalid'];
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
            return [null, 'procurement checkpoint is invalid'];
        }
        const input: SkillInput = {
            blueprintId,
            blueprintRevision,
            planId,
            planRevision,
            workPackageId,
            ...(checkpoint.taskId.length === 0 ? {} : { taskId: checkpoint.taskId }),
        };
        const planResult = this.resolvePlan(context, input);
        if (planResult[1] !== null) return [null, planResult[1]];
        const plan = planResult[0];
        if (plan === null) return [null, 'procurement plan returned null'];
        return [{ skillId: this.id, state: this.serialize(this.stateFor(plan)) }, null];
    }

    private resolvePlan(
        context: SkillContext,
        input: SkillInput,
    ): Result<SkillConstructionPlan | null, string> {
        const source = context.services?.construction;
        if (source === undefined) return [null, 'construction source is unavailable'];
        return source.resolve(context, input);
    }

    private advance(context: SkillContext, state: ProcurementState): SkillStep {
        const run: SkillRun = { skillId: this.id, state: this.serialize(state) };
        if (state.steps >= MAXIMUM_STEPS) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                'material procurement made no progress',
            );
        }
        if (context.services?.procurement === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'unsupported',
                'procurement service is unavailable',
            );
        }
        const packageNeeds = Blueprint.outstandingNeeds(context, state.operations);
        if (packageNeeds.length === 0 && state.extraNeeds.length === 0) {
            return SkillSharedUtilities.completed(run, 'materials ready');
        }
        const needs = this.mergeNeeds(packageNeeds, state.extraNeeds);
        const [plan, planError] = context.services.procurement.plan({
            needs,
            inventory: context.inventory,
            position: context.position,
        });
        if (planError !== null) {
            return SkillSharedUtilities.failed(run, 'missing-item', planError);
        }
        if (plan === null) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'procurement plan returned null',
            );
        }
        if (plan.blocked || (plan.actions.length === 0 && plan.shortages.length > 0)) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                `missing procurement materials: ${plan.shortages
                    .map((need) => `${need.item} x${need.count}`)
                    .join(', ')}`,
            );
        }
        if (plan.actions.length === 0) {
            if (state.extraNeeds.length > 0) {
                return this.advance(context, { ...state, extraNeeds: [], steps: state.steps + 1 });
            }
            return SkillSharedUtilities.completed(run, 'materials ready');
        }
        const action = plan.actions[0];
        if (action === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'procurement action missing',
            );
        }
        return this.begin(context, state, action);
    }

    private begin(
        context: SkillContext,
        state: ProcurementState,
        action: SkillProcurementAction,
    ): SkillStep {
        const nextState = { ...state, steps: state.steps + 1, active: action };
        const run: SkillRun = { skillId: this.id, state: this.serialize(nextState) };
        if (action.kind === 'withdraw') {
            return SkillSharedUtilities.running(
                run,
                {
                    kind: 'transfer',
                    direction: 'withdraw',
                    container: action.container,
                    itemName: action.item,
                    count: action.count,
                },
                state.steps,
                MAXIMUM_STEPS,
                `withdrawing ${action.item}`,
            );
        }
        if (action.kind === 'craft') {
            const missingIngredients = action.ingredients
                .map((ingredient) => ({
                    item: ingredient.item,
                    count:
                        ingredient.count -
                        SkillSharedUtilities.itemCount(context.inventory, ingredient.item),
                }))
                .filter((ingredient) => ingredient.count > 0);
            if (missingIngredients.length > 0) {
                return this.advance(context, {
                    ...nextState,
                    active: null,
                    extraNeeds: this.mergeExtraNeeds(state.extraNeeds, missingIngredients),
                });
            }
            return SkillSharedUtilities.running(
                run,
                { kind: 'craft', itemName: action.item, count: action.count },
                state.steps,
                MAXIMUM_STEPS,
                `crafting ${action.item}`,
            );
        }
        return this.beginGather(context, nextState, action);
    }

    private beginGather(
        context: SkillContext,
        state: ProcurementState,
        action: Extract<SkillProcurementAction, { kind: 'gather' }>,
    ): SkillStep {
        const run: SkillRun = { skillId: this.id, state: this.serialize(state) };
        if (context.world.nearestBlock === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                'gathering requires a world scan',
            );
        }
        const position = context.world.nearestBlock([action.source], GATHER_RADIUS);
        if (position === null) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                `cannot find ${action.source} to gather ${action.item}`,
            );
        }
        const protectedResult = context.services?.spatial?.isProtected(position);
        if (protectedResult !== undefined) {
            const [isProtected, protectedError] = protectedResult;
            if (protectedError !== null) {
                return SkillSharedUtilities.failed(run, 'unsafe', protectedError);
            }
            if (isProtected) {
                return SkillSharedUtilities.failed(
                    run,
                    'unsafe',
                    `refusing to gather ${action.item} from a protected block`,
                );
            }
        }
        const gather: GatherState = {
            position,
            expectedBlockId: action.source,
            phase:
                SkillSharedUtilities.distance(context.position, position) > GATHER_REACH
                    ? 'move'
                    : 'break',
        };
        const gatherState = { ...state, gather };
        return this.gatherStep({ skillId: this.id, state: this.serialize(gatherState) }, gather);
    }

    private advanceGather(
        context: SkillContext,
        run: SkillRun,
        state: ProcurementState,
    ): SkillStep {
        const gather = state.gather;
        if (gather === null) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'procurement gather state is missing',
            );
        }
        if (gather.phase === 'move') {
            const breaking: GatherState = { ...gather, phase: 'break' };
            return this.gatherStep(
                { skillId: this.id, state: this.serialize({ ...state, gather: breaking }) },
                breaking,
            );
        }
        if (gather.phase === 'break') {
            const collecting: GatherState = { ...gather, phase: 'collect' };
            return this.gatherStep(
                { skillId: this.id, state: this.serialize({ ...state, gather: collecting }) },
                collecting,
            );
        }
        const nextState = { ...state, gather: null, active: null, steps: state.steps + 1 };
        return this.advance(context, nextState);
    }

    private gatherStep(run: SkillRun, gather: GatherState): SkillStep {
        if (gather.phase === 'move') {
            return SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: gather.position, range: GATHER_REACH },
                0,
                MAXIMUM_STEPS,
                `moving to ${gather.expectedBlockId}`,
            );
        }
        if (gather.phase === 'break') {
            return SkillSharedUtilities.running(
                run,
                {
                    kind: 'break-block',
                    position: gather.position,
                    expectedBlockId: gather.expectedBlockId,
                },
                0,
                MAXIMUM_STEPS,
                `gathering ${gather.expectedBlockId}`,
            );
        }
        return SkillSharedUtilities.running(
            run,
            { kind: 'collect-drops', radius: COLLECT_RADIUS },
            0,
            MAXIMUM_STEPS,
            'collecting gathered materials',
        );
    }

    private actionStep(run: SkillRun, action: SkillProcurementAction, steps: number): SkillStep {
        if (action.kind === 'withdraw') {
            return SkillSharedUtilities.running(
                run,
                {
                    kind: 'transfer',
                    direction: 'withdraw',
                    container: action.container,
                    itemName: action.item,
                    count: action.count,
                },
                steps,
                MAXIMUM_STEPS,
                `withdrawing ${action.item}`,
            );
        }
        if (action.kind === 'craft') {
            return SkillSharedUtilities.running(
                run,
                { kind: 'craft', itemName: action.item, count: action.count },
                steps,
                MAXIMUM_STEPS,
                `crafting ${action.item}`,
            );
        }
        return SkillSharedUtilities.failed(
            run,
            'execution-failed',
            'gather action lost its target',
        );
    }

    private record(
        context: SkillContext,
        action: SkillProcurementAction | null,
        status: 'completed' | 'failed',
    ): void {
        if (action === null) return;
        context.services?.procurement?.record?.({ action, status });
    }

    private stateFor(plan: SkillConstructionPlan): ProcurementState {
        return {
            blueprintId: plan.blueprintId,
            blueprintRevision: plan.blueprintRevision,
            planId: plan.planId,
            planRevision: plan.planRevision,
            workPackageId: plan.workPackageId,
            operations: plan.operations,
            extraNeeds: [],
            active: null,
            gather: null,
            steps: 0,
        };
    }

    private serialize(state: ProcurementState): Record<string, unknown> {
        return {
            blueprintId: state.blueprintId,
            blueprintRevision: state.blueprintRevision,
            planId: state.planId,
            planRevision: state.planRevision,
            workPackageId: state.workPackageId,
            operations: state.operations,
            extraNeeds: state.extraNeeds,
            active: state.active,
            gather: state.gather,
            steps: state.steps,
        };
    }

    private readState(run: SkillRun): ProcurementState | null {
        const blueprintId = SkillSharedUtilities.readString(run.state.blueprintId);
        const blueprintRevision = run.state.blueprintRevision;
        const planId = SkillSharedUtilities.readString(run.state.planId);
        const planRevision = run.state.planRevision;
        const workPackageId = SkillSharedUtilities.readString(run.state.workPackageId);
        const operations = this.readOperations(run.state.operations);
        const extraNeeds = this.readNeeds(run.state.extraNeeds);
        const active = this.readAction(run.state.active);
        const gather = this.readGather(run.state.gather);
        const steps = run.state.steps;
        if (
            blueprintId === null ||
            typeof blueprintRevision !== 'number' ||
            planId === null ||
            typeof planRevision !== 'number' ||
            workPackageId === null ||
            operations === null ||
            extraNeeds === null ||
            active === undefined ||
            gather === undefined ||
            typeof steps !== 'number' ||
            !Number.isInteger(steps)
        ) {
            return null;
        }
        return {
            blueprintId,
            blueprintRevision,
            planId,
            planRevision,
            workPackageId,
            operations,
            extraNeeds,
            active,
            gather,
            steps,
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
            operations.push({
                kind,
                target,
                ...(typeof entry.phase === 'string'
                    ? { phase: entry.phase as SkillConstructionOperation['phase'] }
                    : {}),
            });
        }
        return operations;
    }

    private readNeeds(value: unknown): SkillMaterialNeed[] | null {
        if (!Array.isArray(value)) return null;
        const needs: SkillMaterialNeed[] = [];
        for (const entry of value) {
            if (!SkillSharedUtilities.isRecord(entry)) return null;
            const item = SkillSharedUtilities.readString(entry.item);
            const count = entry.count;
            if (item === null || typeof count !== 'number' || count <= 0) return null;
            needs.push({ item, count });
        }
        return needs;
    }

    private readAction(value: unknown): SkillProcurementAction | null | undefined {
        if (value === null || value === undefined) return null;
        if (!SkillSharedUtilities.isRecord(value)) return undefined;
        const kind = SkillSharedUtilities.readString(value.kind);
        const item = SkillSharedUtilities.readString(value.item);
        const count = value.count;
        if (kind === null || item === null || typeof count !== 'number') return undefined;
        if (kind === 'withdraw') {
            const container = SkillSharedUtilities.readVec3(value.container);
            if (container === null) return undefined;
            return { kind, container, item, count };
        }
        if (kind === 'craft') {
            const ingredients = this.readNeeds(value.ingredients);
            if (ingredients === null) return undefined;
            return { kind, item, count, ingredients };
        }
        if (kind === 'gather') {
            const source = SkillSharedUtilities.readString(value.source);
            if (source === null) return undefined;
            return { kind, item, count, source };
        }
        return undefined;
    }

    private readGather(value: unknown): GatherState | null | undefined {
        if (value === null || value === undefined) return null;
        if (!SkillSharedUtilities.isRecord(value)) return undefined;
        const position = SkillSharedUtilities.readVec3(value.position);
        const expectedBlockId = SkillSharedUtilities.readString(value.expectedBlockId);
        const phase = SkillSharedUtilities.readString(value.phase);
        if (position === null || expectedBlockId === null) return undefined;
        if (phase !== 'move' && phase !== 'break' && phase !== 'collect') return undefined;
        return { position, expectedBlockId, phase };
    }

    private mergeNeeds(
        left: readonly SkillMaterialNeed[],
        right: readonly SkillMaterialNeed[],
    ): SkillMaterialNeed[] {
        const merged = new Map<string, number>();
        [...left, ...right].forEach((need) => {
            merged.set(need.item, (merged.get(need.item) ?? 0) + need.count);
        });
        return [...merged.entries()]
            .map(([item, count]) => ({ item, count }))
            .sort((a, b) => a.item.localeCompare(b.item));
    }

    private mergeExtraNeeds(
        left: readonly SkillMaterialNeed[],
        right: readonly SkillMaterialNeed[],
    ): SkillMaterialNeed[] {
        const merged = new Map<string, number>();
        [...left, ...right].forEach((need) => {
            merged.set(need.item, Math.max(merged.get(need.item) ?? 0, need.count));
        });
        return [...merged.entries()]
            .map(([item, count]) => ({ item, count }))
            .sort((a, b) => a.item.localeCompare(b.item));
    }
}
