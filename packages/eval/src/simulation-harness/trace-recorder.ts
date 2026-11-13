export interface TraceEvent {
    tick: number;
    at: string;
    botId: string | null;
    kind:
        | 'goal'
        | 'focus'
        | 'plan'
        | 'progression'
        | 'planner'
        | 'laya'
        | 'task'
        | 'skill'
        | 'movement'
        | 'gaze'
        | 'pause'
        | 'chat'
        | 'permission'
        | 'behavior'
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
