import { z as zod } from 'zod';

export const BEHAVIOR_TRACE_EVENT = 'behavior.trace';

export const behaviorTraceKinds = [
    'decision',
    'plan',
    'action',
    'gaze',
    'movement',
    'pause',
    'chat',
    'permission',
    'perception',
] as const;

export const behaviorTraceKindSchema = zod.enum(behaviorTraceKinds);

export const behaviorTraceEntrySchema = zod.object({
    at: zod.string().min(1),
    botId: zod.string().min(1),
    kind: behaviorTraceKindSchema,
    subject: zod.string().min(1),
    detail: zod.record(zod.string(), zod.unknown()),
});

export type BehaviorTraceKind = zod.infer<typeof behaviorTraceKindSchema>;
export type BehaviorTraceEntry = zod.infer<typeof behaviorTraceEntrySchema>;
