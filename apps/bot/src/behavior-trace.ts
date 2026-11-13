import type { BehaviorTraceEntry, BehaviorTraceKind } from '@ticrafter/core';

export type { BehaviorTraceEntry, BehaviorTraceKind };

export interface BehaviorTracePort {
    record(
        kind: BehaviorTraceKind,
        subject: string,
        detail: Readonly<Record<string, unknown>>,
    ): void;
}

export type BehaviorTraceSink = (entry: BehaviorTraceEntry) => void;

export class BehaviorTraceRecorder implements BehaviorTracePort {
    constructor(
        private readonly botId: string,
        private readonly sink: BehaviorTraceSink,
        private readonly now: () => number = Date.now,
    ) {}

    record(
        kind: BehaviorTraceKind,
        subject: string,
        detail: Readonly<Record<string, unknown>>,
    ): void {
        this.sink({
            at: new Date(this.now()).toISOString(),
            botId: this.botId,
            kind,
            subject,
            detail,
        });
    }
}
