import { z as zod } from 'zod';

import { integerBoundingBoxSchema } from './shared.js';

export const BOT_SAFETY_RESUME = 'bot.safety.resume';
export const BOT_SAFETY_STOP = 'bot.safety.stop';

export const safetyClaimRegionSchema = zod.object({
    id: zod.string().min(1),
    ownerBotId: zod.string().min(1),
    structureId: zod.string().min(1).optional(),
    workPackageId: zod.string().min(1).optional(),
    bbox: integerBoundingBoxSchema,
    expiresAt: zod.string().min(1),
});

export const safetyGrantRegionSchema = zod.object({
    id: zod.string().min(1),
    granteeBotId: zod.string().min(1),
    structureId: zod.string().min(1),
    bbox: integerBoundingBoxSchema,
    expiresAt: zod.string().min(1),
    allowedOps: zod.array(zod.enum(['place', 'break'])),
});

export const safetyContextSchema = zod.object({
    activeClaim: safetyClaimRegionSchema.nullable().optional(),
    claims: zod.array(safetyClaimRegionSchema),
    grants: zod.array(safetyGrantRegionSchema),
});

export const botSafetyResumeSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export const botSafetyStopSchema = zod.object({
    reason: zod.string().min(1),
});

export type SafetyClaimRegion = zod.infer<typeof safetyClaimRegionSchema>;
export type SafetyGrantRegion = zod.infer<typeof safetyGrantRegionSchema>;
export type SafetyContext = zod.infer<typeof safetyContextSchema>;
export type BotSafetyResumeMessage = zod.infer<typeof botSafetyResumeSchema>;
export type BotSafetyStopMessage = zod.infer<typeof botSafetyStopSchema>;
