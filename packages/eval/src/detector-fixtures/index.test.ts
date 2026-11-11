import { DetectorPipeline } from '@ticrafter/perception';
import { describe, expect, it } from 'bun:test';

import { DetectorFixtures } from './index.js';

describe('DetectorFixtures', () => {
    it('produces golden candidates for every detector', () => {
        const pipeline = DetectorPipeline.withDefaults();
        DetectorFixtures.cases().forEach((fixture) => {
            const candidates = pipeline.run(fixture.snapshot);
            const detected = new Set(candidates.map((candidate) => candidate.detectorId));
            fixture.expectedDetectorIds.forEach((detectorId) => {
                expect(detected.has(detectorId as never)).toBe(true);
            });
        });
    });
});
