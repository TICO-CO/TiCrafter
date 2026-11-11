import fileSystem from 'node:fs';

import { attempt } from '@ticrafter/core';
import { SqliteRuntime } from '@ticrafter/memory';

import type { SoakProbePort, SoakSnapshot } from './index.js';

interface CountRow {
    count: number;
}

interface TimeRow {
    at: string | null;
}

export class FleetSoakProbe implements SoakProbePort {
    constructor(
        private readonly dataDir: string,
        private readonly childPid: () => number | null,
    ) {}

    snapshot(): SoakSnapshot {
        const rssBytes = this.rssBytes();
        const [database, openError] = new SqliteRuntime({ dataDir: this.dataDir }).open();
        if (openError || database === null) {
            return { rssBytes, activeClaims: 0, lastHeartbeatAt: null };
        }
        const [snapshot, readError] = attempt<SoakSnapshot, unknown>(() => {
            const claims = database
                .prepare("SELECT COUNT(*) AS count FROM claims WHERE status = 'active'")
                .get() as CountRow;
            const heartbeat = database
                .prepare('SELECT MAX(created_at) AS at FROM bot_events')
                .get() as TimeRow;
            return {
                rssBytes,
                activeClaims: Number(claims.count),
                lastHeartbeatAt: heartbeat.at,
            };
        });
        const [, closeError] = attempt(() => database.close());
        if (readError || closeError || snapshot === null) {
            return { rssBytes, activeClaims: 0, lastHeartbeatAt: null };
        }
        return snapshot;
    }

    private rssBytes(): number {
        const pid = this.childPid();
        if (pid === null) return 0;
        const [status, readError] = attempt(() =>
            fileSystem.readFileSync(`/proc/${pid}/status`, 'utf8'),
        );
        if (readError || status === null) return 0;
        const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
        return match === null ? 0 : Number(match[1]) * 1024;
    }
}
