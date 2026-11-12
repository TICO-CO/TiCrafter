import type {
    BlueprintDocument,
    ConstructionPlan,
    ConstructionPlanDocument,
} from '@ticrafter/building';
import { describe, expect, it } from 'bun:test';

import type { ConstructionPlanDocumentService } from './construction-plan-document-service.js';
import { ProjectRepairPlanner } from './project-repair-planner.js';

type CommitInput = Parameters<ConstructionPlanDocumentService['commit']>[0];

const now = '2026-11-12T10:00:00.000Z';
const bbox = { min: { x: 0, y: 64, z: 0 }, max: { x: 2, y: 66, z: 2 } };

const blueprint: BlueprintDocument = {
    id: 'blueprint.project.project-1',
    revision: 1,
    hash: 'blueprint-hash',
    source: 'composed',
    provenance: { createdBy: 'bot.tibot1', createdAt: now },
    blueprint: {
        id: 'blueprint.project.project-1',
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0,
        blocks: [{ x: 0, y: 64, z: 0, state: { name: 'stone' }, priority: 0 }],
        materials: [{ item: 'stone', count: 1 }],
        constraints: [],
    },
};

const basePlan: ConstructionPlan = {
    id: 'plan.structure.project.project-1',
    blueprintId: blueprint.id,
    anchor: { x: 0, y: 64, z: 0 },
    rotation: 0,
    translation: { x: 0, y: 0, z: 0 },
    site: {
        anchor: { x: 0, y: 64, z: 0 },
        translation: { x: 0, y: 0, z: 0 },
        rotation: 0,
        bounds: bbox,
        clearance: [],
        access: { kind: 'none', from: null, to: { x: 0, y: 64, z: 0 }, length: 0 },
        foundationMode: 'level',
        foundationFillDepth: 0,
        foundationCutDepth: 0,
        score: 1,
        rationale: [],
    },
    foundation: {
        mode: 'level',
        targetY: 64,
        maximumFillDepth: 0,
        changes: [],
        materials: [],
        rationale: [],
    },
    changes: [],
    order: [],
    dependencies: [],
    scaffolds: [],
    unreachable: [],
    phases: [],
    materials: [],
    workPackages: [],
};

const baseDocument: ConstructionPlanDocument = {
    id: basePlan.id,
    revision: 1,
    hash: 'base-hash',
    structureId: 'structure.project.project-1',
    blueprintId: blueprint.id,
    blueprintRevision: 1,
    purpose: 'build',
    createdAt: now,
    plan: basePlan,
};

describe('ProjectRepairPlanner', () => {
    it('commits a repair plan from the stored blueprint diff', () => {
        const planner = new ProjectRepairPlanner({
            world: { blockAt: () => ['air', null] },
            blueprints: { latest: () => [blueprint, null] },
            plans: {
                latest: () => [baseDocument, null],
                commit: (input: CommitInput) => [
                    {
                        ...baseDocument,
                        id: input.id,
                        revision: 2,
                        hash: 'repair-hash',
                        purpose: 'repair',
                        plan: input.plan,
                    },
                    null,
                ],
            },
        } as unknown as ConstructorParameters<typeof ProjectRepairPlanner>[0]);

        const [artifacts, error] = planner.prepare({
            projectId: 'project-1',
            structureId: 'structure.project.project-1',
            botId: 'bot.tibot1',
            anchor: basePlan.anchor,
            bbox,
        });

        expect(error).toBeNull();
        expect(artifacts?.plan.purpose).toBe('repair');
        expect(artifacts?.plan.plan.changes).toHaveLength(1);
        expect(artifacts?.plan.plan.changes[0]?.kind).toBe('place');
    });
});
