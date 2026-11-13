import {
    attempt,
    CHUNK_SNAPSHOT_EVENT,
    type ClockHandle,
    type ClockPort,
    type Envelope,
    EventStream,
    LANDMARK_CANDIDATE_EVENT,
    type LoggerPort,
    ProtocolEnvelope,
    type Result,
    SystemClock,
    type TransportFailure,
} from '@ticrafter/core';
import {
    ChunkSnapshotEncoder,
    type DetectionCandidate,
    DetectorPipeline,
    LandmarkCandidateEmitter,
    type RingSampler,
} from '@ticrafter/perception';

import type { PerceptionSource } from './perception-source.js';

export type PerceptionEventSink = (envelope: Envelope) => Result<void, TransportFailure>;

export interface PerceptionHostOptions {
    botId: string;
    source: PerceptionSource;
    sampler: RingSampler;
    events: EventStream;
    sink: PerceptionEventSink;
    logger: LoggerPort;
    ringRadius: number;
    intervalMilliseconds: number;
    maxChunksPerTick?: number;
    pipeline?: DetectorPipeline;
    clock?: ClockPort;
    onCandidates?: (candidates: readonly DetectionCandidate[]) => void;
}

export class PerceptionHost {
    private readonly encoder = new ChunkSnapshotEncoder();
    private readonly emitter: LandmarkCandidateEmitter;
    private readonly unsubscribe: Array<() => void> = [];
    private readonly clock: ClockPort;
    private timer: ClockHandle | null = null;

    constructor(private readonly options: PerceptionHostOptions) {
        this.clock = options.clock ?? new SystemClock();
        this.emitter = new LandmarkCandidateEmitter(
            options.pipeline ?? DetectorPipeline.withDefaults(),
            options.events,
        );
    }

    start(): void {
        if (this.timer !== null) return;
        this.unsubscribe.push(
            this.options.events.subscribe(CHUNK_SNAPSHOT_EVENT, (envelope) =>
                this.forward(envelope),
            ),
            this.options.events.subscribe(LANDMARK_CANDIDATE_EVENT, (envelope) =>
                this.forward(envelope),
            ),
        );
        this.timer = this.clock.setInterval(
            () => this.runTick(),
            this.options.intervalMilliseconds,
        );
    }

    stop(): void {
        if (this.timer !== null) {
            this.clock.clearInterval(this.timer);
            this.timer = null;
        }
        this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe());
    }

    tick(): Result<readonly DetectionCandidate[], string> {
        const [position, positionError] = attempt(() => this.options.source.position());
        if (positionError) return [null, this.describe(positionError)];
        if (position === null) return [[], null];

        const [loaded, sourceError] = attempt(() =>
            this.options.source.nextLoadedChunks(
                position,
                this.options.ringRadius,
                this.options.maxChunksPerTick ?? 1,
            ),
        );
        if (sourceError) return [null, this.describe(sourceError)];
        if (loaded === null || loaded.length === 0) return [[], null];

        const [sampled, sampleError] = this.options.sampler.sample({
            botId: this.options.botId,
            position,
            loadedChunks: loaded,
        });
        if (sampleError) return [null, `ring sampler: ${sampleError.type}`];
        const candidates: DetectionCandidate[] = [];
        for (const input of sampled ?? []) {
            const [snapshot, encodeError] = this.encoder.encode(input);
            if (encodeError || snapshot === null) {
                return [null, `snapshot encoder: ${encodeError?.type ?? 'null snapshot'}`];
            }
            const [, publishError] = this.options.events.publish(
                ProtocolEnvelope.create('event', CHUNK_SNAPSHOT_EVENT, snapshot),
            );
            if (publishError) return [null, `chunk snapshot publish: ${publishError.type}`];
            const [detected, emitError] = this.emitter.emit(snapshot);
            if (emitError) return [null, `landmark emitter: ${emitError.type}`];
            candidates.push(...(detected ?? []));
        }
        this.options.onCandidates?.(candidates);
        return [candidates, null];
    }

    private runTick(): void {
        const [, tickError] = this.tick();
        if (tickError) this.options.logger.warn({ error: tickError }, 'perception tick failed');
    }

    private forward(envelope: Envelope): void {
        const [, sinkError] = this.options.sink(envelope);
        if (sinkError) {
            this.options.logger.warn(
                { error: sinkError, type: envelope.type },
                'perception event send failed',
            );
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
