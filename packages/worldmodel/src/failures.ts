import type { BlockPosition, WorldFailure } from './types.js';

export class WorldFailures {
    static invalidTimestamp(value: string): WorldFailure {
        return { type: 'INVALID_TIMESTAMP', value };
    }

    static invalidConfidence(value: number): WorldFailure {
        return { type: 'INVALID_CONFIDENCE', value };
    }

    static invalidReliability(value: number): WorldFailure {
        return { type: 'INVALID_RELIABILITY', value };
    }

    static invalidContainerRole(value: string): WorldFailure {
        return { type: 'INVALID_CONTAINER_ROLE', value };
    }

    static invalidContainerObservation(message: string): WorldFailure {
        return { type: 'INVALID_CONTAINER_OBSERVATION', message };
    }

    static invalidPlanTagRevision(value: number): WorldFailure {
        return { type: 'INVALID_PLAN_TAG_REVISION', value };
    }

    static invalidBlockPosition(position: BlockPosition): WorldFailure {
        return { type: 'INVALID_BLOCK_POSITION', position };
    }

    static invalidDecayOptions(
        halfLifeMilliseconds: number,
        verificationThreshold: number,
    ): WorldFailure {
        return {
            type: 'INVALID_DECAY_OPTIONS',
            halfLifeMilliseconds,
            verificationThreshold,
        };
    }

    static queryUnavailable(query: string): WorldFailure {
        return { type: 'QUERY_UNAVAILABLE', query };
    }

    static storageFailed(message: string): WorldFailure {
        return { type: 'STORAGE_FAILED', message };
    }

    static landmarkListUnavailable(): WorldFailure {
        return WorldFailures.storageFailed('landmark list returned null');
    }

    static containerListUnavailable(): WorldFailure {
        return WorldFailures.storageFailed('container list returned null');
    }
}
