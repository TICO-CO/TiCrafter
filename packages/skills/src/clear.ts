import type { Result } from '@ticrafter/core';

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
import { WorldScan } from './world-scan.js';

export class ClearSkill implements Skill {
    readonly id = 'clear';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        const structureError = this.validateStructure(input);
        if (structureError !== null) return [null, structureError];
        return this.authorize(context, input);
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        const structureError = this.validateStructure(input);
        if (structureError !== null) return [null, structureError];
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const structureError = this.validateStructure(input);
        if (structureError !== null) return [null, structureError];
        const [authorization, authorizationError] = this.authorize(context, input);
        if (authorizationError) return [null, authorizationError];
        if (authorization !== true) return [null, 'grant required'];
        const blockIds = input.blockIds ?? [];
        const targets = this.collectTargets(context, input, blockIds);
        const run: SkillRun = {
            skillId: this.id,
            state: {
                remaining: targets,
                remainingKeys: WorldScan.keys(targets.map((target) => target.position)),
                blockIds,
                current: null,
                phase: 'break',
                radius: input.radius ?? 4,
                ...(input.itemName === undefined ? {} : { itemName: input.itemName }),
            },
        };
        return this.selectNext(context, run);
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'clearing failed',
                ),
                null,
            ];
        }
        const current = this.readCurrent(run);
        if (current === null) return this.selectNext(context, run);
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase === null) return [null, 'clear state lost its phase'];
        if (phase === 'collect') return this.collectStep(context, run, current);
        if (phase !== 'break') return [null, `clear state has unknown phase ${phase}`];
        if (context.lastAction?.status !== 'completed') return [this.breakStep(run, current), null];
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'collect' },
        };
        return [this.collectAction(nextRun), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (WorldScan.readTargets(checkpoint.state.remaining) === null) {
            return [null, 'checkpoint has no remaining blocks'];
        }
        if (WorldScan.readStrings(checkpoint.state.remainingKeys) === null) {
            return [null, 'checkpoint has no remaining keys'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private validateStructure(input: SkillInput): string | null {
        const hasBlocks = input.blocks !== undefined && input.blocks.length > 0;
        const hasBox =
            input.bbox !== undefined && input.blockIds !== undefined && input.blockIds.length > 0;
        if (!hasBlocks && !hasBox) return 'clear requires blocks or bbox with blockIds';
        return null;
    }

    private authorize(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.grant === undefined) return [null, 'grant required'];
        const grants = context.services?.grants;
        if (grants === undefined) return [null, 'grant required'];
        const [valid, validationError] = grants.validate(input.grant, context.botId);
        if (validationError) return [null, validationError];
        if (valid !== true) return [null, 'grant required'];
        return [true, null];
    }

    private collectTargets(
        context: SkillContext,
        input: SkillInput,
        blockIds: readonly string[],
    ): readonly SkillBuildTarget[] {
        if (input.blocks !== undefined && input.blocks.length > 0) return input.blocks;
        if (input.bbox === undefined) return [];
        const listedBlocks =
            context.world.blocksInBox?.(input.bbox) ??
            WorldScan.positionsInBox(input.bbox).map((position) => ({
                position,
                name: context.world.blockAt(position) ?? 'air',
                properties: {},
            }));
        return listedBlocks
            .filter((block) => blockIds.includes(block.name))
            .map((block) => ({
                position: block.position,
                itemName: block.name,
                expectedBlockId: block.name,
            }));
    }

    private selectNext(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const remaining = WorldScan.readTargets(run.state.remaining);
        if (remaining === null) return [null, 'clear state lost its remaining blocks'];
        const blockIds = WorldScan.readStrings(run.state.blockIds) ?? [];
        let index = 0;
        while (index < remaining.length) {
            const target = remaining[index];
            if (target === undefined) break;
            const permitted = this.permittedTarget(context, target, blockIds);
            if (permitted !== null) {
                const nextRemaining = remaining.slice(index);
                const nextRun: SkillRun = {
                    skillId: this.id,
                    state: {
                        ...run.state,
                        remaining: nextRemaining,
                        remainingKeys: WorldScan.keys(nextRemaining.map((entry) => entry.position)),
                        current: permitted,
                        phase: 'break',
                    },
                };
                return [this.breakStep(nextRun, permitted), null];
            }
            index += 1;
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: {
                ...run.state,
                remaining: [],
                remainingKeys: [],
                current: null,
                phase: 'break',
            },
        };
        return [SkillSharedUtilities.completed(nextRun, 'clear complete'), null];
    }

    private permittedTarget(
        context: SkillContext,
        target: SkillBuildTarget,
        blockIds: readonly string[],
    ): SkillBuildTarget | null {
        const currentBlock = context.world.blockAt(target.position);
        if (WorldScan.isAir(currentBlock)) return null;
        if (target.expectedBlockId !== undefined && target.expectedBlockId !== currentBlock) {
            return null;
        }
        if (currentBlock === null) return null;
        const expectedBlockId = target.expectedBlockId ?? currentBlock;
        if (blockIds.length > 0 && !blockIds.includes(expectedBlockId)) return null;
        return { position: target.position, itemName: target.itemName, expectedBlockId };
    }

    private breakStep(run: SkillRun, target: SkillBuildTarget): SkillStep {
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'break-block',
                position: target.position,
                ...(target.expectedBlockId === undefined
                    ? {}
                    : { expectedBlockId: target.expectedBlockId }),
            },
            0,
            2,
            `breaking ${target.itemName}`,
        );
    }

    private collectStep(
        context: SkillContext,
        run: SkillRun,
        target: SkillBuildTarget,
    ): Result<SkillStep, string> {
        if (context.lastAction?.status === 'completed') {
            const remaining = WorldScan.readTargets(run.state.remaining);
            if (remaining === null) return [null, 'clear state lost its remaining blocks'];
            const key = WorldScan.key(target.position);
            const nextRemaining = remaining.filter(
                (entry) => WorldScan.key(entry.position) !== key,
            );
            const nextRun: SkillRun = {
                skillId: this.id,
                state: {
                    ...run.state,
                    remaining: nextRemaining,
                    remainingKeys: WorldScan.keys(nextRemaining.map((entry) => entry.position)),
                    current: null,
                    phase: 'break',
                },
            };
            return this.selectNext(context, nextRun);
        }
        return [this.collectAction(run), null];
    }

    private collectAction(run: SkillRun): SkillStep {
        const radius = SkillSharedUtilities.readNumber(run.state.radius, 4);
        const itemName = SkillSharedUtilities.readString(run.state.itemName);
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'collect-drops',
                radius,
                ...(itemName === null ? {} : { itemName }),
            },
            1,
            2,
            'collecting cleared drops',
        );
    }

    private readCurrent(run: SkillRun): SkillBuildTarget | null {
        if (run.state.current === null || run.state.current === undefined) return null;
        return WorldScan.readTarget(run.state.current);
    }
}
