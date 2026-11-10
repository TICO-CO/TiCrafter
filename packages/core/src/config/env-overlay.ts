import { attempt } from '../kernel/index.js';

const KNOWN_KEYS = new Set([
    'HARDWARE_PROFILE',
    'BOT_COUNT',
    'BOT_NAMES',
    'AUTO_SPAWN_BOTS',
    'LAN_HOST',
    'LAN_PORT',
    'TRANSPORT_HOST',
    'TRANSPORT_PORT',
    'OPS_HOST',
    'OPS_PORT',
    'DATA_DIR',
    'LAYA_EP',
    'LAYA_THREADS',
    'PLANNER_ENABLED',
    'PLANNER_BASE_URL',
    'PLANNER_API_KEY',
    'LOG_LEVEL',
]);

export class EnvOverlay {
    static apply(environment: Record<string, string | undefined>): Record<string, unknown> {
        const overrides: Record<string, unknown> = {};
        const read = (key: string): string | undefined => {
            const value = environment[key];
            if (value === undefined || !KNOWN_KEYS.has(key)) return undefined;
            return value;
        };

        const hardwareProfile = read('HARDWARE_PROFILE');
        if (hardwareProfile) overrides.hardwareProfile = hardwareProfile;

        const botCount = EnvOverlay.number(read('BOT_COUNT'));
        if (botCount !== undefined) overrides.botCount = botCount;

        const botNames = EnvOverlay.list(read('BOT_NAMES'));
        if (botNames) overrides.botNames = botNames;

        const autoSpawnBots = EnvOverlay.boolean(read('AUTO_SPAWN_BOTS'));
        if (autoSpawnBots !== undefined) overrides.autoSpawnBots = autoSpawnBots;

        EnvOverlay.applyEndpoint(
            overrides,
            'lan',
            read('LAN_HOST'),
            EnvOverlay.number(read('LAN_PORT')),
        );
        EnvOverlay.applyEndpoint(
            overrides,
            'transport',
            read('TRANSPORT_HOST'),
            EnvOverlay.number(read('TRANSPORT_PORT')),
        );
        EnvOverlay.applyEndpoint(
            overrides,
            'ops',
            read('OPS_HOST'),
            EnvOverlay.number(read('OPS_PORT')),
        );

        const dataDirectory = read('DATA_DIR');
        if (dataDirectory) overrides.dataDir = dataDirectory;

        const layaProviders = EnvOverlay.list(read('LAYA_EP'));
        const layaThreads = EnvOverlay.number(read('LAYA_THREADS'));
        if (layaProviders || layaThreads !== undefined) {
            overrides.laya = {
                ...(layaProviders ? { executionProviders: layaProviders } : {}),
                ...(layaThreads !== undefined ? { threads: layaThreads } : {}),
            };
        }

        EnvOverlay.applyPlanner(overrides, environment);
        const logLevel = read('LOG_LEVEL');
        if (logLevel) overrides.logging = { level: logLevel };
        return overrides;
    }

    private static applyEndpoint(
        overrides: Record<string, unknown>,
        key: string,
        host: string | undefined,
        port: number | undefined,
    ): void {
        if (!host && port === undefined) return;
        overrides[key] = {
            ...(host ? { host } : {}),
            ...(port !== undefined ? { port } : {}),
        };
    }

    private static applyPlanner(
        overrides: Record<string, unknown>,
        environment: Record<string, string | undefined>,
    ): void {
        const enabled = EnvOverlay.boolean(environment.PLANNER_ENABLED);
        const baseUrl = environment.PLANNER_BASE_URL;
        const apiKey = environment.PLANNER_API_KEY;
        if (enabled === undefined && !baseUrl && !apiKey) return;
        overrides.planner = {
            ...(enabled !== undefined ? { enabled } : {}),
            ...(baseUrl ? { baseUrl } : {}),
            ...(apiKey ? { apiKey } : {}),
        };
    }

    private static number(value: string | undefined): number | undefined {
        if (value === undefined || value === '') return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private static boolean(value: string | undefined): boolean | undefined {
        if (value === undefined || value === '') return undefined;
        if (/^(1|true|yes|on)$/i.test(value)) return true;
        if (/^(0|false|no|off)$/i.test(value)) return false;
        return undefined;
    }

    private static list(value: string | undefined): string[] | undefined {
        if (value === undefined || value === '') return undefined;
        if (value.trim().startsWith('[')) {
            const [parsed, parseError] = attempt(() => JSON.parse(value) as unknown);
            if (
                !parseError &&
                Array.isArray(parsed) &&
                parsed.every((item) => typeof item === 'string')
            ) {
                return parsed;
            }
        }
        return EnvOverlay.commaList(value);
    }

    private static commaList(value: string): string[] {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
}
