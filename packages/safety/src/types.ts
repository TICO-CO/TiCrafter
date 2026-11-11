import type { ActionRequest, Vec3 } from '@ticrafter/core';

export type SafetySeverity = 'info' | 'warning' | 'critical';

export type SafetySignalCode =
    | 'hazard.lava'
    | 'hazard.fire'
    | 'hazard.drowning'
    | 'hazard.fall'
    | 'hazard.void'
    | 'mob.threat'
    | 'hunger.low'
    | 'movement.stuck'
    | 'movement.unreachable'
    | 'inventory.full'
    | 'claim.lost'
    | 'action.material-ban'
    | 'action.protected-region'
    | 'action.active-bot-support'
    | 'emergency-stop';

export interface SafetySignal {
    code: SafetySignalCode;
    severity: SafetySeverity;
    message: string;
}

export interface SafetyActiveBot {
    botId: string;
    position: Vec3;
}

export interface SafetyClaim {
    id: string;
    expiresAt: string;
}

export interface SafetyWorldView {
    blockAt(position: Vec3): string | null;
    isProtected(position: Vec3): boolean;
    activeBots(): readonly SafetyActiveBot[];
    claimFor(botId: string): SafetyClaim | null;
}

export interface SafetyInventoryItem {
    name: string;
    count: number;
}

export interface SafetySnapshot {
    botId: string;
    at: string;
    position: Vec3;
    health: number;
    food: number;
    oxygen: number;
    onGround: boolean;
    fallDistance?: number;
    falling?: boolean;
    stuckMilliseconds: number;
    targetUnreachableMilliseconds: number;
    inventory: readonly SafetyInventoryItem[];
    inventoryUsedSlots: number;
    inventoryTotalSlots: number;
    nearestHostileDistance: number | null;
    activeSkillId: string | null;
    claimTrackingEnabled: boolean;
    allowDestructiveMaterials: boolean;
    world: SafetyWorldView;
}

export interface SafetyEvaluator {
    evaluate(snapshot: SafetySnapshot): readonly SafetySignal[];
}

export type RecoveryStepKind =
    'retry-local' | 'deterministic-alternative' | 'planner-replan' | 'safe-mode' | 'emergency-stop';

export interface RecoveryStep {
    kind: RecoveryStepKind;
    reason: string;
}

export interface SafetyDecisionAllowed {
    allowed: true;
    signals: readonly SafetySignal[];
}

export interface SafetyDecisionDenied {
    allowed: false;
    reason: string;
    signals: readonly SafetySignal[];
    recovery: RecoveryStep;
}

export type SafetyDecision = SafetyDecisionAllowed | SafetyDecisionDenied;

export interface SafetyIncident {
    at: string;
    botId: string;
    kind: string;
    message: string;
    action?: ActionRequest;
}

export interface SafetyIncidentSink {
    record(incident: SafetyIncident): void;
}
