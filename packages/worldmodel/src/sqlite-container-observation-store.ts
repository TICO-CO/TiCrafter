import { attempt, type Result } from '@ticrafter/core';
import { type ContainerObservationRecord, WorldStore } from '@ticrafter/memory';

import type { ContainerObservationStorePort } from './container-memory.js';
import { WorldFailures } from './failures.js';
import type {
    BlockPosition,
    ContainerItemSnapshot,
    ContainerObservation,
    ContainerRole,
    WorldFailure,
} from './types.js';

export class SqliteContainerObservationStore implements ContainerObservationStorePort {
    constructor(private readonly store: WorldStore) {}

    get(id: string): Result<ContainerObservation | null, WorldFailure> {
        const [record, readError] = this.store.getContainerObservation(id);
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (record === null) return [null, null];
        return this.toObservation(record);
    }

    list(): Result<readonly ContainerObservation[], WorldFailure> {
        const [records, readError] = this.store.listContainerObservations();
        if (readError) {
            return [null, WorldFailures.storageFailed(readError.message)];
        }
        if (records === null) {
            return [null, WorldFailures.containerListUnavailable()];
        }
        const observations: ContainerObservation[] = [];
        for (const record of records) {
            const [observation, mappingError] = this.toObservation(record);
            if (mappingError) return [null, mappingError];
            if (observation !== null) observations.push(observation);
        }
        return [observations, null];
    }

    save(observation: ContainerObservation): Result<void, WorldFailure> {
        const [, writeError] = this.store.saveContainerObservation({
            id: observation.id,
            positionJson: JSON.stringify(observation.position),
            role: observation.role,
            contentsJson:
                observation.contents === null ? null : JSON.stringify(observation.contents),
            observedAt: observation.observedAt,
            confidence: observation.confidence,
            updatedAt: observation.observedAt,
        });
        if (writeError) {
            return [null, WorldFailures.storageFailed(writeError.message)];
        }
        return [undefined, null];
    }

    private toObservation(
        record: ContainerObservationRecord,
    ): Result<ContainerObservation, WorldFailure> {
        const [position, positionError] = SqliteContainerObservationStore.parse<BlockPosition>(
            record.positionJson,
        );
        if (positionError) return [null, positionError];
        if (position === null || !SqliteContainerObservationStore.isPosition(position)) {
            return [null, WorldFailures.storageFailed('invalid container position')];
        }
        const role = SqliteContainerObservationStore.role(record.role);
        if (role === null) {
            return [null, WorldFailures.invalidContainerRole(record.role)];
        }
        const [contents, contentsError] = SqliteContainerObservationStore.contents(
            record.contentsJson,
        );
        if (contentsError) return [null, contentsError];
        return [
            {
                id: record.id,
                position,
                role,
                contents,
                observedAt: record.observedAt,
                confidence: record.confidence,
            },
            null,
        ];
    }

    private static contents(
        value: string | null,
    ): Result<readonly ContainerItemSnapshot[] | null, WorldFailure> {
        if (value === null) return [null, null];
        const [parsed, parseError] =
            SqliteContainerObservationStore.parse<ContainerItemSnapshot[]>(value);
        if (parseError) return [null, parseError];
        if (parsed === null || !Array.isArray(parsed)) {
            return [null, WorldFailures.storageFailed('container contents invalid')];
        }
        return [parsed, null];
    }

    private static parse<T>(value: string): Result<T, WorldFailure> {
        const [parsed, parseError] = attempt(() => JSON.parse(value) as T);
        if (parseError) {
            return [null, WorldFailures.storageFailed('invalid stored JSON')];
        }
        return [parsed, null];
    }

    private static role(value: string): ContainerRole | null {
        switch (value) {
            case 'storage':
            case 'food':
            case 'tools':
            case 'fuel':
                return value;
            default:
                return null;
        }
    }

    private static isPosition(position: BlockPosition): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }
}
