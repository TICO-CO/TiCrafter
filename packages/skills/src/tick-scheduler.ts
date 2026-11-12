import { type ClockHandle, type ClockPort, type Result, SystemClock } from '@ticrafter/core';

export class TickScheduler {
    private timer: ClockHandle | null = null;
    private readonly clock: ClockPort;

    constructor(
        private readonly intervalMilliseconds: number,
        clock: ClockPort = new SystemClock(),
    ) {
        this.clock = clock;
    }

    start(callback: () => void): Result<void, string> {
        if (this.timer !== null) return [null, 'scheduler already running'];
        this.timer = this.clock.setInterval(callback, this.intervalMilliseconds);
        return [undefined, null];
    }

    stop(): void {
        if (this.timer === null) return;
        this.clock.clearInterval(this.timer);
        this.timer = null;
    }

    get running(): boolean {
        return this.timer !== null;
    }
}
