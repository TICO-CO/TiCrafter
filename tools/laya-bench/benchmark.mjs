import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
    LayaBenchmarkRunner,
    LayaModelLoader,
    ProcessMemoryProbe,
    ProviderGate,
} from '@ticrafter/eval';

const root = path.resolve(import.meta.dirname, '../..');
const defaultRevision = 'd42786bdff8a7550316339c5fbf8f46caa83ea1b';

const usage = `Usage: bun run bench:laya -- [options]

Options:
  --provider <all|cpu|webgpu>   Provider(s) to measure (default: all)
  --profile <name>              Hardware profile (default: HARDWARE_PROFILE or home-full)
  --fixture <standard|compact|mixed> Decision fixture size (default: standard)
  --threads <count>             ONNX intra-op threads (default: profile value)
  --iterations <count>          Measured requests per provider (default: 200)
  --warmup <count>              Warm-up requests per provider (default: 10)
  --soak-seconds <seconds>      Stability soak duration (default: 0)
  --soak-interval-ms <ms>       Soak request interval (default: 1000)
  --cache-dir <path>            Repo-local model cache (default: models/laya)
  --revision <sha>              Pinned ONNX bundle revision
  --model-dir <path>            Load an existing local ONNX bundle
  --webgpu-validation-mode <m>  disabled, wgpuOnly, basic, or full
  --webgpu-preferred-layout <l> NCHW or NHWC
  --ort-log-severity <0-4>      ONNX Runtime session log severity
  --strict-provider             Disable WebGPU to CPU fallback
  --max-input-tokens <count>    Gate total input tokens (default: 600)
  --out-dir <path>              Report directory (default: data/benchmarks)
  --json                        Print the full report JSON
  --help                        Show this message
`;

function nativeLibraryDirectories() {
    const candidates = [
        path.join(root, '.toolchain/lib'),
        '/run/opengl-driver/lib',
        '/run/current-system/sw/lib',
        path.join(homedir(), '.nix-profile/lib'),
        `/etc/profiles/per-user/${process.env.USER ?? ''}/lib`,
    ];
    return candidates.filter((candidate) => existsSync(candidate));
}

function ensureNativeLibraries() {
    const librariesDirectory = path.join(root, '.toolchain/lib');
    const stdCppLibrary = path.join(librariesDirectory, 'libstdc++.so.6');
    if (!existsSync(stdCppLibrary)) {
        console.error(
            `missing ${path.relative(root, stdCppLibrary)}; run: bun tools/bootstrap/bootstrap.mjs --no-bun --no-python --no-server --no-browser`,
        );
        return;
    }

    const currentPath = process.env.LD_LIBRARY_PATH ?? '';
    const entries = currentPath.split(':').filter(Boolean);
    const missing = nativeLibraryDirectories().filter((directory) => !entries.includes(directory));
    if (missing.length === 0) return;

    const result = spawnSync(process.execPath, [import.meta.filename, ...process.argv.slice(2)], {
        stdio: 'inherit',
        env: {
            ...process.env,
            LD_LIBRARY_PATH: [...missing, ...entries].join(':'),
        },
    });
    process.exit(result.status ?? 1);
}

function readProfile(profileName) {
    const profilePath = path.join(root, 'config', 'profiles', `${profileName}.json`);
    const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
    if (!Array.isArray(profile.laya?.executionProviders) || profile.laya?.threads === undefined) {
        throw new Error(`profile ${profileName} has no Laya settings`);
    }
    return profile;
}

function resolveProviders(providerOption) {
    if (providerOption === 'all') return ['cpu', 'webgpu'];
    if (providerOption === 'cpu' || providerOption === 'webgpu') return [providerOption];
    throw new Error(`unknown provider ${providerOption}`);
}

function numberOption(value, fallback, optionName) {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`${optionName} must be an integer`);
    return parsed;
}

function choiceOption(value, allowed, optionName) {
    if (value === undefined) return undefined;
    if (!allowed.includes(value))
        throw new Error(`${optionName} must be one of ${allowed.join(', ')}`);
    return value;
}

function createProgressReporter() {
    const lastBucketByFile = new Map();
    return (progress) => {
        if (progress.total === null || progress.total <= 0) {
            if (lastBucketByFile.has(progress.file)) return;
            lastBucketByFile.set(progress.file, -1);
            process.stderr.write(`download ${progress.file}: ${progress.received} bytes\n`);
            return;
        }
        const percent = Math.floor((progress.received / progress.total) * 100);
        const bucket = Math.floor(percent / 5) * 5;
        if (lastBucketByFile.get(progress.file) === bucket) return;
        lastBucketByFile.set(progress.file, bucket);
        process.stderr.write(`download ${progress.file}: ${percent}%\n`);
    };
}

function formatMegabytes(bytes) {
    if (bytes === null) return 'n/a';
    return `${(bytes / 1024 ** 2).toFixed(0)}MiB`;
}

function printSummary(reports, gate, combinedPath) {
    for (const report of reports) {
        const latency = report.latency;
        const providerLabel =
            report.provider === report.requestedProvider
                ? report.provider
                : `${report.requestedProvider}->${report.provider}`;
        console.log(
            `${providerLabel}: p50=${latency?.p50 ?? 'n/a'}ms p95=${latency?.p95 ?? 'n/a'}ms ` +
                `tokens=${report.inputTokens ?? 'n/a'} ` +
                `rssPeak=${formatMegabytes(report.memory.rssPeakBytes)} ` +
                `vram=${formatMegabytes(report.memory.vramBeforeBytes)}->` +
                `${formatMegabytes(report.memory.vramPeakBytes)}`,
        );
    }
    console.log(
        `gate: p95WithinBudget=${gate.p95WithinBudget} inputWithinBudget=${gate.inputWithinBudget} ` +
            `passing=${gate.passingProviders.join(',') || 'none'} ` +
            `webgpuFasterThanCpu=${gate.webgpuFasterThanCpu} recommended=${gate.recommendedProvider ?? 'none'}`,
    );
    for (const reason of gate.reasons) console.log(`reason: ${reason}`);
    console.log(`report: ${combinedPath}`);
}

async function main() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        strict: true,
        allowPositionals: false,
        options: {
            provider: { type: 'string', default: 'all' },
            profile: { type: 'string', default: process.env.HARDWARE_PROFILE ?? 'home-full' },
            fixture: { type: 'string', default: 'standard' },
            threads: { type: 'string' },
            iterations: { type: 'string', default: '200' },
            warmup: { type: 'string', default: '10' },
            'soak-seconds': { type: 'string', default: '0' },
            'soak-interval-ms': { type: 'string', default: '1000' },
            'cache-dir': { type: 'string', default: 'models/laya' },
            revision: { type: 'string', default: defaultRevision },
            'model-dir': { type: 'string' },
            'webgpu-validation-mode': { type: 'string' },
            'webgpu-preferred-layout': { type: 'string' },
            'ort-log-severity': { type: 'string' },
            'fallback-to-cpu': { type: 'boolean', default: true },
            'strict-provider': { type: 'boolean', default: false },
            'max-input-tokens': { type: 'string', default: '600' },
            'out-dir': { type: 'string', default: 'data/benchmarks' },
            json: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
    });

    if (values.help) {
        console.log(usage);
        return;
    }
    ensureNativeLibraries();

    const profile = readProfile(values.profile);
    const providers = resolveProviders(values.provider);
    const fixtureVariant = choiceOption(
        values.fixture,
        ['standard', 'compact', 'mixed'],
        '--fixture',
    );
    const threads = numberOption(values.threads, profile.laya.threads, '--threads');
    const iterations = numberOption(values.iterations, 200, '--iterations');
    const warmup = numberOption(values.warmup, 10, '--warmup');
    const soakSeconds = numberOption(values['soak-seconds'], 0, '--soak-seconds');
    const soakIntervalMilliseconds = numberOption(
        values['soak-interval-ms'],
        1000,
        '--soak-interval-ms',
    );
    const modelDirectory = values['model-dir'] ? path.resolve(root, values['model-dir']) : null;
    const cacheDirectory = path.resolve(root, values['cache-dir']);
    const outputDirectory = path.resolve(root, values['out-dir']);
    const validationMode = choiceOption(
        values['webgpu-validation-mode'],
        ['disabled', 'wgpuOnly', 'basic', 'full'],
        '--webgpu-validation-mode',
    );
    const preferredLayout = choiceOption(
        values['webgpu-preferred-layout'],
        ['NCHW', 'NHWC'],
        '--webgpu-preferred-layout',
    );
    const logSeverityLevel =
        values['ort-log-severity'] === undefined
            ? undefined
            : numberOption(values['ort-log-severity'], 0, '--ort-log-severity');
    if (logSeverityLevel !== undefined && (logSeverityLevel < 0 || logSeverityLevel > 4)) {
        throw new Error('--ort-log-severity must be between 0 and 4');
    }
    const webgpuOptions = {
        ...(validationMode ? { validationMode } : {}),
        ...(preferredLayout ? { preferredLayout } : {}),
    };
    const fallbackToCpu = values['strict-provider'] ? false : values['fallback-to-cpu'];
    const maxInputTokens = numberOption(values['max-input-tokens'], 600, '--max-input-tokens');
    const onDownloadProgress = createProgressReporter();

    const runner = new LayaBenchmarkRunner(new LayaModelLoader(), new ProcessMemoryProbe());
    const reports = [];
    const failures = [];
    for (const provider of providers) {
        console.log(
            `running ${provider} ${fixtureVariant} benchmark (${iterations} requests, ${threads} threads)`,
        );
        const [report, failure] = await runner.run({
            profile: values.profile,
            provider,
            fixtureVariant,
            threads,
            revision: values.revision,
            cacheDir: cacheDirectory,
            modelDir: modelDirectory,
            warmupRequests: warmup,
            measuredRequests: iterations,
            soakDurationMilliseconds: soakSeconds * 1000,
            soakIntervalMilliseconds,
            webgpu: webgpuOptions,
            logSeverityLevel,
            fallbackToCpu,
            onDownloadProgress,
        });
        if (failure) {
            console.error(`${provider}: ${failure.kind}: ${failure.message}`);
            failures.push(failure);
            continue;
        }
        if (report === null) {
            console.error(`${provider}: benchmark returned no report`);
            continue;
        }
        reports.push(report);
    }

    const gate = ProviderGate.evaluate(reports, { maxInputTokens });
    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replaceAll(':', '-').replaceAll('.', '-');
    mkdirSync(outputDirectory, { recursive: true });
    for (const report of reports) {
        const reportPath = path.join(
            outputDirectory,
            `laya-${values.profile}-${fixtureVariant}-${report.provider}-${stamp}.json`,
        );
        writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    const combined = {
        generatedAt,
        profile: values.profile,
        fixtureVariant,
        providers,
        gate,
        reports,
        failures,
    };
    const combinedPath = path.join(
        outputDirectory,
        `laya-${values.profile}-${fixtureVariant}-${stamp}.json`,
    );
    writeFileSync(combinedPath, `${JSON.stringify(combined, null, 2)}\n`);

    if (values.json) console.log(JSON.stringify(combined, null, 2));
    else printSummary(reports, gate, combinedPath);

    if (failures.length > 0) process.exitCode = 1;
    if (reports.length === 0) process.exitCode = 1;
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
