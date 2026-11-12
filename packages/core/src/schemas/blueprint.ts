import { z as zod } from 'zod';

import { integerBoundingBoxSchema, integerPositionSchema } from './shared.js';

export const BOT_BLUEPRINT_GET = 'bot.blueprint.get';
export const BOT_BLUEPRINT_RESPONSE = 'bot.blueprint.response';

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

const blueprintMaterialSchema = zod.object({
    item: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

const blueprintConstraintSchema = zod.union([
    zod.object({
        kind: zod.literal('protected'),
        bbox: integerBoundingBoxSchema,
    }),
    zod.object({
        kind: zod.literal('no-build'),
        polygon: zod.array(integerPositionSchema).readonly(),
    }),
    zod.object({
        kind: zod.literal('support'),
        position: integerPositionSchema,
    }),
]);

const blueprintWorkPackageSchema = zod.object({
    id: zod.string().min(1),
    bbox: integerBoundingBoxSchema,
    blockKeys: zod.array(zod.string().min(1)).readonly(),
    strategy: zod.enum(['single', 'layers', 'slices', 'quadrants']),
    status: zod.enum(['planned', 'claimed', 'building', 'complete']),
});

export const blueprintSchema = zod.object({
    id: zod.string().min(1),
    anchor: integerPositionSchema,
    rotation: zod.union([zod.literal(0), zod.literal(90), zod.literal(180), zod.literal(270)]),
    blocks: zod.array(blueprintBlockSchema).readonly(),
    materials: zod.array(blueprintMaterialSchema).readonly(),
    constraints: zod.array(blueprintConstraintSchema).readonly(),
    workPackages: zod.array(blueprintWorkPackageSchema).readonly().optional(),
});

export const blueprintProvenanceSchema = zod.object({
    createdBy: zod.string().min(1),
    createdAt: zod.string().min(1),
    briefId: zod.string().min(1).optional(),
    landmarkId: zod.string().min(1).optional(),
    plannerPlanId: zod.string().min(1).optional(),
    confidence: zod.number().min(0).max(1).optional(),
});

export const blueprintDocumentSchema = zod.object({
    id: zod.string().min(1),
    revision: zod.number().int().nonnegative(),
    hash: zod.string().min(1),
    source: zod.enum(['template', 'composed', 'schematic', 'observed', 'blocks']),
    provenance: blueprintProvenanceSchema,
    blueprint: blueprintSchema,
});

export const botBlueprintGetSchema = zod.object({
    botId: zod.string().min(1),
    blueprintId: zod.string().min(1),
    revision: zod.number().int().nonnegative(),
});

export const botBlueprintResponseSchema = zod.object({
    ok: zod.boolean(),
    document: blueprintDocumentSchema.nullable(),
    reason: zod.string().optional(),
});

export type BlueprintPayload = zod.infer<typeof blueprintSchema>;
export type BlueprintDocumentPayload = zod.infer<typeof blueprintDocumentSchema>;
export type BotBlueprintGet = zod.infer<typeof botBlueprintGetSchema>;
export type BotBlueprintResponse = zod.infer<typeof botBlueprintResponseSchema>;
