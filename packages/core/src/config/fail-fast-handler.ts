import type { ConfigFailure } from './failures.js';

export class ConfigErrorFormatter {
    static format(error: unknown): string {
        if (ConfigErrorFormatter.isConfigFailure(error)) {
            if (error.type === 'INVALID') return `invalid configuration:\n- ${error.issues.join('\n- ')}`;
            if (error.type === 'READ_FAILED') return `cannot read ${error.path}: ${error.message}`;
            if (error.type === 'NAME_POOL') return error.message;
            if (error.type === 'PLANNER_SECRETS') return error.message;
        }
        if (error instanceof Error) return error.message;
        return String(error);
    }

    private static isConfigFailure(value: unknown): value is ConfigFailure {
        if (typeof value !== 'object' || value === null) return false;
        const type = (value as { type?: unknown }).type;
        return typeof type === 'string';
    }
}
