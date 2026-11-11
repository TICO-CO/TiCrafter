import type { Result, Vec3 } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const SMELT_TIMEOUT_MILLISECONDS = 120_000;
const SMELT_WAIT_MILLISECONDS = 4_000;

interface SmeltItems {
    input: string;
    fuel: string;
    output: string;
}

export class SmeltSkill implements Skill {
    readonly id = 'smelt';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        const validationError = this.validateInput(input);
        if (validationError !== null) return [null, validationError];
        return [this.resolveFurnace(context, input) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        const validationError = this.validateInput(input);
        if (validationError !== null) return [null, validationError];
        return [{ ...input, count: input.count ?? 1 }, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const validationError = this.validateInput(input);
        if (validationError !== null) return [null, validationError];
        const furnace = this.resolveFurnace(context, input);
        if (furnace === null) return [null, 'smelt requires a furnace'];
        const items = this.readItems(input);
        if (items === null) return [null, 'smelt requires input, fuel, and output items'];
        const count = input.count ?? 1;
        const initialOutputCount = SkillSharedUtilities.itemCount(context.inventory, items.output);
        const run: SkillRun = {
            skillId: this.id,
            state: {
                furnace,
                items,
                phase: 'move',
                startedAt: context.at,
                attempts: 0,
                targetCount: initialOutputCount + count,
                initialOutputCount,
                radius: input.range ?? 2,
            },
        };
        const preflight = this.preflight(context, run, items);
        if (preflight !== null) return [preflight, null];
        if (SkillSharedUtilities.distance(context.position, furnace) <= (input.range ?? 2)) {
            return this.beginCycle(context, run);
        }
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: furnace, range: input.range ?? 2 },
                0,
                count,
                'moving to furnace',
            ),
            null,
        ];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'smelting failed',
                ),
                null,
            ];
        }
        const timeout = this.timeoutStep(context, run);
        if (timeout !== null) return [timeout, null];
        const phase = SkillSharedUtilities.readString(run.state.phase);
        if (phase === null) return [null, 'smelt state lost its phase'];
        if (phase === 'move') return this.moveStep(context, run);
        if (phase === 'fuel') return this.fuelStep(context, run);
        if (phase === 'input') return this.inputStep(context, run);
        if (phase === 'wait') return this.waitStep(context, run);
        if (phase === 'withdraw') return this.withdrawStep(context, run);
        return [null, `smelt state has unknown phase ${phase}`];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (SkillSharedUtilities.readVec3(checkpoint.state.furnace) === null) {
            return [null, 'checkpoint has no furnace'];
        }
        if (this.readItemsFromState(checkpoint.state.items) === null) {
            return [null, 'checkpoint has no smelt items'];
        }
        if (SkillSharedUtilities.readString(checkpoint.state.phase) === null) {
            return [null, 'checkpoint has no smelt phase'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private validateInput(input: SkillInput): string | null {
        if (input.itemName === undefined) return 'smelt requires an input item';
        if (input.fuelItem === undefined) return 'smelt requires a fuel item';
        if (input.outputItem === undefined) return 'smelt requires an output item';
        const count = input.count ?? 1;
        if (!Number.isInteger(count) || count < 1) return 'smelt count must be positive';
        return null;
    }

    private resolveFurnace(context: SkillContext, input: SkillInput): Vec3 | null {
        return (
            input.furnace ?? input.container ?? input.target ?? context.world.nearestContainer(32)
        );
    }

    private readItems(input: SkillInput): SmeltItems | null {
        const inputItem = input.itemName;
        const fuelItem = input.fuelItem;
        const outputItem = input.outputItem;
        if (inputItem === undefined || fuelItem === undefined || outputItem === undefined) {
            return null;
        }
        return { input: inputItem, fuel: fuelItem, output: outputItem };
    }

    private readItemsFromState(value: unknown): SmeltItems | null {
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const inputItem = SkillSharedUtilities.readString(value.input);
        const fuelItem = SkillSharedUtilities.readString(value.fuel);
        const outputItem = SkillSharedUtilities.readString(value.output);
        if (inputItem === null || fuelItem === null || outputItem === null) return null;
        return { input: inputItem, fuel: fuelItem, output: outputItem };
    }

    private moveStep(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        const radius = SkillSharedUtilities.readNumber(run.state.radius, 2);
        if (
            context.lastAction?.status === 'completed' ||
            SkillSharedUtilities.distance(context.position, furnace) <= radius
        ) {
            return this.beginCycle(context, run);
        }
        const total = SkillSharedUtilities.readNumber(run.state.targetCount, 1);
        return [
            SkillSharedUtilities.running(
                run,
                { kind: 'move-to', position: furnace, range: radius },
                0,
                total,
                'moving to furnace',
            ),
            null,
        ];
    }

    private beginCycle(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const items = this.readItemsFromState(run.state.items);
        if (items === null) return [null, 'smelt state lost its items'];
        const preflight = this.preflight(context, run, items);
        if (preflight !== null) return [preflight, null];
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        const attempts = SkillSharedUtilities.readNumber(run.state.attempts, 0);
        const currentOutput = SkillSharedUtilities.itemCount(context.inventory, items.output);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: {
                ...run.state,
                phase: 'fuel',
                attempts: attempts + 1,
                cycleBaseline: currentOutput,
            },
        };
        return [this.transfer(nextRun, furnace, items.fuel, 'fuel', 'fuelling furnace'), null];
    }

    private preflight(context: SkillContext, run: SkillRun, items: SmeltItems): SkillStep | null {
        if (SkillSharedUtilities.itemCount(context.inventory, items.input) < 1) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                `no ${items.input} available to smelt`,
            );
        }
        if (SkillSharedUtilities.itemCount(context.inventory, items.fuel) < 1) {
            return SkillSharedUtilities.failed(
                run,
                'missing-item',
                `no ${items.fuel} available as fuel`,
            );
        }
        return null;
    }

    private fuelStep(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const items = this.readItemsFromState(run.state.items);
        if (items === null) return [null, 'smelt state lost its items'];
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        if (context.lastAction?.status !== 'completed') {
            return [this.transfer(run, furnace, items.fuel, 'fuel', 'fuelling furnace'), null];
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'input' },
        };
        return [
            this.transfer(nextRun, furnace, items.input, 'input', 'loading furnace input'),
            null,
        ];
    }

    private inputStep(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const items = this.readItemsFromState(run.state.items);
        if (items === null) return [null, 'smelt state lost its items'];
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        if (context.lastAction?.status !== 'completed') {
            return [
                this.transfer(run, furnace, items.input, 'input', 'loading furnace input'),
                null,
            ];
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'wait' },
        };
        return [
            SkillSharedUtilities.running(
                nextRun,
                { kind: 'wait', milliseconds: SMELT_WAIT_MILLISECONDS },
                SkillSharedUtilities.readNumber(run.state.attempts, 1) - 1,
                SkillSharedUtilities.readNumber(run.state.targetCount, 1),
                'waiting for furnace',
            ),
            null,
        ];
    }

    private waitStep(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const items = this.readItemsFromState(run.state.items);
        if (items === null) return [null, 'smelt state lost its items'];
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        if (context.lastAction?.status !== 'completed') {
            return [
                SkillSharedUtilities.running(
                    run,
                    { kind: 'wait', milliseconds: SMELT_WAIT_MILLISECONDS },
                    SkillSharedUtilities.readNumber(run.state.attempts, 1) - 1,
                    SkillSharedUtilities.readNumber(run.state.targetCount, 1),
                    'waiting for furnace',
                ),
                null,
            ];
        }
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, phase: 'withdraw' },
        };
        return [
            this.transfer(nextRun, furnace, items.output, 'output', 'withdrawing furnace output'),
            null,
        ];
    }

    private withdrawStep(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const items = this.readItemsFromState(run.state.items);
        if (items === null) return [null, 'smelt state lost its items'];
        const furnace = SkillSharedUtilities.readVec3(run.state.furnace);
        if (furnace === null) return [null, 'smelt state lost its furnace'];
        if (context.lastAction?.status !== 'completed') {
            return [
                this.transfer(run, furnace, items.output, 'output', 'withdrawing furnace output'),
                null,
            ];
        }
        const outputCount = SkillSharedUtilities.itemCount(context.inventory, items.output);
        const targetCount = SkillSharedUtilities.readNumber(run.state.targetCount, 1);
        if (outputCount >= targetCount) {
            return [SkillSharedUtilities.completed(run, 'smelt complete'), null];
        }
        const baseline = SkillSharedUtilities.readNumber(
            run.state.cycleBaseline,
            SkillSharedUtilities.readNumber(run.state.initialOutputCount, 0),
        );
        if (outputCount > baseline) return this.beginCycle(context, run);
        return [
            SkillSharedUtilities.failed(
                run,
                'execution-failed',
                `furnace did not produce ${items.output}`,
            ),
            null,
        ];
    }

    private transfer(
        run: SkillRun,
        furnace: Vec3,
        itemName: string,
        slot: 'input' | 'fuel' | 'output',
        label: string,
    ): SkillStep {
        const direction = slot === 'output' ? 'withdraw' : 'deposit';
        return SkillSharedUtilities.running(
            run,
            { kind: 'transfer', direction, container: furnace, itemName, count: 1, slot },
            SkillSharedUtilities.readNumber(run.state.attempts, 0),
            SkillSharedUtilities.readNumber(run.state.targetCount, 1),
            label,
        );
    }

    private timeoutStep(context: SkillContext, run: SkillRun): SkillStep | null {
        const startedAt = SkillSharedUtilities.readString(run.state.startedAt);
        if (startedAt === null) return null;
        const startedMilliseconds = Date.parse(startedAt);
        const currentMilliseconds = Date.parse(context.at);
        if (Number.isNaN(startedMilliseconds) || Number.isNaN(currentMilliseconds)) return null;
        if (currentMilliseconds - startedMilliseconds < SMELT_TIMEOUT_MILLISECONDS) return null;
        return SkillSharedUtilities.failed(run, 'timeout', 'smelt timed out');
    }
}
