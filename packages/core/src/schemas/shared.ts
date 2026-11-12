import { z as zod } from 'zod';

export const positionSchema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

export const integerPositionSchema = zod.object({
    x: zod.number().int(),
    y: zod.number().int(),
    z: zod.number().int(),
});

export const boundingBoxSchema = zod.object({
    min: positionSchema,
    max: positionSchema,
});

export const integerBoundingBoxSchema = zod.object({
    min: integerPositionSchema,
    max: integerPositionSchema,
});

export const chunkCoordinateSchema = zod.object({
    x: zod.number().int(),
    z: zod.number().int(),
});

export const inventoryItemSchema = zod.object({
    name: zod.string().min(1),
    count: zod.number().int().nonnegative(),
});

export const roleSchema = zod.enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']);

export type Position = zod.infer<typeof positionSchema>;
export type IntegerPosition = zod.infer<typeof integerPositionSchema>;
export type BoundingBox = zod.infer<typeof boundingBoxSchema>;
export type IntegerBoundingBox = zod.infer<typeof integerBoundingBoxSchema>;
export type ChunkCoordinate = zod.infer<typeof chunkCoordinateSchema>;
export type InventoryItem = zod.infer<typeof inventoryItemSchema>;
export type Role = zod.infer<typeof roleSchema>;
