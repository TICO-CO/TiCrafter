import type { Result } from '../kernel/index.js';
import type { Envelope } from '../schemas/index.js';
import type { TransportFailure } from './failures.js';

export type EventHandler = (envelope: Envelope) => void;

export class EventStream {
    private readonly handlers = new Map<string, Set<EventHandler>>();
    private cursor = 0;

    publish(envelope: Envelope): Result<void, TransportFailure> {
        if (envelope.kind !== 'event') {
            return [
                null,
                { type: 'INVALID_FRAME', message: 'event stream accepts event envelopes only' },
            ];
        }
        this.cursor += 1;
        for (const handler of this.handlers.get(envelope.type) ?? []) handler(envelope);
        for (const handler of this.handlers.get('*') ?? []) handler(envelope);
        return [undefined, null];
    }

    subscribe(type: string, handler: EventHandler): () => void {
        const handlers = this.handlers.get(type) ?? new Set<EventHandler>();
        handlers.add(handler);
        this.handlers.set(type, handlers);
        return () => handlers.delete(handler);
    }

    get position(): number {
        return this.cursor;
    }
}
