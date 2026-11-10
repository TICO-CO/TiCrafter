import fileSystem from 'node:fs';
import path from 'node:path';

import { attempt, type ConfigFailure, type ConfigSource, type Result } from '@ticrafter/core';

export class NodeConfigSource implements ConfigSource {
    constructor(private readonly configDirectory: string) {}

    readEnvironmentFile(): Result<string, ConfigFailure> {
        return this.readFile(path.join(this.configDirectory, '.env'), true);
    }

    readDefaults(): Result<string, ConfigFailure> {
        return this.readFile(path.join(this.configDirectory, 'default.json'), false);
    }

    readProfile(name: string): Result<string, ConfigFailure> {
        return this.readFile(path.join(this.configDirectory, 'profiles', `${name}.json`), false);
    }

    private readFile(filePath: string, optional: boolean): Result<string, ConfigFailure> {
        const [text, readError] = attempt(() => fileSystem.readFileSync(filePath, 'utf8'));
        if (readError) {
            if (optional) return ['', null];
            return [
                null,
                {
                    type: 'READ_FAILED',
                    path: filePath,
                    message: this.describe(readError),
                },
            ];
        }
        if (text === null) {
            return [null, { type: 'READ_FAILED', path: filePath, message: 'file returned null' }];
        }

        return [text, null];
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
