export interface BlockPosition {
    x: number;
    y: number;
    z: number;
}

export interface BoundingBox {
    min: BlockPosition;
    max: BlockPosition;
}

export interface ChunkCoordinate {
    x: number;
    z: number;
}

export interface ChunkBlockObservation {
    position: BlockPosition;
    blockId: string;
    solid: boolean;
}

export interface ChunkObservation {
    botId: string;
    chunk: ChunkCoordinate;
    version: number;
    observedAt: string;
    blocks: readonly ChunkBlockObservation[];
}

export interface StoredChunk {
    chunk: ChunkCoordinate;
    version: number;
    observedAt: string;
    blocks: readonly ChunkBlockObservation[];
}

export type ChunkIngestOutcome = 'stored' | 'ignored';

export interface ChunkIngestResult {
    chunk: ChunkCoordinate;
    version: number;
    outcome: ChunkIngestOutcome;
}

export type LandmarkType =
    | 'path'
    | 'house'
    | 'farm'
    | 'storage'
    | 'workstation'
    | 'wall'
    | 'bridge'
    | 'mineshaft'
    | 'container';

export interface LandmarkAnchor {
    name: string;
    position: BlockPosition;
}

export interface LandmarkEvidence {
    sourceBotId: string;
    observedAt: string;
    confidence: number;
    reliability: number;
    details: string | null;
}

export interface Landmark {
    id: string;
    type: LandmarkType;
    bbox: BoundingBox;
    anchors: readonly LandmarkAnchor[];
    confidence: number;
    confidenceUpdatedAt: string;
    lastSeen: string;
    evidence: readonly LandmarkEvidence[];
    planId: string | null;
}

export interface LandmarkCandidate {
    id: string;
    type: LandmarkType;
    bbox: BoundingBox;
    anchors: readonly LandmarkAnchor[];
    confidence: number;
    observedAt: string;
    evidence: LandmarkEvidence;
    planId: string | null;
}

export type ContainerRole = 'storage' | 'food' | 'tools' | 'fuel';

export interface ContainerItemSnapshot {
    itemId: string;
    count: number;
}

export interface ContainerObservation {
    id: string;
    position: BlockPosition;
    role: ContainerRole;
    contents: readonly ContainerItemSnapshot[] | null;
    observedAt: string;
    confidence: number;
}

export interface PlanTag {
    planId: string;
    bbox: BoundingBox;
    revision: number;
}

export interface IntendedStructure {
    id: string;
    bbox: BoundingBox;
    status: string;
    planId: string | null;
}

export type DeviationKind = 'missing' | 'unexpected' | 'status-mismatch';

export interface DeviationFinding {
    structureId: string;
    kind: DeviationKind;
    bbox: BoundingBox;
    observedLandmarkIds: readonly string[];
}

export interface BlockUpdateObservation {
    botId: string;
    chunk: ChunkCoordinate;
    observedAt: string;
    block: ChunkBlockObservation;
}

export type WorldFailure =
    | { type: 'INVALID_TIMESTAMP'; value: string }
    | { type: 'INVALID_CONFIDENCE'; value: number }
    | { type: 'INVALID_RELIABILITY'; value: number }
    | { type: 'INVALID_CONTAINER_ROLE'; value: string }
    | { type: 'INVALID_CONTAINER_OBSERVATION'; message: string }
    | { type: 'INVALID_PLAN_TAG_REVISION'; value: number }
    | { type: 'INVALID_BLOCK_POSITION'; position: BlockPosition }
    | {
          type: 'INVALID_DECAY_OPTIONS';
          halfLifeMilliseconds: number;
          verificationThreshold: number;
      }
    | { type: 'QUERY_UNAVAILABLE'; query: string }
    | { type: 'STORAGE_FAILED'; message: string };

export type MergeOutcome = 'created' | 'replaced' | 'kept' | 'flagged';

export interface MergeResult {
    landmark: Landmark;
    outcome: MergeOutcome;
    needsVerification: boolean;
}
