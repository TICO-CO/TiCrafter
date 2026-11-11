import { describe, expect, it } from 'bun:test';

import { WorldFailures } from './failures.js';

describe('WorldFailures', () => {
    it('creates value failures', () => {
        expect(WorldFailures.invalidTimestamp('bad')).toEqual({
            type: 'INVALID_TIMESTAMP',
            value: 'bad',
        });
        expect(WorldFailures.invalidConfidence(1.5)).toEqual({
            type: 'INVALID_CONFIDENCE',
            value: 1.5,
        });
        expect(WorldFailures.invalidReliability(-1)).toEqual({
            type: 'INVALID_RELIABILITY',
            value: -1,
        });
        expect(WorldFailures.invalidContainerRole('unknown')).toEqual({
            type: 'INVALID_CONTAINER_ROLE',
            value: 'unknown',
        });
        expect(WorldFailures.invalidPlanTagRevision(-1)).toEqual({
            type: 'INVALID_PLAN_TAG_REVISION',
            value: -1,
        });
    });

    it('creates position and observation failures', () => {
        const position = { x: 0.5, y: 64, z: 0 };
        expect(WorldFailures.invalidBlockPosition(position)).toEqual({
            type: 'INVALID_BLOCK_POSITION',
            position,
        });
        expect(WorldFailures.invalidContainerObservation('bad contents')).toEqual({
            type: 'INVALID_CONTAINER_OBSERVATION',
            message: 'bad contents',
        });
        expect(WorldFailures.invalidDecayOptions(0, 2)).toEqual({
            type: 'INVALID_DECAY_OPTIONS',
            halfLifeMilliseconds: 0,
            verificationThreshold: 2,
        });
    });

    it('creates storage and query failures', () => {
        expect(WorldFailures.storageFailed('write failed')).toEqual({
            type: 'STORAGE_FAILED',
            message: 'write failed',
        });
        expect(WorldFailures.queryUnavailable('blockAt')).toEqual({
            type: 'QUERY_UNAVAILABLE',
            query: 'blockAt',
        });
        expect(WorldFailures.landmarkListUnavailable()).toEqual({
            type: 'STORAGE_FAILED',
            message: 'landmark list returned null',
        });
        expect(WorldFailures.containerListUnavailable()).toEqual({
            type: 'STORAGE_FAILED',
            message: 'container list returned null',
        });
    });
});
