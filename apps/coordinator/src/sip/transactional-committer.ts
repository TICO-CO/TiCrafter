import type { Result } from '@ticrafter/core';
import { type StorageFailure, TransactionManager } from '@ticrafter/memory';

import type { CoordinatorDatabase } from '../core/index.js';
import { ContainerRegistry } from './container-registry.js';
import { SipDependencyValidator } from './dependency-validator.js';
import { FarmStore } from './farm-store.js';
import { SipMutationProposer } from './mutation-proposer.js';
import { PathGraphStore } from './path-graph-store.js';
import { SipRevisionManager } from './revision-manager.js';
import { RoadStore } from './road-store.js';
import { RulesStore } from './rules-store.js';
import { SipSnapshotRepository } from './snapshot-repository.js';
import { SpatialOverlapValidator } from './spatial-overlap-validator.js';
import { StructureStore } from './structure-store.js';
import type { SipCommit, SipFailure, SipProposal, SipProposalInput, SipSnapshot } from './types.js';
import { ZoneStore } from './zone-store.js';

export class SipTransactionalCommitter {
    private readonly repository: SipSnapshotRepository;
    private readonly transactions: TransactionManager;
    private readonly proposer = new SipMutationProposer();
    private readonly revisions: SipRevisionManager;
    private readonly spatial = new SpatialOverlapValidator();
    private readonly dependencies = new SipDependencyValidator();
    private readonly zones = new ZoneStore();
    private readonly structures = new StructureStore();
    private readonly roads = new RoadStore();
    private readonly farms = new FarmStore();
    private readonly containers = new ContainerRegistry();
    private readonly pathGraph = new PathGraphStore();
    private readonly rules = new RulesStore();

    constructor(
        database: CoordinatorDatabase,
        private readonly onCommitted?: (commit: SipCommit) => void,
    ) {
        this.repository = new SipSnapshotRepository(database);
        this.transactions = new TransactionManager(database);
        this.revisions = new SipRevisionManager(this.repository);
    }

    loadSnapshot(): Result<SipSnapshot, StorageFailure> {
        return this.repository.load();
    }

    commit(
        input: SipProposalInput,
        committedAt = new Date().toISOString(),
    ): Result<SipCommit, SipFailure> {
        const [proposal, proposeError] = this.proposer.propose(input);
        if (proposeError) return [null, { type: 'VALIDATION', failure: proposeError }];
        if (proposal === null) return [null, this.validationFailure('proposal returned null')];
        const [existing, existingError] = this.revisions.findExisting(
            proposal.metadata.idempotencyKey,
        );
        if (existingError) return [null, existingError];
        if (existing !== null) return [existing, null];
        const [snapshot, loadError] = this.repository.load();
        if (loadError) return [null, { type: 'STORAGE', failure: loadError }];
        if (snapshot === null) return [null, this.loadFailure()];
        return this.commitProposal(snapshot, proposal, committedAt);
    }

    private commitProposal(
        snapshot: SipSnapshot,
        proposal: SipProposal,
        committedAt: string,
    ): Result<SipCommit, SipFailure> {
        const [revision, revisionError] = this.revisions.allocate(
            snapshot,
            proposal.metadata.expectedRevision,
        );
        if (revisionError) return [null, revisionError];
        if (revision === null) return [null, this.validationFailure('revision returned null')];
        const candidate = this.applyMutations(snapshot, proposal);
        const [, spatialError] = this.spatial.validate(candidate, proposal);
        if (spatialError) return [null, { type: 'VALIDATION', failure: spatialError }];
        const [, dependencyError] = this.dependencies.validate(candidate);
        if (dependencyError) return [null, { type: 'VALIDATION', failure: dependencyError }];
        const commit: SipCommit = {
            revision,
            snapshot: { ...candidate, revision },
            metadata: proposal.metadata,
            committedAt,
        };
        const [, persistError] = this.persist(commit);
        if (persistError) return [null, persistError];
        this.onCommitted?.(commit);
        return [commit, null];
    }

    private applyMutations(snapshot: SipSnapshot, proposal: SipProposal): SipSnapshot {
        const afterZones = this.zones.apply(snapshot, proposal.mutations);
        const afterStructures = this.structures.apply(afterZones, proposal.mutations);
        const afterRoads = this.roads.apply(afterStructures, proposal.mutations);
        const afterFarms = this.farms.apply(afterRoads, proposal.mutations);
        const afterContainers = this.containers.apply(afterFarms, proposal.mutations);
        const afterPathGraph = this.pathGraph.apply(afterContainers, proposal.mutations);
        return this.rules.apply(afterPathGraph, proposal.mutations);
    }

    private persist(commit: SipCommit): Result<void, SipFailure> {
        const [result, transactionError] = this.transactions.run<Result<void, StorageFailure>>(
            () => {
                const [, writeError] = this.repository.write(commit.snapshot, commit.committedAt);
                if (writeError) return [null, writeError];
                const [, revisionError] = this.repository.appendRevision(commit);
                if (revisionError) return [null, revisionError];
                return [undefined, null];
            },
        );
        if (transactionError) return [null, { type: 'STORAGE', failure: transactionError }];
        if (result === null) return [null, this.loadFailure()];
        const [, writeError] = result;
        if (writeError) return [null, { type: 'STORAGE', failure: writeError }];
        return [undefined, null];
    }

    private validationFailure(message: string): SipFailure {
        return { type: 'VALIDATION', failure: { type: 'INVALID_PROPOSAL', message } };
    }

    private loadFailure(): SipFailure {
        return {
            type: 'STORAGE',
            failure: { type: 'READ_FAILED', message: 'SIP snapshot unavailable' },
        };
    }
}
