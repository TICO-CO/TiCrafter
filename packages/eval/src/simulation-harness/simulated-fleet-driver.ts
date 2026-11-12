import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import { type BotPlatformPorts, HeadlessBotRuntime } from '@ticrafter/bot/headless';
import { TaskRepository } from '@ticrafter/coordinator/tasks';
import {
    attempt,
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
import { CoordinatorRunner, type RunningCoordinator } from './coordinator-runner.js';
import { FakeActionDispatcher } from './fake-action-dispatcher.js';
import { FakeContainers } from './fake-containers.js';
import { FakeInventory } from './fake-inventory.js';
import { FakeProcurementCatalog } from './fake-procurement.js';
import { FakeSafetySnapshots } from './fake-safety.js';
import { FakeWorld } from './fake-world.js';
import type { BehaviorScenario } from './scenario.js';
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
}

export class SimulatedFleetDriver implements ScenarioDriver {
    private clock: SimulationClock | null = null;
    private world: FakeWorld | null = null;
    private inventory: FakeInventory | null = null;
    private dispatcher: FakeActionDispatcher | null = null;
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
        if (scenario.bots[0] === undefined) return [null, 'scenario has no bots'];
        this.inventory = new FakeInventory({ contents: scenario.bots[0].inventory ?? {} });
        this.dispatcher = new FakeActionDispatcher({
            clock: this.clock,
            world,
            inventory: this.inventory,
            containers: new FakeContainers(),
            position: () => ({ x: 0, y: 0, z: 0 }),
            recipes: { oak_planks: { oak_log: 1 } },
        });
        return [undefined, null];
    }

    async run(_definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>> {
        const scenario = this.options.scenario;
        const clock = this.clock;
        const world = this.world;
        const inventory = this.inventory;
        const dispatcher = this.dispatcher;
        const dataDirectory = this.dataDirectory;
        if (
            clock === null ||
            world === null ||
            inventory === null ||
            dispatcher === null ||
            dataDirectory === null
        ) {
            return [null, 'simulation was not started'];
        }
        const [coordinator, coordinatorError] = await CoordinatorRunner.start({
            repositoryRoot: this.options.repositoryRoot,
            dataDirectory,
            scenario,
            clock,
        });
        if (coordinatorError || coordinator === null) {
            return [null, coordinatorError ?? 'coordinator failed'];
        }
        this.coordinator = coordinator;
        const [bots, botError] = await this.startBots(
            scenario,
            coordinator,
            world,
            inventory,
            dispatcher,
            clock,
        );
        if (botError || bots === null) {
            await coordinator.close();
            return [null, botError ?? 'bots failed'];
        }
        this.bots = bots;
        const [ticks, kernelError] = await new SimulationKernel({
            clock,
            maximumTicks: scenario.timeoutTicks,
            shouldStop: () => SimulatedFleetDriver.terminal(coordinator, scenario),
            onTick: (tick) =>
                this.trace.record({
                    tick,
                    at: new Date(clock.now()).toISOString(),
                    botId: null,
                    kind: 'task',
                    summary: 'simulation tick',
                    data: {},
                }),
        }).run();
        const assertionContext = SimulatedFleetDriver.assertionContext(coordinator, world);
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
        inventory: FakeInventory,
        dispatcher: FakeActionDispatcher,
        clock: SimulationClock,
    ): Promise<Result<BotFixture[], string>> {
        const registry = MessageSchemaRegistry.withDefaults();
        const logger = new NullLogger();
        const bots: BotFixture[] = [];
        for (const [index, bot] of scenario.bots.entries()) {
            const position = { x: 4, y: 66 + index, z: 4 };
            const ports: BotPlatformPorts = {
                world,
                inventory,
                containers: new FakeContainers(),
                procurement: new FakeProcurementCatalog(),
                dispatch: dispatcher,
                clock,
                position: () => position,
                health: () => 20,
                food: () => 20,
                timeOfDay: () => scenario.startTime.timeOfDay,
                hostiles: () => [],
                home: () => null,
                project: () => null,
                nightIntent: () => null,
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
            const runtime = new HeadlessBotRuntime({
                config: coordinator.config,
                name: bot.name,
                botId: `bot.${bot.name.toLowerCase()}`,
                botIndex: index,
                url: `ws://127.0.0.1:${coordinator.config.transport.port}`,
                registry,
                logger,
                dataDirectory: this.options.repositoryRoot,
                ports,
                checkpointStore: new MemoryCheckpointStore(),
            });
            const [, startError] = await runtime.start();
            if (startError) {
                bots.forEach((candidate) => candidate.runtime.close());
                return [null, startError];
            }
            bots.push({ runtime, world, inventory, dispatcher });
        }
        return [bots, null];
    }

    private static terminal(coordinator: RunningCoordinator, scenario: BehaviorScenario): boolean {
        const [tasks] = new TaskRepository(coordinator.database).list();
        if (tasks === null) return false;
        return (scenario.tasks ?? []).every((task) => {
            const record = tasks.find((candidate) => candidate.id === task.id);
            return (
                record !== undefined &&
                record.status !== 'pending' &&
                record.status !== 'claimed' &&
                record.status !== 'running'
            );
        });
    }

    private static assertionContext(
        coordinator: RunningCoordinator,
        world: FakeWorld,
    ): AssertionContext {
        const [events] = new EventLogWriter(coordinator.database).list(10_000);
        const [blocks] = new BlockChangelogReader(coordinator.database).listAfter(0, 10_000);
        const [tasks] = new TaskRepository(coordinator.database).list();
        return {
            world,
            tasks: (tasks ?? []).map((task) => ({
                id: task.id,
                status: task.status,
                failureClass: task.failureClass,
            })),
            events: (events ?? []).map((event) => ({
                type: event.type,
                botId: event.botId ?? null,
                at: event.createdAt ?? '',
                payload: event.payload ?? null,
            })),
            blockWrites: (blocks ?? []).map((block) => ({
                botId: block.botId,
                position: block.position,
                authorized: block.authorized ?? false,
                at: block.createdAt ?? '',
            })),
            vetoes: [],
        };
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
        return [
            new FakeWorld({
                seed: scenario.seed,
                kind: scenario.world.kind,
                min: scenario.world.bounds.min,
                max: scenario.world.bounds.max,
                groundY: scenario.world.groundY,
                maximumStep: scenario.world.maximumStep,
                ...(anchor === null
                    ? {}
                    : {
                          clearRegion: {
                              min: { x: anchor.x - 2, y: anchor.y - 4, z: anchor.z - 2 },
                              max: { x: anchor.x + 9, y: anchor.y + 8, z: anchor.z + 9 },
                          },
                      }),
            }),
            null,
        ];
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
