import type { ActionDispatchPort, ActionRequest, Result, Vec3 } from '@ticrafter/core';

import type { BlueprintMaterialNeed } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { ContainerCatalogPort, MaterialPlan } from './material-preflight.js';

export interface RefillTransfer {
    direction: 'withdraw' | 'deposit';
    container: Vec3;
    itemName: string;
    count: number;
}

export class ContainerRefillAdapter {
    constructor(
        private readonly dispatcher: ActionDispatchPort,
        private readonly containers: ContainerCatalogPort,
    ) {}

    plan(plan: MaterialPlan): readonly RefillTransfer[] {
        return plan.withdrawals.map((withdrawal) => ({
            direction: 'withdraw',
            container: withdrawal.position,
            itemName: withdrawal.item,
            count: withdrawal.count,
        }));
    }

    planDeposits(
        surplus: readonly BlueprintMaterialNeed[],
        botPosition?: Vec3,
    ): Result<readonly RefillTransfer[], BuildingFailure> {
        if (surplus.length === 0) return [[], null];
        const [containers, containerError] = this.containers.list();
        if (containerError) return [null, containerError];
        if (containers === null) {
            return [null, { type: 'WORLD_QUERY_FAILED', message: 'containers returned null' }];
        }
        const target = this.targetContainer(containers, botPosition);
        if (target === null) {
            return [
                null,
                { type: 'WORLD_QUERY_FAILED', message: 'no storage container for deposits' },
            ];
        }
        return [
            surplus.map((entry) => ({
                direction: 'deposit',
                container: target,
                itemName: entry.item,
                count: entry.count,
            })),
            null,
        ];
    }

    dispatch(transfer: RefillTransfer): Result<string, BuildingFailure> {
        const action: ActionRequest = {
            kind: 'transfer',
            direction: transfer.direction,
            container: transfer.container,
            itemName: transfer.itemName,
            count: transfer.count,
        };
        const [handleId, dispatchError] = this.dispatcher.dispatch(action);
        if (dispatchError) return [null, { type: 'ACTION_REJECTED', message: dispatchError }];
        if (handleId === null) {
            return [null, { type: 'ACTION_REJECTED', message: 'transfer handle is missing' }];
        }
        return [handleId, null];
    }

    private targetContainer(
        containers: readonly {
            position: Vec3;
            role: string;
        }[],
        botPosition?: Vec3,
    ): Vec3 | null {
        const storage = containers.filter((container) => container.role === 'storage');
        const candidates = storage.length > 0 ? storage : containers;
        if (candidates.length === 0) return null;
        if (botPosition === undefined) return candidates[0]?.position ?? null;
        const nearest = candidates.reduce((closest, current) =>
            this.distance(botPosition, current.position) <
            this.distance(botPosition, closest.position)
                ? current
                : closest,
        );
        return nearest.position;
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}
