import type { BehaviorTraceEntry } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { BehaviorMetricsReader } from './behavior-metrics.js';

function entry(
    at: number,
    subject: string,
    detail: Readonly<Record<string, unknown>>,
): BehaviorTraceEntry {
    return {
        at: new Date(at).toISOString(),
        botId: 'bot.tibot1',
        kind: 'decision',
        subject,
        detail,
    };
}

describe('BehaviorMetricsReader', () => {
    it('measures dwell, switches, and purposeful idle from goal lifecycle traces', () => {
        const entries = [
            entry(0, 'agency.goal.started', { goalId: 'goal:gather', goalKind: 'gather' }),
            entry(60_000, 'agency.goal.completed', { goalId: 'goal:gather', goalKind: 'gather' }),
            entry(60_000, 'agency.goal.started', { goalId: 'goal:leisure', goalKind: 'leisure' }),
            entry(120_000, 'agency.goal.switched', {
                previousGoalId: 'goal:leisure',
                previousGoalKind: 'leisure',
                goalId: 'goal:eat',
                goalKind: 'eat',
            }),
            entry(120_000, 'agency.goal.started', { goalId: 'goal:eat', goalKind: 'eat' }),
            entry(180_000, 'agency.goal.abandoned', { goalId: 'goal:eat', goalKind: 'eat' }),
            entry(190_000, 'agency.goal.started', { goalId: 'goal:explore', goalKind: 'explore' }),
        ];
        const metrics = BehaviorMetricsReader.read(entries, {
            durationMilliseconds: 200_000,
        });
        expect(metrics.goalsStarted).toBe(4);
        expect(metrics.goalsCompleted).toBe(1);
        expect(metrics.goalsAbandoned).toBe(1);
        expect(metrics.goalSwitches).toBe(1);
        expect(metrics.leisureGoals).toBe(1);
        expect(metrics.leisureMilliseconds).toBe(60_000);
        expect(metrics.idleMilliseconds).toBe(10_000);
        expect(metrics.idleFraction).toBe(0.05);
        expect(Number(metrics.goalSwitchesPerTenMinutes.toFixed(3))).toBe(3);
        expect(metrics.dwellMedianMilliseconds).toBe(60_000);
        expect(metrics.switchStormOddities).toBe(1);
    });

    it('flags a run with no purposeful idle', () => {
        const entries = [
            entry(0, 'agency.goal.started', { goalId: 'goal:gather', goalKind: 'gather' }),
            entry(120_000, 'agency.goal.completed', { goalId: 'goal:gather', goalKind: 'gather' }),
        ];
        const metrics = BehaviorMetricsReader.read(entries, {
            durationMilliseconds: 120_000,
        });
        expect(metrics.idleFraction).toBe(0);
        expect(metrics.noIdleOddities).toBe(1);
    });
});
