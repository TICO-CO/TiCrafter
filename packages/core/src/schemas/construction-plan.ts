import { z as zod } from 'zod';

import { integerBoundingBoxSchema, integerPositionSchema } from './shared.js';

export const BOT_CONSTRUCTION_PLAN_GET = 'bot.constructionPlan.get';
export const BOT_CONSTRUCTION_PLAN_RESPONSE = 'bot.constructionPlan.response';

const rotationSchema = zod.union([
    zod.literal(0),
    zod.literal(90),
    zod.literal(180),
    zod.literal(270),
]);

const constructionPhaseSchema = zod.enum([
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
]);

const blockStateSchema = zod.object({
    name: zod.string().min(1),
    properties: zod.record(zod.string(), zod.string()).optional(),
});

const blueprintBlockSchema = zod.object({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
    state: blockStateSchema,
    priority: zod.number().nonnegative(),
});

const materialSchema = zod.object({
    item: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

const constructionChangeSchema = zod.object({
    kind: zod.enum(['place', 'break']),
    block: blueprintBlockSchema,
    phase: constructionPhaseSchema,
    reason: zod.enum(['blueprint', 'clearance', 'foundation', 'scaffold', 'cleanup']),
    dependsOn: zod.array(zod.string()).readonly(),
});

const dependencySchema = zod.object({
    key: zod.string().min(1),
    phase: constructionPhaseSchema,
    dependsOn: zod.array(zod.string()).readonly(),
});

const scaffoldSchema = zod.object({
    position: integerPositionSchema,
    stateName: zod.string().min(1),
    targetKeys: zod.array(zod.string()).readonly(),
    removalPhase: constructionPhaseSchema,
});

const workPackageSchema = zod.object({
    id: zod.string().min(1),
    bbox: integerBoundingBoxSchema,
    blockKeys: zod.array(zod.string()).readonly(),
    strategy: zod.enum(['single', 'layers', 'slices', 'quadrants']),
    status: zod.enum(['planned', 'claimed', 'building', 'complete']),
    phase: constructionPhaseSchema,
    materials: zod.array(materialSchema).readonly(),
    scaffoldPositions: zod.array(integerPositionSchema).readonly(),
    predecessorIds: zod.array(zod.string()).readonly(),
});

const accessSchema = zod.object({
    kind: zod.enum(['none', 'path', 'stairs', 'bridge']),
    from: integerPositionSchema.nullable(),
    to: integerPositionSchema,
    length: zod.number().nonnegative(),
});

const sitePlanSchema = zod.object({
    anchor: integerPositionSchema,
    translation: integerPositionSchema,
    rotation: rotationSchema,
    bounds: integerBoundingBoxSchema,
    clearance: zod.array(integerPositionSchema).readonly(),
    access: accessSchema,
    foundationMode: zod.enum(['level', 'terrace', 'retaining-wall', 'stilts']),
    foundationFillDepth: zod.number(),
    foundationCutDepth: zod.number(),
    score: zod.number(),
    rationale: zod.array(zod.string()).readonly(),
});

const foundationPlanSchema = zod.object({
    mode: zod.enum(['level', 'terrace', 'retaining-wall', 'stilts']),
    targetY: zod.number().int(),
    maximumFillDepth: zod.number(),
    changes: zod.array(constructionChangeSchema).readonly(),
    materials: zod.array(materialSchema).readonly(),
    rationale: zod.array(zod.string()).readonly(),
});

export const constructionPlanSchema = zod.object({
    id: zod.string().min(1),
    blueprintId: zod.string().min(1),
    anchor: integerPositionSchema,
    rotation: rotationSchema,
    translation: integerPositionSchema,
    site: sitePlanSchema,
    foundation: foundationPlanSchema,
    changes: zod.array(constructionChangeSchema).readonly(),
    order: zod.array(zod.string()).readonly(),
    dependencies: zod.array(dependencySchema).readonly(),
    scaffolds: zod.array(scaffoldSchema).readonly(),
    unreachable: zod.array(blueprintBlockSchema).readonly(),
    phases: zod.array(constructionPhaseSchema).readonly(),
    materials: zod.array(materialSchema).readonly(),
    workPackages: zod.array(workPackageSchema).readonly(),
});

export const constructionPlanDocumentSchema = zod.object({
    id: zod.string().min(1),
    revision: zod.number().int().nonnegative(),
    hash: zod.string().min(1),
    structureId: zod.string().min(1),
    blueprintId: zod.string().min(1),
    blueprintRevision: zod.number().int().nonnegative(),
    plan: constructionPlanSchema,
    createdAt: zod.string().min(1),
});

export const botConstructionPlanGetSchema = zod.object({
    botId: zod.string().min(1),
    planId: zod.string().min(1),
    revision: zod.number().int().nonnegative(),
});

export const botConstructionPlanResponseSchema = zod.object({
    ok: zod.boolean(),
    document: constructionPlanDocumentSchema.nullable(),
    reason: zod.string().optional(),
});

export type ConstructionPlanPayload = zod.infer<typeof constructionPlanSchema>;
export type ConstructionPlanDocumentPayload = zod.infer<typeof constructionPlanDocumentSchema>;
export type BotConstructionPlanGet = zod.infer<typeof botConstructionPlanGetSchema>;
export type BotConstructionPlanResponse = zod.infer<typeof botConstructionPlanResponseSchema>;
