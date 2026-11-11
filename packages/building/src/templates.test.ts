import { describe, expect, it } from 'bun:test';

import { BuiltInTemplates } from './built-in-templates.js';
import { HouseTemplate } from './template-house.js';
import { TemplateInstantiator } from './template-instantiator.js';
import { TemplateRegistry } from './template-registry.js';

const TEMPLATE_TYPES = [
    'house',
    'road',
    'farm',
    'wall',
    'bridge',
    'storage',
    'watchtower',
] as const;

describe('building templates', () => {
    const [registry, registryError] = BuiltInTemplates.createRegistry();

    it('registers every built-in template', () => {
        expect(registryError).toBeNull();
        expect(registry?.types()).toEqual([...TEMPLATE_TYPES].sort());
    });

    it('instantiates deterministic valid blueprints', () => {
        if (registry === null) return;
        const instantiator = new TemplateInstantiator(registry);
        const blueprintIds = TEMPLATE_TYPES.map((templateType) => {
            const [blueprint, blueprintError] = instantiator.instantiate({
                type: templateType,
                anchor: { x: 10, y: 64, z: -5 },
                rotation: 90,
                size: { width: 3, depth: 3, height: 3, length: 3 },
            });
            expect(blueprintError).toBeNull();
            expect((blueprint?.blocks.length ?? 0) > 0).toBe(true);
            expect((blueprint?.materials.length ?? 0) > 0).toBe(true);
            const positions = new Set(
                blueprint?.blocks.map((block) => `${block.x},${block.y},${block.z}`),
            );
            expect(positions.size).toBe(blueprint?.blocks.length);
            return blueprint?.id;
        });
        expect(new Set(blueprintIds).size).toBe(TEMPLATE_TYPES.length);
    });

    it('includes required structural features', () => {
        if (registry === null) return;
        const instantiator = new TemplateInstantiator(registry);
        const house = instantiator.instantiate({
            type: 'house',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
            size: { width: 5, depth: 5, height: 4 },
        })[0];
        const houseStates = house?.blocks.map((block) => block.state.name) ?? [];
        expect(houseStates.includes('oak_door')).toBe(true);
        expect(houseStates.includes('glass')).toBe(true);
        expect(houseStates.includes('dark_oak_planks')).toBe(true);

        const farm = instantiator.instantiate({
            type: 'farm',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
        })[0];
        const water = farm?.blocks.filter((block) => block.state.name === 'water') ?? [];
        const crops = farm?.blocks.filter((block) => block.state.name === 'wheat') ?? [];
        expect(water).toHaveLength(1);
        expect(crops.length > 0).toBe(true);

        const storage = instantiator.instantiate({
            type: 'storage',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
        })[0];
        expect(storage?.blocks.some((block) => block.state.name === 'chest')).toBe(true);

        const tower = instantiator.instantiate({
            type: 'watchtower',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
        })[0];
        expect(tower?.blocks.some((block) => block.state.name === 'ladder')).toBe(true);
    });

    it('applies rotation around the anchor', () => {
        if (registry === null) return;
        const instantiator = new TemplateInstantiator(registry);
        const [blueprint, blueprintError] = instantiator.instantiate({
            type: 'road',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 90,
            size: { width: 1, length: 2 },
        });

        expect(blueprintError).toBeNull();
        expect(
            blueprint?.blocks.some((block) => block.x === 0 && block.y === 64 && block.z === 1),
        ).toBe(true);
    });

    it('rejects duplicate or unknown templates', () => {
        const duplicate = TemplateRegistry.create([new HouseTemplate(), new HouseTemplate()]);
        expect(duplicate[1]?.type).toBe('TEMPLATE_FAILED');

        if (registry === null) return;
        const instantiator = new TemplateInstantiator(registry);
        const unknown = instantiator.instantiate({
            type: 'castle',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
        });
        expect(unknown[1]?.type).toBe('UNKNOWN_TEMPLATE');
    });
});
