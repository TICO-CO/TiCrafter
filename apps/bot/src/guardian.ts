import {
    type GuardianReport,
    type GuardianSnapshotSource,
    ReflexGuardianLoop,
} from '@ticrafter/brains';
import {
    type ActionRequest,
    attempt,
    type ClockPort,
    type LoggerPort,
    type Result,
} from '@ticrafter/core';
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
    type SafetyEvaluator,
    type SafetyIncidentSink,
    SafetyPolicyEngine,
    type SafetySnapshot,
    StuckTimeoutEvaluator,
} from '@ticrafter/safety';

export interface GuardianHookOptions {
    source: GuardianSnapshotSource;
    logger: LoggerPort;
    intervalMilliseconds?: number;
    onCritical?: (report: GuardianReport) => void;
    incidentSink?: SafetyIncidentSink;
    emergencyStop?: EmergencyStopController;
    clock?: ClockPort;
}

export class GuardianHook {
    private readonly emergencyStop: EmergencyStopController;
    private readonly evaluators: readonly SafetyEvaluator[];
    private readonly recovery = new RecoveryLadder();
    private readonly journal: IncidentJournal;
    private readonly gate: ActionVetoGate;
    private readonly loop: ReflexGuardianLoop;
    private emergencyReported = false;
    private safeModeReported = false;
    private lastSnapshot: SafetySnapshot | null = null;

    constructor(private readonly options: GuardianHookOptions) {
        this.emergencyStop = options.emergencyStop ?? new EmergencyStopController();
        this.evaluators = [
            new HazardEvaluator(),
            new MobThreatEvaluator(),
            new HungerEvaluator(),
            new StuckTimeoutEvaluator(),
            new InventoryEvaluator(),
            new ClaimLossEvaluator(),
        ];
        this.journal = new IncidentJournal(this.sink());
        this.gate = new ActionVetoGate(
            new SafetyPolicyEngine(),
            this.emergencyStop,
            this.evaluators,
            this.recovery,
        );
        this.loop = new ReflexGuardianLoop(
            this.evaluators,
            this.emergencyStop,
            this.journal,
            this.recovery,
            options.source,
            {
                intervalMilliseconds: options.intervalMilliseconds ?? 50,
                ...(options.clock === undefined ? {} : { clock: options.clock }),
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

    triggerEmergencyStop(reason: string): void {
        this.emergencyStop.trigger(reason);
        this.options.logger.warn({ reason }, 'emergency stop triggered');
    }

    resumeSafety(): void {
        this.emergencyStop.resume();
        this.recovery.reset();
        this.loop.reset();
        this.journal.resetDeduplication();
        this.emergencyReported = false;
        this.safeModeReported = false;
        this.options.logger.info('safety resumed');
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
        this.lastSnapshot = snapshot;
        return this.gate.evaluate(snapshot, request);
    }

    recordVeto(request: ActionRequest, reason: string): void {
        const snapshot = this.vetoSnapshot();
        if (snapshot === null) {
            this.options.logger.warn({ request, reason }, 'action vetoed');
            return;
        }
        this.journal.recordVeto(snapshot, request, reason);
    }

    clearEmergencyStop(): void {
        this.emergencyStop.clear();
        this.emergencyReported = false;
    }

    get safeModeActive(): boolean {
        return this.recovery.safeModeActive;
    }

    get emergencyStopActive(): boolean {
        return this.emergencyStop.stopped;
    }

    private vetoSnapshot(): SafetySnapshot | null {
        if (this.lastSnapshot !== null) return this.lastSnapshot;
        const [snapshot, readError] = this.options.source.read();
        if (readError) return null;
        return snapshot;
    }

    private report(report: GuardianReport): void {
        const critical = report.signals.some((signal) => signal.severity === 'critical');
        if (report.safeMode && !this.safeModeReported) {
            this.safeModeReported = true;
            this.options.logger.warn(
                { signals: report.signals, reason: report.recovery.reason },
                'guardian safe mode',
            );
        }
        if (!report.safeMode) this.safeModeReported = false;
        if (report.emergencyStop && !this.emergencyReported) {
            this.emergencyReported = true;
            this.options.logger.warn({ signals: report.signals }, 'guardian emergency stop');
        }
        if (!critical && !report.emergencyStop && !report.safeMode) return;
        this.options.onCritical?.(report);
    }

    private sink(): SafetyIncidentSink {
        return {
            record: (incident) => {
                this.options.logger.warn({ incident }, 'safety incident');
                if (this.options.incidentSink === undefined) return;
                const [, sinkError] = attempt(() => this.options.incidentSink?.record(incident));
                if (sinkError) {
                    this.options.logger.warn(
                        { error: this.describe(sinkError) },
                        'safety incident sink failed',
                    );
                }
            },
        };
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
