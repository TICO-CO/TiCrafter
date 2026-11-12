import { z as zod } from 'zod';

import { agencyStateSchema } from './agency.js';
import { resumeProjectSchema } from './projects.js';
import { roleSchema } from './shared.js';
import { strategicIntentSchema } from './strategic-intent.js';
import { taskAssignmentSchema } from './tasks.js';

export const sessionHelloSchema = zod.object({
    botId: zod.string().min(1),
    name: zod.string().min(1),
    version: zod.string().optional(),
});

export const sessionResumeSchema = zod.object({
    task: taskAssignmentSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().nullable(),
    checkpoint: zod.unknown().nullable().optional(),
    sipRevision: zod.number().int().nonnegative(),
    role: roleSchema.nullable().optional(),
    agency: agencyStateSchema.nullable().optional(),
    projects: zod.array(resumeProjectSchema).optional(),
    strategicIntent: strategicIntentSchema.nullable().optional(),
});

export const sessionHelloResponseSchema = zod.object({
    accepted: zod.boolean(),
    epoch: zod.number().int().nonnegative(),
    reason: zod.string().optional(),
    resume: sessionResumeSchema.optional(),
});

export type SessionHello = zod.infer<typeof sessionHelloSchema>;
export type SessionResume = zod.infer<typeof sessionResumeSchema>;
export type SessionHelloResponse = zod.infer<typeof sessionHelloResponseSchema>;
