import type { BuildingFailure } from '@ticrafter/building';
import type { StorageFailure } from '@ticrafter/memory';

export type BlueprintDocumentFailure =
    | { type: 'INVALID_ID'; message: string }
    | { type: 'INVALID_SOURCE'; message: string }
    | { type: 'INVALID_BLUEPRINT'; failure: BuildingFailure }
    | { type: 'STORAGE'; failure: StorageFailure };

export class BlueprintDocumentFailures {
    static invalidId(message: string): BlueprintDocumentFailure {
        return { type: 'INVALID_ID', message };
    }

    static invalidSource(message: string): BlueprintDocumentFailure {
        return { type: 'INVALID_SOURCE', message };
    }

    static invalidBlueprint(failure: BuildingFailure): BlueprintDocumentFailure {
        return { type: 'INVALID_BLUEPRINT', failure };
    }

    static storage(failure: StorageFailure): BlueprintDocumentFailure {
        return { type: 'STORAGE', failure };
    }
}
