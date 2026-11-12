export type TacticalDecisionMode = 'background' | 'blocking';

export interface TacticalDecisionPolicyOptions {
    enabled: boolean;
    mode: TacticalDecisionMode;
    deadlineMilliseconds: number;
    minimumIntervalMilliseconds: number;
    maxDecisionsPerMinute: number;
    skipSingleAffordance: boolean;
    circuitBreakerFailureCount: number;
    now?: () => number;
}

export interface TacticalDecisionPermit {
    allowed: boolean;
    reason: string | null;
    deadlineMilliseconds: number;
}

const MINUTE_MILLISECONDS = 60_000;

export class TacticalDecisionPolicy {
    private lastRequestAt = Number.NEGATIVE_INFINITY;
    private minuteStartedAt = 0;
    private requestsThisMinute = 0;
    private consecutiveFailures = 0;
    private blockedUntil = 0;

    constructor(private readonly options: TacticalDecisionPolicyOptions) {}

    get mode(): TacticalDecisionMode {
        return this.options.mode;
    }

    get enabled(): boolean {
        return this.options.enabled;
    }

    request(affordanceCount: number, now = this.now()): TacticalDecisionPermit {
        if (!this.options.enabled) return this.denied('tactical decisions are disabled');
        if (this.options.skipSingleAffordance && affordanceCount <= 1) {
            return this.denied('single legal affordance');
        }
        if (now < this.blockedUntil) {
            return this.denied('tactical circuit breaker is open');
        }
        if (now - this.lastRequestAt < this.options.minimumIntervalMilliseconds) {
            return this.denied('minimum decision interval is active');
        }
        this.rollMinute(now);
        if (this.requestsThisMinute >= this.options.maxDecisionsPerMinute) {
            return this.denied('maximum decisions per minute reached');
        }
        this.lastRequestAt = now;
        this.requestsThisMinute += 1;
        return {
            allowed: true,
            reason: null,
            deadlineMilliseconds: this.options.deadlineMilliseconds,
        };
    }

    recordSuccess(): void {
        this.consecutiveFailures = 0;
        this.blockedUntil = 0;
    }

    recordFailure(now = this.now()): void {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures < this.options.circuitBreakerFailureCount) return;
        this.blockedUntil =
            Math.floor(now / MINUTE_MILLISECONDS) * MINUTE_MILLISECONDS + MINUTE_MILLISECONDS;
    }

    private rollMinute(now: number): void {
        if (now - this.minuteStartedAt < MINUTE_MILLISECONDS) return;
        this.minuteStartedAt = now;
        this.requestsThisMinute = 0;
    }

    private denied(reason: string): TacticalDecisionPermit {
        return {
            allowed: false,
            reason,
            deadlineMilliseconds: this.options.deadlineMilliseconds,
        };
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }
}
