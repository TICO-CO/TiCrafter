import type { Result } from '@ticrafter/core';
import type { BoundingBox, IntendedStructure, Landmark } from '@ticrafter/worldmodel';

import type {
    SipProgressChange,
    SipReconciliationCommitterPort,
    SipReconciliationEventPort,
    SipReconciliationReport,
    SipReconciliationSnapshotPort,
    SipReconciliationWorldPort,
} from './reconciliation-types.js';
import type { SipSnapshot, SipStructure, SipWorkPackage } from './types.js';

export class SipReconciliationEngine {
    constructor(
        private readonly snapshot: SipReconciliationSnapshotPort,
        private readonly world: SipReconciliationWorldPort,
        private readonly committer: SipReconciliationCommitterPort,
        private readonly events: SipReconciliationEventPort,
    ) {}

    run(): Result<SipReconciliationReport, string> {
        const [snapshot, loadError] = this.snapshot.loadSnapshot();
        if (loadError) return [null, loadError];
        if (snapshot === null) return [null, 'SIP snapshot is unavailable'];
        const [findings, reconcileError] = this.world.reconcile(
            snapshot.structures.map((structure) => this.intended(structure)),
        );
        if (reconcileError) return [null, reconcileError];
        if (findings === null) return [null, 'SIP reconciliation returned null findings'];
        const [changes, progressError] = this.progressChanges(snapshot.structures);
        if (progressError) return [null, progressError];
        if (changes === null) return [null, 'SIP progress evaluation returned null'];
        const [revision, commitError] =
            changes.length === 0 ? [snapshot.revision, null] : this.commit(snapshot, changes);
        if (commitError) return [null, commitError];
        if (revision === null) return [null, 'SIP reconciliation revision is missing'];
        const report = {
            revision,
            structures: snapshot.structures.length,
            findings,
            progressChanges: changes,
        };
        if (findings.length > 0 || changes.length > 0) {
            const [, auditError] = this.record(report);
            if (auditError) return [null, auditError];
        }
        return [report, null];
    }

    private progressChanges(
        structures: readonly SipStructure[],
    ): Result<readonly SipProgressChange[], string> {
        const changes: SipProgressChange[] = [];
        for (const structure of structures) {
            const [progress, progressError] = this.progressFor(structure);
            if (progressError) return [null, progressError];
            if (progress === null) return [null, 'SIP structure progress is missing'];
            if (progress <= structure.progress) continue;
            changes.push({
                structureId: structure.id,
                previous: structure.progress,
                next: progress,
            });
        }
        return [changes, null];
    }

    private progressFor(structure: SipStructure): Result<number, string> {
        if (structure.workPackages.length === 0) return [structure.progress, null];
        const [landmarks, queryError] = this.world.intersecting(this.bbox(structure));
        if (queryError) return [null, queryError];
        if (landmarks === null) return [null, 'SIP observed landmarks are unavailable'];
        const covered = structure.workPackages.filter((workPackage) =>
            landmarks.some((landmark) => SipReconciliationEngine.overlaps(workPackage, landmark)),
        ).length;
        return [Math.max(structure.progress, covered / structure.workPackages.length), null];
    }

    private commit(
        snapshot: SipSnapshot,
        changes: readonly SipProgressChange[],
    ): Result<number, string> {
        const mutations = snapshot.structures.flatMap((structure) => {
            const change = changes.find((candidate) => candidate.structureId === structure.id);
            if (change === undefined) return [];
            return [
                {
                    kind: 'structure.upsert' as const,
                    structure: { ...structure, progress: change.next },
                },
            ];
        });
        return this.committer.commit({
            metadata: {
                actor: 'coordinator',
                expectedRevision: snapshot.revision,
                idempotencyKey: this.idempotencyKey(snapshot.revision, changes),
                fencingToken: 0,
                planId: null,
                grantId: null,
            },
            mutations,
        });
    }

    private record(report: SipReconciliationReport): Result<void, string> {
        const [, eventError] = this.events.append({
            type: 'sip.reconciliation',
            actor: 'coordinator',
            payload: report,
        });
        if (eventError) return [null, eventError.type];
        return [undefined, null];
    }

    private intended(structure: SipStructure): IntendedStructure {
        return {
            id: structure.id,
            bbox: this.bbox(structure),
            status: structure.status,
            planId: null,
        };
    }

    private bbox(structure: SipStructure): BoundingBox {
        if (structure.workPackages.length === 0) {
            return { min: structure.anchor, max: structure.anchor };
        }
        return structure.workPackages
            .map((workPackage) => workPackage.bbox)
            .reduce((current, bbox) => ({
                min: {
                    x: Math.min(current.min.x, bbox.min.x),
                    y: Math.min(current.min.y, bbox.min.y),
                    z: Math.min(current.min.z, bbox.min.z),
                },
                max: {
                    x: Math.max(current.max.x, bbox.max.x),
                    y: Math.max(current.max.y, bbox.max.y),
                    z: Math.max(current.max.z, bbox.max.z),
                },
            }));
    }

    private idempotencyKey(revision: number, changes: readonly SipProgressChange[]): string {
        const progress = changes.map((change) => `${change.structureId}=${change.next}`).join(',');
        return `reconcile:${revision}:${progress}`;
    }

    private static overlaps(workPackage: SipWorkPackage, landmark: Landmark): boolean {
        return (
            workPackage.bbox.min.x <= landmark.bbox.max.x &&
            workPackage.bbox.max.x >= landmark.bbox.min.x &&
            workPackage.bbox.min.y <= landmark.bbox.max.y &&
            workPackage.bbox.max.y >= landmark.bbox.min.y &&
            workPackage.bbox.min.z <= landmark.bbox.max.z &&
            workPackage.bbox.max.z >= landmark.bbox.min.z
        );
    }
}
