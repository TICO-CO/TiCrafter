import type { Vec3 } from '@ticrafter/core';
import type { SkillBBox, SkillBlock, SkillBlockState } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { BuildingSkillServices, type BuildingWorldView } from './building-services.js';

class EmptyWorld implements BuildingWorldView {
    blockStateAt(): SkillBlockState | null {
        return null;
    }

    blocksInBox(): readonly SkillBlock[] {
        return [];
    }
}

const MISSING_DIRECTORY = `/tmp/opencode/ticrafter-building-services-${crypto.randomUUID()}`;
const ANCHOR: Vec3 = { x: 0, y: 64, z: 0 };

describe('BuildingSkillServices', () => {
    it('serves template blueprints through the skill adapters', async () => {
        const [services, servicesError] = await BuildingSkillServices.create(
            MISSING_DIRECTORY,
            new EmptyWorld(),
        );

        expect(servicesError).toBeNull();
        if (services === null) return;
        const [targets, targetError] = services.schematics.prepare({
            id: 'template:house',
            anchor: ANCHOR,
        });
        expect(targetError).toBeNull();
        expect((targets?.length ?? 0) > 0).toBe(true);
        expect(targets?.some((target) => target.itemName === 'oak_door')).toBe(true);

        const [blueprintTargets, blueprintError] = services.blueprints.targets({
            schematic: { id: 'template:farm', anchor: ANCHOR },
        });
        expect(blueprintError).toBeNull();
        expect((blueprintTargets?.length ?? 0) > 0).toBe(true);
    });

    it('computes repair diffs from templates', async () => {
        const [services, servicesError] = await BuildingSkillServices.create(
            MISSING_DIRECTORY,
            new EmptyWorld(),
        );

        expect(servicesError).toBeNull();
        if (services === null) return;
        const [diff, diffError] = services.repairDiff.diff({
            schematic: { id: 'template:storage', anchor: ANCHOR },
        });
        expect(diffError).toBeNull();
        expect((diff?.missing.length ?? 0) > 0).toBe(true);
        expect(diff?.extra).toHaveLength(0);
    });

    it('fails closed for unknown blueprints and missing references', async () => {
        const [services, servicesError] = await BuildingSkillServices.create(
            MISSING_DIRECTORY,
            new EmptyWorld(),
        );

        expect(servicesError).toBeNull();
        if (services === null) return;
        const [targets, targetError] = services.schematics.prepare({
            id: 'missing-schematic',
            anchor: ANCHOR,
        });
        expect(targets).toBeNull();
        expect(targetError).toBe('unknown blueprint missing-schematic');

        const [missingReference, referenceError] = services.blueprints.targets({});
        expect(missingReference).toBeNull();
        expect(referenceError).toBe('blueprint source requires a schematic reference');
    });
});
