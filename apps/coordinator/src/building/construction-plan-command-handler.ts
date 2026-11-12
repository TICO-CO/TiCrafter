import {
    BOT_CONSTRUCTION_PLAN_RESPONSE,
    type BotConstructionPlanGet,
    type BotConstructionPlanResponse,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { ConstructionPlanDocumentService } from './construction-plan-document-service.js';

export class ConstructionPlanCommandHandler {
    constructor(
        private readonly plans: ConstructionPlanDocumentService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
    ) {}

    handleGet(
        connection: ClientConnection,
        request: BotConstructionPlanGet,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined || botId !== request.botId) {
            this.reply(connection, envelope, this.failure('bot is offline'));
            return;
        }
        const [document, documentError] = this.plans.get(request.planId, request.revision);
        if (documentError) {
            this.reply(connection, envelope, this.failure(documentError.type));
            return;
        }
        if (document === null) {
            this.reply(
                connection,
                envelope,
                this.failure(
                    `construction plan ${request.planId} revision ${request.revision} missing`,
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
                structureId: document.structureId,
                blueprintId: document.blueprintId,
                blueprintRevision: document.blueprintRevision,
                purpose: document.purpose,
                plan: document.plan,
                createdAt: document.createdAt,
            },
        });
    }

    private failure(reason: string): BotConstructionPlanResponse {
        return { ok: false, document: null, reason };
    }

    private reply(
        connection: ClientConnection,
        request: Envelope,
        payload: BotConstructionPlanResponse,
    ): void {
        const envelope = ProtocolEnvelope.create(
            'response',
            BOT_CONSTRUCTION_PLAN_RESPONSE,
            payload,
            {
                replyTo: request.id,
            },
        );
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'construction plan response failed');
    }
}
