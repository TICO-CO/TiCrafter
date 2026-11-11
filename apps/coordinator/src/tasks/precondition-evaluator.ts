import type { Result } from '@ticrafter/core';

import type {
    TaskClaimPort,
    TaskPrecondition,
    TaskPreconditionFailure,
    TaskWorldPort,
} from './types.js';

export interface TaskPreconditionContext {
    world: TaskWorldPort;
    claims: TaskClaimPort;
    inventory: Readonly<Record<string, number>>;
}

export class TaskPreconditionEvaluator {
    evaluate(
        preconditions: readonly TaskPrecondition[],
        context: TaskPreconditionContext,
    ): Result<void, readonly TaskPreconditionFailure[]> {
        const failures: TaskPreconditionFailure[] = [];
        for (const precondition of preconditions) {
            const failure = this.evaluateOne(precondition, context);
            if (failure !== null) failures.push(failure);
        }
        if (failures.length > 0) return [null, failures];
        return [undefined, null];
    }

    private evaluateOne(
        precondition: TaskPrecondition,
        context: TaskPreconditionContext,
    ): TaskPreconditionFailure | null {
        switch (precondition.kind) {
            case 'inventory.at-least':
                return this.inventory(precondition, context);
            case 'claim.free':
                return this.claim(precondition, context);
            case 'world.block':
                return this.block(precondition, context);
            case 'world.landmark':
                return this.landmark(precondition, context);
        }
    }

    private inventory(
        precondition: TaskPrecondition & { kind: 'inventory.at-least' },
        context: TaskPreconditionContext,
    ): TaskPreconditionFailure | null {
        const count = context.inventory[precondition.item] ?? 0;
        if (count >= precondition.quantity) return null;
        return {
            precondition,
            reason: `need ${precondition.quantity} ${precondition.item}, have ${count}`,
        };
    }

    private claim(
        precondition: TaskPrecondition & { kind: 'claim.free' },
        context: TaskPreconditionContext,
    ): TaskPreconditionFailure | null {
        const [overlapping, claimError] = context.claims.hasActiveOverlap(precondition.bbox);
        if (claimError) return { precondition, reason: claimError };
        if (overlapping === true) return { precondition, reason: 'active claim overlaps' };
        return null;
    }

    private block(
        precondition: TaskPrecondition & { kind: 'world.block' },
        context: TaskPreconditionContext,
    ): TaskPreconditionFailure | null {
        const [block, blockError] = context.world.blockAt(precondition.position);
        if (blockError) return { precondition, reason: blockError.type };
        if (block === null) return { precondition, reason: 'block not observed' };
        if (
            precondition.expectedBlockId !== undefined &&
            block.blockId !== precondition.expectedBlockId
        ) {
            return {
                precondition,
                reason: `expected ${precondition.expectedBlockId}, observed ${block.blockId}`,
            };
        }
        return null;
    }

    private landmark(
        precondition: TaskPrecondition & { kind: 'world.landmark' },
        context: TaskPreconditionContext,
    ): TaskPreconditionFailure | null {
        const [landmarks, landmarkError] = context.world.intersecting(
            precondition.bbox,
            precondition.type ?? null,
        );
        if (landmarkError) return { precondition, reason: landmarkError.type };
        if (landmarks === null) return { precondition, reason: 'landmark query missing' };
        if (landmarks.length === 0) return { precondition, reason: 'landmark not observed' };
        return null;
    }
}
