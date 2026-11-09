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

export class EnvParser {
    static parse(text: string): Record<string, string> {
        const values: Record<string, string> = {};
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const withoutExport = line.startsWith('export ') ? line.slice('export '.length) : line;
            const separator = withoutExport.indexOf('=');
            if (separator <= 0) continue;
            const key = withoutExport.slice(0, separator).trim();
            let value = withoutExport.slice(separator + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            values[key] = value;
        }
        return values;
    }

    static overlay(env: NodeJS.ProcessEnv): Record<string, unknown> {
        const overrides: Record<string, unknown> = {};
        const get = (key: string): string | undefined => {
            const value = env[key];
            if (value === undefined || !KNOWN_KEYS.has(key)) return undefined;
            return value;
        };

        const hardwareProfile = get('HARDWARE_PROFILE');
        if (hardwareProfile) overrides.hardwareProfile = hardwareProfile;

        const botCount = EnvParser.number(get('BOT_COUNT'));
        if (botCount !== undefined) overrides.botCount = botCount;

        const botNames = EnvParser.list(get('BOT_NAMES'));
        if (botNames) overrides.botNames = botNames;

        const autoSpawnBots = EnvParser.boolean(get('AUTO_SPAWN_BOTS'));
        if (autoSpawnBots !== undefined) overrides.autoSpawnBots = autoSpawnBots;

        EnvParser.applyEndpoint(overrides, 'lan', get('LAN_HOST'), EnvParser.number(get('LAN_PORT')));
        EnvParser.applyEndpoint(
            overrides,
            'transport',
            get('TRANSPORT_HOST'),
            EnvParser.number(get('TRANSPORT_PORT')),
        );
        EnvParser.applyEndpoint(overrides, 'ops', get('OPS_HOST'), EnvParser.number(get('OPS_PORT')));

        const dataDir = get('DATA_DIR');
        if (dataDir) overrides.dataDir = dataDir;

        const layaProviders = EnvParser.list(get('LAYA_EP'));
        const layaThreads = EnvParser.number(get('LAYA_THREADS'));
        if (layaProviders || layaThreads !== undefined) {
            overrides.laya = {
                ...(layaProviders ? { executionProviders: layaProviders } : {}),
                ...(layaThreads !== undefined ? { threads: layaThreads } : {}),
            };
        }

        EnvParser.applyPlanner(overrides, env);
        const logLevel = get('LOG_LEVEL');
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

    private static applyPlanner(overrides: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
        const enabled = EnvParser.boolean(env.PLANNER_ENABLED);
        const baseUrl = env.PLANNER_BASE_URL;
        const apiKey = env.PLANNER_API_KEY;
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
            try {
                const parsed: unknown = JSON.parse(value);
                if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
                    return parsed;
                }
            } catch {
                return value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
        }
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
}
