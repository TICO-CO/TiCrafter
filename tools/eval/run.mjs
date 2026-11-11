import fileSystem from 'node:fs';
import path from 'node:path';

import {
    ArchitectureGuard,
    EvalMetrics,
    FleetScenarioDriver,
    MetricsReporter,
    MinecraftServerHarness,
    NodeServerCommands,
    ReplayEngine,
    ScenarioCatalog,
    ScenarioRunner,
} from '@ticrafter/eval';
import { BlockChangelogReader, EventLogWriter, SqliteRuntime } from '@ticrafter/memory';

const root = path.resolve(import.meta.dir, '../..');

function usage() {
    console.log('usage: bun tools/eval/run.mjs <scenario|guard|replay> [options]');
    console.log('  scenario <id> [--accept-eula] [--data-dir <path>]');
    console.log('  guard');
    console.log('  replay <data-dir>');
}

function argumentValue(name, fallback = null) {
    const index = process.argv.indexOf(name);
    if (index === -1) return fallback;
    return process.argv[index + 1] ?? fallback;
}

function metricsSink(filePath) {
    return {
        write: (report) => {
            fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
            fileSystem.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
            return [undefined, null];
        },
    };
}

async function runScenario(identifier) {
    const definition = ScenarioCatalog.definitions().find((scenario) => scenario.id === identifier);
    if (definition === undefined) {
        console.error(`unknown scenario: ${identifier}`);
        return 1;
    }
    const dataDir = path.resolve(
        argumentValue('--data-dir', path.join('data', 'eval', identifier)),
    );
    const metrics = new EvalMetrics();
    const reporter = new MetricsReporter(metrics, metricsSink(path.join(dataDir, 'metrics.json')));
    const driver = new FleetScenarioDriver({
        repositoryRoot: root,
        dataDir,
        server: new MinecraftServerHarness(new NodeServerCommands(), root, {
            acceptEula: process.argv.includes('--accept-eula'),
        }),
    });
    const runner = new ScenarioRunner(driver, metrics, reporter);
    const [result, error] = await runner.run(definition);
    if (error) {
        console.error(error);
        return 1;
    }
    console.log(JSON.stringify(result, null, 2));
    return result?.passed ? 0 : 1;
}

function runGuard() {
    const result = ArchitectureGuard.atRepositoryRoot().validate();
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.ok ? 0 : 1;
}

function runReplay(dataDirectory) {
    if (dataDirectory === null) {
        console.error('replay requires a data directory');
        return 1;
    }
    if (!fileSystem.existsSync(dataDirectory)) {
        console.error(`data directory not found: ${dataDirectory}`);
        return 1;
    }
    const [database, openError] = new SqliteRuntime({
        dataDir: path.resolve(dataDirectory),
    }).open();
    if (openError) {
        console.error(openError.type);
        return 1;
    }
    const engine = new ReplayEngine(
        new EventLogWriter(database),
        new BlockChangelogReader(database),
    );
    const [report, replayError] = engine.replay();
    database.close();
    if (replayError) {
        console.error(replayError);
        return 1;
    }
    console.log(JSON.stringify(report, null, 2));
    return 0;
}

async function main() {
    const [command, argument] = process.argv.slice(2);
    switch (command) {
        case 'scenario':
            return runScenario(argument);
        case 'guard':
            return runGuard();
        case 'replay':
            return runReplay(argument ?? null);
        default:
            usage();
            return 1;
    }
}

process.exitCode = await main();
