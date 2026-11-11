import { describe, expect, it } from 'bun:test';

import type { SipSnapshot } from '../sip/index.js';
import { OpsSipDump } from './sip-dump.js';

const snapshot: SipSnapshot = {
    revision: 7,
    zones: [],
    structures: [],
    roads: [],
    farms: [],
    containers: [],
    pathGraph: { nodes: [], edges: [] },
    rules: { protectedBboxes: [], allowedEdits: [], noBreakUnderActiveBot: true },
};

describe('OpsSipDump', () => {
    it('returns the current SIP snapshot', () => {
        const dump = new OpsSipDump({ loadSnapshot: () => [snapshot, null] });

        const [value, error] = dump.snapshot();

        expect(error).toBeNull();
        expect(value?.revision).toBe(7);
    });

    it('maps storage failures', () => {
        const dump = new OpsSipDump({
            loadSnapshot: () => [null, { type: 'READ_FAILED', message: 'broken' }],
        });

        const [value, error] = dump.snapshot();

        expect(value).toBeNull();
        expect(error?.type).toBe('STORAGE');
    });
});
