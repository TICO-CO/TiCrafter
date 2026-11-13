import { describe, expect, it } from 'bun:test';

import { SimulationClock } from './simulation-clock.js';
import { SimulationKernel } from './simulation-kernel.js';

describe('SimulationKernel', () => {
    it('treats a configured duration as successful completion', async () => {
        const clock = new SimulationClock(0);
        const kernel = new SimulationKernel({
            clock,
            maximumTicks: 3,
            durationTicks: 3,
            shouldStop: () => false,
        });
        const [ticks, error] = await kernel.run();
        expect(error).toBeNull();
        expect(ticks).toBe(3);
        expect(clock.now()).toBe(750);
    });

    it('fails when the maximum tick count is exhausted without a duration', async () => {
        const clock = new SimulationClock(0);
        const kernel = new SimulationKernel({
            clock,
            maximumTicks: 3,
            shouldStop: () => false,
        });
        const [ticks, error] = await kernel.run();
        expect(ticks).toBeNull();
        expect(error?.includes('exceeded 3 ticks')).toBe(true);
    });

    it('waits for asynchronous tick handlers to settle', async () => {
        const clock = new SimulationClock(0);
        let completed = false;
        const kernel = new SimulationKernel({
            clock,
            maximumTicks: 2,
            durationTicks: 2,
            shouldStop: () => false,
            onTick: async () => {
                await Promise.resolve();
                completed = true;
            },
        });
        const [, error] = await kernel.run();
        expect(error).toBeNull();
        expect(completed).toBe(true);
    });
});
