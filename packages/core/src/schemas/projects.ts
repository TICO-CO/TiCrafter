import { z as zod } from 'zod';

import { boundingBoxSchema, positionSchema } from './shared.js';

export const BOT_PROJECT_PROPOSE = 'bot.project.propose';
export const BOT_PROJECT_RESPONSE = 'bot.project.response';
export const BOT_PROJECT_ABANDON = 'bot.project.abandon';
export const BOT_PROJECT_ABANDON_RESPONSE = 'bot.project.abandon.response';
export const BOT_PROJECT_UPDATE_EVENT = 'bot.project.update';

export const projectKindSchema = zod.enum(['home', 'storage', 'build']);

export const projectStatusSchema = zod.enum([
    'proposed',
    'active',
    'completed',
    'abandoned',
    'failed',
]);

export const projectCollaborationSchema = zod.enum(['private', 'invite', 'open']);

export const resumeProjectSchema = zod.object({
    id: zod.string().min(1),
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: projectKindSchema,
    status: projectStatusSchema,
    anchor: positionSchema,
    bbox: boundingBoxSchema,
    structureId: zod.string().min(1).nullable(),
    storageId: zod.string().min(1).nullable(),
});

const projectClaimSchema = zod.object({
    claimId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botProjectProposeSchema = zod.object({
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: projectKindSchema,
    anchor: positionSchema,
    bbox: boundingBoxSchema,
    storagePosition: positionSchema.nullable().optional(),
    collaboration: projectCollaborationSchema.optional(),
    autoAcceptCompatibleHelpers: zod.boolean().optional(),
});

export const projectRecordSchema = zod.object({
    id: zod.string().min(1),
    botId: zod.string().min(1),
    title: zod.string().min(1),
    kind: projectKindSchema,
    status: projectStatusSchema,
    anchor: positionSchema,
    bbox: boundingBoxSchema,
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

export const botProjectUpdateSchema = zod.object({
    botId: zod.string().min(1),
    project: projectRecordSchema,
});

export const botProjectAbandonResponseSchema = zod.object({
    ok: zod.boolean(),
    project: projectRecordSchema.nullable(),
    reason: zod.string().optional(),
});

export type ResumeProject = zod.infer<typeof resumeProjectSchema>;
export type BotProjectPropose = zod.infer<typeof botProjectProposeSchema>;
export type BotProjectResponse = zod.infer<typeof botProjectResponseSchema>;
export type BotProjectAbandon = zod.infer<typeof botProjectAbandonSchema>;
export type BotProjectAbandonResponse = zod.infer<typeof botProjectAbandonResponseSchema>;
export type BotProjectUpdate = zod.infer<typeof botProjectUpdateSchema>;
export type ProjectRecordPayload = zod.infer<typeof projectRecordSchema>;
