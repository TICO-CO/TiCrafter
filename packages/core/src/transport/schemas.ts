import { z as zod } from 'zod';

export const PROTOCOL_VERSION = 1;

export const envelopeSchema = zod.object({
    v: zod.literal(PROTOCOL_VERSION),
    id: zod.string().min(1),
    kind: zod.enum(['request', 'response', 'event']),
    type: zod.string().min(1),
    payload: zod.unknown(),
    replyTo: zod.string().optional(),
    error: zod
        .object({
            code: zod.string().min(1),
            message: zod.string().min(1),
        })
        .optional(),
    timestamp: zod.string().optional(),
});

export type Envelope = zod.infer<typeof envelopeSchema>;

export const sessionHelloSchema = zod.object({
    botId: zod.string().min(1),
    name: zod.string().min(1),
    version: zod.string().optional(),
});

export const sessionHelloResponseSchema = zod.object({
    accepted: zod.boolean(),
    epoch: zod.number().int().nonnegative(),
    reason: zod.string().optional(),
});

export const coordinatorPingSchema = zod.object({});

export const coordinatorPingResponseSchema = zod.object({
    pong: zod.literal(true),
    at: zod.string(),
});

export const coordinatorStatusSchema = zod.object({});

export const coordinatorStatusResponseSchema = zod.object({
    epoch: zod.number().int().nonnegative(),
    sessions: zod.array(
        zod.object({
            botId: zod.string(),
            name: zod.string(),
            connectedAt: zod.string(),
            lastSeen: zod.string(),
        }),
    ),
});

export const coordinatorErrorSchema = zod.object({
    code: zod.string().min(1),
    message: zod.string().min(1),
});

export const botHeartbeatSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string(),
    digest: zod.object({
        health: zod.number(),
        food: zod.number(),
        position: zod.object({ x: zod.number(), y: zod.number(), z: zod.number() }),
        inventoryCount: zod.number().int().nonnegative(),
    }),
});

export const botEventSchema = zod.object({
    botId: zod.string().min(1),
    event: zod.string().min(1),
    at: zod.string(),
    data: zod.unknown().optional(),
});

const voxelPositionSchema = zod.object({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
});

const voxelBlockSchema = zod.object({
    position: voxelPositionSchema,
    blockId: zod.string().min(1),
    solid: zod.boolean(),
    properties: zod.record(zod.string(), zod.string()).optional(),
});

export const chunkSnapshotSchema = zod.object({
    botId: zod.string().min(1),
    chunk: zod.object({ x: zod.number().int(), z: zod.number().int() }),
    version: zod.number().int().nonnegative(),
    observedAt: zod.string().min(1),
    blocks: zod.array(voxelBlockSchema),
});

export const landmarkCandidateSchema = zod.object({
    botId: zod.string().min(1),
    chunk: zod.object({ x: zod.number().int(), z: zod.number().int() }),
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
        bbox: zod.object({ min: voxelPositionSchema, max: voxelPositionSchema }),
        anchors: zod.array(
            zod.object({ name: zod.string().min(1), position: voxelPositionSchema }),
        ),
        confidence: zod.number().min(0).max(1),
        evidence: zod.string(),
    }),
});

export type SessionHello = zod.infer<typeof sessionHelloSchema>;
export type SessionHelloResponse = zod.infer<typeof sessionHelloResponseSchema>;
export type CoordinatorStatusResponse = zod.infer<typeof coordinatorStatusResponseSchema>;
export type BotHeartbeat = zod.infer<typeof botHeartbeatSchema>;
export type BotEvent = zod.infer<typeof botEventSchema>;
export type ChunkSnapshotMessage = zod.infer<typeof chunkSnapshotSchema>;
export type LandmarkCandidateMessage = zod.infer<typeof landmarkCandidateSchema>;
