import type { Result } from '@ticrafter/core';
import type { BlockChangelogReader, EventLogWriter } from '@ticrafter/memory';

export interface ReplayOptions {
    fromEventId?: number;
    fromBlockId?: number;
    limit?: number;
}

export interface ReplayTimelineEntry {
    kind: 'event' | 'block';
    at: string;
    botId: string | null;
    type: string;
    payload: unknown;
}

export interface ReplayReport {
    events: number;
    blockChanges: number;
    duplicates: number;
    timeline: readonly ReplayTimelineEntry[];
}

export class ReplayEngine {
    constructor(
        private readonly events: EventLogWriter,
        private readonly blocks: BlockChangelogReader,
    ) {}

    replay(options: ReplayOptions = {}): Result<ReplayReport, string> {
        const limit = options.limit ?? 10_000;
        const [events, eventError] = this.events.listAfter(options.fromEventId ?? 0, limit);
        if (eventError) return [null, eventError.type];
        if (events === null) return [null, 'event list returned null'];
        const [blocks, blockError] = this.blocks.listAfter(options.fromBlockId ?? 0, limit);
        if (blockError) return [null, blockError.type];
        if (blocks === null) return [null, 'block changelog returned null'];

        const timeline: ReplayTimelineEntry[] = [
            ...events.map((event) => ({
                kind: 'event' as const,
                at: event.createdAt ?? '',
                botId: event.botId ?? null,
                type: event.type,
                payload: event.payload ?? null,
            })),
            ...blocks.map((change) => ({
                kind: 'block' as const,
                at: change.createdAt ?? '',
                botId: change.botId,
                type: 'block.change',
                payload: change,
            })),
        ].sort((left, right) => left.at.localeCompare(right.at));

        return [
            {
                events: events.length,
                blockChanges: blocks.length,
                duplicates: ReplayEngine.duplicates(blocks),
                timeline,
            },
            null,
        ];
    }

    private static duplicates(
        blocks: readonly { position: { x: number; y: number; z: number } }[],
    ): number {
        const counts = new Map<string, number>();
        blocks.forEach((block) => {
            const key = `${block.position.x},${block.position.y},${block.position.z}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        return [...counts.values()].filter((count) => count > 1).length;
    }
}
