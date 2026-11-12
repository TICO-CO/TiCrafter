import type { Vec3 } from '@ticrafter/core';

export type NeedName =
    | 'safety'
    | 'hunger'
    | 'rest'
    | 'materials'
    | 'tools'
    | 'shelter'
    | 'social'
    | 'novelty'
    | 'achievement';

export type NeedLevels = Readonly<Record<NeedName, number>>;

export interface PersonalityTraits {
    curiosity: number;
    industriousness: number;
    caution: number;
    sociability: number;
    ambition: number;
    orderliness: number;
    patience: number;
}

export type GoalKind =
    | 'survive'
    | 'eat'
    | 'rest'
    | 'gather'
    | 'craft'
    | 'shelter'
    | 'explore'
    | 'social'
    | 'return-home'
    | 'deposit'
    | 'leisure';

export type GoalSource = 'need' | 'job' | 'social' | 'curiosity' | 'routine';

export interface GoalStep {
    skillId: string;
    label: string;
    input: Readonly<Record<string, unknown>>;
}

export interface Goal {
    id: string;
    kind: GoalKind;
    label: string;
    priority: number;
    source: GoalSource;
    target: Vec3 | null;
    steps: readonly GoalStep[];
    expectedValue: number;
    estimatedCost: number;
    estimatedRisk: number;
    deadline: string | null;
}

export interface AgencySnapshot {
    at: string;
    position: Vec3;
    health: number;
    food: number;
    timeOfDay: number | null;
    inventory: readonly { name: string; count: number }[];
    nearbyBots: readonly string[];
    nearbyPlayers: readonly string[];
    hostiles: readonly string[];
    home: Vec3 | null;
    hasBed: boolean;
    knownResourceSites: readonly { kind: string; position: Vec3 }[];
}

export type RoutinePhase = 'morning' | 'day' | 'evening' | 'night';

export interface RoutineState {
    phase: RoutinePhase;
    lastMealAt: string | null;
    lastRestAt: string | null;
}

export interface Intention {
    goalId: string;
    label: string;
    stepIndex: number;
    createdAt: string;
    deadline: string | null;
    attempts: number;
}

export type AbandonmentReason =
    'unsafe' | 'infeasible' | 'preempted' | 'expired' | 'claim_conflict' | 'social_rejection';

export type SocialIntent =
    'greeting' | 'status' | 'request' | 'offer' | 'danger' | 'discovery' | 'small-talk' | 'unknown';

export interface SocialContext {
    botName: string;
    recipient: string;
    phase: RoutinePhase;
    activeGoal: string | null;
}
