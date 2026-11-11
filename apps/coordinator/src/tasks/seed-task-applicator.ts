import type { LoggerPort, Result } from '@ticrafter/core';

import type { CreateTaskInput, TaskFailure, TaskRecord } from './types.js';

export interface SeedTaskPort {
    get(taskId: string): Result<TaskRecord | null, TaskFailure>;
    create(input: CreateTaskInput): Result<TaskRecord, TaskFailure>;
}

export interface SeedTaskApplyReport {
    created: number;
    skipped: number;
}

export class SeedTaskApplicator {
    constructor(
        private readonly tasks: SeedTaskPort,
        private readonly logger: LoggerPort,
    ) {}

    apply(inputs: readonly CreateTaskInput[]): Result<SeedTaskApplyReport, string> {
        let created = 0;
        let skipped = 0;
        for (const input of inputs) {
            const [existing, readError] = this.tasks.get(input.id);
            if (readError) return [null, JSON.stringify(readError)];
            if (existing !== null) {
                skipped += 1;
                continue;
            }
            const [, createError] = this.tasks.create(input);
            if (createError !== null && createError.type !== 'DUPLICATE_TASK') {
                return [null, JSON.stringify(createError)];
            }
            if (createError === null) {
                created += 1;
                this.logger.info({ taskId: input.id }, 'seed task created');
                continue;
            }
            skipped += 1;
        }
        return [{ created, skipped }, null];
    }
}
