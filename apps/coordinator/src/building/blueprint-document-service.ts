import {
    type Blueprint,
    type BlueprintDocument,
    BlueprintDocumentHash,
    type BlueprintProvenance,
    type BlueprintSource,
    BlueprintSources,
    BlueprintValidator,
    type BuildingFailure,
} from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

import {
    type BlueprintDocumentFailure,
    BlueprintDocumentFailures,
} from './blueprint-document-failures.js';
import type { BlueprintDocumentRepository } from './blueprint-repository.js';

export interface CommitBlueprintInput {
    id: string;
    source: BlueprintSource;
    provenance: Omit<BlueprintProvenance, 'createdAt'>;
    blueprint: Blueprint;
}

export interface BlueprintDocumentServiceOptions {
    documents: BlueprintDocumentRepository;
    now?: () => string;
}

export class BlueprintDocumentService {
    private readonly now: () => string;

    constructor(private readonly options: BlueprintDocumentServiceOptions) {
        this.now = options.now ?? (() => new Date().toISOString());
    }

    commit(input: CommitBlueprintInput): Result<BlueprintDocument, BlueprintDocumentFailure> {
        if (input.id.trim().length === 0) {
            return [null, BlueprintDocumentFailures.invalidId('blueprint id is empty')];
        }
        if (!BlueprintSources.isSource(input.source)) {
            return [
                null,
                BlueprintDocumentFailures.invalidSource(`unknown source: ${input.source}`),
            ];
        }
        const [, validationError] = BlueprintValidator.validate(input.blueprint);
        if (validationError) {
            return [null, BlueprintDocumentFailures.invalidBlueprint(validationError)];
        }
        const [latest, latestError] = this.options.documents.getLatest(input.id);
        if (latestError) return [null, BlueprintDocumentFailures.storage(latestError)];
        const revision = (latest?.revision ?? 0) + 1;
        const content = {
            id: input.id,
            revision,
            source: input.source,
            provenance: { ...input.provenance, createdAt: this.now() },
            blueprint: input.blueprint,
        };
        const document: BlueprintDocument = {
            ...content,
            hash: BlueprintDocumentHash.of(content),
        };
        const [, writeError] = this.options.documents.insert(document);
        if (writeError) return [null, BlueprintDocumentFailures.storage(writeError)];
        return [document, null];
    }

    get(id: string, revision: number): Result<BlueprintDocument | null, BlueprintDocumentFailure> {
        const [document, readError] = this.options.documents.get(id, revision);
        if (readError) return [null, BlueprintDocumentFailures.storage(readError)];
        return [document, null];
    }

    latest(id: string): Result<BlueprintDocument | null, BlueprintDocumentFailure> {
        const [document, readError] = this.options.documents.getLatest(id);
        if (readError) return [null, BlueprintDocumentFailures.storage(readError)];
        return [document, null];
    }

    list(id: string): Result<readonly BlueprintDocument[], BlueprintDocumentFailure> {
        const [documents, readError] = this.options.documents.list(id);
        if (readError) return [null, BlueprintDocumentFailures.storage(readError)];
        return [documents, null];
    }
}
