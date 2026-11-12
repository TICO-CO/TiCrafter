import {
    type ConstructionPlan,
    type ConstructionScaffold,
    type PlannedWorkPackage,
} from '@ticrafter/building';

export class ConstructionPackageManifest {
    static packages(plan: ConstructionPlan): readonly PlannedWorkPackage[] {
        const cleanup = ConstructionPackageManifest.cleanupPackage(plan);
        return cleanup === null ? plan.workPackages : [...plan.workPackages, cleanup];
    }

    private static cleanupPackage(plan: ConstructionPlan): PlannedWorkPackage | null {
        if (plan.scaffolds.length === 0) return null;
        const predecessors = plan.workPackages.map((workPackage) => workPackage.id);
        return {
            id: `${plan.id}:cleanup`,
            bbox: ConstructionPackageManifest.scaffoldBounds(plan.scaffolds),
            blockKeys: plan.scaffolds.map((scaffold) =>
                ConstructionPackageManifest.key(scaffold.position),
            ),
            strategy: plan.workPackages[0]?.strategy ?? 'layers',
            status: 'planned',
            phase: 'cleanup',
            materials: [],
            scaffoldPositions: plan.scaffolds.map((scaffold) => scaffold.position),
            predecessorIds: predecessors,
        };
    }

    private static scaffoldBounds(scaffolds: readonly ConstructionScaffold[]): {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    } {
        const first = scaffolds[0]?.position ?? { x: 0, y: 0, z: 0 };
        return scaffolds.reduce(
            (bounds, scaffold) => ({
                min: {
                    x: Math.min(bounds.min.x, scaffold.position.x),
                    y: Math.min(bounds.min.y, scaffold.position.y),
                    z: Math.min(bounds.min.z, scaffold.position.z),
                },
                max: {
                    x: Math.max(bounds.max.x, scaffold.position.x),
                    y: Math.max(bounds.max.y, scaffold.position.y),
                    z: Math.max(bounds.max.z, scaffold.position.z),
                },
            }),
            { min: { ...first }, max: { ...first } },
        );
    }

    private static key(position: { x: number; y: number; z: number }): string {
        return `${position.x},${position.y},${position.z}`;
    }
}
