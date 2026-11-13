import type { SkillProgressEvent } from '@ticrafter/skills';

const HOME_GOAL_PREFIXES = ['goal:prepare-night:', 'goal:return-home:', 'goal:shelter:'];
const UNREACHABLE_FAILURE_CLASSES = new Set(['no-path', 'target-missing']);
const ABANDON_RETRY_MILLISECONDS = 30_000;

export interface HomeProjectRecoveryOptions {
    abandon: (projectId: string, reason: string) => Promise<boolean>;
    clearHome: () => void;
    repropose: () => Promise<void>;
    now?: () => number;
    retryMilliseconds?: number;
}

export class HomeProjectRecovery {
    private inFlight = false;
    private retryAt = 0;
    private readonly now: () => number;
    private readonly retryMilliseconds: number;

    constructor(private readonly options: HomeProjectRecoveryOptions) {
        this.now = options.now ?? (() => Date.now());
        this.retryMilliseconds = options.retryMilliseconds ?? ABANDON_RETRY_MILLISECONDS;
    }

    get busy(): boolean {
        return this.inFlight;
    }

    canAttempt(): boolean {
        return !this.inFlight && this.now() >= this.retryAt;
    }

    async abandon(projectId: string, reason: string): Promise<boolean> {
        if (!this.canAttempt()) return false;
        this.inFlight = true;
        const accepted = await this.options.abandon(projectId, reason).catch(() => false);
        this.inFlight = false;
        if (!accepted) {
            this.retryAt = this.now() + this.retryMilliseconds;
            return false;
        }
        this.retryAt = 0;
        this.options.clearHome();
        await this.options.repropose();
        return true;
    }

    reset(): void {
        this.inFlight = false;
        this.retryAt = 0;
    }
}

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
