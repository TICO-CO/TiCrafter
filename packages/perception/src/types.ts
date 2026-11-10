export interface VoxelPosition {
    x: number;
    y: number;
    z: number;
}

export interface ChunkCoordinate {
    x: number;
    z: number;
}

export interface VoxelBlock {
    position: VoxelPosition;
    blockId: string;
    solid: boolean;
}

export interface ChunkSnapshot {
    botId: string;
    chunk: ChunkCoordinate;
    version: number;
    observedAt: string;
    blocks: readonly VoxelBlock[];
}

export interface ChunkSnapshotInput {
    botId: string;
    chunk: ChunkCoordinate;
    version: number;
    observedAt: string;
    blocks: readonly VoxelBlock[];
}

export type DetectorId = 'path' | 'house' | 'farm' | 'storage-workstation' | 'linear-structure';

export type DetectionType =
    'path' | 'house' | 'farm' | 'storage' | 'workstation' | 'wall' | 'bridge' | 'mineshaft';

export interface DetectionAnchor {
    name: string;
    position: VoxelPosition;
}

export interface DetectionBoundingBox {
    min: VoxelPosition;
    max: VoxelPosition;
}

export interface DetectionCandidate {
    detectorId: DetectorId;
    type: DetectionType;
    bbox: DetectionBoundingBox;
    anchors: readonly DetectionAnchor[];
    confidence: number;
    evidence: string;
}

export interface DetectorPort {
    readonly id: DetectorId;
    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[];
}

export type PerceptionFailure =
    | { type: 'INVALID_VERSION'; value: number }
    | { type: 'INVALID_BLOCK_POSITION'; position: VoxelPosition }
    | { type: 'BLOCK_OUTSIDE_CHUNK'; position: VoxelPosition; chunk: ChunkCoordinate };
