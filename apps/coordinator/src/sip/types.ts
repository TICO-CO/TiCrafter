import type { StorageFailure } from '@ticrafter/memory';

export interface SipBlockPosition {
    x: number;
    y: number;
    z: number;
}

export interface SipBoundingBox {
    min: SipBlockPosition;
    max: SipBlockPosition;
}

export type SipZoneType = 'base' | 'farm' | 'forest' | 'mining' | 'road' | 'reserve' | 'no_build';

export interface SipZone {
    id: string;
    name: string;
    type: SipZoneType;
    polygon: SipBlockPosition[];
    priority: number;
}

export type SipLifecycleStatus =
    'planned' | 'claimed' | 'building' | 'complete' | 'failed' | 'abandoned';

export type SipCollaborationPolicy = 'private' | 'invite' | 'open';

export interface SipMaterialNeed {
    item: string;
    count: number;
}

export interface SipWorkPackage {
    id: string;
    bbox: SipBoundingBox;
    status: SipLifecycleStatus;
    claimedBy: string | null;
}

export interface SipStructure {
    id: string;
    type: string;
    blueprintRef: string;
    anchor: SipBlockPosition;
    rotation: number;
    status: SipLifecycleStatus;
    ownerBotIds: string[];
    designRevision: number;
    collaboration: SipCollaborationPolicy;
    autoAcceptCompatibleHelpers: boolean;
    progress: number;
    materialsNeeded: SipMaterialNeed[];
    workPackages: SipWorkPackage[];
}

export interface SipRoadSegment {
    id: string;
    from: SipBlockPosition;
    to: SipBlockPosition;
    status: SipLifecycleStatus;
    ownerBotId: string | null;
}

export interface SipRoad {
    id: string;
    polyline: SipBlockPosition[];
    width: number;
    material: string;
    segments: SipRoadSegment[];
    status: SipLifecycleStatus;
    ownerBotIds: string[];
}

export interface SipFarmPlot {
    id: string;
    bbox: SipBoundingBox;
    crop: string | null;
    waterSource: SipBlockPosition | null;
    growth: number;
    assignedBotId: string | null;
}

export interface SipFarm {
    id: string;
    plots: SipFarmPlot[];
    status: SipLifecycleStatus;
    ownerBotIds: string[];
}

export type SipContainerRole = 'storage' | 'food' | 'tools' | 'fuel';

export interface SipContainer {
    id: string;
    pos: SipBlockPosition;
    role: SipContainerRole;
    reservedBy: string | null;
    contentsSnapshot: Record<string, number> | null;
}

export interface SipPathNode {
    id: string;
    position: SipBlockPosition;
}

export interface SipPathEdge {
    id: string;
    from: string;
    to: string;
    cost: number;
}

export interface SipPathGraph {
    nodes: SipPathNode[];
    edges: SipPathEdge[];
}

export type SipEditOperation = 'place' | 'break' | 'replace';

export interface SipAllowedEdit {
    bbox: SipBoundingBox;
    botIds: string[];
    operations: SipEditOperation[];
}

export interface SipRules {
    protectedBboxes: SipBoundingBox[];
    allowedEdits: SipAllowedEdit[];
    noBreakUnderActiveBot: boolean;
}

export interface SipSnapshot {
    revision: number;
    zones: readonly SipZone[];
    structures: readonly SipStructure[];
    roads: readonly SipRoad[];
    farms: readonly SipFarm[];
    containers: readonly SipContainer[];
    pathGraph: SipPathGraph;
    rules: SipRules;
}

export type SipMutation =
    | { kind: 'zone.upsert'; zone: SipZone }
    | { kind: 'zone.remove'; zoneId: string }
    | { kind: 'structure.upsert'; structure: SipStructure }
    | { kind: 'structure.remove'; structureId: string }
    | { kind: 'road.upsert'; road: SipRoad }
    | { kind: 'road.remove'; roadId: string }
    | { kind: 'farm.upsert'; farm: SipFarm }
    | { kind: 'farm.remove'; farmId: string }
    | { kind: 'container.upsert'; container: SipContainer }
    | { kind: 'container.remove'; containerId: string }
    | { kind: 'path-graph.replace'; pathGraph: SipPathGraph }
    | { kind: 'rules.replace'; rules: SipRules };

export interface SipProposalMetadataInput {
    actor: string;
    expectedRevision: number;
    idempotencyKey: string;
    fencingToken?: number;
    planId?: string | null;
    grantId?: string | null;
}

export interface SipProposalInput {
    metadata: SipProposalMetadataInput;
    mutations: readonly SipMutation[];
}

export interface SipProposalMetadata {
    actor: string;
    expectedRevision: number;
    idempotencyKey: string;
    fencingToken: number;
    planId: string | null;
    grantId: string | null;
}

export interface SipProposal {
    metadata: SipProposalMetadata;
    mutations: readonly SipMutation[];
}

export interface SipCommit {
    revision: number;
    snapshot: SipSnapshot;
    metadata: SipProposalMetadata;
    committedAt: string;
}

export interface SipRevisionRecord {
    snapshot: SipSnapshot;
    metadata: SipProposalMetadata;
}

export type SipValidationFailure =
    | { type: 'INVALID_PROPOSAL'; message: string }
    | { type: 'INVALID_GEOMETRY'; message: string }
    | { type: 'DUPLICATE_ID'; message: string }
    | { type: 'PROTECTED_REGION'; message: string }
    | { type: 'NO_BUILD_ZONE'; message: string }
    | { type: 'ACTIVE_STRUCTURE'; message: string }
    | { type: 'INVALID_REFERENCE'; message: string }
    | { type: 'INVALID_DEPENDENCY'; message: string };

export type SipFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'MALFORMED_SNAPSHOT'; message: string }
    | { type: 'STALE_REVISION'; expected: number; actual: number }
    | { type: 'IDEMPOTENCY_CONFLICT'; key: string }
    | { type: 'VALIDATION'; failure: SipValidationFailure };
