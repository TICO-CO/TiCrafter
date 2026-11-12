import { z as zod } from 'zod';

export const PROTOCOL_VERSION = 1;

export const BOT_SKILL_START = 'bot.skill.start';
export const BOT_SKILL_CANCEL = 'bot.skill.cancel';
export const BOT_SKILL_RESUME = 'bot.skill.resume';
export const BOT_SAFETY_RESUME = 'bot.safety.resume';
export const BOT_SAFETY_STOP = 'bot.safety.stop';
export const BOT_AUTONOMY_PAUSE = 'bot.autonomy.pause';
export const BOT_AUTONOMY_RESUME = 'bot.autonomy.resume';

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

export const agencyTraitsSchema = zod.object({
    curiosity: zod.number().min(0).max(1),
    industriousness: zod.number().min(0).max(1),
    caution: zod.number().min(0).max(1),
    sociability: zod.number().min(0).max(1),
    ambition: zod.number().min(0).max(1),
    orderliness: zod.number().min(0).max(1),
    patience: zod.number().min(0).max(1),
});

export const agencyNeedsSchema = zod.object({
    safety: zod.number().min(0).max(1),
    hunger: zod.number().min(0).max(1),
    rest: zod.number().min(0).max(1),
    materials: zod.number().min(0).max(1),
    tools: zod.number().min(0).max(1),
    shelter: zod.number().min(0).max(1),
    social: zod.number().min(0).max(1),
    novelty: zod.number().min(0).max(1),
    achievement: zod.number().min(0).max(1),
});

export const agencyIntentionSchema = zod.object({
    goalId: zod.string().min(1),
    label: zod.string().min(1),
    stepIndex: zod.number().int().nonnegative(),
    createdAt: zod.string().min(1),
    deadline: zod.string().min(1).nullable(),
    attempts: zod.number().int().nonnegative(),
});

export const agencyRoutineSchema = zod.object({
    phase: zod.enum(['morning', 'day', 'evening', 'night']),
    lastMealAt: zod.string().min(1).nullable(),
    lastRestAt: zod.string().min(1).nullable(),
});

export const agencyStateSchema = zod.object({
    traits: agencyTraitsSchema,
    needs: agencyNeedsSchema,
    intention: agencyIntentionSchema.nullable(),
    routine: agencyRoutineSchema,
    homeStructureId: zod.string().min(1).nullable(),
    personalStorageId: zod.string().min(1).nullable(),
    mood: zod.string().min(1),
    lastDeliberationAt: zod.string().min(1).nullable(),
});

export const botAgencyStateSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    state: agencyStateSchema,
});

export const botAgencyEpisodeSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    episode: zod.object({
        id: zod.string().min(1),
        goalId: zod.string().min(1).nullable(),
        kind: zod.string().min(1),
        summary: zod.string().min(1),
        position: zod.object({ x: zod.number(), y: zod.number(), z: zod.number() }).nullable(),
        relatedBotId: zod.string().min(1).nullable(),
        payload: zod.unknown(),
    }),
});

const sessionResumeTaskSchema = zod.object({
    id: zod.string().min(1),
    title: zod.string().min(1),
    priority: zod.number(),
    payload: zod.record(zod.string(), zod.unknown()),
    target: zod.object({ x: zod.number(), y: zod.number(), z: zod.number() }).nullable(),
    requiredRole: zod.enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']).nullable(),
});

const projectPositionSchema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

const projectBboxSchema = zod.object({
    min: projectPositionSchema,
    max: projectPositionSchema,
});

const resumeProjectSchema = zod.object({
    id: zod.string().min(1),
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: zod.enum(['home', 'storage', 'build']),
    status: zod.enum(['proposed', 'active', 'completed', 'abandoned', 'failed']),
    anchor: projectPositionSchema,
    bbox: projectBboxSchema,
    structureId: zod.string().min(1).nullable(),
    storageId: zod.string().min(1).nullable(),
});

export const sessionResumeSchema = zod.object({
    task: sessionResumeTaskSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().nullable(),
    checkpoint: zod.unknown().nullable().optional(),
    sipRevision: zod.number().int().nonnegative(),
    role: zod
        .enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard'])
        .nullable()
        .optional(),
    agency: agencyStateSchema.nullable().optional(),
    projects: zod.array(resumeProjectSchema).optional(),
});

export const sessionHelloResponseSchema = zod.object({
    accepted: zod.boolean(),
    epoch: zod.number().int().nonnegative(),
    reason: zod.string().optional(),
    resume: sessionResumeSchema.optional(),
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
    taskId: zod.string().min(1).optional(),
    status: zod.enum(['running', 'completed', 'failed', 'cancelled']),
    progress: zod.object({
        done: zod.number().nonnegative(),
        total: zod.number().nonnegative(),
        label: zod.string(),
    }),
    failureClass: zod.string().optional(),
});

const taskPositionSchema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

const taskInventoryItemSchema = zod.object({
    name: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

const taskRoleSchema = zod.enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']);

const taskFailureClassSchema = zod.enum([
    'transient',
    'precondition',
    'blocked',
    'invalid',
    'fatal',
]);

export const botTaskClaimSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    position: taskPositionSchema,
    inventory: zod.array(taskInventoryItemSchema),
    role: taskRoleSchema.nullable().optional(),
});

export const botTaskRenewSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botTaskCompleteSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botTaskFailSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
    failureClass: taskFailureClassSchema,
    reason: zod.string().min(1),
});

const taskAssignmentSchema = zod.object({
    id: zod.string().min(1),
    title: zod.string().min(1),
    priority: zod.number(),
    payload: zod.record(zod.string(), zod.unknown()),
    target: taskPositionSchema.nullable(),
    requiredRole: taskRoleSchema.nullable(),
});

export const botTaskResponseSchema = zod.object({
    ok: zod.boolean(),
    taskId: zod.string().min(1).optional(),
    task: taskAssignmentSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().min(1).nullable(),
    reason: zod.string().optional(),
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

export const botSafetyStopSchema = zod.object({
    reason: zod.string().min(1),
});

export const botAutonomyPauseSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export const botAutonomyResumeSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

const decisionDigestSchema = zod.object({
    health: zod.number(),
    food: zod.number(),
    position: zod.object({ x: zod.number(), y: zod.number(), z: zod.number() }),
    inventoryCount: zod.number().int().nonnegative(),
    currentSkill: zod.string().optional(),
    inventorySummary: zod
        .array(zod.object({ name: zod.string(), count: zod.number().int().nonnegative() }))
        .optional(),
    hazards: zod.array(zod.string()).optional(),
    taskId: zod.string().optional(),
    taskProgress: zod.number().min(0).max(1).optional(),
    lastResult: zod.string().optional(),
});

const decisionAffordanceSchema = zod.object({
    id: zod.string().min(1),
    skillId: zod.string().min(1),
    label: zod.string().min(1),
    priority: zod.number().optional(),
});

export const decisionRequestSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    digest: decisionDigestSchema,
    affordances: zod.array(decisionAffordanceSchema).min(1).max(16),
});

export const decisionResponseSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    choiceId: zod.string().min(1).nullable(),
    probabilities: zod.record(zod.string(), zod.number()),
    answerConfidence: zod.number().min(0).max(1),
    danger: zod.boolean(),
    shouldContinue: zod.boolean(),
    latencyMilliseconds: zod.number().nonnegative(),
    source: zod.enum(['laya', 'fallback']),
    reason: zod.string().optional(),
});

const projectClaimSchema = zod.object({
    claimId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botProjectProposeSchema = zod.object({
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: zod.enum(['home', 'storage', 'build']),
    anchor: projectPositionSchema,
    bbox: projectBboxSchema,
    storagePosition: projectPositionSchema.nullable().optional(),
});

export const projectRecordSchema = zod.object({
    id: zod.string().min(1),
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: zod.enum(['home', 'storage', 'build']),
    status: zod.enum(['proposed', 'active', 'completed', 'abandoned', 'failed']),
    anchor: projectPositionSchema,
    bbox: projectBboxSchema,
    claims: zod.array(projectClaimSchema),
    structureId: zod.string().min(1).nullable(),
    storageId: zod.string().min(1).nullable(),
    reason: zod.string().nullable(),
    createdAt: zod.string().min(1),
    updatedAt: zod.string().min(1),
});

export const botProjectResponseSchema = zod.object({
    ok: zod.boolean(),
    project: projectRecordSchema.nullable(),
    reason: zod.string().optional(),
});

export const botProjectAbandonSchema = zod.object({
    botId: zod.string().min(1),
    projectId: zod.string().min(1),
    reason: zod.string().min(1),
});

export const botProjectAbandonResponseSchema = zod.object({
    ok: zod.boolean(),
    project: projectRecordSchema.nullable(),
    reason: zod.string().optional(),
});

const jobOfferSchema = zod.object({
    taskId: zod.string().min(1),
    title: zod.string().min(1),
    priority: zod.number(),
    skillId: zod.string().min(1).nullable(),
    target: projectPositionSchema.nullable(),
    requiredRole: taskRoleSchema.nullable(),
    distance: zod.number().nullable(),
});

export const botJobOffersSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    role: taskRoleSchema.nullable(),
    position: projectPositionSchema.nullable(),
    inventory: zod.array(taskInventoryItemSchema),
});

export const botJobOffersResponseSchema = zod.object({
    ok: zod.boolean(),
    offers: zod.array(jobOfferSchema),
    reason: zod.string().optional(),
});

export const botJobDecideSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    decision: zod.enum(['accept', 'defer', 'decline']),
    reason: zod.string().min(1),
    role: taskRoleSchema.nullable(),
    position: projectPositionSchema.nullable(),
    inventory: zod.array(taskInventoryItemSchema),
});

export const botJobDecideResponseSchema = zod.object({
    ok: zod.boolean(),
    taskId: zod.string().min(1),
    offer: jobOfferSchema.nullable(),
    task: taskAssignmentSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().min(1).nullable(),
    reason: zod.string().optional(),
});

export type AgencyTraitsPayload = zod.infer<typeof agencyTraitsSchema>;
export type AgencyNeedsPayload = zod.infer<typeof agencyNeedsSchema>;
export type AgencyIntentionPayload = zod.infer<typeof agencyIntentionSchema>;
export type AgencyRoutinePayload = zod.infer<typeof agencyRoutineSchema>;
export type AgencyStatePayload = zod.infer<typeof agencyStateSchema>;
export type BotAgencyStateMessage = zod.infer<typeof botAgencyStateSchema>;
export type BotAgencyEpisodeMessage = zod.infer<typeof botAgencyEpisodeSchema>;
export type SessionHello = zod.infer<typeof sessionHelloSchema>;
export type SessionResume = zod.infer<typeof sessionResumeSchema>;
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
export type BotSafetyStopMessage = zod.infer<typeof botSafetyStopSchema>;
export type BotAutonomyPauseMessage = zod.infer<typeof botAutonomyPauseSchema>;
export type BotAutonomyResumeMessage = zod.infer<typeof botAutonomyResumeSchema>;
export type DecisionRequest = zod.infer<typeof decisionRequestSchema>;
export type DecisionResponse = zod.infer<typeof decisionResponseSchema>;
export type DecisionAffordance = zod.infer<typeof decisionAffordanceSchema>;
export type DecisionDigest = zod.infer<typeof decisionDigestSchema>;
export type BotTaskClaim = zod.infer<typeof botTaskClaimSchema>;
export type BotTaskRenew = zod.infer<typeof botTaskRenewSchema>;
export type BotTaskComplete = zod.infer<typeof botTaskCompleteSchema>;
export type BotTaskFail = zod.infer<typeof botTaskFailSchema>;
export type BotTaskResponse = zod.infer<typeof botTaskResponseSchema>;
export type BotProjectPropose = zod.infer<typeof botProjectProposeSchema>;
export type BotProjectResponse = zod.infer<typeof botProjectResponseSchema>;
export type BotProjectAbandon = zod.infer<typeof botProjectAbandonSchema>;
export type BotProjectAbandonResponse = zod.infer<typeof botProjectAbandonResponseSchema>;
export type ProjectRecordPayload = zod.infer<typeof projectRecordSchema>;
export type BotJobOffers = zod.infer<typeof botJobOffersSchema>;
export type BotJobOffersResponse = zod.infer<typeof botJobOffersResponseSchema>;
export type BotJobDecide = zod.infer<typeof botJobDecideSchema>;
export type BotJobDecideResponse = zod.infer<typeof botJobDecideResponseSchema>;
export type JobOfferPayload = zod.infer<typeof jobOfferSchema>;
export type ResumeProject = zod.infer<typeof resumeProjectSchema>;
