import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import { type BotPlatformPorts, HeadlessBotRuntime } from '@ticrafter/bot/headless';
import type { ClaimRecord } from '@ticrafter/coordinator/claims';
import { ClaimRepository } from '@ticrafter/coordinator/claims';
import { TaskRepository } from '@ticrafter/coordinator/tasks';
import {
    attempt,
    type BehaviorTraceEntry,
    type LoggerPort,
    MessageSchemaRegistry,
    type Result,
    type Vec3,
} from '@ticrafter/core';
import { BlockChangelogReader, EventLogWriter } from '@ticrafter/memory';
import { MemoryCheckpointStore } from '@ticrafter/skills';

import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import type {
    AssertionContext,
    AssertionResult,
    StoredTaskView,
} from '../behavior-assertions/index.js';
import { AssertionEngine } from '../behavior-assertions/index.js';
import type {
    ScenarioDefinition,
    ScenarioDriver,
    ScenarioObservation,
} from '../scenario-runner/index.js';
import { ArtifactWriter } from './artifacts.js';
import { BehaviorMetricsReader } from './behavior-metrics.js';
import { CoordinatorRunner, type RunningCoordinator } from './coordinator-runner.js';
import { FakeActionDispatcher } from './fake-action-dispatcher.js';
import { FakeChat } from './fake-chat.js';
import { FakeContainers } from './fake-containers.js';
import { FakeInventory } from './fake-inventory.js';
import { FakePerception } from './fake-perception.js';
import { FakeProcurementCatalog } from './fake-procurement.js';
import { FakeSafetySnapshots } from './fake-safety.js';
import { FakeWorld } from './fake-world.js';
import type { BehaviorScenario, ScenarioFault } from './scenario.js';
import { SimulationClock } from './simulation-clock.js';
import { SimulationKernel } from './simulation-kernel.js';
import { TraceRecorder } from './trace-recorder.js';

export interface SimulatedFleetDriverOptions {
    repositoryRoot: string;
    artifactDirectory: string;
    scenario: BehaviorScenario;
}

class NullLogger implements LoggerPort {
    debug(): void {}
    info(): void {}
    warn(): void {}
    error(): void {}
}

interface BotFixture {
    runtime: HeadlessBotRuntime;
    world: FakeWorld;
    inventory: FakeInventory;
    dispatcher: FakeActionDispatcher;
    chat: FakeChat;
    position: Vec3;
    restart: () => Promise<Result<void, string>>;
}

export class SimulatedFleetDriver implements ScenarioDriver {
    private clock: SimulationClock | null = null;
    private world: FakeWorld | null = null;
    private containers: FakeContainers | null = null;
    private dataDirectory: string | null = null;
    private coordinator: RunningCoordinator | null = null;
    private bots: BotFixture[] = [];
    private readonly trace = new TraceRecorder();

    constructor(private readonly options: SimulatedFleetDriverOptions) {}

    start(_definition: ScenarioDefinition): Result<void, string> {
        const scenario = this.options.scenario;
        const [directory, directoryError] = SimulatedFleetDriver.temporaryDirectory();
        if (directoryError) return [null, directoryError];
        this.dataDirectory = directory;
        this.clock = new SimulationClock(scenario.startTime.timeOfDay * 50);
        const [world, worldError] = SimulatedFleetDriver.createWorld(scenario);
        if (worldError || world === null) return [null, worldError ?? 'world failed'];
        this.world = world;
        this.containers = new FakeContainers();
        if (scenario.bots[0] === undefined) return [null, 'scenario has no bots'];
        return [undefined, null];
    }

    async run(_definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>> {
        const scenario = this.options.scenario;
        const clock = this.clock;
        const world = this.world;
        const containers = this.containers;
        const dataDirectory = this.dataDirectory;
        if (clock === null || world === null || containers === null || dataDirectory === null) {
            return [null, 'simulation was not started'];
        }
        const [startedCoordinator, coordinatorError] = await CoordinatorRunner.start({
            repositoryRoot: this.options.repositoryRoot,
            dataDirectory,
            scenario,
            clock,
        });
        if (coordinatorError || startedCoordinator === null) {
            return [null, coordinatorError ?? 'coordinator failed'];
        }
        let coordinator: RunningCoordinator = startedCoordinator;
        this.coordinator = coordinator;
        const [bots, botError] = await this.startBots(
            scenario,
            coordinator,
            world,
            containers,
            clock,
        );
        if (botError || bots === null) {
            await coordinator.close();
            return [null, botError ?? 'bots failed'];
        }
        this.bots = bots;
        const deliveredChat = new Set<number>();
        const appliedFaults = new Set<number>();
        let lastAssertionCheck = Number.NEGATIVE_INFINITY;
        let currentTick = 0;
        let faultError: string | null = null;
        const [ticks, kernelError] = await new SimulationKernel({
            clock,
            maximumTicks: scenario.durationTicks ?? scenario.timeoutTicks,
            ...(scenario.durationTicks === undefined
                ? {}
                : { durationTicks: scenario.durationTicks }),
            shouldStop: () => {
                if (faultError !== null) return true;
                if (scenario.durationTicks !== undefined) return false;
                if (scenario.stopOnAssertions !== true) {
                    return SimulatedFleetDriver.terminal(coordinator, scenario);
                }
                if (currentTick < (scenario.assertionCheckAfterTick ?? 0)) return false;
                if (clock.now() - lastAssertionCheck < 2500) return false;
                lastAssertionCheck = clock.now();
                const context = SimulatedFleetDriver.assertionContext(
                    coordinator,
                    world,
                    bots,
                    clock.now() - scenario.startTime.timeOfDay * 50,
                );
                return AssertionEngine.evaluate(scenario.assertions, context).every(
                    (assertion) => assertion.passed,
                );
            },
            onTick: async (tick) => {
                currentTick = tick;
                for (const [index, fault] of (scenario.faults ?? []).entries()) {
                    if (fault.atTick !== tick || appliedFaults.has(index)) continue;
                    appliedFaults.add(index);
                    if (fault.type === 'coordinator-restart') {
                        for (const bot of bots) bot.runtime.close();
                        await coordinator.close();
                        const [next, restartError] = await CoordinatorRunner.start({
                            repositoryRoot: this.options.repositoryRoot,
                            dataDirectory,
                            scenario,
                            clock,
                            transportPort: coordinator.config.transport.port,
                            opsPort: coordinator.config.ops.port,
                            seed: false,
                        });
                        if (restartError !== null || next === null) {
                            faultError = restartError ?? 'coordinator restart failed';
                            return;
                        }
                        coordinator = next;
                        this.coordinator = next;
                        for (const bot of bots) {
                            const [, botError] = await bot.restart();
                            if (botError !== null) {
                                faultError = botError;
                                return;
                            }
                        }
                        continue;
                    }
                    const applied = await SimulatedFleetDriver.applyFault(fault, {
                        bots,
                        coordinator,
                        world,
                        clock,
                    });
                    if (applied !== null) {
                        faultError = applied;
                        return;
                    }
                }
                this.trace.record({
                    tick,
                    at: new Date(clock.now()).toISOString(),
                    botId: null,
                    kind: 'task',
                    summary: 'simulation tick',
                    data: { pendingTimers: clock.pendingTimers() },
                });
                SimulatedFleetDriver.deliverChat(scenario, bots, deliveredChat, tick);
            },
        }).run();
        if (faultError !== null) return [null, faultError];
        const assertionContext = SimulatedFleetDriver.assertionContext(
            coordinator,
            world,
            bots,
            clock.now() - scenario.startTime.timeOfDay * 50,
        );
        SimulatedFleetDriver.recordBehavior(this.trace, assertionContext.behavior);
        const assertions = AssertionEngine.evaluate(scenario.assertions, assertionContext);
        const reasons =
            kernelError === null ? SimulatedFleetDriver.reasons(assertions) : [kernelError];
        const observation: ScenarioObservation = {
            passed: reasons.length === 0,
            reasons,
            events: assertionContext.events.length,
            duplicates: SimulatedFleetDriver.duplicates(assertionContext),
            claimConflicts: 0,
        };
        const [, artifactError] = ArtifactWriter.write(this.options.artifactDirectory, {
            scenarioId: scenario.id,
            passed: observation.passed,
            reasons,
            assertions,
            trace: this.trace.list(),
            events: [...assertionContext.events],
            blocks: assertionContext.blockWrites.map((write) => ({
                botId: write.botId ?? 'unknown',
                position: write.position,
                authorized: write.authorized,
                at: write.at,
            })),
            metrics: {
                ticks: ticks ?? 0,
                events: observation.events,
                duplicates: observation.duplicates,
                assertions: assertions.length,
                ...assertionContext.metrics,
            },
        });
        if (artifactError) return [null, artifactError];
        return [observation, null];
    }

    async stop(_definition: ScenarioDefinition): Promise<Result<void, string>> {
        this.bots.forEach((bot) => bot.runtime.close());
        this.bots = [];
        if (this.coordinator !== null) await this.coordinator.close();
        this.coordinator = null;
        const directory = this.dataDirectory;
        this.dataDirectory = null;
        if (directory === null) return [undefined, null];
        const [, removeError] = attempt(() =>
            fileSystem.rmSync(directory, { recursive: true, force: true }),
        );
        return removeError === null
            ? [undefined, null]
            : [null, removeError instanceof Error ? removeError.message : String(removeError)];
    }

    private async startBots(
        scenario: BehaviorScenario,
        coordinator: RunningCoordinator,
        world: FakeWorld,
        containers: FakeContainers,
        clock: SimulationClock,
    ): Promise<Result<BotFixture[], string>> {
        const registry = MessageSchemaRegistry.withDefaults();
        const logger = new NullLogger();
        const bots: BotFixture[] = [];
        for (const [index, bot] of scenario.bots.entries()) {
            const position = bot.position ?? { x: 4, y: 66 + index, z: 4 };
            const inventory = new FakeInventory({ contents: bot.inventory ?? {} });
            const dispatcher = new FakeActionDispatcher({
                clock,
                world,
                inventory,
                containers,
                position: () => position,
                setPosition: (next) => {
                    position.x = next.x;
                    position.y = next.y;
                    position.z = next.z;
                },
                recipes: scenario.recipes ?? { oak_planks: { oak_log: 1 } },
                drops: scenario.drops ?? {},
                outputs: scenario.outputs ?? {},
                latencyMilliseconds: scenario.actionLatencyMilliseconds ?? 0,
            });
            const chat = new FakeChat();
            const perception = new FakePerception(world, `bot.${bot.name.toLowerCase()}`);
            const ports: BotPlatformPorts = {
                world,
                inventory,
                containers,
                procurement: new FakeProcurementCatalog(),
                dispatch: dispatcher,
                clock,
                position: () => position,
                health: () => 20,
                food: () => 20,
                timeOfDay: () => Math.floor(clock.now() / 50) % 24_000,
                hostiles: () => [],
                home: () => scenario.home ?? null,
                project: () => null,
                nightIntent: () => null,
                chat,
                players: () => SimulatedFleetDriver.players(scenario),
                villagers: () =>
                    world
                        .entities()
                        .filter(
                            (entity) =>
                                entity.name === 'villager' || entity.name === 'wandering_trader',
                        )
                        .map((entity) => entity.position),
                perception,
                resources: () => scenario.resourceSites ?? SimulatedFleetDriver.resources(world),
                stations: () => SimulatedFleetDriver.stations(world),
                waterSources: () =>
                    world.nearestBlock(['water'], 64) === null
                        ? []
                        : [world.nearestBlock(['water'], 64) as Vec3],
                safety: () => [
                    FakeSafetySnapshots.create({
                        botId: `bot.${bot.name.toLowerCase()}`,
                        at: new Date(clock.now()).toISOString(),
                        position,
                        health: 20,
                        food: 20,
                        inventory,
                        world,
                    }),
                    null,
                ],
            };
            const checkpointStore = new MemoryCheckpointStore();
            const createRuntime = () =>
                new HeadlessBotRuntime({
                    config: coordinator.config,
                    name: bot.name,
                    botId: `bot.${bot.name.toLowerCase()}`,
                    botIndex: index,
                    url: `ws://127.0.0.1:${coordinator.config.transport.port}`,
                    registry,
                    logger,
                    dataDirectory: this.options.repositoryRoot,
                    ports,
                    checkpointStore,
                    ...(bot.traits === undefined ? {} : { traits: bot.traits }),
                    ...(bot.needs === undefined ? {} : { needs: bot.needs }),
                });
            let runtime = createRuntime();
            const [, startError] = await runtime.start();
            if (startError) {
                bots.forEach((candidate) => candidate.runtime.close());
                return [null, startError];
            }
            const fixture: BotFixture = {
                runtime,
                world,
                inventory,
                dispatcher,
                chat,
                position,
                restart: async () => {
                    fixture.runtime.close();
                    runtime = createRuntime();
                    fixture.runtime = runtime;
                    return runtime.start();
                },
            };
            bots.push(fixture);
        }
        return [bots, null];
    }

    private static deliverChat(
        scenario: BehaviorScenario,
        bots: readonly BotFixture[],
        delivered: Set<number>,
        tick: number,
    ): void {
        for (const [index, message] of (scenario.chat ?? []).entries()) {
            if (message.atTick !== tick || delivered.has(index)) continue;
            delivered.add(index);
            const player = scenario.players?.find((candidate) => candidate.id === message.playerId);
            if (player === undefined) continue;
            bots.forEach((bot) => bot.chat.deliver(player.username, message.message, player.id));
        }
    }

    private static players(
        scenario: BehaviorScenario,
    ): readonly { playerId: string; username: string; position: Vec3 }[] {
        return (scenario.players ?? []).map((player) => ({
            playerId: player.id,
            username: player.username,
            position: player.position,
        }));
    }

    private static resources(world: FakeWorld): readonly { kind: string; position: Vec3 }[] {
        const wood = world.nearestBlock(['*_log'], 64);
        const stone = world.nearestBlock(['stone', 'deepslate'], 64);
        return [
            ...(wood === null ? [] : [{ kind: 'wood', position: wood }]),
            ...(stone === null ? [] : [{ kind: 'stone', position: stone }]),
        ];
    }

    private static stations(world: FakeWorld): readonly { kind: string; position: Vec3 }[] {
        const stations: { kind: string; position: Vec3 }[] = [];
        for (const kind of ['crafting_table', 'furnace', 'chest']) {
            const position = world.nearestBlock([kind], 64);
            if (position !== null) stations.push({ kind, position });
        }
        return stations;
    }

    private static async applyFault(
        fault: ScenarioFault,
        context: {
            bots: readonly BotFixture[];
            coordinator: RunningCoordinator;
            world: FakeWorld;
            clock: SimulationClock;
        },
    ): Promise<string | null> {
        const bots = SimulatedFleetDriver.faultBots(
            context.bots,
            'botId' in fault ? fault.botId : undefined,
        );
        switch (fault.type) {
            case 'inventory-change': {
                for (const bot of bots) {
                    if (fault.count >= 0) bot.inventory.add(fault.itemName, fault.count);
                    else bot.inventory.remove(fault.itemName, Math.abs(fault.count));
                }
                return null;
            }
            case 'missing-material': {
                for (const bot of bots) {
                    const count = bot.inventory.count(fault.itemName);
                    if (count > 0) bot.inventory.remove(fault.itemName, count);
                }
                return null;
            }
            case 'missing-recipe': {
                for (const bot of bots) bot.dispatcher.removeRecipe(fault.itemName);
                return null;
            }
            case 'missing-gather-source': {
                const position = context.world.nearestBlock([fault.blockName], 128);
                if (position !== null) context.world.applyBlock(position, null);
                return null;
            }
            case 'unreachable-target': {
                for (const bot of bots) bot.dispatcher.markUnreachable(fault.position);
                return null;
            }
            case 'action-failure': {
                for (const bot of bots) {
                    bot.dispatcher.injectFailures(fault.count ?? 1, fault.kinds);
                }
                return null;
            }
            case 'action-delay': {
                for (const bot of bots) {
                    bot.dispatcher.setLatencyMilliseconds(fault.milliseconds);
                }
                return null;
            }
            case 'block-mismatch': {
                context.world.applyBlock(fault.position, {
                    name: fault.blockId,
                    properties: { ...(fault.properties ?? {}) },
                });
                return null;
            }
            case 'protected-zone': {
                context.world.protect(fault.min, fault.max);
                return null;
            }
            case 'claim-conflict': {
                const repository = new ClaimRepository(context.coordinator.database);
                const now = new Date(context.clock.now()).toISOString();
                const record: ClaimRecord = {
                    id: fault.claim.id,
                    resourceType: fault.claim.resourceType,
                    resourceId: fault.claim.id,
                    bbox: fault.claim.bbox,
                    botId: fault.claim.ownerBotId,
                    leaseUntil: fault.claim.expiresAt ?? '2100-01-01T00:00:00.000Z',
                    fencingToken: 1,
                    status: 'active',
                    taskId: null,
                    parentClaimId: null,
                    epoch: 0,
                    payload: {},
                    createdAt: now,
                    updatedAt: now,
                };
                const [, error] = repository.insert(record);
                return error === null ? null : error.type;
            }
            case 'bot-disconnect': {
                const target = context.bots.find(
                    (bot) =>
                        bot.runtime.botId === fault.botId ||
                        bot.runtime.botId === `bot.${fault.botId.toLowerCase()}`,
                );
                if (target === undefined) return `unknown bot ${fault.botId}`;
                const [, restartError] = await target.restart();
                return restartError;
            }
            case 'coordinator-restart':
                return 'coordinator restart must be handled by the driver';
        }
    }

    private static faultBots(
        bots: readonly BotFixture[],
        botId: string | undefined,
    ): readonly BotFixture[] {
        if (botId === undefined) return bots;
        return bots.filter(
            (bot) =>
                bot.runtime.botId === botId || bot.runtime.botId === `bot.${botId.toLowerCase()}`,
        );
    }

    private static terminal(coordinator: RunningCoordinator, scenario: BehaviorScenario): boolean {
        const [tasks] = new TaskRepository(coordinator.database).list();
        if (tasks === null) return false;
        if ((scenario.tasks ?? []).length === 0) return false;
        return (scenario.tasks ?? []).every((task) => {
            const record = tasks.find((candidate) => candidate.id === task.id);
            return (
                record !== undefined &&
                record.status !== 'pending' &&
                record.status !== 'ready' &&
                record.status !== 'claimed' &&
                record.status !== 'running'
            );
        });
    }

    private static assertionContext(
        coordinator: RunningCoordinator,
        world: FakeWorld,
        bots: readonly BotFixture[],
        durationMilliseconds: number,
    ): AssertionContext {
        const [events] = new EventLogWriter(coordinator.database).list(100_000);
        const [blocks] = new BlockChangelogReader(coordinator.database).listAfter(0, 100_000);
        const [tasks] = new TaskRepository(coordinator.database).list();
        const mappedEvents = [...(events ?? [])].reverse().map((event) => ({
            type: event.type,
            botId: event.botId ?? null,
            at: event.createdAt ?? '',
            payload: event.payload ?? null,
        }));
        const behavior = mappedEvents
            .filter(
                (event) =>
                    event.type === 'bot.event' &&
                    typeof event.payload === 'object' &&
                    event.payload !== null &&
                    (event.payload as { event?: unknown }).event === 'behavior.trace',
            )
            .map((event) => (event.payload as { data: BehaviorTraceEntry }).data);
        const metrics = BehaviorMetricsReader.read(behavior, {
            durationMilliseconds: Math.max(0, durationMilliseconds),
        });
        const metricsByBot = BehaviorMetricsReader.readByBot(behavior, {
            durationMilliseconds: Math.max(0, durationMilliseconds),
        });
        return {
            world,
            tasks: (tasks ?? []).map((task) => ({
                id: task.id,
                status: task.status,
                failureClass: task.failureClass,
            })),
            events: mappedEvents,
            blockWrites: (blocks ?? []).map((block) => ({
                botId: block.botId,
                position: block.position,
                authorized: block.authorized ?? false,
                at: block.createdAt ?? '',
            })),
            vetoes: [],
            inventory: bots[0]?.inventory.items() ?? [],
            inventories: Object.fromEntries(
                bots.map((bot) => [bot.runtime.botId, bot.inventory.items()]),
            ),
            behavior,
            metrics: { ...metrics },
            metricsByBot: Object.fromEntries(
                Object.entries(metricsByBot).map(([botId, botMetrics]) => [
                    botId,
                    { ...botMetrics },
                ]),
            ),
        };
    }

    private static recordBehavior(
        trace: TraceRecorder,
        behavior: readonly BehaviorTraceEntry[],
    ): void {
        for (const entry of behavior) {
            const kind =
                entry.kind === 'decision'
                    ? 'behavior'
                    : entry.kind === 'plan'
                      ? 'plan'
                      : entry.kind === 'perception'
                        ? 'behavior'
                        : entry.kind === 'action'
                          ? 'skill'
                          : entry.kind;
            trace.record({
                tick: 0,
                at: entry.at,
                botId: entry.botId,
                kind,
                summary: entry.subject,
                data: entry.detail,
            });
        }
    }

    private static reasons(assertions: readonly AssertionResult[]): string[] {
        return assertions
            .filter((assertion) => !assertion.passed)
            .map((assertion) => assertion.message);
    }

    private static duplicates(context: AssertionContext): number {
        const seen = new Set<string>();
        return context.blockWrites.filter((write) => {
            const key = `${write.position.x},${write.position.y},${write.position.z}`;
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        }).length;
    }

    private static createWorld(scenario: BehaviorScenario): Result<FakeWorld, string> {
        const anchor = SimulatedFleetDriver.buildAnchor(scenario);
        const clearRegion =
            scenario.world.clearRegion ??
            (anchor === null
                ? undefined
                : {
                      min: { x: anchor.x - 2, y: anchor.y - 4, z: anchor.z - 2 },
                      max: { x: anchor.x + 9, y: anchor.y + 8, z: anchor.z + 9 },
                  });
        const world = new FakeWorld({
            seed: scenario.seed,
            kind: scenario.world.kind,
            min: scenario.world.bounds.min,
            max: scenario.world.bounds.max,
            groundY: scenario.world.groundY,
            maximumStep: scenario.world.maximumStep,
            ...(clearRegion === undefined ? {} : { clearRegion }),
            ...(scenario.world.entities === undefined ? {} : { entities: scenario.world.entities }),
        });
        for (const block of scenario.world.blocks ?? []) {
            world.applyBlock(block.position, {
                name: block.name,
                properties: { ...(block.properties ?? {}) },
            });
        }
        return [world, null];
    }

    private static buildAnchor(scenario: BehaviorScenario): Vec3 | null {
        for (const task of scenario.tasks ?? []) {
            const schematic = task.payload?.schematic;
            if (typeof schematic !== 'object' || schematic === null) continue;
            const anchor = (schematic as { anchor?: Vec3 }).anchor;
            if (anchor !== undefined) return anchor;
        }
        return null;
    }

    private static temporaryDirectory(): Result<string, string> {
        const [directory, error] = attempt(() =>
            fileSystem.mkdtempSync(path.join(operatingSystem.tmpdir(), 'ticrafter-sim-')),
        );
        return error === null
            ? [directory, null]
            : [null, error instanceof Error ? error.message : String(error)];
    }
}
