import {
    DECISION_RESPONSE,
    type DecisionRequest,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { DecisionService } from './decision-service.js';
import { DecisionFailures } from './failures.js';
import type { DecisionTraceRecorder } from './trace-recorder.js';

export class DecisionCommandAdapter {
    constructor(
        private readonly service: DecisionService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
        private readonly trace: DecisionTraceRecorder | null = null,
    ) {}

    async handle(
        connection: ClientConnection,
        request: DecisionRequest,
        envelope: Envelope,
    ): Promise<void> {
        if (connection.botId !== request.botId) {
            this.sendError(connection, envelope, 'bot_mismatch', 'decision botId mismatch');
            return;
        }
        const [outcome, failure] = await this.service.decide(connection.botId, request);
        if (failure || outcome === null) {
            const message =
                failure === null
                    ? 'decision service returned null'
                    : DecisionFailures.message(failure);
            if (failure !== null) this.trace?.recordFailure(request, failure);
            this.sendError(connection, envelope, 'decision_failed', message);
            this.logger.warn({ error: message, botId: connection.botId }, 'decision failed');
            return;
        }
        this.trace?.record(request, outcome);
        if (outcome.fallback !== null) {
            this.logger.debug(
                { botId: connection.botId, reason: outcome.fallback.reason },
                'decision fallback returned',
            );
        }
        this.send(
            connection,
            ProtocolEnvelope.create('response', DECISION_RESPONSE, outcome.response, {
                replyTo: envelope.id,
            }),
        );
    }

    private sendError(
        connection: ClientConnection,
        request: Envelope,
        code: string,
        message: string,
    ): void {
        this.send(
            connection,
            ProtocolEnvelope.create(
                'response',
                'coordinator.error',
                { code, message },
                { replyTo: request.id, error: { code, message } },
            ),
        );
    }

    private send(connection: ClientConnection, envelope: Envelope): void {
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logError(envelope, sendError);
    }

    private logError(envelope: Envelope, failure: TransportFailure): void {
        this.logger.warn({ error: failure.type, type: envelope.type }, 'decision response failed');
    }
}
