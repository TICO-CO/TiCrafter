import { describe, expect, it } from 'bun:test';

import { PerceptionFilter } from './perception-filter.js';

const origin = { x: 0, y: 64, z: 0 };
const options = {
    focusRadius: 32,
    sightingTtlMilliseconds: 60_000,
    halfAngleRadians: Math.PI / 3,
};

describe('perception filter', () => {
    it('keeps candidates inside the view cone and line of sight', () => {
        const filter = new PerceptionFilter(options);
        const visible = filter.observe({
            origin,
            yaw: 0,
            now: 1000,
            candidates: [
                { kind: 'wood', position: { x: 0, y: 64, z: 8 } },
                { kind: 'wood', position: { x: 0, y: 64, z: -8 } },
                { kind: 'stone', position: { x: 0, y: 64, z: 4 } },
            ],
            lineOfSight: (position) => position.z > 0,
        });
        expect(visible).toHaveLength(2);
        expect(visible.some((sighting) => sighting.kind === 'stone')).toBe(true);
    });

    it('expires sightings after the ttl', () => {
        const filter = new PerceptionFilter(options);
        filter.observe({
            origin,
            yaw: 0,
            now: 1000,
            candidates: [{ kind: 'wood', position: { x: 0, y: 64, z: 8 } }],
            lineOfSight: () => true,
        });
        expect(filter.nearest(['wood'], origin, 61_001, 32)).toBeNull();
    });

    it('returns the nearest remembered sighting', () => {
        const filter = new PerceptionFilter(options);
        filter.observe({
            origin,
            yaw: 0,
            now: 1000,
            candidates: [
                { kind: 'wood', position: { x: 0, y: 64, z: 8 } },
                { kind: 'wood', position: { x: 0, y: 64, z: 4 } },
            ],
            lineOfSight: () => true,
        });
        const nearest = filter.nearest(['wood'], origin, 2000, 32);
        expect(nearest?.position.z).toBe(4);
    });
});
