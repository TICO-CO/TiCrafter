import {
    BOT_PLOT_OWNERSHIP_REQUEST,
    type BotPlotOwnershipResponse,
    botPlotOwnershipResponseSchema,
    type Envelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';
import type { BoundingBox, PlotOwnership } from '@ticrafter/worldmodel';

export interface PlotOwnershipRequestPort {
    request(
        type: string,
        payload: unknown,
        timeoutMilliseconds?: number,
    ): Promise<Result<Envelope, TransportFailure>>;
}

export interface PlotOwnershipRequest {
    plotId: string;
    bbox: BoundingBox;
}

export class PlotOwnershipClient {
    constructor(
        private readonly transport: PlotOwnershipRequestPort,
        private readonly botId: string,
        private readonly timeoutMilliseconds = 5000,
    ) {}

    async resolve(input: PlotOwnershipRequest): Promise<Result<PlotOwnership, string>> {
        const [envelope, requestError] = await this.transport.request(
            BOT_PLOT_OWNERSHIP_REQUEST,
            { botId: this.botId, plotId: input.plotId, bbox: input.bbox },
            this.timeoutMilliseconds,
        );
        if (requestError) return [null, requestError.type];
        if (envelope === null) return [null, 'plot ownership response missing'];
        const parsed = botPlotOwnershipResponseSchema.safeParse(envelope.payload);
        if (!parsed.success) return [null, parsed.error.message];
        if (!parsed.data.ok) return [null, parsed.data.reason ?? 'plot ownership failed'];
        if (parsed.data.ownership === null) return [null, 'plot ownership missing'];
        return [this.toOwnership(parsed.data), null];
    }

    private toOwnership(response: BotPlotOwnershipResponse): PlotOwnership {
        const ownership = response.ownership;
        if (ownership === null) {
            return { kind: 'unknown', nearbyBaseId: null, linkedPlayers: [] };
        }
        if (ownership.kind === 'ambiguous') {
            return { ...ownership, ownerIds: [...ownership.ownerIds] };
        }
        if (ownership.kind === 'unknown') {
            return {
                ...ownership,
                linkedPlayers: ownership.linkedPlayers.map((player) => ({
                    ...player,
                    linkedBaseIds: [...player.linkedBaseIds],
                })),
            };
        }
        return ownership;
    }
}
