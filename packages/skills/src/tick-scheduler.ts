import type { Result } from '@ticrafter/core';

export class TickScheduler {
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly intervalMilliseconds: number) {}

    start(callback: () => void): Result<void, string> {
        if (this.timer !== null) return [null, 'scheduler already running'];
        this.timer = setInterval(callback, this.intervalMilliseconds);
        return [undefined, null];
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    get running(): boolean {
        return this.timer !== null;
    }
}
