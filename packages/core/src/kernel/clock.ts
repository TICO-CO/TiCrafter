export type ClockHandle = ReturnType<typeof setTimeout> | number;

export interface ClockPort {
    now(): number;
    setTimeout(callback: () => void, delayMilliseconds: number): ClockHandle;
    clearTimeout(handle: ClockHandle): void;
    setInterval(callback: () => void, delayMilliseconds: number): ClockHandle;
    clearInterval(handle: ClockHandle): void;
}

export class SystemClock implements ClockPort {
    now(): number {
        return Date.now();
    }

    setTimeout(callback: () => void, delayMilliseconds: number): ClockHandle {
        return setTimeout(callback, delayMilliseconds);
    }

    clearTimeout(handle: ClockHandle): void {
        clearTimeout(handle);
    }

    setInterval(callback: () => void, delayMilliseconds: number): ClockHandle {
        return setInterval(callback, delayMilliseconds);
    }

    clearInterval(handle: ClockHandle): void {
        clearInterval(handle);
    }
}
