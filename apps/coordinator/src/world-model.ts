import type {
    ChunkSnapshotMessage,
    LandmarkCandidateMessage,
    LoggerPort,
    Result,
} from '@ticrafter/core';
import { WorldStore } from '@ticrafter/memory';
import {
    type BlockPosition,
    type BlockUpdateObservation,
    type BoundingBox,
    type ChunkBlockObservation,
    ConfidenceDecay,
    ContainerMemory,
    type ContainerObservation,
    type DecayedLandmark,
    DetectorResultIntegrator,
    type DeviationFinding,
    type IntendedStructure,
    type Landmark,
    type LandmarkCandidate,
    LandmarkDecayService,
    LandmarkRegistry,
    type LandmarkType,
    MergeConflictResolver,
    type NearestLandmark,
    ObservationIngestor,
    type PlanTag,
    PlanTagging,
    SparseOccupancyGrid,
    SpatialQueryEngine,
    SqliteChunkStore,
    SqliteContainerObservationStore,
    SqliteLandmarkStore,
    type WorldFailure,
    WorldReconciler,
} from '@ticrafter/worldmodel';

import type { CoordinatorDatabase } from './core/index.js';

const dayMilliseconds = 24 * 60 * 60 * 1000;

export class CoordinatorWorldModel {
    private readonly chunks: ObservationIngestor;
    private readonly landmarks: LandmarkRegistry;
    private readonly integrator: DetectorResultIntegrator;
    private readonly planTagging = new PlanTagging();
    private readonly containers: ContainerMemory;
    private readonly occupancy: SparseOccupancyGrid;
    private readonly spatial: SpatialQueryEngine;
    private readonly decay: LandmarkDecayService;
    private readonly reconciler: WorldReconciler;

    constructor(
        database: CoordinatorDatabase,
        private readonly logger: LoggerPort,
    ) {
        const store = new WorldStore(database);
        const chunkStore = new SqliteChunkStore(store);
        const landmarkStore = new SqliteLandmarkStore(store);
        const confidenceDecay = new ConfidenceDecay({
            halfLifeMilliseconds: dayMilliseconds,
            verificationThreshold: 0.3,
        });
        this.chunks = new ObservationIngestor(chunkStore);
        this.occupancy = new SparseOccupancyGrid(chunkStore);
        this.landmarks = new LandmarkRegistry(
            landmarkStore,
            new MergeConflictResolver(confidenceDecay),
        );
        this.integrator = new DetectorResultIntegrator(this.landmarks, this.planTagging);
        this.containers = new ContainerMemory(new SqliteContainerObservationStore(store));
        this.spatial = new SpatialQueryEngine(this.landmarks, {
            occupancy: this.occupancy,
            containers: this.containers,
        });
        this.decay = new LandmarkDecayService(landmarkStore, confidenceDecay);
        this.reconciler = new WorldReconciler(this.spatial);
    }

    ingestChunk(payload: ChunkSnapshotMessage): Result<void, string> {
        const [result, ingestError] = this.chunks.ingest({
            botId: payload.botId,
            chunk: payload.chunk,
            version: payload.version,
            observedAt: payload.observedAt,
            blocks: payload.blocks,
        });
        if (ingestError) return [null, CoordinatorWorldModel.failure(ingestError)];
        if (result !== null) {
            if (result.outcome === 'stored') {
                this.occupancy.replaceChunk(payload.chunk, payload.blocks);
            }
            this.logger.debug(
                { chunk: result.chunk, version: result.version, outcome: result.outcome },
                'chunk observation ingested',
            );
        }
        return [undefined, null];
    }

    ingestLandmark(payload: LandmarkCandidateMessage): Result<void, string> {
        const candidate: LandmarkCandidate = {
            id: '',
            type: payload.candidate.type,
            bbox: payload.candidate.bbox,
            anchors: payload.candidate.anchors,
            confidence: payload.candidate.confidence,
            observedAt: payload.observedAt,
            evidence: {
                sourceBotId: payload.botId,
                observedAt: payload.observedAt,
                confidence: payload.candidate.confidence,
                reliability: payload.candidate.confidence,
                details: payload.candidate.evidence,
            },
            planId: null,
        };
        const [result, ingestError] = this.integrator.integrate(candidate);
        if (ingestError) return [null, CoordinatorWorldModel.failure(ingestError)];
        if (result !== null) {
            this.recordContainers(payload, result.landmark.id);
            this.logger.debug(
                { landmarkId: result.landmark.id, outcome: result.outcome },
                'landmark candidate ingested',
            );
        }
        return [undefined, null];
    }

    ingestBlockUpdate(payload: BlockUpdateObservation): Result<void, string> {
        const [result, ingestError] = this.chunks.applyBlockUpdate(payload);
        if (ingestError) return [null, CoordinatorWorldModel.failure(ingestError)];
        if (result !== null) {
            this.occupancy.applyBlock(payload.block);
            this.logger.debug(
                { chunk: result.chunk, version: result.version },
                'block update ingested',
            );
        }
        return [undefined, null];
    }

    applyDecay(observedAt: string): Result<readonly DecayedLandmark[], string> {
        const [results, decayError] = this.decay.apply(observedAt);
        if (decayError) return [null, CoordinatorWorldModel.failure(decayError)];
        return [results, null];
    }

    replacePlanTags(tags: readonly PlanTag[], revision: number): Result<void, string> {
        const [, tagError] = this.planTagging.replace(tags, revision);
        if (tagError) return [null, CoordinatorWorldModel.failure(tagError)];
        return [undefined, null];
    }

    reconcile(intended: readonly IntendedStructure[]): Result<readonly DeviationFinding[], string> {
        const [findings, reconcileError] = this.reconciler.reconcile(intended);
        if (reconcileError) return [null, CoordinatorWorldModel.failure(reconcileError)];
        return [findings, null];
    }

    listLandmarks(): Result<readonly Landmark[], string> {
        const [landmarks, listError] = this.landmarks.list();
        if (listError) return [null, CoordinatorWorldModel.failure(listError)];
        return [landmarks, null];
    }

    listContainers(): Result<readonly ContainerObservation[], string> {
        const [containers, listError] = this.containers.list();
        if (listError) return [null, CoordinatorWorldModel.failure(listError)];
        return [containers, null];
    }

    nearest(
        position: BlockPosition,
        type: LandmarkType | null = null,
    ): Result<NearestLandmark | null, WorldFailure> {
        return this.spatial.nearest(position, type);
    }

    intersecting(
        bbox: BoundingBox,
        type: LandmarkType | null = null,
    ): Result<readonly Landmark[], WorldFailure> {
        return this.spatial.intersecting(bbox, type);
    }

    blockAt(position: BlockPosition): Result<ChunkBlockObservation | null, WorldFailure> {
        return this.spatial.blockAt(position);
    }

    blocksInBox(bounds: BoundingBox): Result<readonly ChunkBlockObservation[], WorldFailure> {
        return this.occupancy.blocksInBox(bounds);
    }

    containerAt(position: BlockPosition): Result<ContainerObservation | null, WorldFailure> {
        return this.spatial.containerAt(position);
    }

    insideBase(position: BlockPosition): Result<boolean, WorldFailure> {
        return this.spatial.insideBase(position);
    }

    route(
        from: BlockPosition,
        to: BlockPosition,
    ): Result<readonly BlockPosition[] | null, WorldFailure> {
        return this.spatial.route(from, to);
    }

    isProtected(position: BlockPosition): Result<boolean, WorldFailure> {
        return this.spatial.isProtected(position);
    }

    whoOwns(bbox: BoundingBox): Result<readonly string[], WorldFailure> {
        return this.spatial.whoOwns(bbox);
    }

    private recordContainers(payload: LandmarkCandidateMessage, landmarkId: string): void {
        if (payload.candidate.type !== 'storage') {
            return;
        }
        payload.candidate.anchors.forEach((anchor) => {
            const observation: ContainerObservation = {
                id: `${landmarkId}:${anchor.name}`,
                position: anchor.position,
                role: 'storage',
                contents: null,
                observedAt: payload.observedAt,
                confidence: payload.candidate.confidence,
            };
            const [, recordError] = this.containers.record(observation);
            if (recordError) {
                this.logger.warn(
                    { error: recordError, containerId: observation.id },
                    'container observation rejected',
                );
            }
        });
    }

    private static failure(failure: WorldFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }
}
