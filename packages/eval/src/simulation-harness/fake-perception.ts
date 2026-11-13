import type { DetectionCandidate, DetectorPort } from '@ticrafter/perception';
import { DetectorPipeline } from '@ticrafter/perception';

import type { FakeWorld } from './fake-world.js';

export class FakePerception {
    private readonly pipeline: DetectorPipeline;

    constructor(
        private readonly world: FakeWorld,
        private readonly botId = 'simulation',
        detectors?: readonly DetectorPort[],
    ) {
        this.pipeline =
            detectors === undefined
                ? DetectorPipeline.withDefaults()
                : new DetectorPipeline(detectors);
    }

    candidates(): readonly DetectionCandidate[] {
        const bounds = this.world.bounds();
        return this.pipeline.run({
            botId: this.botId,
            chunk: { x: 0, z: 0 },
            version: 1,
            observedAt: '1970-01-01T00:00:00.000Z',
            blocks: this.world.blocksInBox(bounds).map((block) => ({
                position: block.position,
                blockId: block.name,
                solid: true,
                properties: block.properties,
            })),
        });
    }
}
