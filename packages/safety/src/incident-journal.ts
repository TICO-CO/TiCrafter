import type { ActionRequest } from '@ticrafter/core';

import type { SafetyIncident, SafetyIncidentSink, SafetySnapshot } from './types.js';

export class IncidentJournal {
    private readonly recordedKeys = new Set<string>();

    constructor(private readonly sink: SafetyIncidentSink) {}

    record(snapshot: SafetySnapshot, kind: string, message: string, action?: ActionRequest): void {
        this.sink.record(this.incident(snapshot, kind, message, action));
    }

    recordOnce(
        snapshot: SafetySnapshot,
        kind: string,
        message: string,
        action?: ActionRequest,
    ): boolean {
        const key = this.incidentKey(snapshot.botId, kind, message);
        if (this.recordedKeys.has(key)) return false;
        this.recordedKeys.add(key);
        this.record(snapshot, kind, message, action);
        return true;
    }

    recordVeto(snapshot: SafetySnapshot, request: ActionRequest, reason: string): boolean {
        return this.recordOnce(snapshot, `veto.${request.kind}`, reason, request);
    }

    resetDeduplication(): void {
        this.recordedKeys.clear();
    }

    private incident(
        snapshot: SafetySnapshot,
        kind: string,
        message: string,
        action?: ActionRequest,
    ): SafetyIncident {
        return {
            at: snapshot.at,
            botId: snapshot.botId,
            kind,
            message,
            action,
        };
    }

    private incidentKey(botId: string, kind: string, message: string): string {
        return `${botId}|${kind}|${message}`;
    }
}
