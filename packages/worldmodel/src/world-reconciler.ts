import type { Result } from '@ticrafter/core';

import type { SpatialQueryEngine } from './spatial-query-engine.js';
import type { DeviationFinding, IntendedStructure, WorldFailure } from './types.js';

export class WorldReconciler {
    constructor(private readonly spatial: SpatialQueryEngine) {}

    reconcile(
        intended: readonly IntendedStructure[],
    ): Result<readonly DeviationFinding[], WorldFailure> {
        const findings: DeviationFinding[] = [];
        for (const structure of intended) {
            const [observed, queryError] = this.spatial.intersecting(structure.bbox);
            if (queryError) return [null, queryError];
            if (observed === null) {
                return [null, { type: 'STORAGE_FAILED', message: 'spatial query returned null' }];
            }
            if (observed.length === 0) {
                findings.push({
                    structureId: structure.id,
                    kind: 'missing',
                    bbox: structure.bbox,
                    observedLandmarkIds: [],
                });
                continue;
            }
            if (
                structure.planId !== null &&
                observed.every((landmark) => landmark.planId !== structure.planId)
            ) {
                findings.push({
                    structureId: structure.id,
                    kind: 'status-mismatch',
                    bbox: structure.bbox,
                    observedLandmarkIds: observed.map((landmark) => landmark.id),
                });
            }
        }
        return [findings, null];
    }
}
