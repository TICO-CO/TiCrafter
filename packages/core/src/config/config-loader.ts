import fs from 'node:fs';
import path from 'node:path';
import { attempt, type Result } from '../result.js';
import { EnvParser } from './env-parser.js';
import type { ConfigFailure } from './failures.js';
import { DeepMerge } from './merge.js';
import { ConfigSchemaValidator, type TicrafterConfig } from './schema.js';

export interface LoadConfigOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    configDir?: string;
}

export class ConfigLoader {
    constructor(private readonly options: LoadConfigOptions = {}) {}

    load(): Result<TicrafterConfig, ConfigFailure> {
        const cwd = this.options.cwd ?? process.cwd();
        const configDir = this.options.configDir ?? path.resolve(cwd, 'config');
        const env = {
            ...this.readEnvFile(path.join(configDir, '.env')),
            ...(this.options.env ?? process.env),
        };

        const [defaults, defaultsErr] = this.readJson(path.join(configDir, 'default.json'));
        if (defaultsErr) return [null, defaultsErr];
        if (defaults === null) return [null, this.invalid('default.json returned null')];

        const profileName = env.HARDWARE_PROFILE ?? defaults.hardwareProfile;
        const [profile, profileErr] = this.readJson(
            path.join(configDir, 'profiles', `${String(profileName)}.json`),
        );
        if (profileErr) return [null, profileErr];
        if (profile === null) return [null, this.invalid('profile returned null')];

        const merged = DeepMerge.merge<Record<string, unknown>>(defaults, profile, EnvParser.overlay(env));
        return ConfigSchemaValidator.validate(merged);
    }

    private readEnvFile(file: string): Record<string, string> {
        const [text, error] = attempt(() => fs.readFileSync(file, 'utf8'));
        if (error || text === null) return {};
        return EnvParser.parse(text);
    }

    private readJson(file: string): Result<Record<string, unknown>, ConfigFailure> {
        const [text, readError] = attempt(() => fs.readFileSync(file, 'utf8'));
        if (readError || text === null) {
            return [null, { type: 'READ_FAILED', path: file, message: this.describe(readError) }];
        }
        const [parsed, parseError] = attempt(() => JSON.parse(text) as Record<string, unknown>);
        if (parseError || parsed === null) {
            return [null, { type: 'READ_FAILED', path: file, message: this.describe(parseError) }];
        }
        return [parsed, null];
    }

    private invalid(message: string): ConfigFailure {
        return { type: 'READ_FAILED', path: 'config', message };
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
