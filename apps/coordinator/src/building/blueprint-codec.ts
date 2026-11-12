import {
    type Blueprint,
    type BlueprintDocument,
    BlueprintDocumentHash,
    type BlueprintProvenance,
    type BlueprintSource,
    BlueprintSources,
} from '@ticrafter/building';
import { attempt, type Result } from '@ticrafter/core';
import { type StorageFailure, StorageFailures } from '@ticrafter/memory';

export interface BlueprintDocumentRow {
    id: string;
    revision: number;
    hash: string;
    source: string;
    blueprint_json: string;
    provenance_json: string;
    created_at: string;
}

export class BlueprintDocumentCodec {
    static decode(row: BlueprintDocumentRow): Result<BlueprintDocument, StorageFailure> {
        if (!BlueprintSources.isSource(row.source)) {
            return [null, this.failure(`unknown blueprint source: ${row.source}`)];
        }
        const [content, parseError] = attempt<Omit<BlueprintDocument, 'hash'>, unknown>(() => ({
            id: row.id,
            revision: row.revision,
            source: row.source as BlueprintSource,
            provenance: JSON.parse(row.provenance_json) as BlueprintProvenance,
            blueprint: JSON.parse(row.blueprint_json) as Blueprint,
        }));
        if (parseError) return [null, this.failure(parseError)];
        if (content === null) return [null, this.failure('blueprint document missing')];
        const hash = BlueprintDocumentHash.of(content);
        if (hash !== row.hash) {
            return [
                null,
                this.failure(`blueprint ${row.id} revision ${row.revision} hash mismatch`),
            ];
        }
        return [{ ...content, hash: row.hash }, null];
    }

    static encodeBlueprint(blueprint: Blueprint): string {
        return JSON.stringify(blueprint);
    }

    static encodeProvenance(provenance: BlueprintProvenance): string {
        return JSON.stringify(provenance);
    }

    private static failure(error: unknown): StorageFailure {
        return StorageFailures.from('READ_FAILED', error);
    }
}
