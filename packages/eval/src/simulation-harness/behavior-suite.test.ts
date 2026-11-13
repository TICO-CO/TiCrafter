import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { ScenarioRunner } from '../scenario-runner/index.js';
import { BehaviorScenarioCatalog } from './scenario-catalog.js';
import { SimulatedFleetDriver } from './simulated-fleet-driver.js';

const directories: string[] = [];
const testWithTimeout = it as unknown as (
    label: string,
    fn: () => Promise<void>,
    timeout: number,
) => void;

afterEach(() => {
    if (process.env.DEBUG_KEEP === '1') return;
    directories
        .splice(0)
        .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
});

async function runScenario(id: string, seed?: number): Promise<void> {
    const found = BehaviorScenarioCatalog.find(id);
    expect(found).not.toBeNull();
    if (found === null) return;
    const scenario = seed === undefined ? found : { ...found, seed };
    const directory = fileSystem.mkdtempSync(
        path.join(operatingSystem.tmpdir(), 'ticrafter-behavior-'),
    );
    directories.push(directory);
    const runner = new ScenarioRunner(
        new SimulatedFleetDriver({
            repositoryRoot: process.cwd(),
            artifactDirectory: directory,
            scenario,
        }),
    );
    const [result, error] = await runner.run({
        id: scenario.id,
        title: scenario.title,
        bots: scenario.bots.map((bot) => ({ name: bot.name, role: bot.role })),
        timeoutMilliseconds: scenario.timeoutMilliseconds,
        tasks: scenario.tasks ?? [],
    });
    expect(error).toBeNull();
    expect(result?.reasons).toEqual([]);
    expect(result?.passed).toBe(true);
}

describe('behavior scenarios', () => {
    testWithTimeout(
        'runs village-farm across fixed seeds',
        async () => {
            const scenario = BehaviorScenarioCatalog.find('village-farm');
            expect(scenario).not.toBeNull();
            if (scenario === null) return;
            for (const seed of scenario.seeds ?? [scenario.seed]) {
                await runScenario('village-farm', seed);
            }
        },
        600_000,
    );

    testWithTimeout(
        'runs human and social scenarios across fixed seeds',
        async () => {
            for (const id of ['human-movement', 'human-signature', 'social-chat']) {
                const scenario = BehaviorScenarioCatalog.find(id);
                expect(scenario).not.toBeNull();
                if (scenario === null) continue;
                for (const seed of scenario.seeds ?? [scenario.seed]) {
                    await runScenario(id, seed);
                }
            }
        },
        900_000,
    );

    testWithTimeout(
        'runs idle-life across fixed seeds',
        async () => {
            const scenario = BehaviorScenarioCatalog.find('idle-life');
            expect(scenario).not.toBeNull();
            if (scenario === null) return;
            for (const seed of scenario.seeds ?? [scenario.seed]) {
                await runScenario('idle-life', seed);
            }
        },
        900_000,
    );

    testWithTimeout(
        'runs bot-restart-resume across fixed seeds',
        async () => {
            const scenario = BehaviorScenarioCatalog.find('bot-restart-resume');
            expect(scenario).not.toBeNull();
            if (scenario === null) return;
            for (const seed of scenario.seeds ?? [scenario.seed]) {
                await runScenario('bot-restart-resume', seed);
            }
        },
        300_000,
    );

    testWithTimeout(
        'runs early-game-bootstrap across fixed seeds',
        async () => {
            const scenario = BehaviorScenarioCatalog.find('early-game-bootstrap');
            expect(scenario).not.toBeNull();
            if (scenario === null) return;
            for (const seed of scenario.seeds ?? [scenario.seed]) {
                await runScenario('early-game-bootstrap', seed);
            }
        },
        600_000,
    );
});
