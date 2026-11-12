import type {
    AgencySnapshot,
    Goal,
    NeedsModel,
    PersonalityModel,
    WorkingMemoryFocus,
} from '@ticrafter/agency';
import type { Affordance, LayaDecision, PolicyState } from '@ticrafter/brains';
import type {
    DecisionRequest,
    Result,
    StrategicConstraint,
    StrategicGoalKind,
} from '@ticrafter/core';

export interface GoalTieBreakCandidate {
    goal: Goal;
    score: number;
}

export interface GoalTieBreakContext {
    revision: number;
    focus: WorkingMemoryFocus | null;
    commitments: readonly { id: string; description: string; priority: number }[];
    recentExperiences: readonly { event: string; outcome: string; at: string }[];
    interruption: {
        reason: string;
        resumeCondition: string;
        interruptedFocusId: string;
    } | null;
    strategicGoal: { kind: StrategicGoalKind; weight: number } | null;
    strategicConstraints: readonly StrategicConstraint[];
}

export interface GoalTieBreakInput {
    botId: string;
    at: string;
    snapshot: AgencySnapshot;
    selected: Goal;
    candidates: readonly GoalTieBreakCandidate[];
    tactical: GoalTieBreakContext;
}

export interface GoalTieBreakOutcome {
    goal: Goal;
    choiceId: string;
    source: 'laya' | 'fallback';
}

export interface GoalTieBreakPort {
    decide(input: GoalTieBreakInput): Promise<Result<GoalTieBreakOutcome, string>>;
}

export interface GoalDecisionPort {
    decide(
        request: DecisionRequest,
        affordances: readonly Affordance[],
        state: PolicyState,
    ): Promise<Result<LayaDecision, string>>;
}

export interface GoalTieBreakClientOptions {
    decisions: GoalDecisionPort;
}

export class GoalTieBreakClient implements GoalTieBreakPort {
    constructor(private readonly options: GoalTieBreakClientOptions) {}

    async decide(input: GoalTieBreakInput): Promise<Result<GoalTieBreakOutcome, string>> {
        const fallback = GoalTieBreakClient.fallback(input.selected);
        const candidates = input.candidates.filter(
            (candidate) => candidate.goal.steps[0] !== undefined,
        );
        if (candidates.length < 2) return [fallback, null];
        const affordances = candidates.map((candidate) => GoalTieBreakClient.affordance(candidate));
        const request = GoalTieBreakClient.request(input, affordances);
        const [decision, decisionError] = await this.options.decisions.decide(
            request,
            affordances,
            GoalTieBreakClient.policyState(input.snapshot),
        );
        if (decisionError || decision === null || decision.source !== 'laya') {
            return [fallback, null];
        }
        const chosen = candidates.find(
            (candidate) => `goal:${candidate.goal.id}` === decision.choice.id,
        );
        if (chosen === undefined) return [fallback, null];
        return [
            {
                goal: chosen.goal,
                choiceId: decision.choice.id,
                source: 'laya',
            },
            null,
        ];
    }

    private static request(
        input: GoalTieBreakInput,
        affordances: readonly Affordance[],
    ): DecisionRequest {
        const { snapshot, tactical } = input;
        return {
            botId: input.botId,
            at: input.at,
            digest: {
                health: snapshot.health,
                food: snapshot.food,
                position: snapshot.position,
                inventoryCount: snapshot.inventory.length,
                inventorySummary: snapshot.inventory.slice(0, 5).map((item) => ({
                    name: item.name,
                    count: item.count,
                })),
                hazards: [...snapshot.hostiles],
                lastResult: 'Evaluate close agency goals',
                workingMemoryRevision: tactical.revision,
                decisionKind: 'goal',
                focus:
                    tactical.focus === null
                        ? null
                        : {
                              kind: tactical.focus.kind,
                              id: tactical.focus.id,
                              label: tactical.focus.label,
                          },
                commitments: tactical.commitments.map((commitment) => ({
                    id: commitment.id,
                    description: commitment.description,
                    priority: commitment.priority,
                })),
                recentExperiences: tactical.recentExperiences.slice(-5).map((experience) => ({
                    event: experience.event,
                    outcome: experience.outcome,
                    at: experience.at,
                })),
                interruption:
                    tactical.interruption === null
                        ? null
                        : {
                              reason: tactical.interruption.reason,
                              resumeCondition: tactical.interruption.resumeCondition,
                              interruptedFocusId: tactical.interruption.interruptedFocusId,
                          },
                strategicGoal: tactical.strategicGoal,
                strategicConstraints: [...tactical.strategicConstraints],
            },
            affordances: affordances.map((affordance) => ({
                id: affordance.id,
                skillId: affordance.skillId,
                label: affordance.label ?? affordance.reason,
                priority: affordance.priority,
            })),
        };
    }

    private static affordance(candidate: GoalTieBreakCandidate): Affordance {
        const step = candidate.goal.steps[0];
        return {
            id: `goal:${candidate.goal.id}`,
            skillId: step?.skillId ?? 'idle',
            input: step?.input ?? {},
            reason: candidate.goal.label,
            label: candidate.goal.label,
            priority: candidate.score,
        };
    }

    private static policyState(snapshot: AgencySnapshot): PolicyState {
        const inventoryCount = snapshot.inventory.reduce((sum, item) => sum + item.count, 0);
        return {
            health: snapshot.health,
            food: snapshot.food,
            nearestHostileDistance: snapshot.hostiles.length > 0 ? 1 : null,
            inventoryUsedRatio: Math.min(1, inventoryCount / 36),
        };
    }

    private static fallback(goal: Goal): GoalTieBreakOutcome {
        return { goal, choiceId: `goal:${goal.id}`, source: 'fallback' };
    }
}
