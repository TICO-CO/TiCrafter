import type { Result } from '../kernel/index.js';
import type { ConfigFailure } from './failures.js';
import type { TicrafterConfig } from './schema.js';

export interface PlannerSecrets {
    baseUrl: string;
    apiKey: string;
}

export class PlannerSecretsLoader {
    constructor(private readonly config: TicrafterConfig) {}

    load(): Result<PlannerSecrets, ConfigFailure> {
        if (!this.config.planner.enabled) return [{ baseUrl: '', apiKey: '' }, null];
        if (!this.config.planner.baseUrl) {
            return [null, { type: 'PLANNER_SECRETS', message: 'PLANNER_BASE_URL is required' }];
        }
        if (!this.config.planner.apiKey) {
            return [null, { type: 'PLANNER_SECRETS', message: 'PLANNER_API_KEY is required' }];
        }
        return [{ baseUrl: this.config.planner.baseUrl, apiKey: this.config.planner.apiKey }, null];
    }
}
