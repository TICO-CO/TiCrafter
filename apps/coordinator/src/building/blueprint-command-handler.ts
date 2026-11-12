import {
    BOT_BLUEPRINT_RESPONSE,
    type BotBlueprintGet,
    type BotBlueprintResponse,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { BlueprintDocumentService } from './blueprint-document-service.js';

export class BlueprintCommandHandler {
    constructor(
        private readonly blueprints: BlueprintDocumentService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
    ) {}

    handleGet(connection: ClientConnection, request: BotBlueprintGet, envelope: Envelope): void {
        const botId = connection.botId;
        if (botId === undefined || botId !== request.botId) {
            this.reply(connection, envelope, this.failure('bot is offline'));
            return;
        }
        const [document, documentError] = this.blueprints.get(
            request.blueprintId,
            request.revision,
        );
        if (documentError) {
            this.reply(connection, envelope, this.failure(documentError.type));
            return;
        }
        if (document === null) {
            this.reply(
                connection,
                envelope,
                this.failure(
                    `blueprint ${request.blueprintId} revision ${request.revision} missing`,
                ),
            );
            return;
        }
        this.reply(connection, envelope, {
            ok: true,
            document: {
                id: document.id,
                revision: document.revision,
                hash: document.hash,
                source: document.source,
                provenance: document.provenance,
                blueprint: document.blueprint,
            },
        });
    }

    private failure(reason: string): BotBlueprintResponse {
        return { ok: false, document: null, reason };
    }

    private reply(
        connection: ClientConnection,
        request: Envelope,
        payload: BotBlueprintResponse,
    ): void {
        const envelope = ProtocolEnvelope.create('response', BOT_BLUEPRINT_RESPONSE, payload, {
            replyTo: request.id,
        });
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'blueprint response failed');
    }
}
