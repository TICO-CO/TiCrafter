import { describe, expect, it } from 'bun:test';

import { SimulationClock } from './simulation-clock.js';

describe('SimulationClock', () => {
    it('fires due timers in deadline and creation order', () => {
        const clock = new SimulationClock(1000);
        const order: string[] = [];
        clock.setTimeout(() => order.push('second'), 20);
        clock.setTimeout(() => order.push('first'), 10);
        clock.setTimeout(() => order.push('first-created'), 10);

        expect(clock.advanceBy(15)).toBe(2);
        expect(order).toEqual(['first', 'first-created']);
        clock.advanceBy(10);
        expect(order).toEqual(['first', 'first-created', 'second']);
        expect(clock.now()).toBe(1025);
    });

    it('repeats intervals and stops after clearInterval', () => {
        const clock = new SimulationClock();
        let count = 0;
        const handle = clock.setInterval(() => {
            count += 1;
        }, 10);

        clock.advanceBy(25);
        expect(count).toBe(2);
        clock.clearInterval(handle);
        clock.advanceBy(50);
        expect(count).toBe(2);
        expect(clock.pendingTimers()).toBe(0);
    });
});
