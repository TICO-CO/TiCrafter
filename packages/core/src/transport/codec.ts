import { attempt, type Result } from '../result.js';
import type { TransportFailure } from './failures.js';
import type { Envelope, MessageSchemaRegistry } from './messages.js';

export class WsCodec {
    constructor(private readonly registry: MessageSchemaRegistry) {}

    encode(envelope: Envelope): Result<string, TransportFailure> {
        const [validated, validationError] = this.registry.validate(envelope);
        if (validationError) return [null, validationError];
        if (validated === null) return [null, { type: 'INVALID_FRAME', message: 'envelope returned null' }];
        return [JSON.stringify(validated), null];
    }

    decode(raw: string | Buffer): Result<Envelope, TransportFailure> {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        const [parsed, parseError] = attempt(() => JSON.parse(text) as unknown);
        if (parseError || parsed === null) {
            return [null, { type: 'INVALID_FRAME', message: WsCodec.describe(parseError) }];
        }
        return this.registry.validate(parsed);
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
