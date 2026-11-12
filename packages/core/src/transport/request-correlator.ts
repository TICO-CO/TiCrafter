import { type ClockHandle, type ClockPort, type Result, SystemClock } from '../kernel/index.js';
import type { Envelope } from '../schemas/index.js';
import type { TransportFailure } from './failures.js';
import { ProtocolEnvelope } from './messages.js';

interface PendingRequest {
    resolve: (result: Result<Envelope, TransportFailure>) => void;
    timer: ClockHandle;
}

export class RequestCorrelator {
    private readonly pending = new Map<string, PendingRequest>();

    constructor(private readonly clock: ClockPort = new SystemClock()) {}

    createRequest(
        type: string,
        payload: unknown,
        timeoutMs = 5000,
    ): { envelope: Envelope; response: Promise<Result<Envelope, TransportFailure>> } {
        const envelope = ProtocolEnvelope.create('request', type, payload);
        const response = new Promise<Result<Envelope, TransportFailure>>((resolve) => {
            const timer = this.clock.setTimeout(() => {
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
        this.clock.clearTimeout(pending.timer);
        this.pending.delete(requestId);
        if (envelope.error) {
            pending.resolve([null, { type: 'SEND_FAILED', message: envelope.error.message }]);
            return true;
        }
        pending.resolve([envelope, null]);
        return true;
    }

    reject(id: string, failure: TransportFailure): void {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.clock.clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.resolve([null, failure]);
    }

    rejectAll(failure: TransportFailure): void {
        for (const [id, pending] of this.pending) {
            this.clock.clearTimeout(pending.timer);
            pending.resolve([null, failure]);
            this.pending.delete(id);
        }
    }

    get size(): number {
        return this.pending.size;
    }
}
