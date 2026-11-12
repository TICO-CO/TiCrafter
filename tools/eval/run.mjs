import fileSystem from 'node:fs';
import path from 'node:path';

import {
    ArchitectureGuard,
    BehaviorScenarioCatalog,
    EvalMetrics,
    FleetScenarioDriver,
    FleetSoakProbe,
    MetricsReporter,
    MinecraftServerHarness,
    NodeServerCommands,
    PersistentSoakRunner,
    ReplayEngine,
    ScenarioCatalog,
    ScenarioRunner,
    SimulatedFleetDriver,
    TraceInspector,
} from '@ticrafter/eval';
import { BlockChangelogReader, EventLogWriter, SqliteRuntime } from '@ticrafter/memory';

const root = path.resolve(import.meta.dir, '../..');

function usage() {
    console.log(
        'usage: bun tools/eval/run.mjs <scenario|soak|guard|replay|inspect|check> [options]',
    );
    console.log('  scenario <id> [--mode simulate|live] [--seed <n>] [--data-dir <path>]');
    console.log('  soak <id> [--duration <ms>] [--interval <ms>] [--accept-eula]');
    console.log('  guard');
    console.log('  replay <data-dir>');
    console.log('  inspect <data-dir> [--bot <id>] [--from <tick>] [--to <tick>] [--kind <kind>]');
    console.log('  check <data-dir> --scenario <id>');
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
    const mode = argumentValue('--mode', 'simulate');
    const dataDir = path.resolve(
        argumentValue('--data-dir', path.join('data', 'eval', identifier)),
    );
    if (mode === 'simulate') return runSimulatedScenario(identifier, dataDir);
    if (mode !== 'live') {
        console.error(`unknown mode: ${mode}`);
        return 1;
    }
    const definition = ScenarioCatalog.definitions().find((scenario) => scenario.id === identifier);
    if (definition === undefined) {
        console.error(`unknown scenario: ${identifier}`);
        return 1;
    }
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

async function runSimulatedScenario(identifier, dataDir) {
    const scenario = BehaviorScenarioCatalog.find(identifier);
    if (scenario === null) {
        console.error(`unknown simulated scenario: ${identifier}`);
        return 1;
    }
    const seedOverride = argumentValue('--seed', null);
    const selected =
        seedOverride === null ? scenario : { ...scenario, seed: Number.parseInt(seedOverride, 10) };
    const definition = {
        id: selected.id,
        title: selected.title,
        bots: selected.bots.map((bot) => ({ name: bot.name, role: bot.role })),
        timeoutMilliseconds: selected.timeoutMilliseconds,
        tasks: selected.tasks,
    };
    const driver = new SimulatedFleetDriver({
        repositoryRoot: root,
        artifactDirectory: dataDir,
        scenario: selected,
    });
    const runner = new ScenarioRunner(driver);
    const [result, error] = await runner.run(definition);
    if (error) {
        console.error(error);
        return 1;
    }
    console.log(JSON.stringify(result, null, 2));
    return result?.passed ? 0 : 1;
}

function inspectArtifacts(dataDirectory) {
    if (dataDirectory === null) {
        console.error('inspect requires a data directory');
        return 1;
    }
    const [inspection, error] = TraceInspector.load(dataDirectory);
    if (error) {
        console.error(error);
        return 1;
    }
    const from = argumentValue('--from', null);
    const to = argumentValue('--to', null);
    const filtered = TraceInspector.filter(inspection.trace, {
        botId: argumentValue('--bot', undefined),
        ...(from === null ? {} : { fromTick: Number.parseInt(from, 10) }),
        ...(to === null ? {} : { toTick: Number.parseInt(to, 10) }),
        kind: argumentValue('--kind', undefined),
    });
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ report: inspection.report, trace: filtered }, null, 2));
        return 0;
    }
    console.log(TraceInspector.render(filtered));
    return 0;
}

function checkArtifacts(dataDirectory) {
    if (dataDirectory === null) {
        console.error('check requires a data directory');
        return 1;
    }
    const scenario = argumentValue('--scenario', null);
    const [inspection, error] = TraceInspector.load(dataDirectory);
    if (error) {
        console.error(error);
        return 1;
    }
    const report = inspection.report;
    const matches = scenario === null || report?.scenarioId === scenario;
    const passed = report?.passed === true && matches;
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ passed, scenario, report }, null, 2));
        return passed ? 0 : 1;
    }
    console.log(`${passed ? 'PASS' : 'FAIL'} ${scenario ?? report?.scenarioId ?? 'unknown'}`);
    return passed ? 0 : 1;
}

async function runSoak(identifier) {
    const definition = ScenarioCatalog.definitions().find((scenario) => scenario.id === identifier);
    if (definition === undefined) {
        console.error(`unknown scenario: ${identifier}`);
        return 1;
    }
    const dataDir = path.resolve(
        argumentValue('--data-dir', path.join('data', 'eval', `soak-${identifier}`)),
    );
    const durationMilliseconds = Number.parseInt(argumentValue('--duration', '7200000'), 10);
    const sampleIntervalMilliseconds = Number.parseInt(argumentValue('--interval', '30000'), 10);
    if (
        !Number.isFinite(durationMilliseconds) ||
        durationMilliseconds <= 0 ||
        !Number.isFinite(sampleIntervalMilliseconds) ||
        sampleIntervalMilliseconds <= 0
    ) {
        console.error('duration and interval must be positive milliseconds');
        return 1;
    }
    const driver = new FleetScenarioDriver({
        repositoryRoot: root,
        dataDir,
        server: new MinecraftServerHarness(new NodeServerCommands(), root, {
            acceptEula: process.argv.includes('--accept-eula'),
        }),
    });
    const soak = new PersistentSoakRunner(
        driver,
        new FleetSoakProbe(dataDir, () => driver.childPid),
        {
            now: () => Date.now(),
            sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
        },
    );
    const [report, error] = await soak.run(definition, {
        durationMilliseconds,
        sampleIntervalMilliseconds,
    });
    if (error) {
        console.error(error);
        return 1;
    }
    console.log(JSON.stringify(report, null, 2));
    return report?.completed && report.reasons.length === 0 ? 0 : 1;
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
        case 'soak':
            return runSoak(argument);
        case 'guard':
            return runGuard();
        case 'replay':
            return runReplay(argument ?? null);
        case 'inspect':
            return inspectArtifacts(argument ?? null);
        case 'check':
            return checkArtifacts(argument ?? null);
        default:
            usage();
            return 1;
    }
}

process.exitCode = await main();
