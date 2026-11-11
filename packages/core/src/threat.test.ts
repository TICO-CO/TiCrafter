import { describe, expect, it } from 'bun:test';

import type { HostileThreatObservation } from './threat.js';
import { MobThreatRules } from './threat.js';

function hostile(overrides: Partial<HostileThreatObservation> = {}): HostileThreatObservation {
    return {
        name: 'zombie',
        position: { x: 0, y: 64, z: 0 },
        distance: 6,
        ranged: false,
        attackRange: 3,
        hasLineOfSight: false,
        ...overrides,
    };
}

describe('MobThreatRules', () => {
    it('classifies nearby melee hostiles', () => {
        expect(MobThreatRules.level(hostile({ distance: 4 }))).toBe('critical');
        expect(MobThreatRules.level(hostile({ distance: 8 }))).toBe('warning');
        expect(MobThreatRules.level(hostile({ distance: 9 }))).toBe('none');
    });

    it('classifies ranged hostiles by attack range and line of sight', () => {
        const skeleton = hostile({
            name: 'skeleton',
            distance: 14,
            ranged: true,
            attackRange: 15,
            hasLineOfSight: true,
        });
        expect(MobThreatRules.level(skeleton)).toBe('critical');
        expect(MobThreatRules.level({ ...skeleton, hasLineOfSight: false })).toBe('warning');
        expect(MobThreatRules.level({ ...skeleton, distance: 24 })).toBe('none');
    });
});
