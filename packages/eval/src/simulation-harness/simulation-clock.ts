import type { ClockHandle, ClockPort } from '@ticrafter/core';

interface TimerEntry {
    handle: number;
    deadline: number;
    order: number;
    interval: number | null;
    callback: () => void;
}

export class SimulationClock implements ClockPort {
    private current: number;
    private sequence = 0;
    private nextHandle = 1;
    private readonly timers = new Map<number, TimerEntry>();

    constructor(startMilliseconds = 0) {
        this.current = startMilliseconds;
    }

    now(): number {
        return this.current;
    }

    setTimeout(callback: () => void, delayMilliseconds: number): ClockHandle {
        return this.schedule(callback, Math.max(0, delayMilliseconds), null);
    }

    clearTimeout(handle: ClockHandle): void {
        if (typeof handle === 'number') this.timers.delete(handle);
    }

    setInterval(callback: () => void, delayMilliseconds: number): ClockHandle {
        return this.schedule(
            callback,
            Math.max(1, delayMilliseconds),
            Math.max(1, delayMilliseconds),
        );
    }

    clearInterval(handle: ClockHandle): void {
        this.clearTimeout(handle);
    }

    advanceBy(milliseconds: number): number {
        return this.advanceTo(this.current + Math.max(0, milliseconds));
    }

    advanceTo(targetMilliseconds: number): number {
        let fired = 0;
        let entry = this.nextDue(targetMilliseconds);
        while (entry !== null) {
            this.current = Math.max(this.current, entry.deadline);
            if (entry.interval === null) {
                this.timers.delete(entry.handle);
            } else {
                entry.deadline = this.current + entry.interval;
                entry.order = this.sequence++;
            }
            fired += 1;
            entry.callback();
            entry = this.nextDue(targetMilliseconds);
        }
        this.current = Math.max(this.current, targetMilliseconds);
        return fired;
    }

    pendingTimers(): number {
        return this.timers.size;
    }

    private schedule(callback: () => void, delay: number, interval: number | null): ClockHandle {
        const handle = this.nextHandle;
        this.nextHandle += 1;
        this.timers.set(handle, {
            handle,
            deadline: this.current + delay,
            order: this.sequence,
            interval,
            callback,
        });
        this.sequence += 1;
        return handle;
    }

    private nextDue(limit: number): TimerEntry | null {
        let selected: TimerEntry | null = null;
        for (const entry of this.timers.values()) {
            if (entry.deadline > limit) continue;
            if (
                selected === null ||
                entry.deadline < selected.deadline ||
                (entry.deadline === selected.deadline && entry.order < selected.order)
            ) {
                selected = entry;
            }
        }
        return selected;
    }
}
