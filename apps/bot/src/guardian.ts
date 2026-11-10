import { type GuardianReport, ReflexGuardianLoop } from '@ticrafter/brains';
import type { ActionRequest, LoggerPort, Result } from '@ticrafter/core';
import {
    ActionVetoGate,
    ClaimLossEvaluator,
    EmergencyStopController,
    HazardEvaluator,
    HungerEvaluator,
    IncidentJournal,
    InventoryEvaluator,
    MobThreatEvaluator,
    RecoveryLadder,
    type SafetyDecision,
    type SafetyIncidentSink,
    SafetyPolicyEngine,
    StuckTimeoutEvaluator,
} from '@ticrafter/safety';

import type { SafetySnapshotSource } from './safety-snapshot.js';

export interface GuardianHookOptions {
    source: SafetySnapshotSource;
    logger: LoggerPort;
    intervalMilliseconds?: number;
    onCritical?: (report: GuardianReport) => void;
}

export class GuardianHook {
    private readonly emergencyStop = new EmergencyStopController();
    private readonly gate: ActionVetoGate;
    private readonly loop: ReflexGuardianLoop;
    private emergencyReported = false;

    constructor(private readonly options: GuardianHookOptions) {
        const journal = new IncidentJournal(this.sink());
        this.gate = new ActionVetoGate(new SafetyPolicyEngine(), this.emergencyStop);
        this.loop = new ReflexGuardianLoop(
            [
                new HazardEvaluator(),
                new MobThreatEvaluator(),
                new HungerEvaluator(),
                new StuckTimeoutEvaluator(),
                new InventoryEvaluator(),
                new ClaimLossEvaluator(),
            ],
            this.emergencyStop,
            journal,
            new RecoveryLadder(),
            options.source,
            {
                intervalMilliseconds: options.intervalMilliseconds ?? 50,
                onReport: (report) => this.report(report),
                onError: (error) => options.logger.warn({ error }, 'guardian tick failed'),
            },
        );
    }

    start(): Result<void, string> {
        return this.loop.start();
    }

    stop(): void {
        this.loop.stop();
    }

    evaluate(request: ActionRequest): SafetyDecision {
        const [snapshot, readError] = this.options.source.read();
        if (readError) {
            return {
                allowed: false,
                reason: readError,
                signals: [],
                recovery: { kind: 'safe-mode', reason: readError },
            };
        }
        if (snapshot === null) {
            return {
                allowed: false,
                reason: 'safety snapshot returned null',
                signals: [],
                recovery: { kind: 'safe-mode', reason: 'missing safety snapshot' },
            };
        }
        return this.gate.evaluate(snapshot, request);
    }

    clearEmergencyStop(): void {
        this.emergencyStop.clear();
        this.emergencyReported = false;
    }

    private report(report: GuardianReport): void {
        const critical = report.signals.some((signal) => signal.severity === 'critical');
        if (!critical && !report.emergencyStop) return;
        if (report.emergencyStop && !this.emergencyReported) {
            this.emergencyReported = true;
            this.options.logger.warn({ signals: report.signals }, 'guardian emergency stop');
        }
        this.options.onCritical?.(report);
    }

    private sink(): SafetyIncidentSink {
        return {
            record: (incident) => {
                this.options.logger.warn({ incident }, 'safety incident');
            },
        };
    }
}
