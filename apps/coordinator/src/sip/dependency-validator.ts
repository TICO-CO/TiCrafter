import type { Result } from '@ticrafter/core';

import { SipGeometry } from './geometry.js';
import type { SipSnapshot, SipValidationFailure } from './types.js';

export class SipDependencyValidator {
    validate(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const checks = [
            () => this.validateStructures(snapshot),
            () => this.validateRoads(snapshot),
            () => this.validateFarms(snapshot),
            () => this.validateContainers(snapshot),
            () => this.validatePathGraph(snapshot),
            () => this.validateRules(snapshot),
        ];
        for (const check of checks) {
            const [, failure] = check();
            if (failure) return [null, failure];
        }
        return [undefined, null];
    }

    private validateStructures(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const duplicateStructure = this.duplicateId(snapshot.structures);
        if (duplicateStructure !== null) {
            return this.duplicate('structure', duplicateStructure);
        }
        const workPackages = snapshot.structures.flatMap((structure) => structure.workPackages);
        const duplicateWorkPackage = this.duplicateId(workPackages);
        if (duplicateWorkPackage !== null) {
            return this.duplicate('work package', duplicateWorkPackage);
        }
        const invalidBbox = workPackages.find(
            (workPackage) => !SipGeometry.isValidBbox(workPackage.bbox),
        );
        if (invalidBbox !== undefined) {
            return this.invalidGeometry(`work package ${invalidBbox.id}`);
        }
        return [undefined, null];
    }

    private validateRoads(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const duplicateRoad = this.duplicateId(snapshot.roads);
        if (duplicateRoad !== null) return this.duplicate('road', duplicateRoad);
        const segments = snapshot.roads.flatMap((road) => road.segments);
        const duplicateSegment = this.duplicateId(segments);
        if (duplicateSegment !== null) return this.duplicate('road segment', duplicateSegment);
        return this.validateRoadSegments(snapshot);
    }

    private validateRoadSegments(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        for (const road of snapshot.roads) {
            const segment = road.segments.find(
                (candidate) =>
                    !this.containsPosition(road.polyline, candidate.from) ||
                    !this.containsPosition(road.polyline, candidate.to),
            );
            if (segment === undefined) continue;
            return [
                null,
                {
                    type: 'INVALID_REFERENCE',
                    message: `road segment ${segment.id} references a point outside road ${road.id}`,
                },
            ];
        }
        return [undefined, null];
    }

    private validateFarms(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const duplicateFarm = this.duplicateId(snapshot.farms);
        if (duplicateFarm !== null) return this.duplicate('farm', duplicateFarm);
        const plots = snapshot.farms.flatMap((farm) => farm.plots);
        const duplicatePlot = this.duplicateId(plots);
        if (duplicatePlot !== null) return this.duplicate('farm plot', duplicatePlot);
        const invalidPlot = plots.find((plot) => !SipGeometry.isValidBbox(plot.bbox));
        if (invalidPlot === undefined) return [undefined, null];
        return this.invalidGeometry(`farm plot ${invalidPlot.id}`);
    }

    private validateContainers(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const duplicateContainer = this.duplicateId(snapshot.containers);
        if (duplicateContainer === null) return [undefined, null];
        return this.duplicate('container', duplicateContainer);
    }

    private validatePathGraph(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const duplicateNode = this.duplicateId(snapshot.pathGraph.nodes);
        if (duplicateNode !== null) return this.duplicate('path node', duplicateNode);
        const duplicateEdge = this.duplicateId(snapshot.pathGraph.edges);
        if (duplicateEdge !== null) return this.duplicate('path edge', duplicateEdge);
        const nodeIds = new Set(snapshot.pathGraph.nodes.map((node) => node.id));
        const edge = snapshot.pathGraph.edges.find(
            (candidate) =>
                candidate.from === candidate.to ||
                !nodeIds.has(candidate.from) ||
                !nodeIds.has(candidate.to),
        );
        if (edge === undefined) return [undefined, null];
        return [
            null,
            {
                type: 'INVALID_REFERENCE',
                message: `path edge ${edge.id} references missing or identical nodes`,
            },
        ];
    }

    private validateRules(snapshot: SipSnapshot): Result<void, SipValidationFailure> {
        const invalidProtected = snapshot.rules.protectedBboxes.find(
            (bbox) => !SipGeometry.isValidBbox(bbox),
        );
        if (invalidProtected !== undefined) return this.invalidGeometry('protected bbox');
        const invalidEdit = snapshot.rules.allowedEdits.find(
            (edit) =>
                !SipGeometry.isValidBbox(edit.bbox) ||
                edit.botIds.length === 0 ||
                edit.operations.length === 0,
        );
        if (invalidEdit === undefined) return [undefined, null];
        return this.invalidGeometry('allowed edit');
    }

    private duplicateId(items: readonly { id: string }[]): string | null {
        const seen = new Set<string>();
        for (const item of items) {
            if (seen.has(item.id)) return item.id;
            seen.add(item.id);
        }
        return null;
    }

    private containsPosition(
        positions: readonly { x: number; y: number; z: number }[],
        position: { x: number; y: number; z: number },
    ): boolean {
        return positions.some(
            (candidate) =>
                candidate.x === position.x &&
                candidate.y === position.y &&
                candidate.z === position.z,
        );
    }

    private duplicate(label: string, id: string): Result<void, SipValidationFailure> {
        return [null, { type: 'DUPLICATE_ID', message: `duplicate ${label} id ${id}` }];
    }

    private invalidGeometry(label: string): Result<void, SipValidationFailure> {
        return [null, { type: 'INVALID_GEOMETRY', message: `${label} has invalid geometry` }];
    }
}
