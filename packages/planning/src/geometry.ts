import type {
    PlannerBoundingBox,
    PlannerPlan,
    PlannerPosition,
    PlannerSipMutation,
} from './plan-schema.js';

export class PlannerGeometry {
    static isValidBbox(bounds: PlannerBoundingBox): boolean {
        return (
            bounds.min.x <= bounds.max.x &&
            bounds.min.y <= bounds.max.y &&
            bounds.min.z <= bounds.max.z
        );
    }

    static single(position: PlannerPosition): PlannerBoundingBox {
        return { min: { ...position }, max: { ...position } };
    }

    static overlaps(left: PlannerBoundingBox, right: PlannerBoundingBox): boolean {
        return (
            left.min.x <= right.max.x &&
            left.max.x >= right.min.x &&
            left.min.y <= right.max.y &&
            left.max.y >= right.min.y &&
            left.min.z <= right.max.z &&
            left.max.z >= right.min.z
        );
    }

    static contains(bounds: PlannerBoundingBox, position: PlannerPosition): boolean {
        return (
            position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z
        );
    }

    static fromPositions(positions: readonly PlannerPosition[]): PlannerBoundingBox | null {
        if (positions.length === 0) return null;
        return positions.reduce<PlannerBoundingBox>(
            (bounds, position) => ({
                min: {
                    x: Math.min(bounds.min.x, position.x),
                    y: Math.min(bounds.min.y, position.y),
                    z: Math.min(bounds.min.z, position.z),
                },
                max: {
                    x: Math.max(bounds.max.x, position.x),
                    y: Math.max(bounds.max.y, position.y),
                    z: Math.max(bounds.max.z, position.z),
                },
            }),
            PlannerGeometry.single(positions[0] ?? { x: 0, y: 0, z: 0 }),
        );
    }

    static insidePolygon(position: PlannerPosition, polygon: readonly PlannerPosition[]): boolean {
        let inside = false;
        for (
            let currentIndex = 0, previousIndex = polygon.length - 1;
            currentIndex < polygon.length;
            previousIndex = currentIndex, currentIndex += 1
        ) {
            const current = polygon[currentIndex];
            const previous = polygon[previousIndex];
            if (current === undefined || previous === undefined) continue;
            const intersects =
                current.z > position.z !== previous.z > position.z &&
                position.x <
                    ((previous.x - current.x) * (position.z - current.z)) /
                        (previous.z - current.z) +
                        current.x;
            if (intersects) inside = !inside;
        }
        return inside;
    }

    static mutationBboxes(mutation: PlannerSipMutation): readonly PlannerBoundingBox[] {
        switch (mutation.kind) {
            case 'zone.upsert':
            case 'zone.remove':
            case 'path-graph.replace':
            case 'rules.replace':
                return [];
            case 'structure.upsert':
                return [
                    PlannerGeometry.single(mutation.structure.anchor),
                    ...mutation.structure.workPackages.map((workPackage) => workPackage.bbox),
                ];
            case 'structure.remove':
                return [];
            case 'road.upsert': {
                const bounds = PlannerGeometry.fromPositions(mutation.road.polyline);
                return bounds === null ? [] : [bounds];
            }
            case 'road.remove':
                return [];
            case 'farm.upsert':
                return mutation.farm.plots.map((plot) => plot.bbox);
            case 'farm.remove':
                return [];
            case 'container.upsert':
                return [PlannerGeometry.single(mutation.container.pos)];
            case 'container.remove':
                return [];
        }
    }

    static distance(left: PlannerPosition, right: PlannerPosition): number {
        return Math.max(
            Math.abs(left.x - right.x),
            Math.abs(left.y - right.y),
            Math.abs(left.z - right.z),
        );
    }

    static planPositions(plan: PlannerPlan): readonly PlannerPosition[] {
        const taskPositions = plan.tasks
            .map((task) => task.target)
            .filter((position): position is PlannerPosition => position !== null);
        const blueprintPositions = plan.blueprints.map((blueprint) => blueprint.anchor);
        return [...taskPositions, ...blueprintPositions];
    }
}
