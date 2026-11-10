import type { z as zod } from 'zod';

import { attempt, type Result } from '../kernel/index.js';
import type { TransportFailure } from './failures.js';
import {
    botEventSchema,
    botHeartbeatSchema,
    coordinatorErrorSchema,
    coordinatorPingResponseSchema,
    coordinatorPingSchema,
    coordinatorStatusResponseSchema,
    coordinatorStatusSchema,
    type Envelope,
    envelopeSchema,
    PROTOCOL_VERSION,
    sessionHelloResponseSchema,
    sessionHelloSchema,
} from './schemas.js';

export * from './schemas.js';

export class MessageSchemaRegistry {
    private readonly schemas = new Map<string, zod.ZodType>();

    register(type: string, schema: zod.ZodType): this {
        this.schemas.set(type, schema);
        return this;
    }

    has(type: string): boolean {
        return this.schemas.has(type);
    }

    validate(input: unknown): Result<Envelope, TransportFailure> {
        const [parsed, envelopeError] = attempt(() => envelopeSchema.parse(input));
        if (envelopeError || parsed === null) {
            return [
                null,
                {
                    type: 'INVALID_FRAME',
                    message: MessageSchemaRegistry.describe(envelopeError),
                },
            ];
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
