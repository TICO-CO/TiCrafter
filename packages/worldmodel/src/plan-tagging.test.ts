import { describe, expect, it } from 'bun:test';

import { PlanTagging } from './plan-tagging.js';
import type { LandmarkCandidate, PlanTag } from './types.js';

const candidate: LandmarkCandidate = {
    id: '',
    type: 'house',
    bbox: {
        min: { x: 0, y: 64, z: 0 },
        max: { x: 4, y: 68, z: 4 },
    },
    anchors: [],
    confidence: 0.8,
    observedAt: '2026-11-10T12:00:00.000Z',
    evidence: {
        sourceBotId: 'bot.tibot1',
        observedAt: '2026-11-10T12:00:00.000Z',
        confidence: 0.8,
        reliability: 0.8,
        details: null,
    },
    planId: null,
};

const tag: PlanTag = {
    planId: 'structure.house.1',
    bbox: {
        min: { x: 0, y: 63, z: 0 },
        max: { x: 4, y: 68, z: 4 },
    },
    revision: 3,
};

describe('PlanTagging', () => {
    it('tags a candidate inside an active plan', () => {
        const tagging = new PlanTagging();
        expect(tagging.replace([tag], 3)[1]).toBeNull();

        expect(tagging.tag(candidate).planId).toBe(tag.planId);
    });

    it('tags a candidate fully inside a larger plan area', () => {
        const tagging = new PlanTagging();
        tagging.replace(
            [
                {
                    ...tag,
                    bbox: {
                        min: { x: -20, y: 60, z: -20 },
                        max: { x: 20, y: 80, z: 20 },
                    },
                },
            ],
            3,
        );

        expect(tagging.tag(candidate).planId).toBe(tag.planId);
    });

    it('leaves unrelated candidates untagged', () => {
        const tagging = new PlanTagging();
        tagging.replace([tag], 3);

        expect(
            tagging.tag({
                ...candidate,
                bbox: { min: { x: 20, y: 64, z: 20 }, max: { x: 24, y: 68, z: 24 } },
            }).planId,
        ).toBeNull();
    });

    it('ignores stale revisions', () => {
        const tagging = new PlanTagging();
        tagging.replace([tag], 3);
        tagging.replace([], 2);

        expect(tagging.active()).toHaveLength(1);
    });

    it('rejects invalid revisions', () => {
        const tagging = new PlanTagging();

        const [, error] = tagging.replace([], -1);

        expect(error?.type).toBe('INVALID_PLAN_TAG_REVISION');
    });
});
