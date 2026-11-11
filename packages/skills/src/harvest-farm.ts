import type { Result } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import { FarmCrops, FarmPlotResolver, FarmScanner, FarmStateReader } from './farm.js';
import type {
    Skill,
    SkillBuildTarget,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

interface HarvestState {
    plotId: string;
    remaining: SkillBuildTarget[];
    harvested: string[];
    activeKey: string | null;
    phase: 'break' | 'collect';
}

export class HarvestFarmSkill implements Skill {
    readonly id = 'harvest-farm';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.world.blocksInBox === undefined) return [false, null];
        if (input.plot !== undefined) return [true, null];
        if (input.plotId === undefined) return [false, null];
        if (context.services?.farms === undefined) return [false, null];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.plot !== undefined) return [input, null];
        if (input.plotId === undefined) return [null, 'harvest-farm requires a farm plot'];
        if (context.services?.farms === undefined) {
            return [null, 'harvest-farm requires a farm plot source'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const [plot, plotError] = FarmPlotResolver.resolve(context, input);
        if (plotError !== null) return [null, plotError];
        if (plot === null) {
            return [this.unsupported('harvest-farm requires a farm plot'), null];
        }
        const [blocks, scanError] = FarmScanner.scan(context, plot);
        if (scanError !== null) return [this.unsupported(scanError), null];
        if (blocks === null) return [this.unsupported('farm scan returned no blocks'), null];
        const cropIds = new Set(FarmCrops.ids(plot));
        const remaining = Blueprint.sortSupportFirst(
            blocks
                .filter((block) => cropIds.has(block.name) && FarmCrops.isMature(block))
                .map((block) => FarmCrops.toTarget(block)),
            context.position,
        );
        const run: SkillRun = {
            skillId: this.id,
            state: {
                plotId: plot.id,
                remaining,
                harvested: [],
                activeKey: null,
                phase: 'break',
            },
        };
        return [this.advance(run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const state = this.readState(run);
        if (state === null) {
            return [
                SkillSharedUtilities.failed(run, 'execution-failed', 'harvest state is invalid'),
                null,
            ];
        }
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'harvest action failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'cancelled') {
            return [SkillSharedUtilities.cancelled(run, 'harvest was cancelled'), null];
        }
        if (context.lastAction?.status === 'completed' && state.activeKey !== null) {
            if (state.phase === 'break') {
                const nextRun: SkillRun = {
                    skillId: this.id,
                    state: { ...run.state, phase: 'collect' },
                };
                return [
                    SkillSharedUtilities.running(
                        nextRun,
                        { kind: 'collect-drops', radius: 4 },
                        state.harvested.length,
                        state.harvested.length + state.remaining.length,
                        'collecting crop drops',
                    ),
                    null,
                ];
            }
            const harvested = state.harvested.includes(state.activeKey)
                ? state.harvested
                : [...state.harvested, state.activeKey];
            const remaining = state.remaining.filter(
                (target) => Blueprint.targetKey(target.position) !== state.activeKey,
            );
            const nextRun: SkillRun = {
                skillId: this.id,
                state: {
                    ...run.state,
                    remaining,
                    harvested,
                    activeKey: null,
                    phase: 'break',
                },
            };
            return [this.advance(nextRun), null];
        }
        if (state.activeKey !== null) {
            const target = state.remaining.find(
                (candidate) => Blueprint.targetKey(candidate.position) === state.activeKey,
            );
            if (target === undefined) {
                return [
                    SkillSharedUtilities.failed(
                        run,
                        'execution-failed',
                        'harvest target is missing',
                    ),
                    null,
                ];
            }
            return [
                SkillSharedUtilities.running(
                    run,
                    this.actionFor(state.phase, target),
                    state.harvested.length,
                    state.harvested.length + state.remaining.length,
                    this.labelFor(state.phase, target),
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
        if (state === null) return [null, 'checkpoint has an invalid harvest state'];
        return [run, null];
    }

    private advance(run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(run, 'execution-failed', 'harvest state is invalid');
        }
        if (state.remaining.length === 0) {
            return SkillSharedUtilities.completed(
                { skillId: this.id, state: { ...run.state, activeKey: null, phase: 'break' } },
                `harvested ${state.harvested.length} crops`,
            );
        }
        const target = state.remaining[0];
        if (target === undefined) {
            return SkillSharedUtilities.failed(
                run,
                'execution-failed',
                'harvest target is missing',
            );
        }
        const key = Blueprint.targetKey(target.position);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, activeKey: key, phase: 'break' },
        };
        return SkillSharedUtilities.running(
            nextRun,
            this.actionFor('break', target),
            state.harvested.length,
            state.harvested.length + state.remaining.length,
            this.labelFor('break', target),
        );
    }

    private actionFor(phase: 'break' | 'collect', target: SkillBuildTarget) {
        if (phase === 'collect') return { kind: 'collect-drops' as const, radius: 4 };
        return {
            kind: 'break-block' as const,
            position: target.position,
            expectedBlockId: target.itemName,
        };
    }

    private labelFor(phase: 'break' | 'collect', target: SkillBuildTarget): string {
        if (phase === 'collect') return 'collecting crop drops';
        return `harvesting ${target.itemName}`;
    }

    private readState(run: SkillRun): HarvestState | null {
        const remaining = FarmStateReader.readTargets(run.state.remaining);
        const harvested = FarmStateReader.readKeys(run.state.harvested);
        if (remaining === null || harvested === null) return null;
        const [activeKey, activeError] = FarmStateReader.readActiveKey(run.state.activeKey);
        if (activeError !== null) return null;
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase !== 'break' && phase !== 'collect') return null;
        if (
            activeKey !== null &&
            !remaining.some((target) => Blueprint.targetKey(target.position) === activeKey)
        ) {
            return null;
        }
        return {
            plotId: SkillSharedUtilities.readString(run.state.plotId) ?? 'default',
            remaining,
            harvested,
            activeKey,
            phase,
        };
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }
}
