import { assertNever, type Result } from '@ticrafter/core';

import { SipGeometry } from './geometry.js';
import type {
    SipBoundingBox,
    SipMutation,
    SipProposal,
    SipSnapshot,
    SipStructure,
    SipValidationFailure,
} from './types.js';

interface SpatialTarget {
    id: string;
    label: string;
    bbox: SipBoundingBox | null;
    checkActiveStructures: boolean;
}

export class SpatialOverlapValidator {
    validate(snapshot: SipSnapshot, proposal: SipProposal): Result<void, SipValidationFailure> {
        for (const mutation of proposal.mutations) {
            const target = this.spatialTarget(mutation);
            if (target === null) continue;
            const [, targetError] = this.validateTarget(snapshot, proposal, target);
            if (targetError) return [null, targetError];
        }
        return [undefined, null];
    }

    private validateTarget(
        snapshot: SipSnapshot,
        proposal: SipProposal,
        target: SpatialTarget,
    ): Result<void, SipValidationFailure> {
        const targetBbox = target.bbox;
        if (targetBbox === null) {
            return [null, { type: 'INVALID_GEOMETRY', message: `${target.label} has no bbox` }];
        }
        if (!SipGeometry.isValidBbox(targetBbox)) {
            return [
                null,
                { type: 'INVALID_GEOMETRY', message: `${target.label} has an inverted bbox` },
            ];
        }
        const protectedOverlap = snapshot.rules.protectedBboxes.some((bbox) =>
            SipGeometry.overlaps(bbox, targetBbox),
        );
        if (protectedOverlap) {
            return [
                null,
                {
                    type: 'PROTECTED_REGION',
                    message: `${target.label} overlaps a protected region`,
                },
            ];
        }
        const noBuildOverlap = snapshot.zones.some(
            (zone) => zone.type === 'no_build' && this.zoneOverlaps(zone.polygon, targetBbox),
        );
        if (noBuildOverlap) {
            return [
                null,
                { type: 'NO_BUILD_ZONE', message: `${target.label} overlaps a no-build zone` },
            ];
        }
        if (!target.checkActiveStructures) return [undefined, null];
        return this.validateActiveStructures(snapshot, proposal, target, targetBbox);
    }

    private validateActiveStructures(
        snapshot: SipSnapshot,
        proposal: SipProposal,
        target: SpatialTarget,
        targetBbox: SipBoundingBox,
    ): Result<void, SipValidationFailure> {
        if (this.isAllowedEdit(snapshot, proposal.metadata.actor, targetBbox)) {
            return [undefined, null];
        }
        const collision = snapshot.structures.find(
            (structure) =>
                this.isActive(structure) &&
                structure.id !== target.id &&
                this.overlapsStructure(structure, targetBbox),
        );
        if (collision === undefined) return [undefined, null];
        return [
            null,
            {
                type: 'ACTIVE_STRUCTURE',
                message: `${target.label} overlaps active structure ${collision.id}`,
            },
        ];
    }

    private spatialTarget(mutation: SipMutation): SpatialTarget | null {
        switch (mutation.kind) {
            case 'structure.upsert':
                return {
                    id: mutation.structure.id,
                    label: `structure ${mutation.structure.id}`,
                    bbox: this.structureBbox(mutation.structure),
                    checkActiveStructures: true,
                };
            case 'road.upsert':
                return {
                    id: mutation.road.id,
                    label: `road ${mutation.road.id}`,
                    bbox: SipGeometry.bboxFromPositions(mutation.road.polyline),
                    checkActiveStructures: true,
                };
            case 'farm.upsert':
                return {
                    id: mutation.farm.id,
                    label: `farm ${mutation.farm.id}`,
                    bbox: SipGeometry.bboxFromBboxes(mutation.farm.plots.map((plot) => plot.bbox)),
                    checkActiveStructures: false,
                };
            case 'container.upsert':
                return {
                    id: mutation.container.id,
                    label: `container ${mutation.container.id}`,
                    bbox: SipGeometry.singleBlock(mutation.container.pos),
                    checkActiveStructures: false,
                };
            case 'zone.upsert':
            case 'zone.remove':
            case 'structure.remove':
            case 'road.remove':
            case 'farm.remove':
            case 'container.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return null;
            default:
                return assertNever(mutation);
        }
    }

    private structureBbox(structure: SipStructure): SipBoundingBox | null {
        const boxes = structure.workPackages.map((workPackage) => workPackage.bbox);
        return SipGeometry.bboxFromBboxes([SipGeometry.singleBlock(structure.anchor), ...boxes]);
    }

    private overlapsStructure(structure: SipStructure, bbox: SipBoundingBox): boolean {
        const structureBbox = this.structureBbox(structure);
        if (structureBbox !== null && SipGeometry.overlaps(structureBbox, bbox)) return true;
        return structure.workPackages.some((workPackage) =>
            SipGeometry.overlaps(workPackage.bbox, bbox),
        );
    }

    private zoneOverlaps(
        polygon: readonly { x: number; y: number; z: number }[],
        bbox: SipBoundingBox,
    ): boolean {
        const zoneBbox = SipGeometry.bboxFromPositions(polygon);
        if (zoneBbox === null) return false;
        return SipGeometry.overlaps(zoneBbox, bbox);
    }

    private isActive(structure: SipStructure): boolean {
        return structure.status === 'claimed' || structure.status === 'building';
    }

    private isAllowedEdit(snapshot: SipSnapshot, actor: string, bbox: SipBoundingBox): boolean {
        return snapshot.rules.allowedEdits.some(
            (edit) =>
                edit.operations.length > 0 &&
                edit.botIds.includes(actor) &&
                SipGeometry.contains(edit.bbox, bbox),
        );
    }
}
