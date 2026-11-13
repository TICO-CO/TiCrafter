import type { SkillProgressEvent } from '@ticrafter/skills';
const HOME_GOAL_PREFIXES = ['goal:prepare-night:', 'goal:return-home:', 'goal:shelter:'];
const UNREACHABLE_FAILURE_CLASSES = new Set(['no-path', 'target-missing', 'timeout']);

export class HomeProjectFailure {
    static isUnreachableNavigation(event: SkillProgressEvent): boolean {
        if (event.skillId !== 'navigate') return false;
        if (event.status !== 'failed') return false;
        if (!HomeProjectFailure.homeGoal(event.taskId)) return false;
        return (
            event.failureClass !== undefined && UNREACHABLE_FAILURE_CLASSES.has(event.failureClass)
        );
    }

    private static homeGoal(taskId: string | undefined): boolean {
        if (taskId === undefined) return false;
        return HOME_GOAL_PREFIXES.some((prefix) => taskId.startsWith(prefix));
    }
}
