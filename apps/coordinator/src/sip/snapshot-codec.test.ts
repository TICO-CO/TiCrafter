import { describe, expect, it } from 'bun:test';

import { SipFixtures } from './sip-fixtures.js';
import { SipSnapshotCodec } from './snapshot-codec.js';

describe('SIP snapshot codec', () => {
    it('round-trips the default snapshot', () => {
        const snapshot = SipFixtures.snapshot();
        const [encoded, encodeError] = SipSnapshotCodec.encode(snapshot);
        expect(encodeError).toBeNull();
        if (encoded === null) return;
        const [decoded, decodeError] = SipSnapshotCodec.decode(encoded);
        expect(decodeError).toBeNull();
        expect(decoded).toEqual(snapshot);
    });

    it('rejects malformed JSON', () => {
        const [decoded, error] = SipSnapshotCodec.decode('{');
        expect(decoded).toBeNull();
        expect(error === null).toBe(false);
    });

    it('rejects invalid snapshot fields', () => {
        const [decoded, error] = SipSnapshotCodec.decode(
            JSON.stringify({ ...SipFixtures.snapshot(), revision: -1 }),
        );
        expect(decoded).toBeNull();
        expect(error === null).toBe(false);
    });
});
