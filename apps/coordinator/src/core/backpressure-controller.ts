export type BackpressureLevel = 'normal' | 'throttled';

export interface BackpressureInput {
    decisionP95Milliseconds: number;
    decisionSamples: number;
}

export interface BackpressureState {
    level: BackpressureLevel;
    rateScale: number;
    reasons: readonly string[];
}

export interface BackpressureOptions {
    maximumP95Milliseconds: number;
    triggerSamples: number;
    recoverySamples: number;
    recoveryRatio: number;
    throttledRateScale: number;
}

const defaultOptions: BackpressureOptions = {
    maximumP95Milliseconds: 250,
    triggerSamples: 2,
    recoverySamples: 3,
    recoveryRatio: 0.8,
    throttledRateScale: 0.5,
};

export class BackpressureController {
    private overBudgetSamples = 0;
    private underBudgetSamples = 0;
    private level: BackpressureLevel = 'normal';

    constructor(private readonly options: BackpressureOptions = defaultOptions) {}

    evaluate(input: BackpressureInput): BackpressureState {
        if (input.decisionSamples === 0) return this.state();
        if (input.decisionP95Milliseconds > this.options.maximumP95Milliseconds) {
            return this.observeOverBudget(input.decisionP95Milliseconds);
        }
        return this.observeUnderBudget(input.decisionP95Milliseconds);
    }

    current(): BackpressureState {
        return this.state();
    }

    private observeOverBudget(p95Milliseconds: number): BackpressureState {
        this.underBudgetSamples = 0;
        this.overBudgetSamples += 1;
        if (this.overBudgetSamples >= this.options.triggerSamples) this.level = 'throttled';
        return this.state([
            `decision p95 ${Math.round(p95Milliseconds)}ms exceeds ${this.options.maximumP95Milliseconds}ms`,
        ]);
    }

    private observeUnderBudget(p95Milliseconds: number): BackpressureState {
        this.overBudgetSamples = 0;
        const recoveryThreshold = this.options.maximumP95Milliseconds * this.options.recoveryRatio;
        if (p95Milliseconds > recoveryThreshold) {
            this.underBudgetSamples = 0;
            return this.state();
        }
        this.underBudgetSamples += 1;
        if (this.underBudgetSamples >= this.options.recoverySamples) this.level = 'normal';
        return this.state();
    }

    private state(reasons: readonly string[] = []): BackpressureState {
        return {
            level: this.level,
            rateScale: this.level === 'throttled' ? this.options.throttledRateScale : 1,
            reasons,
        };
    }
}
