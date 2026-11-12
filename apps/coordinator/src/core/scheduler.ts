import {
    attempt,
    type ClockHandle,
    type ClockPort,
    type LoggerPort,
    SystemClock,
} from '@ticrafter/core';

export interface SchedulerOptions {
    intervalMs: number;
    logger: LoggerPort;
    tick: () => void;
    clock?: ClockPort;
}

export class Scheduler {
    private timer: ClockHandle | null = null;
    private readonly clock: ClockPort;

    constructor(private readonly options: SchedulerOptions) {
        this.clock = options.clock ?? new SystemClock();
    }

    start(): void {
        if (this.timer) return;
        this.timer = this.clock.setInterval(() => this.tick(), this.options.intervalMs);
    }

    stop(): void {
        if (this.timer) this.clock.clearInterval(this.timer);
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
