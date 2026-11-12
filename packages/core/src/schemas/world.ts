import { z as zod } from 'zod';

import {
    chunkCoordinateSchema,
    integerBoundingBoxSchema,
    integerPositionSchema,
} from './shared.js';

export const CHUNK_SNAPSHOT_EVENT = 'chunk.snapshot';
export const LANDMARK_CANDIDATE_EVENT = 'landmark.candidate';
export const BLOCK_UPDATE_EVENT = 'block.update';

export const voxelBlockSchema = zod.object({
    position: integerPositionSchema,
    blockId: zod.string().min(1),
    solid: zod.boolean(),
    properties: zod.record(zod.string(), zod.string()).optional(),
});

export const chunkSnapshotSchema = zod.object({
    botId: zod.string().min(1),
    chunk: chunkCoordinateSchema,
    version: zod.number().int().nonnegative(),
    observedAt: zod.string().min(1),
    blocks: zod.array(voxelBlockSchema),
});

export const blockUpdateAttributionSchema = zod.object({
    structureId: zod.string().min(1).optional(),
    taskId: zod.string().min(1).optional(),
    claimId: zod.string().min(1).optional(),
    grantId: zod.string().min(1).optional(),
    grantFencingToken: zod.number().int().nonnegative().optional(),
    blueprintId: zod.string().min(1).optional(),
    blueprintRevision: zod.number().int().nonnegative().optional(),
    workPackageId: zod.string().min(1).optional(),
    planId: zod.string().min(1).optional(),
    fencingToken: zod.number().int().nonnegative().optional(),
    phase: zod
        .enum([
            'site-clear',
            'foundation',
            'scaffold',
            'walls',
            'floors',
            'roof',
            'openings',
            'access',
            'interior',
            'decoration',
            'scaffold-removal',
            'cleanup',
        ])
        .optional(),
});

export const blockUpdateSchema = zod.object({
    botId: zod.string().min(1),
    chunk: chunkCoordinateSchema,
    observedAt: zod.string().min(1),
    block: voxelBlockSchema,
    attribution: blockUpdateAttributionSchema.optional(),
});

export const landmarkCandidateSchema = zod.object({
    botId: zod.string().min(1),
    chunk: chunkCoordinateSchema,
    observedAt: zod.string().min(1),
    candidate: zod.object({
        detectorId: zod.enum(['path', 'house', 'farm', 'storage-workstation', 'linear-structure']),
        type: zod.enum([
            'path',
            'house',
            'farm',
            'storage',
            'workstation',
            'wall',
            'bridge',
            'mineshaft',
        ]),
        bbox: integerBoundingBoxSchema,
        anchors: zod.array(
            zod.object({ name: zod.string().min(1), position: integerPositionSchema }),
        ),
        confidence: zod.number().min(0).max(1),
        evidence: zod.string(),
    }),
});

export type ChunkSnapshotMessage = zod.infer<typeof chunkSnapshotSchema>;
export type LandmarkCandidateMessage = zod.infer<typeof landmarkCandidateSchema>;
export type BlockUpdateMessage = zod.infer<typeof blockUpdateSchema>;
export type BlockUpdateAttribution = zod.infer<typeof blockUpdateAttributionSchema>;
