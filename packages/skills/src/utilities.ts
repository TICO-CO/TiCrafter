import { type ActionOutcome, type ActionRequest, assertNever, type Vec3 } from '@ticrafter/core';

import type {
    SkillCheckpoint,
    SkillContext,
    SkillFailureClass,
    SkillInventoryItem,
    SkillRun,
    SkillStep,
} from './types.js';

const FOOD_ITEMS = new Set([
    'apple',
    'baked_potato',
    'beef',
    'beetroot',
    'bread',
    'carrot',
    'chicken',
    'cod',
    'cooked_beef',
    'cooked_chicken',
    'cooked_mutton',
    'cooked_porkchop',
    'cooked_salmon',
    'cookie',
    'dried_kelp',
    'glow_berries',
    'golden_apple',
    'melon_slice',
    'mushroom_stew',
    'mutton',
    'porkchop',
    'potato',
    'rabbit_stew',
    'salmon',
    'sweet_berries',
]);

export class SkillSharedUtilities {
    static distance(left: Vec3, right: Vec3): number {
        const differenceX = left.x - right.x;
        const differenceY = left.y - right.y;
        const differenceZ = left.z - right.z;
        return Math.sqrt(differenceX ** 2 + differenceY ** 2 + differenceZ ** 2);
    }

    static itemCount(inventory: readonly SkillInventoryItem[], itemName: string): number {
        return inventory
            .filter((item) => item.name === itemName)
            .reduce((total, item) => total + item.count, 0);
    }

    static hasItem(inventory: readonly SkillInventoryItem[], itemName: string): boolean {
        return SkillSharedUtilities.itemCount(inventory, itemName) > 0;
    }

    static firstFood(inventory: readonly SkillInventoryItem[]): string | null {
        const food = inventory.find((item) => FOOD_ITEMS.has(item.name));
        return food?.name ?? null;
    }

    static isFood(itemName: string): boolean {
        return FOOD_ITEMS.has(itemName);
    }

    static awayFrom(position: Vec3, threat: Vec3, distance: number): Vec3 {
        const differenceX = position.x - threat.x;
        const differenceZ = position.z - threat.z;
        const magnitude = Math.sqrt(differenceX ** 2 + differenceZ ** 2);
        if (magnitude === 0) {
            return { x: Math.floor(position.x + distance), y: position.y, z: position.z };
        }
        return {
            x: Math.floor(position.x + (differenceX / magnitude) * distance),
            y: position.y,
            z: Math.floor(position.z + (differenceZ / magnitude) * distance),
        };
    }

    static readVec3(value: unknown): Vec3 | null {
        if (!SkillSharedUtilities.isRecord(value)) return null;
        if (typeof value.x !== 'number') return null;
        if (typeof value.y !== 'number') return null;
        if (typeof value.z !== 'number') return null;
        return { x: value.x, y: value.y, z: value.z };
    }

    static readNumber(value: unknown, fallback: number): number {
        return typeof value === 'number' ? value : fallback;
    }

    static readString(value: unknown): string | null {
        return typeof value === 'string' ? value : null;
    }

    static readProperties(value: unknown): Record<string, string> | null {
        if (!SkillSharedUtilities.isRecord(value)) return null;
        const entries = Object.entries(value);
        if (!entries.every((entry) => typeof entry[1] === 'string')) return null;
        return Object.fromEntries(entries) as Record<string, string>;
    }

    static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    static running(
        run: SkillRun,
        action: ActionRequest,
        done: number,
        total: number,
        label: string,
    ): SkillStep {
        return {
            run,
            status: 'running',
            action,
            progress: { done, total, label },
            failure: null,
        };
    }

    static completed(run: SkillRun, label: string): SkillStep {
        return {
            run,
            status: 'completed',
            action: null,
            progress: { done: 1, total: 1, label },
            failure: null,
        };
    }

    static failed(run: SkillRun, failureClass: SkillFailureClass, message: string): SkillStep {
        return {
            run,
            status: 'failed',
            action: null,
            progress: { done: 0, total: 1, label: message },
            failure: { class: failureClass, message },
        };
    }

    static cancelled(
        run: SkillRun,
        reason: string,
        failureClass: SkillFailureClass = 'cancelled',
    ): SkillStep {
        return {
            run,
            status: 'cancelled',
            action: null,
            progress: { done: 0, total: 1, label: reason },
            failure: { class: failureClass, message: reason },
        };
    }

    static failureClassFor(outcome: ActionOutcome): SkillFailureClass {
        const failureClass = outcome.failure?.class;
        switch (failureClass) {
            case 'no-path':
                return 'no-path';
            case 'timeout':
                return 'timeout';
            case 'unsafe':
                return 'unsafe';
            case 'missing-item':
                return 'missing-item';
            case 'missing-tool':
                return 'missing-tool';
            case 'target-missing':
                return 'target-missing';
            case 'invalid':
                return 'invalid-input';
            case 'preempted':
                return 'preempted';
            case 'execution-failed':
            case undefined:
                return 'execution-failed';
            default:
                return assertNever(failureClass);
        }
    }

    static checkpoint(context: SkillContext, run: SkillRun): SkillCheckpoint {
        return {
            botId: context.botId,
            taskId: context.taskId ?? 'default',
            skillId: run.skillId,
            state: run.state,
            updatedAt: context.at,
        };
    }
}
