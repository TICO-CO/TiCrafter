import { describe, expect, it } from 'bun:test';

import { BackpressureController } from './backpressure-controller.js';

describe('backpressure controller', () => {
    it('stays normal without samples', () => {
        const controller = new BackpressureController();
        const state = controller.evaluate({ decisionP95Milliseconds: 0, decisionSamples: 0 });
        expect(state.level).toBe('normal');
        expect(state.rateScale).toBe(1);
    });

    it('throttles after consecutive over-budget samples', () => {
        const controller = new BackpressureController();
        const first = controller.evaluate({ decisionP95Milliseconds: 300, decisionSamples: 10 });
        expect(first.level).toBe('normal');
        const second = controller.evaluate({ decisionP95Milliseconds: 320, decisionSamples: 11 });
        expect(second.level).toBe('throttled');
        expect(second.rateScale).toBe(0.5);
        expect(second.reasons[0]?.includes('exceeds')).toBe(true);
    });

    it('recovers after consecutive under-budget samples', () => {
        const controller = new BackpressureController();
        controller.evaluate({ decisionP95Milliseconds: 300, decisionSamples: 10 });
        controller.evaluate({ decisionP95Milliseconds: 300, decisionSamples: 11 });
        controller.evaluate({ decisionP95Milliseconds: 100, decisionSamples: 12 });
        controller.evaluate({ decisionP95Milliseconds: 100, decisionSamples: 13 });
        const recovered = controller.evaluate({
            decisionP95Milliseconds: 100,
            decisionSamples: 14,
        });
        expect(recovered.level).toBe('normal');
        expect(recovered.rateScale).toBe(1);
    });

    it('does not recover inside the hysteresis band', () => {
        const controller = new BackpressureController();
        controller.evaluate({ decisionP95Milliseconds: 300, decisionSamples: 10 });
        controller.evaluate({ decisionP95Milliseconds: 300, decisionSamples: 11 });
        const state = controller.evaluate({ decisionP95Milliseconds: 210, decisionSamples: 12 });
        expect(state.level).toBe('throttled');
    });
});
