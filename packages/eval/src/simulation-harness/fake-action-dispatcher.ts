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
    latencyMilliseconds?: number;
    recipes?: Readonly<Record<string, Readonly<Record<string, number>>>>;
    drops?: Readonly<Record<string, string>>;
    outputs?: Readonly<Record<string, number>>;
}

interface PendingAction {
    outcome: ActionOutcome;
    readyAt: number;
}

const PLACEABLE = new Set(['air', 'water', 'lava', 'short_grass', 'tall_grass']);
const TOOL_SUFFIXES = ['_pickaxe', '_axe', '_shovel', '_hoe', '_sword'];
const SEED_CROPS: Readonly<Record<string, string>> = {
    beetroot_seeds: 'beetroots',
    carrot: 'carrots',
    melon_seeds: 'melon_stem',
    nether_wart: 'nether_wart',
    potato: 'potatoes',
    pumpkin_seeds: 'pumpkin_stem',
    sweet_berries: 'sweet_berry_bush',
    wheat_seeds: 'wheat',
};

export class FakeActionDispatcher {
    private sequence = 0;
    private latencyMilliseconds: number;
    private readonly pending = new Map<string, PendingAction>();
    private readonly unreachable = new Set<string>();
    private readonly recipes: Map<string, Readonly<Record<string, number>>>;
    private injectedFailures = 0;
    private injectedFailureKinds: ReadonlySet<string> | null = null;

    constructor(private readonly options: FakeActionDispatcherOptions) {
        this.latencyMilliseconds = options.latencyMilliseconds ?? 0;
        this.recipes = new Map(Object.entries(options.recipes ?? {}));
    }

    setLatencyMilliseconds(milliseconds: number): void {
        this.latencyMilliseconds = Math.max(0, milliseconds);
    }

    removeRecipe(itemName: string): void {
        this.recipes.delete(itemName);
    }

    injectFailures(count = 1, kinds?: readonly string[]): void {
        this.injectedFailures = Math.max(this.injectedFailures, count);
        this.injectedFailureKinds =
            kinds === undefined || kinds.length === 0 ? null : new Set(kinds);
    }

    dispatch(request: ActionRequest): Result<string, string> {
        const handle = `action.${this.sequence}`;
        this.sequence += 1;
        if (
            this.injectedFailures > 0 &&
            (this.injectedFailureKinds === null || this.injectedFailureKinds.has(request.kind))
        ) {
            this.injectedFailures -= 1;
            const [failure, failureError] = this.fail(
                request,
                'execution-failed',
                'injected action failure',
            );
            if (failureError !== null) return [null, failureError];
            if (failure === null) return [null, 'injected failure produced no outcome'];
            const handle = `action.${this.sequence}`;
            this.sequence += 1;
            this.pending.set(handle, {
                outcome: failure,
                readyAt: this.options.clock.now() + this.latencyMilliseconds,
            });
            return [handle, null];
        }
        const [outcome, error] = this.execute(request);
        if (error !== null) return [null, error];
        if (outcome === null) return [null, 'action produced no outcome'];
        this.pending.set(handle, {
            outcome,
            readyAt: this.options.clock.now() + this.latencyMilliseconds,
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
            case 'smelt':
                return this.completed(request);
            case 'transfer':
                return this.transfer(request);
            case 'consume':
                return this.completed(request);
            case 'equip':
                return this.options.inventory.count(request.itemName) > 0
                    ? this.completed(request)
                    : this.fail(request, 'missing-item', `missing ${request.itemName}`);
            case 'attack':
            case 'use-entity':
                return this.interactWithEntity(request);
            case 'use-block':
                return this.useBlock(request);
            case 'look-at':
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
        const drop = this.options.drops?.[current.name] ?? current.name;
        this.options.inventory.add(drop, 1);
        return this.completed(request);
    }

    private interactWithEntity(
        request: Extract<ActionRequest, { kind: 'attack' | 'use-entity' }>,
    ): Result<ActionOutcome, string> {
        const target = this.options.world
            .entities()
            .find(
                (entity) =>
                    (request.entityId !== undefined && entity.id === request.entityId) ||
                    (request.entityId === undefined &&
                        entity.name === (request.entityName ?? entity.name)),
            );
        if (target === undefined) {
            return this.fail(request, 'target-missing', 'entity target is missing');
        }
        if (target.name === 'sheep') {
            const [added, addError] = this.options.inventory.add('white_wool', 1);
            if (addError !== null || added === null) {
                return this.fail(request, 'execution-failed', addError ?? 'wool add failed');
            }
        }
        return this.completed(request);
    }

    private useBlock(
        request: Extract<ActionRequest, { kind: 'use-block' }>,
    ): Result<ActionOutcome, string> {
        const itemName = request.itemName;
        if (itemName === undefined) return this.completed(request);
        const crop = SEED_CROPS[itemName];
        if (crop === undefined) return this.completed(request);
        const soil = this.options.world.blockAt(request.position);
        if (soil !== 'farmland') return this.completed(request);
        if (this.options.inventory.count(itemName) === 0) {
            return this.fail(request, 'missing-item', `missing ${itemName}`);
        }
        const [, removeError] = this.options.inventory.remove(itemName, 1);
        if (removeError !== null) {
            return this.fail(request, 'missing-item', removeError);
        }
        this.options.world.applyBlock(
            { x: request.position.x, y: request.position.y + 1, z: request.position.z },
            { name: crop, properties: { age: '0' } },
        );
        return this.completed(request);
    }

    private craft(
        request: Extract<ActionRequest, { kind: 'craft' }>,
    ): Result<ActionOutcome, string> {
        const recipe = this.recipes.get(request.itemName);
        if (recipe === undefined) {
            return this.fail(request, 'missing-item', `missing recipe for ${request.itemName}`);
        }
        const available = Object.entries(recipe).every(
            ([item, count]) => this.options.inventory.count(item) >= count,
        );
        if (!available) {
            return this.fail(
                request,
                'missing-item',
                `missing ingredients for ${request.itemName}`,
            );
        }
        Object.entries(recipe).forEach(([item, count]) => {
            this.options.inventory.remove(item, count);
        });
        this.options.inventory.add(
            request.itemName,
            request.count * (this.options.outputs?.[request.itemName] ?? 1),
        );
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
