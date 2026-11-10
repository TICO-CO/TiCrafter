import { describe, expect, it } from 'bun:test';

import { DetectorPipeline } from './detector-pipeline.js';
import type { ChunkSnapshot, DetectionCandidate, DetectorId, DetectorPort } from './types.js';

class StubDetector implements DetectorPort {
    constructor(
        readonly id: DetectorId,
        private readonly candidates: readonly DetectionCandidate[],
    ) {}

    detect(): readonly DetectionCandidate[] {
        return this.candidates;
    }
}

const snapshot: ChunkSnapshot = {
    botId: 'bot.tibot1',
    chunk: { x: 0, z: 0 },
    version: 1,
    observedAt: '2026-11-10T12:00:00.000Z',
    blocks: [],
};

const pathCandidate: DetectionCandidate = {
    detectorId: 'path',
    type: 'path',
    bbox: {
        min: { x: 0, y: 63, z: 0 },
        max: { x: 9, y: 65, z: 0 },
    },
    anchors: [],
    confidence: 0.6,
    evidence: 'first detector',
};

describe('DetectorPipeline', () => {
    it('runs detectors and merges duplicate landmarks', () => {
        const pipeline = new DetectorPipeline([
            new StubDetector('path', [pathCandidate]),
            new StubDetector('linear-structure', [
                { ...pathCandidate, confidence: 0.8, evidence: 'higher confidence' },
            ]),
        ]);
        const candidates = pipeline.run(snapshot);

        expect(candidates).toHaveLength(1);
        expect(candidates[0]?.confidence).toBe(0.8);
        expect(candidates[0]?.evidence).toBe('higher confidence');
    });

    it('builds a pipeline with the default detector set', () => {
        const corridor = Array.from({ length: 10 }, (_, index) => ({
            position: { x: index, y: 64, z: 0 },
            blockId: 'stone',
            solid: true,
        }));
        const candidates = DetectorPipeline.withDefaults().run({ ...snapshot, blocks: corridor });

        expect(candidates.some((candidate) => candidate.type === 'path')).toBe(true);
    });

    it('keeps distinct landmarks', () => {
        const pipeline = new DetectorPipeline([
            new StubDetector('path', [pathCandidate]),
            new StubDetector('house', [
                {
                    ...pathCandidate,
                    detectorId: 'house',
                    type: 'house',
                    bbox: {
                        min: { x: 20, y: 63, z: 20 },
                        max: { x: 29, y: 70, z: 29 },
                    },
                },
            ]),
        ]);

        expect(pipeline.run(snapshot)).toHaveLength(2);
    });
});
