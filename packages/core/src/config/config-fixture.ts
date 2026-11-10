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
    planner: { enabled: false, baseUrl: '', apiKey: '' },
    logging: { level: 'info' },
    safety: { guardianHz: 20 },
};

const profiles: Record<string, Record<string, unknown>> = {
    'home-min': {
        hardwareProfile: 'home-min',
        botCount: 4,
        laya: { executionProviders: ['cpu'], threads: 3 },
    },
    'home-full': {
        hardwareProfile: 'home-full',
        botCount: 8,
        laya: { executionProviders: ['webgpu', 'cpu'], threads: 8 },
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
