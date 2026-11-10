import type { Result } from '@ticrafter/core';
import type {
    IncidentJournal,
    RecoveryLadder,
    RecoveryStep,
    SafetyEvaluator,
    SafetySignal,
    SafetySnapshot,
} from '@ticrafter/safety';

export interface GuardianSnapshotSource {
    read(): Result<SafetySnapshot, string>;
}

export interface GuardianReport {
    at: string;
    signals: readonly SafetySignal[];
    recovery: RecoveryStep;
    emergencyStop: boolean;
}

export interface ReflexGuardianOptions {
    intervalMilliseconds: number;
    onReport?: (report: GuardianReport) => void;
    onError?: (error: string) => void;
}

export class ReflexGuardianLoop {
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly evaluators: readonly SafetyEvaluator[],
        private readonly emergencyStop: { trigger(reason: string): void; get stopped(): boolean },
        private readonly journal: IncidentJournal,
        private readonly recoveryLadder: RecoveryLadder,
        private readonly source: GuardianSnapshotSource,
        private readonly options: ReflexGuardianOptions,
    ) {}

    tick(): Result<GuardianReport, string> {
        const [snapshot, readError] = this.source.read();
        if (readError) return [null, readError];
        if (snapshot === null) return [null, 'safety snapshot returned null'];
        const signals = this.evaluators.flatMap((evaluator) => evaluator.evaluate(snapshot));
        const recovery = this.recoveryLadder.next(signals);
        const critical = signals.find((signal) => signal.severity === 'critical');
        if (critical && recovery.kind === 'emergency-stop') {
            this.emergencyStop.trigger(critical.message);
            this.journal.record(snapshot, critical.code, critical.message);
        }
        return [
            {
                at: snapshot.at,
                signals,
                recovery,
                emergencyStop: this.emergencyStop.stopped,
            },
            null,
        ];
    }

    start(): Result<void, string> {
        if (this.timer !== null) return [null, 'guardian already running'];
        this.timer = setInterval(() => this.runTick(), this.options.intervalMilliseconds);
        return [undefined, null];
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    get running(): boolean {
        return this.timer !== null;
    }

    private runTick(): void {
        const [report, error] = this.tick();
        if (error) {
            this.options.onError?.(error);
            return;
        }
        if (report === null) return;
        this.options.onReport?.(report);
    }
}
