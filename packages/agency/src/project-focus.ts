import type { GoalKind } from './types.js';

const INTERRUPTION_GOALS: ReadonlySet<GoalKind> = new Set([
    'survive',
    'eat',
    'rest',
    'shelter',
    'prepare-night',
]);

export class ProjectFocusPolicy {
    static allowsGoal(kind: GoalKind): boolean {
        return INTERRUPTION_GOALS.has(kind);
    }

    static allowsAny(kinds: readonly GoalKind[]): boolean {
        return kinds.some((kind) => ProjectFocusPolicy.allowsGoal(kind));
    }
}
