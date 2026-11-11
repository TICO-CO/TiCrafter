import type { Result } from '@ticrafter/core';

import type { DecisionFailure, DecisionJob } from './types.js';

export class DecisionQueue {
    private readonly jobs: DecisionJob[] = [];

    constructor(private readonly maximumDepth: number) {}

    enqueue(job: DecisionJob): Result<void, DecisionFailure> {
        if (this.jobs.length >= this.maximumDepth) {
            return [null, { type: 'QUEUE_FULL', depth: this.jobs.length }];
        }
        this.jobs.push(job);
        this.jobs.sort((left, right) => {
            if (left.priority !== right.priority) return right.priority - left.priority;
            return left.id.localeCompare(right.id);
        });
        return [undefined, null];
    }

    take(): DecisionJob | null {
        return this.jobs.shift() ?? null;
    }

    get depth(): number {
        return this.jobs.length;
    }
}
