import {
    BOT_PLOT_OWNERSHIP_RESPONSE,
    type BotPlotOwnershipRequest,
    type BotPlotOwnershipResponse,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { PlotOwnershipService } from './plot-ownership-service.js';

export class PlotOwnershipCommandHandler {
    constructor(
        private readonly ownership: PlotOwnershipService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
    ) {}

    handle(
        connection: ClientConnection,
        request: BotPlotOwnershipRequest,
        envelope: Envelope,
    ): void {
        if (connection.botId === undefined || connection.botId !== request.botId) {
            this.reply(connection, envelope, this.failure(request.plotId, 'bot is offline'));
            return;
        }
        const [ownership, ownershipError] = this.ownership.resolve(request.botId, request.bbox);
        if (ownershipError) {
            this.reply(connection, envelope, this.failure(request.plotId, ownershipError));
            return;
        }
        if (ownership === null) {
            this.reply(connection, envelope, this.failure(request.plotId, 'ownership missing'));
            return;
        }
        this.reply(connection, envelope, {
            ok: true,
            plotId: request.plotId,
            ownership:
                ownership.kind === 'ambiguous'
                    ? { ...ownership, ownerIds: [...ownership.ownerIds] }
                    : ownership.kind === 'unknown'
                      ? {
                            ...ownership,
                            linkedPlayers: ownership.linkedPlayers.map((player) => ({
                                ...player,
                                linkedBaseIds: [...player.linkedBaseIds],
                            })),
                        }
                      : ownership,
            reason: null,
        });
    }

    private failure(plotId: string, reason: string): BotPlotOwnershipResponse {
        return { ok: false, plotId, ownership: null, reason };
    }

    private reply(
        connection: ClientConnection,
        request: Envelope,
        payload: BotPlotOwnershipResponse,
    ): void {
        const envelope = ProtocolEnvelope.create('response', BOT_PLOT_OWNERSHIP_RESPONSE, payload, {
            replyTo: request.id,
        });
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'plot ownership response failed');
    }
}
