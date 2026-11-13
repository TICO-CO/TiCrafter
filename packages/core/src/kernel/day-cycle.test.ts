import { describe, expect, it } from 'bun:test';

import { DayCycle } from './day-cycle.js';

describe('DayCycle', () => {
    it('maps minecraft ticks from sunrise through night', () => {
        expect(DayCycle.phase(0)).toBe('morning');
        expect(DayCycle.phase(3_281)).toBe('morning');
        expect(DayCycle.phase(6_000)).toBe('day');
        expect(DayCycle.phase(10_000)).toBe('day');
        expect(DayCycle.phase(10_500)).toBe('evening');
        expect(DayCycle.phase(12_500)).toBe('evening');
        expect(DayCycle.phase(13_000)).toBe('night');
        expect(DayCycle.phase(18_000)).toBe('night');
        expect(DayCycle.phase(23_000)).toBe('night');
    });

    it('normalizes wrapped ticks', () => {
        expect(DayCycle.phase(-1)).toBe('night');
        expect(DayCycle.phase(24_000)).toBe('morning');
        expect(DayCycle.phase(37_000)).toBe('night');
    });

    it('counts ticks until night', () => {
        expect(DayCycle.ticksUntilNight(0)).toBe(13_000);
        expect(DayCycle.ticksUntilNight(10_000)).toBe(3_000);
        expect(DayCycle.ticksUntilNight(12_500)).toBe(500);
        expect(DayCycle.ticksUntilNight(13_000)).toBe(0);
        expect(DayCycle.ticksUntilNight(null)).toBe(0);
    });

    it('does not mark daytime without a clock value', () => {
        expect(DayCycle.isDaytime(0)).toBe(true);
        expect(DayCycle.isDaytime(13_000)).toBe(false);
        expect(DayCycle.isDaytime(null)).toBe(false);
    });
});
