import { attempt } from '@ticrafter/core';
import type { Logger } from 'pino';

export interface SchedulerOptions {
    intervalMs: number;
    logger: Logger;
    tick: () => void;
}

export class Scheduler {
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly options: SchedulerOptions) {}

    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), this.options.intervalMs);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private tick(): void {
        const [, tickError] = attempt(() => this.options.tick());
        if (tickError) {
            this.options.logger.error({ error: this.describe(tickError) }, 'scheduler tick failed');
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
