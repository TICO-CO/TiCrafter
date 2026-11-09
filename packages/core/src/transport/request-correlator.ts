import type { Result } from '../result.js';
import type { TransportFailure } from './failures.js';
import { ProtocolEnvelope, type Envelope } from './messages.js';

interface PendingRequest {
    resolve: (result: Result<Envelope, TransportFailure>) => void;
    timer: NodeJS.Timeout;
}

export class RequestCorrelator {
    private readonly pending = new Map<string, PendingRequest>();

    createRequest(
        type: string,
        payload: unknown,
        timeoutMs = 5000,
    ): { envelope: Envelope; response: Promise<Result<Envelope, TransportFailure>> } {
        const envelope = ProtocolEnvelope.create('request', type, payload);
        const response = new Promise<Result<Envelope, TransportFailure>>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(envelope.id);
                resolve([null, { type: 'TIMEOUT', requestType: type }]);
            }, timeoutMs);
            this.pending.set(envelope.id, { resolve, timer });
        });
        return { envelope, response };
    }

    accept(envelope: Envelope): boolean {
        if (envelope.kind !== 'response') return false;
        const requestId = envelope.replyTo ?? envelope.id;
        const pending = this.pending.get(requestId);
        if (!pending) return false;
        clearTimeout(pending.timer);
        this.pending.delete(requestId);
        if (envelope.error) {
            pending.resolve([null, { type: 'SEND_FAILED', message: envelope.error.message }]);
            return true;
        }
        pending.resolve([envelope, null]);
        return true;
    }

    rejectAll(error: TransportFailure): void {
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.resolve([null, error]);
            this.pending.delete(id);
        }
    }

    get size(): number {
        return this.pending.size;
    }
}
