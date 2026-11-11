import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { SkillRegistry } from './registry.js';
import { SkillCatalog } from './skill-catalog.js';
import type { Skill } from './types.js';

const EXPECTED_SKILLS = [
    'bridge',
    'clear',
    'collect',
    'craft',
    'deposit',
    'eat',
    'explore',
    'flee-defend',
    'follow-path',
    'harvest-farm',
    'mine',
    'navigate',
    'place-build',
    'plant-farm',
    'repair',
    'schematic-build',
    'sleep',
    'smelt',
    'withdraw',
] as const;

describe('skill catalog', () => {
    it('registers every v1 skill', () => {
        const [registry, registryError] = SkillCatalog.createRegistry();
        expect(registryError).toBeNull();
        expect(
            registry
                ?.list()
                .map((skill) => skill.id)
                .sort(),
        ).toEqual([...EXPECTED_SKILLS]);
    });

    it('rejects duplicate and malformed skills', () => {
        const registry = new SkillRegistry();
        const skill = {
            id: 'broken',
            canRun: () => [true, null] as Result<boolean, string>,
        } as unknown as Skill;
        const [missing, missingError] = registry.register(skill);
        expect(missing).toBeNull();
        expect(String(missingError).includes('missing plan')).toBe(true);

        const [registered] = SkillCatalog.createRegistry();
        const navigate = registered?.list().find((candidate) => candidate.id === 'navigate');
        expect(navigate !== undefined).toBe(true);
        if (navigate === undefined) return;
        const duplicateRegistry = new SkillRegistry();
        duplicateRegistry.register(navigate);
        const [, duplicateError] = duplicateRegistry.register(navigate);
        expect(String(duplicateError).includes('duplicate skill navigate')).toBe(true);
    });
});
