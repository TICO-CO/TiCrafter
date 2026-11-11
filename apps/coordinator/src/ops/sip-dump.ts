import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { SipSnapshot } from '../sip/index.js';
import type { OpsMetricsRegistry } from './metrics-registry.js';
import type { OpsFailure } from './types.js';

export interface OpsSipDumpPort {
    loadSnapshot(): Result<SipSnapshot, StorageFailure>;
}

export class OpsSipDump {
    constructor(
        private readonly sip: OpsSipDumpPort,
        private readonly metrics?: OpsMetricsRegistry,
    ) {}

    snapshot(): Result<SipSnapshot, OpsFailure> {
        const startedAt = Date.now();
        const [snapshot, snapshotError] = this.sip.loadSnapshot();
        this.metrics?.observe('ops_sip_dump_latency_ms', Date.now() - startedAt);
        if (snapshotError) {
            this.metrics?.increment('ops_sip_dump_errors_total');
            return [null, { type: 'STORAGE', failure: snapshotError }];
        }
        if (snapshot === null) {
            this.metrics?.increment('ops_sip_dump_errors_total');
            return [null, { type: 'UNAVAILABLE', message: 'SIP snapshot unavailable' }];
        }
        return [snapshot, null];
    }
}
