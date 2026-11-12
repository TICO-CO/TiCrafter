import { ConstructionPlanDocumentHash } from '@ticrafter/building';
import {
    BOT_CONSTRUCTION_PLAN_GET,
    botConstructionPlanResponseSchema,
    type ConstructionPlanDocumentPayload,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { BlueprintRequestPort } from './blueprint-fetch-client.js';

export class ConstructionPlanFetchClient {
    private readonly cache = new Map<string, ConstructionPlanDocumentPayload>();

    constructor(
        private readonly transport: BlueprintRequestPort,
        private readonly botId: string,
        private readonly timeoutMilliseconds = 5000,
    ) {}

    async fetch(
        planId: string,
        revision: number,
    ): Promise<Result<ConstructionPlanDocumentPayload, string>> {
        const key = ConstructionPlanFetchClient.key(planId, revision);
        const cached = this.cache.get(key);
        if (cached !== undefined) return [cached, null];
        const [envelope, requestError] = await this.transport.request(
            BOT_CONSTRUCTION_PLAN_GET,
            { botId: this.botId, planId, revision },
            this.timeoutMilliseconds,
        );
        if (requestError) return [null, requestError.type];
        if (envelope === null) return [null, 'construction plan response missing'];
        const parsed = botConstructionPlanResponseSchema.safeParse(envelope.payload);
        if (!parsed.success) return [null, parsed.error.message];
        if (!parsed.data.ok) return [null, parsed.data.reason ?? 'construction plan fetch failed'];
        const document = parsed.data.document;
        if (document === null) return [null, 'construction plan document missing'];
        if (document.id !== planId || document.revision !== revision) {
            return [null, 'construction plan response revision mismatch'];
        }
        const expectedHash = ConstructionPlanDocumentHash.of({
            id: document.id,
            revision: document.revision,
            structureId: document.structureId,
            blueprintId: document.blueprintId,
            blueprintRevision: document.blueprintRevision,
            plan: document.plan,
            createdAt: document.createdAt,
        });
        if (expectedHash !== document.hash) {
            return [null, 'construction plan response hash mismatch'];
        }
        this.cache.set(key, document);
        return [document, null];
    }

    cached(planId: string, revision: number): ConstructionPlanDocumentPayload | null {
        return this.cache.get(ConstructionPlanFetchClient.key(planId, revision)) ?? null;
    }

    private static key(planId: string, revision: number): string {
        return `${planId}@${revision}`;
    }
}
