import type { Result } from '../kernel/index.js';
import { ConfigLoader, type ConfigSource } from './config-loader.js';
import type { ConfigFailure } from './failures.js';

const defaultConfig: Record<string, unknown> = {
    hardwareProfile: 'home-min',
    botCount: 4,
    botNames: ['TiBot1', 'TiBot2', 'TiBot3', 'TiBot4', 'TiBot5', 'TiBot6', 'TiBot7', 'TiBot8'],
    autoSpawnBots: false,
    lan: { host: 'localhost', port: 25565 },
    transport: { host: '127.0.0.1', port: 8788 },
    ops: { host: '127.0.0.1', port: 8787 },
    dataDir: './data',
    perception: { ringRadius: 32, chunksPerSecond: 1, burst: 2 },
    laya: { executionProviders: ['cpu'], threads: 3 },
    decision: {
        enabled: true,
        timeoutMilliseconds: 1200,
        minConfidence: 0.6,
        maxQueueDepth: 64,
        fleetRatePerSecond: 4,
        botRatePerSecond: 1,
        maxInputTokens: 600,
        modelRevision: 'd42786bdff8a7550316339c5fbf8f46caa83ea1b',
        cacheDirectory: 'models/laya',
        modelDirectory: '',
        providerTemperatures: { nextAction: 1, danger: 1, shouldContinue: 1 },
    },
    planner: {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        model: 'Muse Spark 1.3 Contributor',
        intervalMilliseconds: 300000,
        callsPerMinute: 6,
        maxTokensPerCall: 16000,
        timeoutMilliseconds: 60000,
        maxRepairAttempts: 2,
        maxContextCharacters: 48000,
        reserveTasksPerBot: 1,
    },
    logging: { level: 'info' },
    agency: {
        enabled: true,
        goalCadenceMilliseconds: 2000,
        idleThresholdMilliseconds: 10000,
        chatRatePerMinute: 5,
        needDecayPerMinute: 0.02,
        committedGoalBonus: 0.15,
    },
    building: {
        maxStructureBlocks: 4000,
        maxWorkPackageBlocks: 128,
        allowRawBlockBlueprints: false,
    },
    safety: { guardianHz: 20, interactionReach: 4.5, actionsPerSecond: 10 },
    skills: { tickMilliseconds: 250 },
    training: { traceEnabled: false },
};

const profiles: Record<string, Record<string, unknown>> = {
    'home-min': {
        hardwareProfile: 'home-min',
        botCount: 4,
        laya: { executionProviders: ['cpu'], threads: 3 },
        building: { maxStructureBlocks: 4000, maxWorkPackageBlocks: 128 },
    },
    'home-full': {
        hardwareProfile: 'home-full',
        botCount: 8,
        laya: { executionProviders: ['webgpu', 'cpu'], threads: 8 },
        building: { maxStructureBlocks: 12000, maxWorkPackageBlocks: 256 },
    },
};

class FakeConfigSource implements ConfigSource {
    constructor(private readonly envFile = '') {}

    readEnvironmentFile(): Result<string, ConfigFailure> {
        return [this.envFile, null];
    }

    readDefaults(): Result<string, ConfigFailure> {
        return [JSON.stringify(defaultConfig), null];
    }

    readProfile(name: string): Result<string, ConfigFailure> {
        const profile = profiles[name];
        if (!profile) {
            return [
                null,
                {
                    type: 'READ_FAILED',
                    path: `profiles/${name}.json`,
                    message: 'missing profile',
                },
            ];
        }
        return [JSON.stringify(profile), null];
    }
}

export class ConfigFixture {
    static load(environment: Record<string, string | undefined> = {}) {
        return new ConfigLoader({
            source: new FakeConfigSource(),
            environment: environment,
        }).load();
    }
}
