import { attempt, type Result } from '../kernel/index.js';
import { EnvOverlay } from './env-overlay.js';
import { EnvParser } from './env-parser.js';
import type { ConfigFailure } from './failures.js';
import { DeepMerge } from './merge.js';
import { ConfigSchemaValidator, type TicrafterConfig } from './schema.js';

export interface ConfigSource {
    readEnvironmentFile(): Result<string, ConfigFailure>;
    readDefaults(): Result<string, ConfigFailure>;
    readProfile(name: string): Result<string, ConfigFailure>;
}

export interface ConfigLoaderOptions {
    source: ConfigSource;
    environment?: Record<string, string | undefined>;
}

export class ConfigLoader {
    constructor(private readonly options: ConfigLoaderOptions) {}

    load(): Result<TicrafterConfig, ConfigFailure> {
        const [environmentText, environmentError] = this.options.source.readEnvironmentFile();
        if (environmentError) return [null, environmentError];
        if (environmentText === null) return [null, this.invalid('environment file returned null')];

        const environment = {
            ...EnvParser.parse(environmentText),
            ...(this.options.environment ?? {}),
        };

        const [defaultsText, defaultsError] = this.options.source.readDefaults();
        if (defaultsError) return [null, defaultsError];
        if (defaultsText === null) return [null, this.invalid('default.json returned null')];

        const [defaults, defaultsParseError] = this.parseJson(defaultsText, 'default.json');
        if (defaultsParseError) return [null, defaultsParseError];
        if (defaults === null) return [null, this.invalid('default.json returned null')];

        const profileName = environment.HARDWARE_PROFILE ?? String(defaults.hardwareProfile ?? '');
        const [profileText, profileError] = this.options.source.readProfile(profileName);
        if (profileError) return [null, profileError];
        if (profileText === null) return [null, this.invalid('profile returned null')];

        const [profile, profileParseError] = this.parseJson(
            profileText,
            `profiles/${profileName}.json`,
        );
        if (profileParseError) return [null, profileParseError];
        if (profile === null) return [null, this.invalid('profile returned null')];

        const merged = DeepMerge.merge<Record<string, unknown>>(
            defaults,
            profile,
            EnvOverlay.apply(environment),
        );
        return ConfigSchemaValidator.validate(merged);
    }

    private parseJson(text: string, path: string): Result<Record<string, unknown>, ConfigFailure> {
        const [parsed, parseError] = attempt(() => JSON.parse(text) as unknown);
        if (parseError) {
            return [null, { type: 'READ_FAILED', path, message: this.describe(parseError) }];
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return [null, { type: 'READ_FAILED', path, message: 'expected a JSON object' }];
        }

        return [parsed as Record<string, unknown>, null];
    }

    private invalid(message: string): ConfigFailure {
        return { type: 'READ_FAILED', path: 'config', message };
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
