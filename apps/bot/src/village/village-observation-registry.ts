import type { Vec3 } from '@ticrafter/core';
import {
    type VillageCandidate,
    type VillageObservation,
    VillageScanner,
    type VillageScannerOptions,
} from '@ticrafter/perception';

export class VillageObservationRegistry {
    private readonly scanner: VillageScanner;
    private candidates: readonly VillageCandidate[] = [];

    constructor(options: Partial<VillageScannerOptions> = {}) {
        this.scanner = new VillageScanner(options);
    }

    update(observation: VillageObservation): readonly VillageCandidate[] {
        this.candidates = this.scanner.scan(observation);
        return this.candidates;
    }

    list(): readonly VillageCandidate[] {
        return this.candidates;
    }

    clear(): void {
        this.candidates = [];
    }

    static observation(input: {
        villagers?: readonly Vec3[];
        beds?: readonly Vec3[];
        doors?: readonly Vec3[];
        workstations?: readonly Vec3[];
        farmland?: readonly Vec3[];
    }): VillageObservation {
        return {
            villagers: input.villagers ?? [],
            beds: input.beds ?? [],
            doors: input.doors ?? [],
            workstations: input.workstations ?? [],
            farmland: input.farmland ?? [],
        };
    }
}
