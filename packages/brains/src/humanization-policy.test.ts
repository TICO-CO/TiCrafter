import { describe, expect, it } from 'bun:test';

import { HumanizationPolicy, SeededRandomSource } from './humanization-policy.js';

const traits = { caution: 0.5, orderliness: 0.5, patience: 0.5 };

describe('humanization policy', () => {
    it('produces stable values for a fixed seed', () => {
        const first = new HumanizationPolicy(new SeededRandomSource(42), traits);
        const second = new HumanizationPolicy(new SeededRandomSource(42), traits);
        expect(first.reactionLatency()).toBe(second.reactionLatency());
        expect(first.pauseDuration()).toBe(second.pauseDuration());
        expect(first.chatDelay()).toBe(second.chatDelay());
    });

    it('bounds reaction and chat delays', () => {
        const policy = new HumanizationPolicy(new SeededRandomSource(7), traits);
        const latency = policy.reactionLatency();
        const chat = policy.chatDelay();
        expect(latency >= 50 && latency <= 250).toBe(true);
        expect(chat >= 800 && chat <= 3000).toBe(true);
    });

    it('sprints only on long open stretches', () => {
        const policy = new HumanizationPolicy(new SeededRandomSource(1), traits);
        expect(
            policy.sprintAllowed({
                distance: 32,
                indoor: false,
                nearHazard: false,
                surface: 'open',
            }),
        ).toBe(true);
        expect(
            policy.sprintAllowed({
                distance: 32,
                indoor: true,
                nearHazard: false,
                surface: 'open',
            }),
        ).toBe(false);
        expect(
            policy.sprintAllowed({
                distance: 32,
                indoor: false,
                nearHazard: true,
                surface: 'open',
            }),
        ).toBe(false);
        expect(
            policy.sprintAllowed({
                distance: 8,
                indoor: false,
                nearHazard: false,
                surface: 'open',
            }),
        ).toBe(false);
    });
});
