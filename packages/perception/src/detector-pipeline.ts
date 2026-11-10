import type { ChunkSnapshot, DetectionCandidate, DetectorPort } from './types.js';

export class DetectorPipeline {
    constructor(private readonly detectors: readonly DetectorPort[]) {}

    run(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const candidates = new Map<string, DetectionCandidate>();
        this.detectors.forEach((detector) => {
            detector.detect(snapshot).forEach((candidate) => {
                const key = DetectorPipeline.key(candidate);
                const existing = candidates.get(key);
                if (existing === undefined || candidate.confidence > existing.confidence) {
                    candidates.set(key, candidate);
                }
            });
        });
        return [...candidates.values()];
    }

    private static key(candidate: DetectionCandidate): string {
        const { min, max } = candidate.bbox;
        return [candidate.type, min.x, min.y, min.z, max.x, max.y, max.z].join(':');
    }
}
