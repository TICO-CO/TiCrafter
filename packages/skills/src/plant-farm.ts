import type { ActionRequest, Result } from '@ticrafter/core';

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

interface PlantState {
    plotId: string;
    seedItem: string;
    pending: SkillBuildTarget[];
    planted: string[];
    dryFarmland: string[];
    activeKey: string | null;
    waterMaintenance: boolean;
}

export class PlantFarmSkill implements Skill {
    readonly id = 'plant-farm';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (context.world.blocksInBox === undefined) return [false, null];
        if (input.plot !== undefined) return [true, null];
        if (input.plotId === undefined) return [false, null];
        if (context.services?.farms === undefined) return [false, null];
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.plot !== undefined) return [input, null];
        if (input.plotId === undefined) return [null, 'plant-farm requires a farm plot'];
        if (context.services?.farms === undefined) {
            return [null, 'plant-farm requires a farm plot source'];
        }
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const [plot, plotError] = FarmPlotResolver.resolve(context, input);
        if (plotError !== null) return [null, plotError];
        if (plot === null) {
            return [this.unsupported('plant-farm requires a farm plot'), null];
        }
        const [blocks, scanError] = FarmScanner.scan(context, plot);
        if (scanError !== null) return [this.unsupported(scanError), null];
        if (blocks === null) return [this.unsupported('farm scan returned no blocks'), null];
        const seedItem = input.seedItem ?? plot.seedItem;
        if (seedItem === undefined) {
            return [this.missingItem('plant-farm requires a seed item'), null];
        }
        const waterMaintenance = input.maintainWater === true;
        const blockIndex = new Map(
            blocks.map((block) => [Blueprint.targetKey(block.position), block]),
        );
        const farmland = blocks.filter((block) => block.name === 'farmland');
        const dryFarmland = farmland
            .filter((block) => FarmCrops.isDryFarmland(block))
            .map((block) => Blueprint.targetKey(block.position));
        const pending = Blueprint.sortSupportFirst(
            farmland
                .filter((block) => {
                    const abovePosition = FarmScanner.above(block.position);
                    const above = blockIndex.get(Blueprint.targetKey(abovePosition));
                    const aboveName = above?.name ?? context.world.blockAt(abovePosition);
                    return FarmCrops.isAir(aboveName);
                })
                .map((block) => ({
                    position: block.position,
                    itemName: seedItem,
                    expectedBlockId: 'farmland',
                })),
            context.position,
        );
        const run: SkillRun = {
            skillId: this.id,
            state: {
                plotId: plot.id,
                seedItem,
                pending,
                planted: [],
                dryFarmland,
                activeKey: null,
                waterMaintenance,
            },
        };
        if (waterMaintenance) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'missing-item',
                    'water maintenance is required but unsupported',
                ),
                null,
            ];
        }
        const available = SkillSharedUtilities.itemCount(context.inventory, seedItem);
        if (pending.length > 0 && available < pending.length) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'missing-item',
                    `missing seeds: ${seedItem} (${available}/${pending.length})`,
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
                SkillSharedUtilities.failed(run, 'execution-failed', 'plant state is invalid'),
                null,
            ];
        }
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'planting failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'cancelled') {
            return [SkillSharedUtilities.cancelled(run, 'planting was cancelled'), null];
        }
        if (context.lastAction?.status === 'completed' && state.activeKey !== null) {
            const planted = state.planted.includes(state.activeKey)
                ? state.planted
                : [...state.planted, state.activeKey];
            const pending = state.pending.filter(
                (target) => Blueprint.targetKey(target.position) !== state.activeKey,
            );
            const nextRun: SkillRun = {
                skillId: this.id,
                state: { ...run.state, pending, planted, activeKey: null },
            };
            return [this.advance(nextRun), null];
        }
        if (state.activeKey !== null) {
            const target = state.pending.find(
                (candidate) => Blueprint.targetKey(candidate.position) === state.activeKey,
            );
            if (target === undefined) {
                return [
                    SkillSharedUtilities.failed(run, 'execution-failed', 'plant target is missing'),
                    null,
                ];
            }
            return [
                SkillSharedUtilities.running(
                    run,
                    this.actionFor(target),
                    state.planted.length,
                    state.planted.length + state.pending.length,
                    `planting ${target.itemName}`,
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
        if (state === null) return [null, 'checkpoint has an invalid plant state'];
        if (state.waterMaintenance) return [null, 'checkpoint requires unsupported water upkeep'];
        return [run, null];
    }

    private advance(run: SkillRun): SkillStep {
        const state = this.readState(run);
        if (state === null) {
            return SkillSharedUtilities.failed(run, 'execution-failed', 'plant state is invalid');
        }
        if (state.pending.length === 0) {
            const dryLabel =
                state.dryFarmland.length === 0
                    ? ''
                    : `; ${state.dryFarmland.length} dry farmland blocks`;
            return SkillSharedUtilities.completed(
                { skillId: this.id, state: { ...run.state, activeKey: null } },
                `planted ${state.planted.length} seeds${dryLabel}`,
            );
        }
        const target = state.pending[0];
        if (target === undefined) {
            return SkillSharedUtilities.failed(run, 'execution-failed', 'plant target is missing');
        }
        const key = Blueprint.targetKey(target.position);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, activeKey: key },
        };
        return SkillSharedUtilities.running(
            nextRun,
            this.actionFor(target),
            state.planted.length,
            state.planted.length + state.pending.length,
            `planting ${target.itemName}`,
        );
    }

    private actionFor(target: SkillBuildTarget): ActionRequest {
        return {
            kind: 'use-block',
            position: target.position,
            itemName: target.itemName,
        };
    }

    private readState(run: SkillRun): PlantState | null {
        const pending = FarmStateReader.readTargets(run.state.pending);
        const planted = FarmStateReader.readKeys(run.state.planted);
        const dryFarmland = FarmStateReader.readKeys(run.state.dryFarmland);
        if (pending === null || planted === null || dryFarmland === null) return null;
        const [activeKey, activeError] = FarmStateReader.readActiveKey(run.state.activeKey);
        if (activeError !== null) return null;
        const seedItem = SkillSharedUtilities.readString(run.state.seedItem);
        if (seedItem === null) return null;
        if (
            activeKey !== null &&
            !pending.some((target) => Blueprint.targetKey(target.position) === activeKey)
        ) {
            return null;
        }
        return {
            plotId: SkillSharedUtilities.readString(run.state.plotId) ?? 'default',
            seedItem,
            pending,
            planted,
            dryFarmland,
            activeKey,
            waterMaintenance: run.state.waterMaintenance === true,
        };
    }

    private missingItem(message: string): SkillStep {
        return SkillSharedUtilities.failed(
            { skillId: this.id, state: {} },
            'missing-item',
            message,
        );
    }

    private unsupported(message: string): SkillStep {
        return SkillSharedUtilities.failed({ skillId: this.id, state: {} }, 'unsupported', message);
    }
}
