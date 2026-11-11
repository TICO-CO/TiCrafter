import type { Result } from '../kernel/index.js';
import { EnvOverlay } from './env-overlay.js';
import type { ConfigFailure } from './failures.js';
import { DeepMerge } from './merge.js';
import { ConfigSchemaValidator, type TicrafterConfig } from './schema.js';

export class ProfileResolver {
    static profileName(
        defaults: Record<string, unknown>,
        environment: Record<string, string | undefined>,
    ): string {
        return environment.HARDWARE_PROFILE ?? String(defaults.hardwareProfile ?? '');
    }

    static resolve(
        defaults: Record<string, unknown>,
        profile: Record<string, unknown>,
        environment: Record<string, string | undefined>,
    ): Result<TicrafterConfig, ConfigFailure> {
        const merged = DeepMerge.merge<Record<string, unknown>>(
            defaults,
            profile,
            EnvOverlay.apply(environment),
        );
        return ConfigSchemaValidator.validate(merged);
    }
}
