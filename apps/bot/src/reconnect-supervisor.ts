import { ReconnectPolicy } from '@ticrafter/core';

export class ReconnectSupervisor {
    private attempt = 0;

    nextDelay(): number {
        const delay = ReconnectPolicy.delay(this.attempt);
        this.attempt += 1;
        return delay;
    }

    reset(): void {
        this.attempt = 0;
    }

    cancel(): void {
        this.attempt = 0;
    }
}
