import { z as zod } from 'zod';

export const PROTOCOL_VERSION = 1;

export const BOT_SKILL_START = 'bot.skill.start';
export const BOT_SKILL_CANCEL = 'bot.skill.cancel';
export const BOT_SKILL_RESUME = 'bot.skill.resume';
export const BOT_SAFETY_RESUME = 'bot.safety.resume';

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
        currentSkill: zod.string().optional(),
        inventorySummary: zod
            .array(zod.object({ name: zod.string(), count: zod.number().int().nonnegative() }))
            .optional(),
        hazards: zod.array(zod.string()).optional(),
    }),
});

export const skillProgressSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    skillId: zod.string().min(1),
    status: zod.enum(['running', 'completed', 'failed', 'cancelled']),
    progress: zod.object({
        done: zod.number().nonnegative(),
        total: zod.number().nonnegative(),
        label: zod.string(),
    }),
    failureClass: zod.string().optional(),
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

export const blockUpdateSchema = zod.object({
    botId: zod.string().min(1),
    chunk: zod.object({ x: zod.number().int(), z: zod.number().int() }),
    observedAt: zod.string().min(1),
    block: voxelBlockSchema,
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

const skillVec3Schema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

const skillBBoxSchema = zod.object({
    min: skillVec3Schema,
    max: skillVec3Schema,
});

const skillBuildTargetSchema = zod.object({
    position: skillVec3Schema,
    itemName: zod.string().min(1),
    expectedBlockId: zod.string().min(1).optional(),
});

const skillGrantSchema = zod.object({
    id: zod.string().min(1),
    expiresAt: zod.string().min(1).optional(),
});

const skillSchematicRefSchema = zod.object({
    id: zod.string().min(1),
    anchor: skillVec3Schema,
    revision: zod.number().optional(),
    rotation: zod.number().optional(),
});

const skillFarmPlotSchema = zod.object({
    id: zod.string().min(1),
    bbox: skillBBoxSchema,
    cropBlockIds: zod.array(zod.string().min(1)).optional(),
    seedItem: zod.string().min(1).optional(),
});

export const skillInputSchema = zod.object({
    target: skillVec3Schema.optional(),
    waypoints: zod.array(skillVec3Schema).optional(),
    itemName: zod.string().min(1).optional(),
    count: zod.number().optional(),
    radius: zod.number().optional(),
    range: zod.number().optional(),
    threshold: zod.number().optional(),
    container: skillVec3Schema.optional(),
    taskId: zod.string().min(1).optional(),
    blocks: zod.array(skillBuildTargetSchema).optional(),
    blockIds: zod.array(zod.string().min(1)).optional(),
    bbox: skillBBoxSchema.optional(),
    material: zod.string().min(1).optional(),
    direction: skillVec3Schema.optional(),
    end: skillVec3Schema.optional(),
    width: zod.number().optional(),
    maxLength: zod.number().optional(),
    furnace: skillVec3Schema.optional(),
    fuelItem: zod.string().min(1).optional(),
    outputItem: zod.string().min(1).optional(),
    bed: skillVec3Schema.optional(),
    center: skillVec3Schema.optional(),
    maxSteps: zod.number().optional(),
    seedItem: zod.string().min(1).optional(),
    maintainWater: zod.boolean().optional(),
    plot: skillFarmPlotSchema.optional(),
    plotId: zod.string().min(1).optional(),
    schematic: skillSchematicRefSchema.optional(),
    grant: skillGrantSchema.optional(),
});

export const botSkillStartSchema = zod.object({
    skillId: zod.string().min(1),
    input: skillInputSchema,
    taskId: zod.string().min(1).optional(),
});

export const botSkillCancelSchema = zod.object({
    skillId: zod.string().min(1).optional(),
    taskId: zod.string().min(1).optional(),
    reason: zod.string().min(1).optional(),
});

export const botSkillResumeSchema = zod.object({
    skillId: zod.string().min(1),
    taskId: zod.string().min(1).optional(),
});

export const botSafetyResumeSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export type SessionHello = zod.infer<typeof sessionHelloSchema>;
export type SessionHelloResponse = zod.infer<typeof sessionHelloResponseSchema>;
export type CoordinatorStatusResponse = zod.infer<typeof coordinatorStatusResponseSchema>;
export type BotHeartbeat = zod.infer<typeof botHeartbeatSchema>;
export type BotEvent = zod.infer<typeof botEventSchema>;
export type SkillProgress = zod.infer<typeof skillProgressSchema>;
export type ChunkSnapshotMessage = zod.infer<typeof chunkSnapshotSchema>;
export type LandmarkCandidateMessage = zod.infer<typeof landmarkCandidateSchema>;
export type BlockUpdateMessage = zod.infer<typeof blockUpdateSchema>;
export type BotSkillStartMessage = zod.infer<typeof botSkillStartSchema>;
export type BotSkillCancelMessage = zod.infer<typeof botSkillCancelSchema>;
export type BotSkillResumeMessage = zod.infer<typeof botSkillResumeSchema>;
export type BotSafetyResumeMessage = zod.infer<typeof botSafetyResumeSchema>;
