import type { Result } from '@ticrafter/core';
import type { DomainEvent, Episode, StorageFailure, StoredBlockChange } from '@ticrafter/memory';

import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsFailure } from './types.js';

export interface OpsAuditPorts {
    events: { list(limit?: number): Result<DomainEvent[], StorageFailure> };
    blocks: {
        listAfter(id: number, limit?: number): Result<StoredBlockChange[], StorageFailure>;
        listByBot(botId: string, limit?: number): Result<StoredBlockChange[], StorageFailure>;
    };
    episodes: { list(limit?: number): Result<Episode[], StorageFailure> };
}

export class OpsAuditViewer {
    constructor(
        private readonly ports: OpsAuditPorts,
        private readonly metrics?: OpsMetricsRegistry,
    ) {}

    events(limit = 100): Result<readonly DomainEvent[], OpsFailure> {
        return this.read('events', () => this.ports.events.list(limit));
    }

    blocks(limit = 100, botId?: string): Result<readonly StoredBlockChange[], OpsFailure> {
        return this.read('blocks', () =>
            botId === undefined
                ? this.ports.blocks.listAfter(0, limit)
                : this.ports.blocks.listByBot(botId, limit),
        );
    }

    episodes(limit = 100): Result<readonly Episode[], OpsFailure> {
        return this.read('episodes', () => this.ports.episodes.list(limit));
    }

    private read<T>(
        operation: string,
        read: () => Result<T[], StorageFailure>,
    ): Result<T[], OpsFailure> {
        const startedAt = Date.now();
        const [value, readError] = read();
        this.metrics?.observe('ops_audit_viewer_latency_ms', Date.now() - startedAt, {
            operation,
        });
        if (readError) {
            this.metrics?.increment('ops_audit_viewer_errors_total', 1, { operation });
            return [null, { type: 'STORAGE', failure: readError }];
        }
        return [value, null];
    }
}
