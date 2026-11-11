import { z as zod } from 'zod';

const identifierSchema = zod.string().min(1);

const positionSchema = zod.object({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
});

const boundingBoxSchema = zod.object({
    min: positionSchema,
    max: positionSchema,
});

const zoneTypeSchema = zod.enum([
    'base',
    'farm',
    'forest',
    'mining',
    'road',
    'reserve',
    'no_build',
]);

const lifecycleStatusSchema = zod.enum([
    'planned',
    'claimed',
    'building',
    'complete',
    'failed',
    'abandoned',
]);

const collaborationPolicySchema = zod.enum(['private', 'invite', 'open']);

const editOperationSchema = zod.enum(['place', 'break', 'replace']);

const zoneSchema = zod.object({
    id: identifierSchema,
    name: zod.string(),
    type: zoneTypeSchema,
    polygon: zod.array(positionSchema).min(3),
    priority: zod.number().int(),
});

const materialNeedSchema = zod.object({
    item: identifierSchema,
    count: zod.number().int().nonnegative(),
});

const workPackageSchema = zod.object({
    id: identifierSchema,
    bbox: boundingBoxSchema,
    status: lifecycleStatusSchema,
    claimedBy: zod.string().nullable(),
});

const structureSchema = zod.object({
    id: identifierSchema,
    type: identifierSchema,
    blueprintRef: identifierSchema,
    anchor: positionSchema,
    rotation: zod.number().int(),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(identifierSchema),
    designRevision: zod.number().int().nonnegative(),
    collaboration: collaborationPolicySchema,
    autoAcceptCompatibleHelpers: zod.boolean(),
    progress: zod.number().min(0).max(1),
    materialsNeeded: zod.array(materialNeedSchema),
    workPackages: zod.array(workPackageSchema),
});

const roadSegmentSchema = zod.object({
    id: identifierSchema,
    from: positionSchema,
    to: positionSchema,
    status: lifecycleStatusSchema,
    ownerBotId: zod.string().nullable(),
});

const roadSchema = zod.object({
    id: identifierSchema,
    polyline: zod.array(positionSchema).min(2),
    width: zod.number().positive(),
    material: identifierSchema,
    segments: zod.array(roadSegmentSchema),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(identifierSchema),
});

const farmPlotSchema = zod.object({
    id: identifierSchema,
    bbox: boundingBoxSchema,
    crop: zod.string().nullable(),
    waterSource: positionSchema.nullable(),
    growth: zod.number().min(0).max(1),
    assignedBotId: zod.string().nullable(),
});

const farmSchema = zod.object({
    id: identifierSchema,
    plots: zod.array(farmPlotSchema),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(identifierSchema),
});

const containerSchema = zod.object({
    id: identifierSchema,
    pos: positionSchema,
    role: zod.enum(['storage', 'food', 'tools', 'fuel']),
    reservedBy: zod.string().nullable(),
    contentsSnapshot: zod.record(zod.string(), zod.number()).nullable(),
});

const pathNodeSchema = zod.object({
    id: identifierSchema,
    position: positionSchema,
});

const pathEdgeSchema = zod.object({
    id: identifierSchema,
    from: identifierSchema,
    to: identifierSchema,
    cost: zod.number().nonnegative(),
});

const pathGraphSchema = zod.object({
    nodes: zod.array(pathNodeSchema),
    edges: zod.array(pathEdgeSchema),
});

const allowedEditSchema = zod.object({
    bbox: boundingBoxSchema,
    botIds: zod.array(identifierSchema),
    operations: zod.array(editOperationSchema),
});

const rulesSchema = zod.object({
    protectedBboxes: zod.array(boundingBoxSchema),
    allowedEdits: zod.array(allowedEditSchema),
    noBreakUnderActiveBot: zod.boolean(),
});

export const sipSnapshotSchema = zod.object({
    revision: zod.number().int().nonnegative(),
    zones: zod.array(zoneSchema),
    structures: zod.array(structureSchema),
    roads: zod.array(roadSchema),
    farms: zod.array(farmSchema),
    containers: zod.array(containerSchema),
    pathGraph: pathGraphSchema,
    rules: rulesSchema,
});

export const sipMutationSchema = zod.discriminatedUnion('kind', [
    zod.object({ kind: zod.literal('zone.upsert'), zone: zoneSchema }),
    zod.object({ kind: zod.literal('zone.remove'), zoneId: identifierSchema }),
    zod.object({ kind: zod.literal('structure.upsert'), structure: structureSchema }),
    zod.object({ kind: zod.literal('structure.remove'), structureId: identifierSchema }),
    zod.object({ kind: zod.literal('road.upsert'), road: roadSchema }),
    zod.object({ kind: zod.literal('road.remove'), roadId: identifierSchema }),
    zod.object({ kind: zod.literal('farm.upsert'), farm: farmSchema }),
    zod.object({ kind: zod.literal('farm.remove'), farmId: identifierSchema }),
    zod.object({ kind: zod.literal('container.upsert'), container: containerSchema }),
    zod.object({ kind: zod.literal('container.remove'), containerId: identifierSchema }),
    zod.object({ kind: zod.literal('path-graph.replace'), pathGraph: pathGraphSchema }),
    zod.object({ kind: zod.literal('rules.replace'), rules: rulesSchema }),
]);

export const sipProposalSchema = zod.object({
    metadata: zod.object({
        actor: identifierSchema,
        expectedRevision: zod.number().int().nonnegative(),
        idempotencyKey: identifierSchema,
        fencingToken: zod.number().int().nonnegative().default(0),
        planId: zod.string().nullable().default(null),
        grantId: zod.string().nullable().default(null),
    }),
    mutations: zod.array(sipMutationSchema).min(1),
});

export const sipRevisionRecordSchema = zod.object({
    snapshot: sipSnapshotSchema,
    metadata: sipProposalSchema.shape.metadata,
});
