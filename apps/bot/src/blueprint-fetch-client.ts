import { BlueprintDocumentHash } from '@ticrafter/building';
import {
    type BlueprintDocumentPayload,
    BOT_BLUEPRINT_GET,
    botBlueprintResponseSchema,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

export interface BlueprintRequestPort {
    request(
        type: string,
        payload: unknown,
        timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>>;
}

export class BlueprintFetchClient {
    private readonly cache = new Map<string, BlueprintDocumentPayload>();

    constructor(
        private readonly transport: BlueprintRequestPort,
        private readonly botId: string,
        private readonly timeoutMilliseconds = 5000,
    ) {}

    async fetch(
        blueprintId: string,
        revision: number,
    ): Promise<Result<BlueprintDocumentPayload, string>> {
        const key = BlueprintFetchClient.key(blueprintId, revision);
        const cached = this.cache.get(key);
        if (cached !== undefined) return [cached, null];
        const [envelope, requestError] = await this.transport.request(
            BOT_BLUEPRINT_GET,
            { botId: this.botId, blueprintId, revision },
            this.timeoutMilliseconds,
        );
        if (requestError) return [null, requestError.type];
        if (envelope === null) return [null, 'blueprint response missing'];
        const parsed = botBlueprintResponseSchema.safeParse(envelope.payload);
        if (!parsed.success) return [null, parsed.error.message];
        if (!parsed.data.ok) return [null, parsed.data.reason ?? 'blueprint fetch failed'];
        const document = parsed.data.document;
        if (document === null) return [null, 'blueprint document missing'];
        if (document.id !== blueprintId || document.revision !== revision) {
            return [null, 'blueprint response revision mismatch'];
        }
        const expectedHash = BlueprintDocumentHash.of({
            id: document.id,
            revision: document.revision,
            source: document.source,
            provenance: document.provenance,
            blueprint: document.blueprint,
        });
        if (expectedHash !== document.hash) return [null, 'blueprint response hash mismatch'];
        this.cache.set(key, document);
        return [document, null];
    }

    cached(blueprintId: string, revision: number): BlueprintDocumentPayload | null {
        return this.cache.get(BlueprintFetchClient.key(blueprintId, revision)) ?? null;
    }

    private static key(blueprintId: string, revision: number): string {
        return `${blueprintId}@${revision}`;
    }
}
