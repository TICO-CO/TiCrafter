import type { ActionRequest } from '@ticrafter/core';

import type { SafetyIncidentSink, SafetySnapshot } from './types.js';

export class IncidentJournal {
    constructor(private readonly sink: SafetyIncidentSink) {}

    record(snapshot: SafetySnapshot, kind: string, message: string, action?: ActionRequest): void {
        this.sink.record({
            at: snapshot.at,
            botId: snapshot.botId,
            kind,
            message,
            action,
        });
    }
}
