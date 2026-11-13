import type { GoalKind } from './types.js';

const INTERRUPTION_GOALS: ReadonlySet<GoalKind> = new Set([
    'survive',
    'eat',
    'rest',
    'shelter',
    'prepare-night',
    'gather',
    'craft',
    'deposit',
    'gather-wool',
    'gather-food',
    'secure-bed',
    'build-shelter',
    'dig-shelter',
    'equip-gear',
    'harvest-farm',
    'plant-farm',
]);

export class ProjectFocusPolicy {
    static allowsGoal(kind: GoalKind): boolean {
        return INTERRUPTION_GOALS.has(kind);
    }

    static allowsAny(kinds: readonly GoalKind[]): boolean {
        return kinds.some((kind) => ProjectFocusPolicy.allowsGoal(kind));
    }
}
