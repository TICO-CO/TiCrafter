import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { ScenarioRunner } from '../scenario-runner/index.js';
import { BehaviorScenarioCatalog } from './scenario-catalog.js';
import { SimulatedFleetDriver } from './simulated-fleet-driver.js';

const directories: string[] = [];

afterEach(() => {
    directories
        .splice(0)
        .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
});

describe('SimulatedFleetDriver', () => {
    it('builds the simulated house without a Minecraft server', async () => {
        const scenario = BehaviorScenarioCatalog.find('simulated-build');
        expect(scenario).not.toBeNull();
        if (scenario === null) return;
        const directory = fileSystem.mkdtempSync(
            path.join(operatingSystem.tmpdir(), 'ticrafter-sim-test-'),
        );
        directories.push(directory);
        const driver = new SimulatedFleetDriver({
            repositoryRoot: process.cwd(),
            artifactDirectory: directory,
            scenario,
        });
        const runner = new ScenarioRunner(driver);
        const [result, error] = await runner.run({
            id: scenario.id,
            title: scenario.title,
            bots: scenario.bots.map((bot) => ({ name: bot.name, role: bot.role })),
            timeoutMilliseconds: scenario.timeoutMilliseconds,
            tasks: scenario.tasks,
        });
        expect(error).toBeNull();
        expect(result?.passed).toBe(true);
        expect(result?.duplicates).toBe(0);
    });
});
