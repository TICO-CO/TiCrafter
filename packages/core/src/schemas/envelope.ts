import { z as zod } from 'zod';

export const PROTOCOL_VERSION = 1;

export const envelopeSchema = zod.object({
    v: zod.literal(PROTOCOL_VERSION),
    id: zod.string().min(1),
    kind: zod.enum(['request', 'response', 'event']),
    type: zod.string().min(1),
    payload: zod.unknown(),
    replyTo: zod.string().optional(),
    error: zod
        .object({
            code: zod.string().min(1),
            message: zod.string().min(1),
        })
        .optional(),
    timestamp: zod.string().optional(),
});

export type Envelope = zod.infer<typeof envelopeSchema>;
