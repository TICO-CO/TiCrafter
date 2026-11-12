export interface TraceEvent {
    tick: number;
    at: string;
    botId: string | null;
    kind:
        | 'goal'
        | 'focus'
        | 'planner'
        | 'laya'
        | 'task'
        | 'skill'
        | 'block'
        | 'safety'
        | 'project'
        | 'checkpoint'
        | 'assertion';
    summary: string;
    data: Readonly<Record<string, unknown>>;
    refs?: readonly string[];
}

export class TraceRecorder {
    private readonly entries: TraceEvent[] = [];

    record(event: TraceEvent): void {
        this.entries.push(event);
    }

    list(): readonly TraceEvent[] {
        return this.entries;
    }
}
