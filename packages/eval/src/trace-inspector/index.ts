import fileSystem from 'node:fs';
import path from 'node:path';

import { attempt, type Result } from '@ticrafter/core';

import type { TraceEvent } from '../simulation-harness/index.js';

export interface TraceFilter {
    botId?: string;
    fromTick?: number;
    toTick?: number;
    kind?: TraceEvent['kind'];
    taskId?: string;
    projectId?: string;
    structureId?: string;
    assertionId?: string;
}

export interface TraceInspection {
    report: unknown;
    trace: readonly TraceEvent[];
    events: unknown;
    filtered: readonly TraceEvent[];
}

export class TraceInspector {
    static load(directory: string): Result<TraceInspection, string> {
        const [report, reportError] = TraceInspector.readJson(path.join(directory, 'report.json'));
        if (reportError) return [null, reportError];
        const [events, eventsError] = TraceInspector.readJson(path.join(directory, 'events.json'));
        if (eventsError) return [null, eventsError];
        const [trace, traceError] = TraceInspector.readLineJson(
            path.join(directory, 'trace.jsonl'),
        );
        if (traceError || trace === null) return [null, traceError ?? 'trace missing'];
        return [{ report, trace, events, filtered: trace }, null];
    }

    static filter(trace: readonly TraceEvent[], filter: TraceFilter): readonly TraceEvent[] {
        return trace.filter((event) => {
            if (filter.botId !== undefined && event.botId !== filter.botId) return false;
            if (filter.fromTick !== undefined && event.tick < filter.fromTick) return false;
            if (filter.toTick !== undefined && event.tick > filter.toTick) return false;
            if (filter.kind !== undefined && event.kind !== filter.kind) return false;
            if (filter.taskId !== undefined && event.data.taskId !== filter.taskId) return false;
            if (filter.projectId !== undefined && event.data.projectId !== filter.projectId)
                return false;
            if (filter.structureId !== undefined && event.data.structureId !== filter.structureId) {
                return false;
            }
            return true;
        });
    }

    static render(trace: readonly TraceEvent[]): string {
        return trace
            .map((event) => `${event.tick}\t${event.botId ?? '-'}\t${event.kind}\t${event.summary}`)
            .join('\n');
    }

    private static readJson(filePath: string): Result<unknown, string> {
        const [text, readError] = attempt(() => fileSystem.readFileSync(filePath, 'utf8'));
        if (readError || text === null) {
            return [null, `unable to read ${filePath}: ${TraceInspector.describe(readError)}`];
        }
        const [parsed, parseError] = attempt<unknown>(() => JSON.parse(text));
        return parseError === null
            ? [parsed, null]
            : [null, `invalid JSON in ${filePath}: ${TraceInspector.describe(parseError)}`];
    }

    private static readLineJson(filePath: string): Result<readonly TraceEvent[], string> {
        const [text, readError] = attempt(() => fileSystem.readFileSync(filePath, 'utf8'));
        if (readError || text === null) {
            return [null, `unable to read ${filePath}: ${TraceInspector.describe(readError)}`];
        }
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        const events: TraceEvent[] = [];
        for (const line of lines) {
            const [parsed, parseError] = attempt<TraceEvent>(() => JSON.parse(line) as TraceEvent);
            if (parseError || parsed === null) {
                return [null, `invalid trace line in ${filePath}`];
            }
            events.push(parsed);
        }
        return [events, null];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
