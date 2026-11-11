import { attemptAsync, type Result } from '@ticrafter/core';

import type { DecisionFailure } from './types.js';

interface TimeoutHandle<T> {
    promise: Promise<Result<T, DecisionFailure>>;
    cancel: () => void;
}

export class DecisionSingleInflightGuard {
    private inFlight = false;

    async run<T>(
        operation: () => Promise<T>,
        timeoutMilliseconds: number,
    ): Promise<Result<T, DecisionFailure>> {
        if (this.inFlight) return [null, { type: 'BUSY' }];
        this.inFlight = true;
        const timeout = DecisionSingleInflightGuard.timeout<T>(timeoutMilliseconds);
        const result = await Promise.race([
            attemptAsync<T, DecisionFailure>(operation),
            timeout.promise,
        ]);
        timeout.cancel();
        this.inFlight = false;
        return result;
    }

    get busy(): boolean {
        return this.inFlight;
    }

    private static timeout<T>(timeoutMilliseconds: number): TimeoutHandle<T> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const promise = new Promise<Result<T, DecisionFailure>>((resolve) => {
            timer = setTimeout(
                () => resolve([null, { type: 'TIMEOUT', timeoutMilliseconds }]),
                timeoutMilliseconds,
            );
        });
        return {
            promise,
            cancel: () => {
                if (timer !== null) clearTimeout(timer);
            },
        };
    }
}
