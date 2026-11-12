import {
    type ActionDispatchPort,
    type ActionFailure,
    type ActionOutcome,
    type ActionRequest,
    attempt,
    attemptAsync,
    type ContainerSlot,
    type LoggerPort,
    type Result,
    type Vec3 as CoreVec3,
} from '@ticrafter/core';
import type { Bot } from 'mineflayer';
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

import { ReachRateGuard } from './reach-rate-guard.js';

interface ActiveAction {
    id: string;
    request: ActionRequest;
    outcome: ActionOutcome | null;
}

interface ContainerItem {
    name: string;
    count: number;
}

interface OpenContainer {
    slots: Array<ContainerItem | null>;
    inventoryStart: number;
    close: () => Promise<void>;
}

const FURNACE_SLOTS: Record<ContainerSlot, number> = {
    input: 0,
    fuel: 1,
    output: 2,
};

const DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 20_000;
const CONTAINER_MOVE_TIMEOUT_MILLISECONDS = 10_000;
const LONG_DISTANCE_SPRINT_THRESHOLD = 24;

type ShortcutCapablePathfinder = Bot['pathfinder'] & {
    enablePathShortcut: boolean;
};

export class MineflayerActionExecutor implements ActionDispatchPort {
    private active: ActiveAction | null = null;
    private lastFailureValue: ActionFailure | null = null;
    private lastFailureTime: string | null = null;

    constructor(
        private readonly bot: Bot,
        private readonly logger: LoggerPort,
        private readonly timeoutMilliseconds = DEFAULT_ACTION_TIMEOUT_MILLISECONDS,
        private readonly reachRateGuard: ReachRateGuard | null = null,
    ) {}

    get lastFailure(): ActionFailure | null {
        return this.lastFailureValue;
    }

    get lastFailureAt(): string | null {
        return this.lastFailureTime;
    }

    install(): Result<void, string> {
        const [, error] = attempt(() => {
            this.bot.loadPlugin(pathfinder);
            const movements = new Movements(this.bot);
            movements.allowSprinting = true;
            movements.allowParkour = true;
            this.bot.pathfinder.setMovements(movements);
        });
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    dispatch(request: ActionRequest): Result<string, string> {
        if (this.active !== null) return [null, 'an action is already running'];
        const id = crypto.randomUUID();
        this.active = { id, request, outcome: null };
        void this.run(id, request);
        return [id, null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        if (this.active === null || this.active.id !== handleId) {
            return [null, `unknown action handle ${handleId}`];
        }
        if (this.active.outcome === null) return [null, null];
        const outcome = this.active.outcome;
        this.active = null;
        return [outcome, null];
    }

    cancel(handleId: string): Result<void, string> {
        if (this.active === null || this.active.id !== handleId) {
            return [null, `unknown action handle ${handleId}`];
        }
        this.stopMovement();
        this.active = null;
        return [undefined, null];
    }

    private async run(handleId: string, request: ActionRequest): Promise<void> {
        const [outcome, failure] = await this.execute(request);
        if (this.active?.id !== handleId) return;
        if (outcome !== null) {
            this.lastFailureValue = null;
            this.lastFailureTime = null;
            this.active.outcome = outcome;
            return;
        }
        if (failure !== null) {
            this.recordFailure(failure);
            this.active.outcome = {
                request,
                status: 'failed',
                message: failure.message,
                failure,
            };
        }
    }

    private async execute(request: ActionRequest): Promise<Result<ActionOutcome, ActionFailure>> {
        const [result, outerError] = await attemptAsync(() => this.perform(request));
        if (outerError) {
            return [null, this.failureFor(request, this.describe(outerError))];
        }
        if (result === null) return [null, { class: 'execution-failed', message: 'action null' }];
        if (result[1] !== null) return [null, this.failureFor(request, result[1])];
        return [{ request, status: 'completed' }, null];
    }

    private async perform(request: ActionRequest): Promise<Result<void, string>> {
        switch (request.kind) {
            case 'move-to':
                return this.moveTo(request.position, request.range ?? 1);
            case 'follow-path':
                return this.followPath(request.waypoints, request.range ?? 1);
            case 'break-block':
                return this.breakBlock(request.position, request.expectedBlockId);
            case 'place-block':
                return this.placeBlock(
                    request.position,
                    request.itemName,
                    request.reference,
                    request.face,
                );
            case 'use-block':
                return this.useBlock(request.position, request.itemName);
            case 'attack':
                return this.attack(request.entityId, request.entityName);
            case 'equip':
                return this.equip(request.itemName, request.destination ?? 'hand');
            case 'consume':
                return this.consume(request.itemName);
            case 'craft':
                return this.craft(request.itemName, request.count);
            case 'collect-drops':
                return this.collectDrops(request.radius, request.itemName);
            case 'transfer':
                return this.transfer(request);
            case 'wait':
                return this.delay(request.milliseconds);
        }
    }

    private async ensureNear(position: CoreVec3, range: number): Promise<Result<void, string>> {
        const distance = this.bot.entity.position.distanceTo(this.vector(position));
        if (distance <= range) return [undefined, null];
        return this.moveTo(position, range);
    }

    private enforceGuard(target: CoreVec3 | null): Result<void, string> {
        if (this.reachRateGuard === null) return [undefined, null];
        const [, guardError] = this.reachRateGuard.evaluate(this.bot.entity.position, target);
        if (guardError) return [null, ReachRateGuard.describe(guardError)];
        return [undefined, null];
    }

    private async moveTo(position: CoreVec3, range: number): Promise<Result<void, string>> {
        const pathfinder = this.bot.pathfinder as ShortcutCapablePathfinder;
        const previousPathShortcut = pathfinder.enablePathShortcut;
        pathfinder.enablePathShortcut = previousPathShortcut || this.isLongDistance(position);
        const [, error] = await attemptAsync(() =>
            this.withTimeout(
                this.bot.pathfinder.goto(
                    new goals.GoalNear(position.x, position.y, position.z, range),
                ),
                this.timeoutMilliseconds,
            ),
        );
        pathfinder.enablePathShortcut = previousPathShortcut;
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private isLongDistance(position: CoreVec3): boolean {
        const distance = this.bot.entity.position.distanceTo(this.vector(position));
        return distance > LONG_DISTANCE_SPRINT_THRESHOLD;
    }

    private async followPath(
        waypoints: readonly CoreVec3[],
        range: number,
    ): Promise<Result<void, string>> {
        for (const waypoint of waypoints) {
            const [, error] = await this.moveTo(waypoint, range);
            if (error) return [null, error];
        }
        return [undefined, null];
    }

    private async breakBlock(
        position: CoreVec3,
        expectedBlockId: string | undefined,
    ): Promise<Result<void, string>> {
        const [, approachError] = await this.ensureNear(position, 3);
        if (approachError) return [null, approachError];
        const [, guardError] = this.enforceGuard(position);
        if (guardError) return [null, guardError];
        const block = this.bot.blockAt(this.vector(position));
        if (block === null || block.name === 'air') return [null, 'target block is missing'];
        if (expectedBlockId !== undefined && block.name !== expectedBlockId) {
            return [null, `expected ${expectedBlockId}, found ${block.name}`];
        }
        const [, toolError] = await this.equipBestTool(block);
        if (toolError) return [null, toolError];
        const [, error] = await attemptAsync(() => this.bot.dig(block));
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async equipBestTool(block: {
        harvestTools?: Record<number, boolean> | null;
    }): Promise<Result<void, string>> {
        const tools = this.bot.inventory
            .items()
            .filter((item) => block.harvestTools?.[item.type] === true);
        const tool = tools[0];
        if (tool === undefined) return [undefined, null];
        const [, equipError] = await attemptAsync(() => this.bot.equip(tool, 'hand'));
        if (equipError) return [null, this.describe(equipError)];
        return [undefined, null];
    }

    private async placeBlock(
        position: CoreVec3,
        itemName: string,
        referencePosition?: CoreVec3,
        face?: CoreVec3,
    ): Promise<Result<void, string>> {
        const item = this.findItem(itemName);
        if (item === null) return [null, `missing item ${itemName}`];
        const referencePoint = referencePosition ?? { ...position, y: position.y - 1 };
        const [, approachError] = await this.ensureNear(referencePoint, 3);
        if (approachError) return [null, approachError];
        const [, guardError] = this.enforceGuard(position);
        if (guardError) return [null, guardError];
        const reference = this.bot.blockAt(this.vector(referencePoint));
        if (reference === null) return [null, 'placement reference is missing'];
        const [, equipError] = await this.equip(itemName, 'hand');
        if (equipError) return [null, equipError];
        const faceVector = face ?? { x: 0, y: 1, z: 0 };
        const [, placeError] = await attemptAsync(() =>
            this.withTimeout(
                this.bot.placeBlock(reference, new Vec3(faceVector.x, faceVector.y, faceVector.z)),
                this.timeoutMilliseconds,
            ),
        );
        if (placeError) return [null, this.describe(placeError)];
        return [undefined, null];
    }

    private async useBlock(position: CoreVec3, itemName?: string): Promise<Result<void, string>> {
        if (itemName !== undefined) {
            const [, equipError] = await this.equip(itemName, 'hand');
            if (equipError) return [null, equipError];
        }
        const [, approachError] = await this.ensureNear(position, 3);
        if (approachError) return [null, approachError];
        const [, guardError] = this.enforceGuard(position);
        if (guardError) return [null, guardError];
        const block = this.bot.blockAt(this.vector(position));
        if (block === null) return [null, 'target block is missing'];
        const [, error] = await attemptAsync(() =>
            this.withTimeout(this.bot.activateBlock(block), this.timeoutMilliseconds),
        );
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async attack(
        entityId: number | undefined,
        entityName: string | undefined,
    ): Promise<Result<void, string>> {
        const entity = this.findEntity(entityId, entityName);
        if (entity === null) return [null, 'hostile entity is missing'];
        const [, guardError] = this.enforceGuard(entity.position);
        if (guardError) return [null, guardError];
        this.bot.attack(entity);
        return [undefined, null];
    }

    private async equip(
        itemName: string,
        destination: 'hand' | 'off-hand',
    ): Promise<Result<void, string>> {
        const item = this.findItem(itemName);
        if (item === null) return [null, `missing item ${itemName}`];
        const [, error] = await attemptAsync(() => this.bot.equip(item, destination));
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async consume(itemName: string | undefined): Promise<Result<void, string>> {
        if (itemName !== undefined) {
            const [, equipError] = await this.equip(itemName, 'hand');
            if (equipError) return [null, equipError];
        }
        const [, error] = await attemptAsync(() => this.bot.consume());
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async craft(itemName: string, count: number): Promise<Result<void, string>> {
        const itemType = this.bot.registry.itemsByName[itemName];
        if (itemType === undefined) return [null, `unknown item ${itemName}`];
        const table = this.findCraftingTable();
        if (table !== null) {
            const [, approachError] = await this.ensureNear(
                { x: table.position.x, y: table.position.y, z: table.position.z },
                3,
            );
            if (approachError) return [null, approachError];
            const [, guardError] = this.enforceGuard(table.position);
            if (guardError) return [null, guardError];
        }
        const recipes = this.bot.recipesFor(itemType.id, null, count, table);
        const recipe = recipes[0];
        if (recipe === undefined) return [null, `no recipe for ${itemName}`];
        const [, error] = await attemptAsync(() =>
            this.bot.craft(recipe, count, table ?? undefined),
        );
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async collectDrops(radius: number, itemName?: string): Promise<Result<void, string>> {
        for (let attempt = 0; attempt < 16; attempt += 1) {
            const drop = this.nearestDrop(radius, itemName);
            if (drop === null) return [undefined, null];
            const [, error] = await this.moveTo(
                { x: drop.position.x, y: drop.position.y, z: drop.position.z },
                1,
            );
            if (error) return [null, error];
            await this.delay(300);
        }
        return [undefined, null];
    }

    private async transfer(request: {
        direction: 'deposit' | 'withdraw';
        container: CoreVec3;
        itemName: string;
        count: number;
        slot?: ContainerSlot;
    }): Promise<Result<void, string>> {
        const [, approachError] = await this.ensureNear(request.container, 3);
        if (approachError) return [null, approachError];
        const [, guardError] = this.enforceGuard(request.container);
        if (guardError) return [null, guardError];
        const block = this.bot.blockAt(this.vector(request.container));
        if (block === null) return [null, 'container is missing'];
        const itemType = this.bot.registry.itemsByName[request.itemName];
        if (itemType === undefined) return [null, `unknown item ${request.itemName}`];
        const [opened, openError] = await attemptAsync(() => this.bot.openContainer(block));
        if (openError || opened === null) {
            return [null, this.describe(openError ?? 'container returned null')];
        }
        const container: OpenContainer = opened;
        const slot = request.slot;
        const [transferError] =
            slot === undefined
                ? await attemptAsync(() =>
                      request.direction === 'deposit'
                          ? opened.deposit(itemType.id, null, request.count)
                          : opened.withdraw(itemType.id, null, request.count),
                  )
                : await this.moveContainerItem(container, {
                      direction: request.direction,
                      itemName: request.itemName,
                      slot,
                  });
        const [, closeError] = await attemptAsync(() => opened.close());
        if (transferError) return [null, this.describe(transferError)];
        if (closeError) return [null, this.describe(closeError)];
        return [undefined, null];
    }

    private async moveContainerItem(
        container: OpenContainer,
        request: {
            direction: 'deposit' | 'withdraw';
            itemName: string;
            slot: ContainerSlot;
        },
    ): Promise<Result<void, string>> {
        const containerSlot = FURNACE_SLOTS[request.slot];
        if (request.direction === 'deposit') {
            if (request.slot === 'output') {
                return [null, 'cannot deposit into the output slot'];
            }
            const occupied = container.slots[containerSlot];
            if (occupied !== null && occupied !== undefined && occupied.name !== request.itemName) {
                return [null, `${request.slot} slot is occupied by ${occupied.name}`];
            }
            const sourceSlot = this.firstSlot(container, (item) => item.name === request.itemName);
            if (sourceSlot === null) return [null, `missing item ${request.itemName}`];
            return this.moveSlot(sourceSlot, containerSlot);
        }
        const source = container.slots[containerSlot];
        if (source === null || source === undefined) {
            return [null, `${request.slot} slot is empty`];
        }
        if (source.name !== request.itemName) {
            return [null, `${request.slot} slot contains ${source.name}`];
        }
        const destinationSlot = this.firstEmptyInventorySlot(container);
        if (destinationSlot === null) return [null, 'inventory is full'];
        return this.moveSlot(containerSlot, destinationSlot);
    }

    private async moveSlot(
        sourceSlot: number,
        destinationSlot: number,
    ): Promise<Result<void, string>> {
        const [, error] = await attemptAsync(() =>
            this.withTimeout(
                this.bot.moveSlotItem(sourceSlot, destinationSlot),
                CONTAINER_MOVE_TIMEOUT_MILLISECONDS,
            ),
        );
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private firstSlot(
        container: OpenContainer,
        predicate: (item: ContainerItem) => boolean,
    ): number | null {
        const index = container.slots.findIndex(
            (item, slot) =>
                slot >= container.inventoryStart &&
                item !== null &&
                item !== undefined &&
                predicate(item),
        );
        return index === -1 ? null : index;
    }

    private firstEmptyInventorySlot(container: OpenContainer): number | null {
        const index = container.slots.findIndex(
            (item, slot) =>
                slot >= container.inventoryStart && (item === null || item === undefined),
        );
        return index === -1 ? null : index;
    }

    private async delay(milliseconds: number): Promise<Result<void, string>> {
        await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
        return [undefined, null];
    }

    private withTimeout<T>(
        operation: Promise<T>,
        milliseconds = this.timeoutMilliseconds,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.stopMovement();
                reject(new Error(`action timed out after ${milliseconds}ms`));
            }, milliseconds);
            operation.then(
                (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                (error: unknown) => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        });
    }

    private stopMovement(): void {
        attempt(() => this.bot.pathfinder.stop());
        attempt(() => this.bot.stopDigging());
        attempt(() => this.bot.clearControlStates());
    }

    private recordFailure(failure: ActionFailure): void {
        this.lastFailureValue = failure;
        this.lastFailureTime = new Date().toISOString();
    }

    private findItem(itemName: string) {
        return this.bot.inventory.items().find((item) => item.name === itemName) ?? null;
    }

    private findEntity(entityId: number | undefined, entityName: string | undefined) {
        if (entityId !== undefined) return this.bot.entities[entityId] ?? null;
        return (
            Object.values(this.bot.entities).find(
                (entity) => entityName !== undefined && entity.name === entityName,
            ) ?? null
        );
    }

    private nearestDrop(radius: number, itemName?: string) {
        const drops = Object.values(this.bot.entities)
            .filter((entity) => entity.name === 'item')
            .filter((entity) => {
                if (itemName === undefined) return true;
                return this.droppedItemName(entity) === itemName;
            })
            .map((entity) => ({
                entity,
                distance: this.bot.entity.position.distanceTo(entity.position),
            }))
            .filter((candidate) => candidate.distance <= radius);
        if (drops.length === 0) return null;
        return drops.reduce((nearest, current) =>
            current.distance < nearest.distance ? current : nearest,
        ).entity;
    }

    private droppedItemName(entity: {
        getDroppedItem?: () => { name: string } | null;
    }): string | null {
        if (typeof entity.getDroppedItem !== 'function') return null;
        return entity.getDroppedItem()?.name ?? null;
    }

    private findCraftingTable() {
        const tableId = this.bot.registry.blocksByName.crafting_table?.id;
        if (tableId === undefined) return null;
        return this.bot.findBlock({ matching: tableId, maxDistance: 32 });
    }

    private vector(position: CoreVec3): Vec3 {
        return new Vec3(position.x, position.y, position.z);
    }

    private failureFor(request: ActionRequest, message: string): ActionFailure {
        const lowercase = message.toLowerCase();
        return { class: this.failureClassFor(request, lowercase), message };
    }

    private failureClassFor(request: ActionRequest, lowercase: string): ActionFailure['class'] {
        if (lowercase.includes('timed out') || lowercase.includes('timeout')) {
            return 'timeout';
        }
        if (lowercase.includes('no path')) return 'no-path';
        if (
            lowercase.includes('missing item') ||
            lowercase.includes('no recipe') ||
            lowercase.includes('unknown item')
        ) {
            return 'missing-item';
        }
        if (
            lowercase.includes('tool') ||
            lowercase.includes('harvest') ||
            lowercase.includes('cannot dig') ||
            lowercase.includes("can't dig")
        ) {
            return 'missing-tool';
        }
        if (request.kind === 'attack' && lowercase.includes('entity')) {
            return 'target-missing';
        }
        if (lowercase.includes('target') || lowercase.includes('missing')) {
            return 'target-missing';
        }
        return 'execution-failed';
    }

    private describe(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}
