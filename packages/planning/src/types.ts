import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { PlannerFailure } from './failures.js';
import type {
    PlannerBlueprint,
    PlannerBoundingBox,
    PlannerContainer,
    PlannerFarm,
    PlannerGoal,
    PlannerPlan,
    PlannerPosition,
    PlannerRoad,
    PlannerSipMutation,
    PlannerStructure,
    PlannerTask,
    PlannerZone,
} from './plan-schema.js';

export type PlannerTriggerKind =
    | 'interval'
    | 'sip_conflict'
    | 'task_failure_burst'
    | 'death_cluster'
    | 'landmark'
    | 'chat_request'
    | 'arbitration';

export interface PlannerTrigger {
    kind: PlannerTriggerKind;
    id: string;
    reason: string;
    requestedAt: string;
    detail: Readonly<Record<string, unknown>>;
}

export interface PlannerTaskView {
    id: string;
    status: string;
    priority: number;
    dependencies: readonly string[];
    failureClass: string | null;
    deadLetterReason: string | null;
}

export interface PlannerBotView {
    id: string;
    role: string | null;
    online: boolean;
    position: PlannerPosition | null;
}

export interface PlannerLandmarkView {
    id: string;
    type: string;
    position: PlannerPosition;
    confidence: number;
}

export interface PlannerSipView {
    revision: number;
    zones: readonly PlannerZone[];
    structures: readonly PlannerStructure[];
    roads: readonly PlannerRoad[];
    farms: readonly PlannerFarm[];
    containers: readonly PlannerContainer[];
    protectedBboxes: readonly PlannerBoundingBox[];
    noBuildZones: readonly (readonly PlannerPosition[])[];
}

export interface PlannerContext {
    createdAt: string;
    trigger: PlannerTrigger;
    sip: PlannerSipView;
    tasks: readonly PlannerTaskView[];
    bots: readonly PlannerBotView[];
    landmarks: readonly PlannerLandmarkView[];
    inventory: Readonly<Record<string, number>>;
}

export interface PlannerContextSource {
    snapshot(): Result<PlannerSipView, string>;
    tasks(): Result<readonly PlannerTaskView[], string>;
    bots(): Result<readonly PlannerBotView[], string>;
    landmarks(): Result<readonly PlannerLandmarkView[], string>;
    inventory(): Result<Readonly<Record<string, number>>, string>;
}

export interface PlannerPrompt {
    context: PlannerContext;
    messages: readonly PlannerChatMessage[];
    contextHash: string;
}

export interface PlannerChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface PlannerHttpRequest {
    url: string;
    apiKey: string;
    headers: Readonly<Record<string, string>>;
    bodyJson: string;
    signal: AbortSignal;
}

export interface PlannerHttpResponse {
    status: number;
    bodyText: string;
}

export interface PlannerHttpPort {
    post(request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>>;
}

export interface PlannerCompletionRequest {
    messages: readonly PlannerChatMessage[];
    maxOutputTokens: number;
    signal: AbortSignal;
}

export interface PlannerUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export interface PlannerCompletion {
    content: string;
    usage: PlannerUsage;
}

export interface PlannerRawResponse {
    content: string;
    failure: PlannerFailure | null;
    usage: PlannerUsage;
}

export interface PlannerRepairOutcome {
    plan: PlannerPlan;
    attempts: number;
    responses: readonly PlannerRawResponse[];
    usage: PlannerUsage;
}

export interface PlannerPlanCacheEntry {
    plan: PlannerPlan;
    revision: number;
    contextHash: string | null;
    createdAt: string;
}

export interface PlannerPlanStorePort {
    savePlan(record: {
        id: string;
        revision: number;
        contextHash: string | null;
        planJson: string;
        createdAt: string;
    }): Result<void, StorageFailure>;
    latestPlan(): Result<
        {
            id: string;
            revision: number;
            contextHash: string | null;
            planJson: string;
            createdAt: string;
        } | null,
        StorageFailure
    >;
    appendResponse(record: {
        planId: string | null;
        status: 'success' | 'failure';
        content: string;
        error: string | null;
        createdAt: string;
    }): Result<void, StorageFailure>;
    prune(planLimit: number, responseLimit: number): Result<void, StorageFailure>;
}

export interface PlannerSipProposalMetadata {
    actor: string;
    expectedRevision: number;
    idempotencyKey: string;
    fencingToken: number;
    planId: string | null;
    grantId: string | null;
}

export interface PlannerSipProposalInput {
    metadata: PlannerSipProposalMetadata;
    mutations: readonly PlannerSipMutation[];
}

export interface PlannerSipProposalPort {
    propose(input: PlannerSipProposalInput): Result<PlannerSipProposalInput, string>;
}

export interface PlannerTaskProposal {
    id: string;
    title: string;
    parentId: string | null;
    priority: number;
    payload: Readonly<Record<string, unknown>>;
    dependencies: readonly string[];
    preconditions: PlannerTask['preconditions'];
    requiredRole: PlannerTask['requiredRole'];
    target: PlannerPosition | null;
}

export interface PlannerTaskProposalPort {
    validate(inputs: readonly PlannerTaskProposal[]): Result<void, string>;
}

export interface PlannerSkillCatalogPort {
    has(skillId: string): boolean;
}

export interface PlannerSipValidationPort {
    validate(mutations: readonly PlannerSipMutation[]): Result<void, string>;
}

export interface PlannerArbitrationRequest {
    structureId: string;
    requesterBotId: string;
    ownerBotIds: readonly string[];
    observedDesignRevision: number;
    designRevision: number;
    proposedOps: readonly string[];
    bbox: PlannerBoundingBox;
    intent: string;
    snapshotRevision: number;
    completedWorkPackageIds: readonly string[];
    claimedWorkPackageIds: readonly string[];
    protectedRegion: boolean;
    noBuildZone: boolean;
}

export interface PlannerArbitrationResult {
    allow: boolean;
    reason: string;
}

export interface PlannerCycleResult {
    source: 'planner' | 'last-good' | 'none';
    plan: PlannerPlan | null;
    applicable: boolean;
    sipProposal: PlannerSipProposalInput | null;
    taskProposals: readonly PlannerTaskProposal[];
    attempts: number;
    usage: PlannerUsage;
    failure: PlannerFailure | null;
}

export interface PlannerServiceConfig {
    enabled: boolean;
    model: string;
    intervalMilliseconds: number;
    callsPerMinute: number;
    maxTokensPerCall: number;
    timeoutMilliseconds: number;
    maxRepairAttempts: number;
    maxContextCharacters: number;
}

export type PlannerPlanParts = {
    goals: readonly PlannerGoal[];
    tasks: readonly PlannerTask[];
    blueprints: readonly PlannerBlueprint[];
};
