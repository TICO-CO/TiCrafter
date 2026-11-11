import { describe, expect, it } from 'bun:test';

import { PerceptionFailures } from './failures.js';

describe('PerceptionFailures', () => {
    it('creates value failures', () => {
        expect(PerceptionFailures.invalidVersion(-1)).toEqual({
            type: 'INVALID_VERSION',
            value: -1,
        });
        expect(PerceptionFailures.invalidRingRadius(8)).toEqual({
            type: 'INVALID_RING_RADIUS',
            value: 8,
        });
        expect(PerceptionFailures.invalidTimestamp('bad')).toEqual({
            type: 'INVALID_TIMESTAMP',
            value: 'bad',
        });
        expect(PerceptionFailures.invalidBlockId('')).toEqual({
            type: 'INVALID_BLOCK_ID',
            value: '',
        });
    });

    it('creates position failures', () => {
        const position = { x: 0.5, y: 64, z: 0 };
        expect(PerceptionFailures.invalidBlockPosition(position)).toEqual({
            type: 'INVALID_BLOCK_POSITION',
            position,
        });
        expect(PerceptionFailures.blockOutsideChunk(position, { x: 1, z: -1 })).toEqual({
            type: 'BLOCK_OUTSIDE_CHUNK',
            position,
            chunk: { x: 1, z: -1 },
        });
    });

    it('creates rate limit failures', () => {
        expect(PerceptionFailures.invalidRateLimitOptions(0, 0)).toEqual({
            type: 'INVALID_RATE_LIMIT_OPTIONS',
            tokensPerSecond: 0,
            burst: 0,
        });
    });
});
