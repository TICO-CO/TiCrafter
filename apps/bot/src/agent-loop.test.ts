import {
    type AgencySnapshot,
    type Goal,
    GoalArbiter,
    GoalGenerator,
    IntentionManager,
    NeedsModel,
    PersonalityModel,
    RoutineModel,
} from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { AgentLoop } from './agent-loop.js';
import type {
    GoalTieBreakContext,
    GoalTieBreakInput,
    GoalTieBreakOutcome,
    GoalTieBreakPort,
} from './goal-tie-break.js';

function snapshot(): AgencySnapshot {
    return {
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 6000,
        inventory: [],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: null,
        hasBed: false,
        knownResourceSites: [],
        homeBbox: null,
        homeStatus: null,
        homeStructureId: null,
        hasBedAtHome: false,
        isSheltered: false,
        digSite: null,
        weapon: null,
        armorPieces: 0,
        armorInventoryPieces: 0,
        nightIntent: null,
    };
}

function goal(id: string): Goal {
    return {
        id,
        kind: 'explore',
        label: id,
        priority: 50,
        source: 'need',
        target: null,
        steps: [{ skillId: 'explore', label: 'Explore', input: {} }],
        expectedValue: 0.5,
        estimatedCost: 0.1,
        estimatedRisk: 0.1,
        deadline: null,
    };
}

class FakeGenerator extends GoalGenerator {
    constructor(private readonly goals: readonly Goal[]) {
        super();
    }

    override generate(): Result<readonly Goal[], string> {
        return [this.goals, null];
    }
}

class FakeTieBreak implements GoalTieBreakPort {
    calls = 0;
    stale = false;

    constructor(
        private readonly selected: Goal,
        private readonly onChange?: () => void,
    ) {}

    async decide(input: GoalTieBreakInput): Promise<Result<GoalTieBreakOutcome, string>> {
        this.calls += 1;
        this.onChange?.();
        return [
            {
                goal: this.selected,
                choiceId: `goal:${this.selected.id}`,
                source: this.stale ? 'fallback' : 'laya',
            },
            null,
        ];
    }
}

function context(revision: number): GoalTieBreakContext {
    return {
        revision,
        focus: null,
        commitments: [],
        recentExperiences: [],
        interruption: null,
        strategicGoal: null,
        strategicConstraints: [],
    };
}

interface RecordedDecision {
    choiceId: string;
    source: 'laya' | 'fallback' | 'deterministic';
    revision: number;
    at: string;
}

interface RecordedDrop {
    choiceId: string;
    revision: number;
    reason: string;
    at: string;
}

interface Records {
    decisions: RecordedDecision[];
    drops: RecordedDrop[];
}

function loop(
    goals: readonly Goal[],
    tieBreak: GoalTieBreakPort,
    readContext: () => GoalTieBreakContext,
    records: Records,
): AgentLoop {
    return new AgentLoop({
        botId: 'bot.one',
        generator: new FakeGenerator(goals),
        arbiter: GoalArbiter.create()[0] as GoalArbiter,
        intentions: new IntentionManager(),
        snapshots: {
            read: () => [
                {
                    snapshot: snapshot(),
                    needs: NeedsModel.defaults(),
                    traits: PersonalityModel.fromBotIndex(0),
                    routine: RoutineModel.initialState(6000),
                },
                null,
            ],
        },
        tieBreak,
        tieBreakEnabled: true,
        tacticalContext: readContext,
        recordTacticalDecision: (input) => records.decisions.push(input),
        recordTacticalDrop: (input) => records.drops.push(input),
    });
}

describe('agent loop goal tie-break', () => {
    it('applies a close-goal Laya choice', async () => {
        const first = goal('goal:first');
        const second = goal('goal:second');
        const tieBreak = new FakeTieBreak(second);
        const records: Records = { decisions: [], drops: [] };
        const selected = loop([first, second], tieBreak, () => context(1), records);
        const [tick, tickError] = await selected.tick('2026-11-12T12:00:00.000Z');
        expect(tickError).toBeNull();
        expect(selected.intention?.goalId).toBe(second.id);
        expect(tick?.consultLaya).toBe(true);
        expect(records.decisions[0]?.source).toBe('laya');
    });

    it('drops a stale tie-break and uses the deterministic goal', async () => {
        const first = goal('goal:first');
        const second = goal('goal:second');
        let revision = 1;
        const tieBreak = new FakeTieBreak(second, () => {
            revision = 2;
        });
        const records: Records = { decisions: [], drops: [] };
        const selected = loop([first, second], tieBreak, () => context(revision), records);
        const [, tickError] = await selected.tick('2026-11-12T12:00:00.000Z');
        expect(tickError).toBeNull();
        expect(selected.intention?.goalId).toBe(first.id);
        expect(records.drops).toHaveLength(1);
        expect(records.drops[0]?.reason.includes('revision')).toBe(true);
    });

    it('switches a committed goal only after the minimum dwell', async () => {
        const first = goal('goal:first');
        const second = { ...goal('goal:second'), priority: 90 };
        const selected = loop([first, second], new FakeTieBreak(second), () => context(1), {
            decisions: [],
            drops: [],
        });
        selected.restore(first, {
            goalId: first.id,
            label: first.label,
            stepIndex: 0,
            createdAt: '2026-11-12T12:00:00.000Z',
            deadline: null,
            attempts: 0,
        });
        const [held] = await selected.reconsider('2026-11-12T12:00:10.000Z');
        expect(held).toBeNull();
        const [switched] = await selected.reconsider('2026-11-12T12:00:40.000Z');
        expect(switched?.goal.id).toBe(second.id);
        expect(selected.intention?.goalId).toBe(second.id);
    });

    it('does not consult Laya when scores are not close', async () => {
        const first = goal('goal:first');
        const distant = { ...goal('goal:distant'), priority: 0, expectedValue: 0 };
        const tieBreak = new FakeTieBreak(distant);
        const records: Records = { decisions: [], drops: [] };
        const selected = loop([first, distant], tieBreak, () => context(1), records);
        await selected.tick('2026-11-12T12:00:00.000Z');
        expect(tieBreak.calls).toBe(0);
    });
});
