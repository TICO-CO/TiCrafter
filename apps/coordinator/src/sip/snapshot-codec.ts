import { attempt, type Result } from '@ticrafter/core';

import { sipRevisionRecordSchema, sipSnapshotSchema } from './schemas.js';
import type { SipProposalMetadata, SipRevisionRecord, SipSnapshot } from './types.js';

export class SipSnapshotCodec {
    static defaults(): SipSnapshot {
        return {
            revision: 0,
            zones: [],
            structures: [],
            roads: [],
            farms: [],
            containers: [],
            pathGraph: { nodes: [], edges: [] },
            rules: {
                protectedBboxes: [],
                allowedEdits: [],
                noBreakUnderActiveBot: true,
            },
        };
    }

    static decode(payloadJson: string): Result<SipSnapshot, string> {
        const [parsed, parseError] = attempt<unknown, unknown>(() => JSON.parse(payloadJson));
        if (parseError) return [null, SipSnapshotCodec.describe(parseError)];
        const result = sipSnapshotSchema.safeParse(parsed);
        if (!result.success) return [null, result.error.message];
        return [result.data, null];
    }

    static encode(snapshot: SipSnapshot): Result<string, string> {
        return attempt<string, string>(() => JSON.stringify(snapshot));
    }

    static encodeRevision(
        snapshot: SipSnapshot,
        metadata: SipProposalMetadata,
    ): Result<string, string> {
        return attempt<string, string>(() => JSON.stringify({ snapshot, metadata }));
    }

    static decodeRevision(payloadJson: string): Result<SipRevisionRecord, string> {
        const [parsed, parseError] = attempt<unknown, unknown>(() => JSON.parse(payloadJson));
        if (parseError) return [null, SipSnapshotCodec.describe(parseError)];
        const result = sipRevisionRecordSchema.safeParse(parsed);
        if (!result.success) return [null, result.error.message];
        return [result.data, null];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
