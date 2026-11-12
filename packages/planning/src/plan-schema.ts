import { strategicIntentSchema } from '@ticrafter/core';
import { z as zod } from 'zod';

const positionSchema = zod.strictObject({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
});

const boundingBoxSchema = zod.strictObject({
    min: positionSchema,
    max: positionSchema,
});

const materialNeedSchema = zod.strictObject({
    item: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

const lifecycleStatusSchema = zod.enum([
    'planned',
    'claimed',
    'building',
    'complete',
    'failed',
    'abandoned',
]);

const collaborationPolicySchema = zod.enum(['private', 'invite', 'open']);

export const plannerZoneSchema = zod.strictObject({
    id: zod.string().min(1),
    name: zod.string(),
    type: zod.enum(['base', 'farm', 'forest', 'mining', 'road', 'reserve', 'no_build']),
    polygon: zod.array(positionSchema).min(3),
    priority: zod.number().int(),
});

export const plannerStructureSchema = zod.strictObject({
    id: zod.string().min(1),
    type: zod.string().min(1),
    blueprintRef: zod.string().min(1),
    anchor: positionSchema,
    rotation: zod.number().int(),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(zod.string().min(1)),
    designRevision: zod.number().int().nonnegative(),
    collaboration: collaborationPolicySchema,
    autoAcceptCompatibleHelpers: zod.boolean(),
    progress: zod.number().min(0).max(1),
    materialsNeeded: zod.array(materialNeedSchema),
    workPackages: zod.array(
        zod.strictObject({
            id: zod.string().min(1),
            bbox: boundingBoxSchema,
            status: lifecycleStatusSchema,
            claimedBy: zod.string().nullable(),
        }),
    ),
});

export const plannerRoadSchema = zod.strictObject({
    id: zod.string().min(1),
    polyline: zod.array(positionSchema).min(2),
    width: zod.number().positive(),
    material: zod.string().min(1),
    segments: zod.array(
        zod.strictObject({
            id: zod.string().min(1),
            from: positionSchema,
            to: positionSchema,
            status: lifecycleStatusSchema,
            ownerBotId: zod.string().nullable(),
        }),
    ),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(zod.string().min(1)),
});

export const plannerFarmSchema = zod.strictObject({
    id: zod.string().min(1),
    plots: zod.array(
        zod.strictObject({
            id: zod.string().min(1),
            bbox: boundingBoxSchema,
            crop: zod.string().nullable(),
            waterSource: positionSchema.nullable(),
            growth: zod.number().min(0).max(1),
            assignedBotId: zod.string().nullable(),
        }),
    ),
    status: lifecycleStatusSchema,
    ownerBotIds: zod.array(zod.string().min(1)),
});

export const plannerContainerSchema = zod.strictObject({
    id: zod.string().min(1),
    pos: positionSchema,
    role: zod.enum(['storage', 'food', 'tools', 'fuel']),
    reservedBy: zod.string().nullable(),
    contentsSnapshot: zod.record(zod.string(), zod.number()).nullable(),
});

const pathGraphSchema = zod.strictObject({
    nodes: zod.array(
        zod.strictObject({
            id: zod.string().min(1),
            position: positionSchema,
        }),
    ),
    edges: zod.array(
        zod.strictObject({
            id: zod.string().min(1),
            from: zod.string().min(1),
            to: zod.string().min(1),
            cost: zod.number().nonnegative(),
        }),
    ),
});

const rulesSchema = zod.strictObject({
    protectedBboxes: zod.array(boundingBoxSchema),
    allowedEdits: zod.array(
        zod.strictObject({
            bbox: boundingBoxSchema,
            botIds: zod.array(zod.string().min(1)),
            operations: zod.array(zod.enum(['place', 'break', 'replace'])),
        }),
    ),
    noBreakUnderActiveBot: zod.boolean(),
});

export const plannerSipMutationSchema = zod.discriminatedUnion('kind', [
    zod.strictObject({ kind: zod.literal('zone.upsert'), zone: plannerZoneSchema }),
    zod.strictObject({ kind: zod.literal('zone.remove'), zoneId: zod.string().min(1) }),
    zod.strictObject({
        kind: zod.literal('structure.upsert'),
        structure: plannerStructureSchema,
    }),
    zod.strictObject({
        kind: zod.literal('structure.remove'),
        structureId: zod.string().min(1),
    }),
    zod.strictObject({ kind: zod.literal('road.upsert'), road: plannerRoadSchema }),
    zod.strictObject({ kind: zod.literal('road.remove'), roadId: zod.string().min(1) }),
    zod.strictObject({ kind: zod.literal('farm.upsert'), farm: plannerFarmSchema }),
    zod.strictObject({ kind: zod.literal('farm.remove'), farmId: zod.string().min(1) }),
    zod.strictObject({
        kind: zod.literal('container.upsert'),
        container: plannerContainerSchema,
    }),
    zod.strictObject({
        kind: zod.literal('container.remove'),
        containerId: zod.string().min(1),
    }),
    zod.strictObject({ kind: zod.literal('path-graph.replace'), pathGraph: pathGraphSchema }),
    zod.strictObject({ kind: zod.literal('rules.replace'), rules: rulesSchema }),
]);

const taskPreconditionSchema = zod.discriminatedUnion('kind', [
    zod.strictObject({
        kind: zod.literal('inventory.at-least'),
        item: zod.string().min(1),
        quantity: zod.number().int().nonnegative(),
    }),
    zod.strictObject({ kind: zod.literal('claim.free'), bbox: boundingBoxSchema }),
    zod.strictObject({
        kind: zod.literal('world.block'),
        position: positionSchema,
        expectedBlockId: zod.string().optional(),
    }),
    zod.strictObject({
        kind: zod.literal('world.landmark'),
        bbox: boundingBoxSchema,
        type: zod
            .enum(['house', 'farm', 'road', 'wall', 'bridge', 'storage', 'watchtower', 'path'])
            .optional(),
    }),
]);

export const plannerTaskSchema = zod.strictObject({
    id: zod.string().min(1),
    title: zod.string().min(1),
    parentId: zod.string().nullable().default(null),
    priority: zod.number().int().default(0),
    dependencies: zod.array(zod.string().min(1)).default([]),
    preconditions: zod.array(taskPreconditionSchema).default([]),
    requiredRole: zod
        .enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard'])
        .nullable()
        .default(null),
    target: positionSchema.nullable().default(null),
    skillId: zod.string().min(1),
    payload: zod.record(zod.string(), zod.unknown()).default({}),
});

export const plannerBlueprintSchema = zod.strictObject({
    id: zod.string().min(1),
    template: zod.string().min(1),
    anchor: positionSchema,
    rotation: zod.number().int(),
    materials: zod.array(materialNeedSchema).default([]),
    parameters: zod.record(zod.string(), zod.unknown()).default({}),
});

export const plannerGoalSchema = zod.strictObject({
    id: zod.string().min(1),
    description: zod.string().min(1),
    priority: zod.number().int(),
    status: zod.enum(['active', 'complete', 'blocked']).default('active'),
});

export const plannerPlanSchema = zod.strictObject({
    schemaVersion: zod.literal(1),
    planId: zod.string().min(1),
    baseRevision: zod.number().int().nonnegative(),
    goals: zod.array(plannerGoalSchema).min(1),
    sipMutations: zod.array(plannerSipMutationSchema).default([]),
    tasks: zod.array(plannerTaskSchema).default([]),
    cancelTaskIds: zod.array(zod.string().min(1)).default([]),
    blueprints: zod.array(plannerBlueprintSchema).default([]),
    strategicIntent: strategicIntentSchema.optional(),
    recovery: zod.strictObject({
        mode: zod.enum(['continue', 'retry', 'safe_mode', 'stop']),
        notes: zod.string().default(''),
    }),
    notes: zod.string().default(''),
});

export const plannerArbitrationSchema = zod.strictObject({
    allow: zod.boolean(),
    reason: zod.string().min(1),
});

export type PlannerPlan = zod.infer<typeof plannerPlanSchema>;
export type PlannerTask = zod.infer<typeof plannerTaskSchema>;
export type PlannerGoal = zod.infer<typeof plannerGoalSchema>;
export type PlannerBlueprint = zod.infer<typeof plannerBlueprintSchema>;
export type PlannerSipMutation = zod.infer<typeof plannerSipMutationSchema>;
export type PlannerZone = zod.infer<typeof plannerZoneSchema>;
export type PlannerStructure = zod.infer<typeof plannerStructureSchema>;
export type PlannerRoad = zod.infer<typeof plannerRoadSchema>;
export type PlannerFarm = zod.infer<typeof plannerFarmSchema>;
export type PlannerContainer = zod.infer<typeof plannerContainerSchema>;
export type PlannerPosition = zod.infer<typeof positionSchema>;
export type PlannerBoundingBox = zod.infer<typeof boundingBoxSchema>;
export type PlannerMaterialNeed = zod.infer<typeof materialNeedSchema>;
export type PlannerArbitrationDecision = zod.infer<typeof plannerArbitrationSchema>;
