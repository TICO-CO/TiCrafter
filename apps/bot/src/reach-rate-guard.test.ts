import { describe, expect, it } from 'bun:test';

import { ReachRateGuard } from './reach-rate-guard.js';

describe('reach rate guard', () => {
    it('accepts targets inside reach', () => {
        const guard = new ReachRateGuard({
            maximumReach: 4.5,
            actionsPerSecond: 10,
            clock: () => 1_000,
        });
        const [accepted, failure] = guard.evaluate({ x: 0, y: 64, z: 0 }, { x: 4, y: 64, z: 0 });
        expect(failure).toBeNull();
        expect(accepted).toBe(undefined);
    });

    it('rejects targets outside reach', () => {
        const guard = new ReachRateGuard({
            maximumReach: 4.5,
            actionsPerSecond: 10,
            clock: () => 1_000,
        });
        const [accepted, failure] = guard.evaluate({ x: 0, y: 64, z: 0 }, { x: 5, y: 64, z: 0 });
        expect(accepted).toBeNull();
        expect(failure?.type).toBe('REACH_EXCEEDED');
    });

    it('rejects actions inside the rate window', () => {
        let now = 1_000;
        const guard = new ReachRateGuard({
            maximumReach: 4.5,
            actionsPerSecond: 10,
            clock: () => now,
        });
        const [firstAccepted, firstFailure] = guard.evaluate({ x: 0, y: 64, z: 0 }, null);
        expect(firstFailure).toBeNull();
        expect(firstAccepted).toBe(undefined);
        const [secondAccepted, secondFailure] = guard.evaluate({ x: 0, y: 64, z: 0 }, null);
        expect(secondAccepted).toBeNull();
        expect(secondFailure?.type).toBe('RATE_LIMITED');
        now += 100;
        const [thirdAccepted, thirdFailure] = guard.evaluate({ x: 0, y: 64, z: 0 }, null);
        expect(thirdFailure).toBeNull();
        expect(thirdAccepted).toBe(undefined);
    });

    it('describes failures', () => {
        expect(
            ReachRateGuard.describe({
                type: 'REACH_EXCEEDED',
                distance: 6,
                maximumReach: 4.5,
            }).includes('exceeds reach'),
        ).toBe(true);
        expect(
            ReachRateGuard.describe({
                type: 'RATE_LIMITED',
                waitMilliseconds: 25,
            }).includes('25ms'),
        ).toBe(true);
    });
});
