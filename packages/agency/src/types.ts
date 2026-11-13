import type { ProgressionPlan, StrategicGoalKind, StrategicIntent, Vec3 } from '@ticrafter/core';

export type { ProgressionMilestone, ProgressionPlan } from '@ticrafter/core';

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

export type GoalKind = StrategicGoalKind;

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
    homeBbox: SnapshotBoundingBox | null;
    homeStatus: HomeStatus | null;
    homeStructureId: string | null;
    hasBedAtHome: boolean;
    isSheltered: boolean;
    digSite: Vec3 | null;
    weapon: { name: string; tier: number } | null;
    armorPieces: number;
    armorInventoryPieces: number;
    nightIntent: NightIntent | null;
    project?: ProjectSummary | null;
    hasCraftingTable?: boolean;
    hasFurnace?: boolean;
    hasContainer?: boolean;
    stations?: readonly { kind: string; position: Vec3 }[];
    woodClusters?: readonly { position: Vec3; count: number }[];
    farmPlots?: readonly {
        id: string;
        bbox: SnapshotBoundingBox;
        cropBlockIds?: readonly string[];
        seedItem?: string;
        permitted?: boolean;
    }[];
    villageCandidates?: readonly {
        id: string;
        bbox: SnapshotBoundingBox;
        confidence: number;
    }[];
    waterSources?: readonly Vec3[];
}

export interface SnapshotBoundingBox {
    min: Vec3;
    max: Vec3;
}

export type HomeStatus = 'proposed' | 'active' | 'completed' | 'abandoned' | 'failed';

export type NightIntent = 'rest' | 'hunt';

export type NightGap =
    | 'home-missing'
    | 'home-far'
    | 'shelter-missing'
    | 'bed-missing'
    | 'food-low'
    | 'food-missing'
    | 'weapon-missing'
    | 'armor-missing'
    | 'health-low'
    | 'hostiles-near';

export type NightActionKind =
    | 'navigate-home'
    | 'eat'
    | 'gather-food'
    | 'gather-wool'
    | 'craft-bed'
    | 'place-bed'
    | 'craft-weapon'
    | 'equip-gear'
    | 'build-shelter'
    | 'dig-shelter';

export type ShelterStrategy = 'keep' | 'build' | 'dig-in' | 'none';

export interface NightAction {
    kind: NightActionKind;
    gap: NightGap;
    label: string;
    input: Readonly<Record<string, unknown>>;
}

export interface NightCombatReadiness {
    weaponTier: number;
    armorPieces: number;
    health: number;
    ready: boolean;
}

export interface NightReadiness {
    ready: boolean;
    gaps: readonly NightGap[];
    actions: readonly NightAction[];
    foodServings: number;
    shelterStrategy: ShelterStrategy;
    combat: NightCombatReadiness;
    nightIntent: NightIntent;
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
    deadlineExtended?: boolean;
    attempts: number;
}

export type FocusKind = 'agency' | 'project' | 'task';

export interface WorkingMemoryFocus {
    kind: FocusKind;
    id: string;
    label: string;
    startedAt: string;
}

export interface WorkingMemoryCommitment {
    id: string;
    description: string;
    priority: number;
    createdAt: string;
    expiresAt: string | null;
}

export interface WorkingMemoryInterruption {
    reason: string;
    resumeCondition: string;
    interruptedFocusId: string;
    at: string;
}

export interface WorkingMemoryExperience {
    event: string;
    outcome: string;
    at: string;
}

export interface WorkingMemoryTacticalDecision {
    choiceId: string;
    source: 'laya' | 'fallback' | 'deterministic';
    at: string;
    revision: number;
}

export interface WorkingMemory {
    revision: number;
    focus: WorkingMemoryFocus | null;
    commitments: readonly WorkingMemoryCommitment[];
    interruption: WorkingMemoryInterruption | null;
    recentExperiences: readonly WorkingMemoryExperience[];
    lastTacticalDecision: WorkingMemoryTacticalDecision | null;
    strategicIntent?: StrategicIntent | null;
    progressionPlan?: ProgressionPlan | null;
}

export type ProjectKind = 'home' | 'storage' | 'build';

export type ProjectStatus = 'proposed' | 'active' | 'completed' | 'abandoned' | 'failed';

export interface ProjectSummary {
    id: string;
    title: string;
    kind: ProjectKind;
    status: ProjectStatus;
    anchor: Vec3;
    bbox: SnapshotBoundingBox;
    structureId: string | null;
    storageId: string | null;
}

export type AbandonmentReason =
    | 'unsafe'
    | 'infeasible'
    | 'preempted'
    | 'expired'
    | 'deadline'
    | 'claim_conflict'
    | 'social_rejection';

export type SocialIntent =
    'greeting' | 'status' | 'request' | 'offer' | 'danger' | 'discovery' | 'small-talk' | 'unknown';

export interface SocialContext {
    botName: string;
    recipient: string;
    phase: RoutinePhase;
    activeGoal: string | null;
}
