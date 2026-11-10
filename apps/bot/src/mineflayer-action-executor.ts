import {
    type ActionDispatchPort,
    type ActionFailure,
    type ActionOutcome,
    type ActionRequest,
    attempt,
    attemptAsync,
    type LoggerPort,
    type Result,
    type Vec3 as CoreVec3,
} from '@ticrafter/core';
import type { Bot } from 'mineflayer';
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

interface ActiveAction {
    id: string;
    request: ActionRequest;
    outcome: ActionOutcome | null;
}

export class MineflayerActionExecutor implements ActionDispatchPort {
    private active: ActiveAction | null = null;

    constructor(
        private readonly bot: Bot,
        private readonly logger: LoggerPort,
    ) {}

    install(): Result<void, string> {
        const [, error] = attempt(() => {
            this.bot.loadPlugin(pathfinder);
            this.bot.pathfinder.setMovements(new Movements(this.bot));
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
        this.bot.pathfinder.stop();
        this.bot.stopDigging();
        this.bot.clearControlStates();
        this.active = null;
        return [undefined, null];
    }

    private async run(handleId: string, request: ActionRequest): Promise<void> {
        const [outcome, failure] = await this.execute(request);
        if (this.active?.id !== handleId) return;
        if (outcome !== null) {
            this.active.outcome = outcome;
            return;
        }
        if (failure !== null) {
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
                return this.placeBlock(request.position, request.itemName);
            case 'use-block':
                return this.useBlock(request.position);
            case 'attack':
                return this.attack(request.entityId, request.entityName);
            case 'equip':
                return this.equip(request.itemName, request.destination ?? 'hand');
            case 'consume':
                return this.consume(request.itemName);
            case 'craft':
                return this.craft(request.itemName, request.count);
            case 'collect-drops':
                return this.collectDrops(request.radius);
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

    private async moveTo(position: CoreVec3, range: number): Promise<Result<void, string>> {
        const [, error] = await attemptAsync(() =>
            this.withTimeout(
                this.bot.pathfinder.goto(
                    new goals.GoalNear(position.x, position.y, position.z, range),
                ),
            ),
        );
        if (error) return [null, this.describe(error)];
        return [undefined, null];
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
        const block = this.bot.blockAt(this.vector(position));
        if (block === null || block.name === 'air') return [null, 'target block is missing'];
        if (expectedBlockId !== undefined && block.name !== expectedBlockId) {
            return [null, `expected ${expectedBlockId}, found ${block.name}`];
        }
        const [, error] = await attemptAsync(() => this.bot.dig(block));
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async placeBlock(position: CoreVec3, itemName: string): Promise<Result<void, string>> {
        const item = this.findItem(itemName);
        if (item === null) return [null, `missing item ${itemName}`];
        const [, approachError] = await this.ensureNear(position, 3);
        if (approachError) return [null, approachError];
        const reference = this.bot.blockAt(this.vector({ ...position, y: position.y - 1 }));
        if (reference === null) return [null, 'placement reference is missing'];
        const [, equipError] = await this.equip(itemName, 'hand');
        if (equipError) return [null, equipError];
        const [, placeError] = await attemptAsync(() =>
            this.bot.placeBlock(reference, new Vec3(0, 1, 0)),
        );
        if (placeError) return [null, this.describe(placeError)];
        return [undefined, null];
    }

    private async useBlock(position: CoreVec3): Promise<Result<void, string>> {
        const [, approachError] = await this.ensureNear(position, 3);
        if (approachError) return [null, approachError];
        const block = this.bot.blockAt(this.vector(position));
        if (block === null) return [null, 'target block is missing'];
        const [, error] = await attemptAsync(() => this.bot.activateBlock(block));
        if (error) return [null, this.describe(error)];
        return [undefined, null];
    }

    private async attack(
        entityId: number | undefined,
        entityName: string | undefined,
    ): Promise<Result<void, string>> {
        const entity = this.findEntity(entityId, entityName);
        if (entity === null) return [null, 'hostile entity is missing'];
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

    private async collectDrops(radius: number): Promise<Result<void, string>> {
        const drop = this.nearestDrop(radius);
        if (drop === null) return [undefined, null];
        const [, error] = await this.moveTo(
            { x: drop.position.x, y: drop.position.y, z: drop.position.z },
            1,
        );
        if (error) return [null, error];
        return this.delay(750);
    }

    private async transfer(request: {
        direction: 'deposit' | 'withdraw';
        container: CoreVec3;
        itemName: string;
        count: number;
    }): Promise<Result<void, string>> {
        const [, approachError] = await this.ensureNear(request.container, 3);
        if (approachError) return [null, approachError];
        const block = this.bot.blockAt(this.vector(request.container));
        if (block === null) return [null, 'container is missing'];
        const itemType = this.bot.registry.itemsByName[request.itemName];
        if (itemType === undefined) return [null, `unknown item ${request.itemName}`];
        const [container, openError] = await attemptAsync(() => this.bot.openContainer(block));
        if (openError || container === null) {
            return [null, this.describe(openError ?? 'container returned null')];
        }
        const [, transferError] = await attemptAsync(() =>
            request.direction === 'deposit'
                ? container.deposit(itemType.id, null, request.count)
                : container.withdraw(itemType.id, null, request.count),
        );
        const [, closeError] = await attemptAsync(() => container.close());
        if (transferError) return [null, this.describe(transferError)];
        if (closeError) return [null, this.describe(closeError)];
        return [undefined, null];
    }

    private async delay(milliseconds: number): Promise<Result<void, string>> {
        await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
        return [undefined, null];
    }

    private async withTimeout<T>(operation: Promise<T>, milliseconds = 20_000): Promise<T> {
        return Promise.race([
            operation,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('action timed out')), milliseconds),
            ),
        ]);
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

    private nearestDrop(radius: number) {
        const drops = Object.values(this.bot.entities)
            .filter((entity) => entity.name === 'item')
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
        if (lowercase.includes('no path') || lowercase.includes('timed out')) {
            return { class: 'no-path', message };
        }
        if (lowercase.includes('missing item') || lowercase.includes('no recipe')) {
            return { class: 'missing-item', message };
        }
        if (lowercase.includes('target') || lowercase.includes('missing')) {
            return { class: 'target-missing', message };
        }
        if (request.kind === 'attack' && lowercase.includes('entity')) {
            return { class: 'target-missing', message };
        }
        return { class: 'execution-failed', message };
    }

    private describe(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}
