import type { Result, Vec3 } from '@ticrafter/core';

import type { AgencySnapshot, Goal, ProgressionPlan } from './types.js';

export interface MaterialNeed {
    item: string;
    count: number;
}

export interface ProgressionDecision {
    plan: ProgressionPlan;
    goal: Goal | null;
}

export interface ProgressionPlannerPort {
    nextGoal(plan: ProgressionPlan, snapshot: AgencySnapshot): Result<ProgressionDecision, string>;
    observe(plan: ProgressionPlan, outcome: GoalOutcome): ProgressionPlan;
}

export interface GoalOutcome {
    goal: Goal;
    status: 'completed' | 'abandoned';
    at: string;
}

export interface ProgressionMilestoneDefinition {
    id: string;
    kind: string;
    label: string;
    targetCount: number;
    goalKind: Goal['kind'];
    resourceKind?: 'wood' | 'stone';
    anchor?: (snapshot: AgencySnapshot) => Vec3 | null;
}
