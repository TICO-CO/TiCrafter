import type { Result } from '@ticrafter/core';

import { WorldFailures } from './failures.js';
import type { BlockPosition, ContainerObservation, ContainerRole, WorldFailure } from './types.js';

export interface ContainerObservationStorePort {
    get(id: string): Result<ContainerObservation | null, WorldFailure>;
    list(): Result<readonly ContainerObservation[], WorldFailure>;
    save(observation: ContainerObservation): Result<void, WorldFailure>;
}

export class InMemoryContainerObservationStore implements ContainerObservationStorePort {
    private readonly observations = new Map<string, ContainerObservation>();

    get(id: string): Result<ContainerObservation | null, WorldFailure> {
        return [this.observations.get(id) ?? null, null];
    }

    list(): Result<readonly ContainerObservation[], WorldFailure> {
        return [[...this.observations.values()], null];
    }

    save(observation: ContainerObservation): Result<void, WorldFailure> {
        this.observations.set(observation.id, observation);
        return [undefined, null];
    }
}

export class ContainerMemory {
    constructor(private readonly store: ContainerObservationStorePort) {}

    record(observation: ContainerObservation): Result<ContainerObservation, WorldFailure> {
        const validationError = ContainerMemory.validate(observation);
        if (validationError) return [null, validationError];
        const [existing, readError] = this.store.get(observation.id);
        if (readError) return [null, readError];
        if (existing !== null) {
            const ordering = ContainerMemory.compare(observation.observedAt, existing.observedAt);
            if (ordering === null) {
                return [null, WorldFailures.invalidTimestamp(observation.observedAt)];
            }
            if (ordering < 0) return [existing, null];
        }
        const [, writeError] = this.store.save(observation);
        if (writeError) return [null, writeError];
        return [observation, null];
    }

    at(position: BlockPosition): Result<ContainerObservation | null, WorldFailure> {
        const [observations, listError] = this.store.list();
        if (listError) return [null, listError];
        if (observations === null) {
            return [null, WorldFailures.containerListUnavailable()];
        }
        return [
            observations.find((observation) =>
                ContainerMemory.samePosition(observation.position, position),
            ) ?? null,
            null,
        ];
    }

    list(): Result<readonly ContainerObservation[], WorldFailure> {
        return this.store.list();
    }

    private static validate(observation: ContainerObservation): WorldFailure | null {
        if (observation.id.length === 0) {
            return WorldFailures.invalidContainerObservation('container id is empty');
        }
        if (!ContainerMemory.isPosition(observation.position)) {
            return WorldFailures.invalidContainerObservation('container position invalid');
        }
        if (!ContainerMemory.isRole(observation.role)) {
            return WorldFailures.invalidContainerRole(observation.role);
        }
        if (
            !Number.isFinite(observation.confidence) ||
            observation.confidence < 0 ||
            observation.confidence > 1
        ) {
            return WorldFailures.invalidContainerObservation('container confidence invalid');
        }
        if (!Number.isFinite(Date.parse(observation.observedAt))) {
            return WorldFailures.invalidTimestamp(observation.observedAt);
        }
        if (observation.contents !== null) {
            const invalidItem = observation.contents.find(
                (item) =>
                    item.itemId.length === 0 || !Number.isInteger(item.count) || item.count < 0,
            );
            if (invalidItem !== undefined) {
                return WorldFailures.invalidContainerObservation('container contents invalid');
            }
        }
        return null;
    }

    private static compare(left: string, right: string): number | null {
        const leftMilliseconds = Date.parse(left);
        const rightMilliseconds = Date.parse(right);
        if (!Number.isFinite(leftMilliseconds) || !Number.isFinite(rightMilliseconds)) {
            return null;
        }
        return leftMilliseconds - rightMilliseconds;
    }

    private static isPosition(position: BlockPosition): boolean {
        return (
            Number.isInteger(position.x) &&
            Number.isInteger(position.y) &&
            Number.isInteger(position.z)
        );
    }

    private static isRole(value: string): value is ContainerRole {
        return value === 'storage' || value === 'food' || value === 'tools' || value === 'fuel';
    }

    private static samePosition(left: BlockPosition, right: BlockPosition): boolean {
        return left.x === right.x && left.y === right.y && left.z === right.z;
    }
}
