import type { ActionFailure, ActionOutcome, ActionRequest, Vec3 } from '@ticrafter/core';
import type { Result } from '@ticrafter/core';
import type { SkillBlockState } from '@ticrafter/skills';

import type { FakeContainers } from './fake-containers.js';
import type { FakeInventory } from './fake-inventory.js';
import type { FakeWorld } from './fake-world.js';
import type { SimulationClock } from './simulation-clock.js';

export interface FakeActionDispatcherOptions {
    clock: SimulationClock;
    world: FakeWorld;
    inventory: FakeInventory;
    containers: FakeContainers;
    position: () => Vec3;
    setPosition?: (position: Vec3) => void;
    latencyTicks?: number;
    recipes?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

interface PendingAction {
    outcome: ActionOutcome;
    readyAt: number;
}

const PLACEABLE = new Set(['air', 'water', 'lava', 'short_grass', 'tall_grass']);
const TOOL_SUFFIXES = ['_pickaxe', '_axe', '_shovel', '_hoe', '_sword'];

export class FakeActionDispatcher {
    private sequence = 0;
    private readonly pending = new Map<string, PendingAction>();
    private readonly unreachable = new Set<string>();

    constructor(private readonly options: FakeActionDispatcherOptions) {}

    dispatch(request: ActionRequest): Result<string, string> {
        const handle = `action.${this.sequence}`;
        this.sequence += 1;
        const [outcome, error] = this.execute(request);
        if (error !== null) return [null, error];
        if (outcome === null) return [null, 'action produced no outcome'];
        const latency = this.options.latencyTicks ?? 0;
        this.pending.set(handle, {
            outcome,
            readyAt: this.options.clock.now() + latency,
        });
        return [handle, null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        const pending = this.pending.get(handleId);
        if (pending === undefined) return [null, null];
        if (pending.readyAt > this.options.clock.now()) return [null, null];
        this.pending.delete(handleId);
        return [pending.outcome, null];
    }

    cancel(handleId: string): Result<void, string> {
        this.pending.delete(handleId);
        return [undefined, null];
    }

    markUnreachable(position: Vec3): void {
        this.unreachable.add(FakeActionDispatcher.key(position));
    }

    private execute(request: ActionRequest): Result<ActionOutcome, string> {
        switch (request.kind) {
            case 'move-to':
                return this.move(request.position);
            case 'follow-path': {
                const last = request.waypoints.at(-1);
                return last === undefined
                    ? this.fail(request, 'no-path', 'empty path')
                    : this.move(last);
            }
            case 'place-block':
                return this.place(request);
            case 'break-block':
                return this.breakBlock(request);
            case 'craft':
                return this.craft(request);
            case 'transfer':
                return this.transfer(request);
            case 'consume':
                return this.completed(request);
            case 'equip':
                return this.options.inventory.count(request.itemName) > 0
                    ? this.completed(request)
                    : this.fail(request, 'missing-item', `missing ${request.itemName}`);
            case 'use-block':
            case 'attack':
            case 'use-entity':
            case 'collect-drops':
                return this.completed(request);
            case 'wait':
                return this.completed(request);
        }
    }

    private move(position: Vec3): Result<ActionOutcome, string> {
        if (this.unreachable.has(FakeActionDispatcher.key(position))) {
            return this.fail({ kind: 'move-to', position }, 'no-path', 'target is unreachable');
        }
        this.options.setPosition?.(position);
        return this.completed({ kind: 'move-to', position });
    }

    private place(
        request: Extract<ActionRequest, { kind: 'place-block' }>,
    ): Result<ActionOutcome, string> {
        const current = this.options.world.blockStateAt(request.position);
        if (current === null)
            return this.fail(request, 'target-missing', 'target is outside the world');
        if (!PLACEABLE.has(current.name)) {
            return this.fail(request, 'target-missing', `target contains ${current.name}`);
        }
        if (this.options.inventory.count(request.itemName) === 0) {
            return this.fail(request, 'missing-item', `missing ${request.itemName}`);
        }
        const [removed, removeError] = this.options.inventory.remove(request.itemName, 1);
        if (removeError !== null || removed === null) {
            return this.fail(request, 'missing-item', removeError ?? 'item removal failed');
        }
        const state: SkillBlockState = {
            name: request.expectedBlockId ?? request.itemName,
            properties: { ...(request.properties ?? {}) },
        };
        this.options.world.applyBlock(request.position, state);
        return this.completed(request);
    }

    private breakBlock(
        request: Extract<ActionRequest, { kind: 'break-block' }>,
    ): Result<ActionOutcome, string> {
        const current = this.options.world.blockStateAt(request.position);
        if (current === null || current.name === 'air') {
            return this.fail(request, 'target-missing', 'target block is missing');
        }
        if (!this.hasToolFor(current.name)) {
            return this.fail(request, 'missing-tool', `missing tool for ${current.name}`);
        }
        this.options.world.applyBlock(request.position, null);
        this.options.inventory.add(current.name, 1);
        return this.completed(request);
    }

    private craft(
        request: Extract<ActionRequest, { kind: 'craft' }>,
    ): Result<ActionOutcome, string> {
        const recipe = this.options.recipes?.[request.itemName];
        if (recipe === undefined) {
            return this.fail(request, 'missing-item', `missing recipe for ${request.itemName}`);
        }
        const available = Object.entries(recipe).every(
            ([item, count]) => this.options.inventory.count(item) >= count * request.count,
        );
        if (!available) {
            return this.fail(
                request,
                'missing-item',
                `missing ingredients for ${request.itemName}`,
            );
        }
        Object.entries(recipe).forEach(([item, count]) => {
            this.options.inventory.remove(item, count * request.count);
        });
        this.options.inventory.add(request.itemName, request.count);
        return this.completed(request);
    }

    private transfer(
        request: Extract<ActionRequest, { kind: 'transfer' }>,
    ): Result<ActionOutcome, string> {
        if (request.direction === 'withdraw') {
            const [withdrawn, withdrawError] = this.options.containers.withdraw(
                request.container,
                request.itemName,
                request.count,
            );
            if (withdrawError !== null || withdrawn === null) {
                return this.fail(request, 'missing-item', withdrawError ?? 'withdraw failed');
            }
            const [added, addError] = this.options.inventory.add(request.itemName, request.count);
            if (addError !== null || added === null) {
                return this.fail(request, 'missing-item', addError ?? 'inventory add failed');
            }
            return this.completed(request);
        }
        const [removed, removeError] = this.options.inventory.remove(
            request.itemName,
            request.count,
        );
        if (removeError !== null || removed === null) {
            return this.fail(request, 'missing-item', removeError ?? 'inventory remove failed');
        }
        const [deposited, depositError] = this.options.containers.deposit(
            request.container,
            request.itemName,
            request.count,
        );
        if (depositError !== null || deposited === null) {
            return this.fail(request, 'missing-item', depositError ?? 'deposit failed');
        }
        return this.completed(request);
    }

    private hasToolFor(blockId: string): boolean {
        if (!FakeActionDispatcher.needsTool(blockId)) return true;
        return this.options.inventory
            .items()
            .some((item) => TOOL_SUFFIXES.some((suffix) => item.name.endsWith(suffix)));
    }

    private completed(request: ActionRequest): Result<ActionOutcome, string> {
        return [{ request, status: 'completed' }, null];
    }

    private fail(
        request: ActionRequest,
        failureClass: ActionFailure['class'],
        message: string,
    ): Result<ActionOutcome, string> {
        return [
            {
                request,
                status: 'failed',
                message,
                failure: { class: failureClass, message },
            },
            null,
        ];
    }

    private static needsTool(blockId: string): boolean {
        return !['dirt', 'grass_block', 'sand', 'oak_log', 'oak_leaves'].includes(blockId);
    }

    private static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }
}
