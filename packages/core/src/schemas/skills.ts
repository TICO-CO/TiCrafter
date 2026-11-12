import { z as zod } from 'zod';

import { boundingBoxSchema, positionSchema } from './shared.js';

export const BOT_SKILL_START = 'bot.skill.start';
export const BOT_SKILL_CANCEL = 'bot.skill.cancel';
export const BOT_SKILL_RESUME = 'bot.skill.resume';
export const SKILL_PROGRESS_EVENT = 'skill.progress';

const skillBuildTargetSchema = zod.object({
    position: positionSchema,
    itemName: zod.string().min(1),
    expectedBlockId: zod.string().min(1).optional(),
});

const skillGrantSchema = zod.object({
    id: zod.string().min(1),
    expiresAt: zod.string().min(1).optional(),
});

const skillSchematicRefSchema = zod.object({
    id: zod.string().min(1),
    anchor: positionSchema,
    revision: zod.number().optional(),
    rotation: zod.number().optional(),
});

const skillFarmPlotSchema = zod.object({
    id: zod.string().min(1),
    bbox: boundingBoxSchema,
    cropBlockIds: zod.array(zod.string().min(1)).optional(),
    seedItem: zod.string().min(1).optional(),
});

export const skillInputSchema = zod.object({
    target: positionSchema.optional(),
    waypoints: zod.array(positionSchema).optional(),
    itemName: zod.string().min(1).optional(),
    count: zod.number().optional(),
    radius: zod.number().optional(),
    range: zod.number().optional(),
    threshold: zod.number().optional(),
    container: positionSchema.optional(),
    taskId: zod.string().min(1).optional(),
    blocks: zod.array(skillBuildTargetSchema).optional(),
    blockIds: zod.array(zod.string().min(1)).optional(),
    bbox: boundingBoxSchema.optional(),
    material: zod.string().min(1).optional(),
    direction: positionSchema.optional(),
    end: positionSchema.optional(),
    width: zod.number().optional(),
    maxLength: zod.number().optional(),
    furnace: positionSchema.optional(),
    fuelItem: zod.string().min(1).optional(),
    outputItem: zod.string().min(1).optional(),
    bed: positionSchema.optional(),
    center: positionSchema.optional(),
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

export type BotSkillStartMessage = zod.infer<typeof botSkillStartSchema>;
export type BotSkillCancelMessage = zod.infer<typeof botSkillCancelSchema>;
export type BotSkillResumeMessage = zod.infer<typeof botSkillResumeSchema>;
export type SkillProgress = zod.infer<typeof skillProgressSchema>;
