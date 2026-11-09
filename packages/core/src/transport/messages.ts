import { z } from 'zod';
import { attempt, type Result } from '../result.js';
import type { TransportFailure } from './failures.js';

export const PROTOCOL_VERSION = 1;

export const envelopeSchema = z.object({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string().min(1),
    kind: z.enum(['request', 'response', 'event']),
    type: z.string().min(1),
    payload: z.unknown(),
    replyTo: z.string().optional(),
    error: z
        .object({
            code: z.string().min(1),
            message: z.string().min(1),
        })
        .optional(),
    timestamp: z.string().optional(),
});

export type Envelope = z.infer<typeof envelopeSchema>;

export const sessionHelloSchema = z.object({
    botId: z.string().min(1),
    name: z.string().min(1),
    version: z.string().optional(),
});

export const sessionHelloResponseSchema = z.object({
    accepted: z.boolean(),
    epoch: z.number().int().nonnegative(),
    reason: z.string().optional(),
});

export const coordinatorPingSchema = z.object({});

export const coordinatorPingResponseSchema = z.object({
    pong: z.literal(true),
    at: z.string(),
});

export const coordinatorStatusSchema = z.object({});

export const coordinatorStatusResponseSchema = z.object({
    epoch: z.number().int().nonnegative(),
    sessions: z.array(
        z.object({
            botId: z.string(),
            name: z.string(),
            connectedAt: z.string(),
            lastSeen: z.string(),
        }),
    ),
});

export const coordinatorErrorSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1),
});

export const botHeartbeatSchema = z.object({
    botId: z.string().min(1),
    at: z.string(),
    digest: z.object({
        health: z.number(),
        food: z.number(),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        inventoryCount: z.number().int().nonnegative(),
    }),
});

export const botEventSchema = z.object({
    botId: z.string().min(1),
    event: z.string().min(1),
    at: z.string(),
    data: z.unknown().optional(),
});

export type SessionHello = z.infer<typeof sessionHelloSchema>;
export type SessionHelloResponse = z.infer<typeof sessionHelloResponseSchema>;
export type CoordinatorStatusResponse = z.infer<typeof coordinatorStatusResponseSchema>;
export type BotHeartbeat = z.infer<typeof botHeartbeatSchema>;
export type BotEvent = z.infer<typeof botEventSchema>;

export class MessageSchemaRegistry {
    private readonly schemas = new Map<string, z.ZodType>();

    register(type: string, schema: z.ZodType): this {
        this.schemas.set(type, schema);
        return this;
    }

    has(type: string): boolean {
        return this.schemas.has(type);
    }

    validate(input: unknown): Result<Envelope, TransportFailure> {
        const [parsed, envelopeError] = attempt(() => envelopeSchema.parse(input));
        if (envelopeError || parsed === null) {
            return [null, { type: 'INVALID_FRAME', message: MessageSchemaRegistry.describe(envelopeError) }];
        }
        const schema = this.schemas.get(parsed.type);
        if (!schema) return [null, { type: 'UNKNOWN_MESSAGE', messageType: parsed.type }];
        const [, payloadError] = attempt(() => schema.parse(parsed.payload));
        if (payloadError) {
            return [
                null,
                {
                    type: 'INVALID_PAYLOAD',
                    messageType: parsed.type,
                    message: MessageSchemaRegistry.describe(payloadError),
                },
            ];
        }
        return [parsed, null];
    }

    static withDefaults(): MessageSchemaRegistry {
        return new MessageSchemaRegistry()
            .register('session.hello', sessionHelloSchema)
            .register('session.hello.response', sessionHelloResponseSchema)
            .register('coordinator.ping', coordinatorPingSchema)
            .register('coordinator.ping.response', coordinatorPingResponseSchema)
            .register('coordinator.status', coordinatorStatusSchema)
            .register('coordinator.status.response', coordinatorStatusResponseSchema)
            .register('coordinator.error', coordinatorErrorSchema)
            .register('bot.heartbeat', botHeartbeatSchema)
            .register('bot.event', botEventSchema);
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class ProtocolEnvelope {
    static create(
        kind: Envelope['kind'],
        type: string,
        payload: unknown,
        options: { id?: string; replyTo?: string; error?: Envelope['error'] } = {},
    ): Envelope {
        const envelope: Envelope = {
            v: PROTOCOL_VERSION,
            id: options.id ?? crypto.randomUUID(),
            kind,
            type,
            payload,
            timestamp: new Date().toISOString(),
        };
        if (options.replyTo !== undefined) envelope.replyTo = options.replyTo;
        if (options.error !== undefined) envelope.error = options.error;
        return envelope;
    }
}
