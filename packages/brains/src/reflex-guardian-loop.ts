import { attempt, type Result } from '@ticrafter/core';
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
    safeMode: boolean;
}

export interface ReflexGuardianOptions {
    intervalMilliseconds: number;
    onReport?: (report: GuardianReport) => void;
    onError?: (error: string) => void;
}

export class ReflexGuardianLoop {
    private timer: ReturnType<typeof setInterval> | null = null;
    private lastSnapshot: SafetySnapshot | null = null;
    private readonly activeIncidentKeys = new Set<string>();

    constructor(
        private readonly evaluators: readonly SafetyEvaluator[],
        private readonly emergencyStop: { trigger(reason: string): void; get stopped(): boolean },
        private readonly journal: IncidentJournal,
        private readonly recoveryLadder: RecoveryLadder,
        private readonly source: GuardianSnapshotSource,
        private readonly options: ReflexGuardianOptions,
    ) {}

    tick(): Result<GuardianReport, string> {
        const [readResult, readFailure] = attempt<Result<SafetySnapshot, string>, unknown>(() =>
            this.source.read(),
        );
        if (readFailure) return this.failClosed(this.errorMessage(readFailure));
        if (readResult === null) return this.failClosed('safety snapshot read returned null');
        const [snapshot, readError] = readResult;
        if (readError) return this.failClosed(readError);
        if (snapshot === null) return this.failClosed('safety snapshot returned null');
        this.lastSnapshot = snapshot;
        const [signals, evaluatorError] = this.evaluate(snapshot);
        if (evaluatorError) {
            return this.failClosed(`safety evaluator failed: ${evaluatorError}`, snapshot);
        }
        if (signals === null) return this.failClosed('safety evaluator returned null', snapshot);
        const recovery = this.recoveryLadder.next(signals);
        this.recordCriticalIncidents(snapshot, signals, recovery);
        return [
            {
                at: snapshot.at,
                signals,
                recovery,
                emergencyStop: this.emergencyStop.stopped,
                safeMode: this.recoveryLadder.safeModeActive,
            },
            null,
        ];
    }

    reset(): void {
        this.recoveryLadder.reset();
        this.activeIncidentKeys.clear();
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

    private evaluate(snapshot: SafetySnapshot): Result<readonly SafetySignal[], string> {
        const signals: SafetySignal[] = [];
        for (const evaluator of this.evaluators) {
            const [evaluated, failure] = attempt<readonly SafetySignal[], unknown>(() =>
                evaluator.evaluate(snapshot),
            );
            if (failure) return [null, this.errorMessage(failure)];
            if (evaluated === null) return [null, 'safety evaluator returned null'];
            signals.push(...evaluated);
        }
        return [signals, null];
    }

    private recordCriticalIncidents(
        snapshot: SafetySnapshot,
        signals: readonly SafetySignal[],
        recovery: RecoveryStep,
    ): void {
        const criticalSignals = signals.filter((signal) => signal.severity === 'critical');
        if (criticalSignals.length === 0) {
            this.activeIncidentKeys.clear();
            return;
        }
        if (recovery.kind === 'emergency-stop') this.emergencyStop.trigger(recovery.reason);
        const currentKeys = new Set(criticalSignals.map((signal) => this.incidentKey(signal)));
        for (const key of this.activeIncidentKeys) {
            if (!currentKeys.has(key)) this.activeIncidentKeys.delete(key);
        }
        for (const signal of criticalSignals) {
            const key = this.incidentKey(signal);
            if (this.activeIncidentKeys.has(key)) continue;
            this.activeIncidentKeys.add(key);
            this.journal.record(snapshot, signal.code, signal.message);
        }
    }

    private failClosed(reason: string, snapshot?: SafetySnapshot): Result<GuardianReport, string> {
        this.emergencyStop.trigger(reason);
        const journalSnapshot = snapshot ?? this.lastSnapshot;
        if (journalSnapshot !== null) {
            this.journal.recordOnce(journalSnapshot, 'guardian.failure', reason);
        }
        return [null, reason];
    }

    private incidentKey(signal: SafetySignal): string {
        return `${signal.code}|${signal.message}`;
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
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
