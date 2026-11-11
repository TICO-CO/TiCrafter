import type { Result, Vec3 } from '@ticrafter/core';

import { BridgePlanner } from './bridge-plan.js';
import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';
import { WorldScan } from './world-scan.js';

const SUPPORT_FACE = { x: 0, y: 1, z: 0 };

export class BridgeSkill implements Skill {
    readonly id = 'bridge';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        if (input.material === undefined) return [null, 'bridge requires a material'];
        const [plan, planError] = BridgePlanner.plan(input);
        if (planError) return [null, planError];
        return [plan !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        if (input.material === undefined) return [null, 'bridge requires a material'];
        const [plan, planError] = BridgePlanner.plan(input);
        if (planError) return [null, planError];
        if (plan === null) return [null, 'bridge produced no plan'];
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        if (input.material === undefined) return [null, 'bridge requires a material'];
        const [plan, planError] = BridgePlanner.plan(input);
        if (planError) return [null, planError];
        if (plan === null) return [null, 'bridge produced no plan'];
        const run: SkillRun = {
            skillId: this.id,
            state: {
                positions: plan.positions,
                material: input.material,
                width: plan.width,
                cursor: 0,
                placed: [],
                phase: 'place',
            },
        };
        const needed = plan.positions.filter(
            (position) => context.world.blockAt(position) !== input.material,
        );
        const available = SkillSharedUtilities.itemCount(context.inventory, input.material);
        if (available < needed.length) {
            return [
                SkillSharedUtilities.failed(
                    run,
                    'missing-item',
                    `bridge needs ${needed.length} ${input.material} but has ${available}`,
                ),
                null,
            ];
        }
        return this.nextPlacement(context, run);
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'bridge placement failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status !== 'completed') return this.nextPlacement(context, run);
        const positions = WorldScan.readPositions(run.state.positions);
        if (positions === null) return [null, 'bridge state lost its deck positions'];
        const cursor = SkillSharedUtilities.readNumber(run.state.cursor, 0);
        const current = positions[cursor];
        if (current === undefined) return this.nextPlacement(context, run);
        const key = WorldScan.key(current);
        const placed = WorldScan.readStrings(run.state.placed) ?? [];
        const nextRun: SkillRun = {
            skillId: this.id,
            state: {
                ...run.state,
                cursor: cursor + 1,
                placed: placed.includes(key) ? placed : [...placed, key],
            },
        };
        return this.nextPlacement(context, nextRun);
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (WorldScan.readPositions(checkpoint.state.positions) === null) {
            return [null, 'checkpoint has no deck positions'];
        }
        if (SkillSharedUtilities.readString(checkpoint.state.material) === null) {
            return [null, 'checkpoint has no bridge material'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private nextPlacement(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const positions = WorldScan.readPositions(run.state.positions);
        if (positions === null) return [null, 'bridge state lost its deck positions'];
        const material = SkillSharedUtilities.readString(run.state.material);
        if (material === null) return [null, 'bridge state lost its material'];
        const placed = new Set(WorldScan.readStrings(run.state.placed) ?? []);
        let cursor = SkillSharedUtilities.readNumber(run.state.cursor, 0);
        while (cursor < positions.length) {
            const position = positions[cursor];
            if (position === undefined) break;
            const key = WorldScan.key(position);
            const currentBlock = context.world.blockAt(position);
            if (currentBlock === null) {
                return [
                    SkillSharedUtilities.failed(
                        run,
                        'target-missing',
                        `deck position ${key} is unavailable`,
                    ),
                    null,
                ];
            }
            if (currentBlock !== material && !placed.has(key)) {
                const failure = this.supportFailure(context, run, position);
                if (failure !== null) return [failure, null];
                if (SkillSharedUtilities.itemCount(context.inventory, material) < 1) {
                    return [
                        SkillSharedUtilities.failed(
                            run,
                            'missing-item',
                            `no ${material} left for bridge deck`,
                        ),
                        null,
                    ];
                }
                return [this.place(run, position, material, cursor, positions.length), null];
            }
            cursor += 1;
        }
        return [SkillSharedUtilities.completed(run, 'bridge complete'), null];
    }

    private supportFailure(context: SkillContext, run: SkillRun, position: Vec3): SkillStep | null {
        const key = WorldScan.key(position);
        const support = context.world.blockAt(WorldScan.below(position));
        if (support === null) {
            return SkillSharedUtilities.failed(
                run,
                'target-missing',
                `no world block below deck position ${key}`,
            );
        }
        if (WorldScan.isAir(support)) {
            return SkillSharedUtilities.failed(
                run,
                'unsupported',
                `deck position ${key} has no support below`,
            );
        }
        return null;
    }

    private place(
        run: SkillRun,
        position: Vec3,
        material: string,
        cursor: number,
        total: number,
    ): SkillStep {
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, cursor, phase: 'place' },
        };
        return SkillSharedUtilities.running(
            nextRun,
            {
                kind: 'place-block',
                position,
                itemName: material,
                reference: WorldScan.below(position),
                face: SUPPORT_FACE,
            },
            cursor,
            total,
            `placing bridge deck ${cursor + 1}/${total}`,
        );
    }
}
