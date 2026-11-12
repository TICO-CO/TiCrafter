import {
    BOT_JOB_DECIDE_RESPONSE,
    BOT_JOB_OFFERS_RESPONSE,
    type BotJobDecide,
    type BotJobDecideResponse,
    type BotJobOffers,
    type BotJobOffersResponse,
    type Envelope,
    type JobOfferPayload,
    type LoggerPort,
    ProtocolEnvelope,
    type TransportFailure,
} from '@ticrafter/core';

import type { JobAssignment, JobOffer, JobOfferContext, JobOfferService } from '../tasks/index.js';
import type { ClientConnection, TransportServer } from '../transport/index.js';

export class JobCommandHandler {
    constructor(
        private readonly jobs: JobOfferService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
        private readonly now: () => string = () => new Date().toISOString(),
    ) {}

    handleOffers(connection: ClientConnection, request: BotJobOffers, envelope: Envelope): void {
        const botId = this.botId(connection, request.botId);
        if (botId === null) {
            this.reply(
                connection,
                envelope,
                BOT_JOB_OFFERS_RESPONSE,
                this.offerFailure('bot is offline'),
            );
            return;
        }
        const [offers, offerError] = this.jobs.offer(this.context(botId, request));
        if (offerError) {
            this.reply(
                connection,
                envelope,
                BOT_JOB_OFFERS_RESPONSE,
                this.offerFailure(offerError),
            );
            return;
        }
        if (offers === null) {
            this.reply(
                connection,
                envelope,
                BOT_JOB_OFFERS_RESPONSE,
                this.offerFailure('offers missing'),
            );
            return;
        }
        this.reply(connection, envelope, BOT_JOB_OFFERS_RESPONSE, {
            ok: true,
            offers: offers.map((offer) => JobCommandHandler.offer(offer)),
        });
    }

    handleDecide(connection: ClientConnection, request: BotJobDecide, envelope: Envelope): void {
        const botId = this.botId(connection, request.botId);
        if (botId === null) {
            this.reply(
                connection,
                envelope,
                BOT_JOB_DECIDE_RESPONSE,
                this.decisionFailure(request.taskId, 'bot is offline'),
            );
            return;
        }
        const context = this.context(botId, request);
        const [assignment, decisionError] = this.jobs.resolve(
            context,
            request.taskId,
            request.decision,
            request.reason,
        );
        if (decisionError) {
            this.reply(
                connection,
                envelope,
                BOT_JOB_DECIDE_RESPONSE,
                this.decisionFailure(request.taskId, decisionError),
            );
            return;
        }
        this.reply(
            connection,
            envelope,
            BOT_JOB_DECIDE_RESPONSE,
            this.decisionResponse(request.taskId, assignment),
        );
    }

    private context(botId: string, request: BotJobOffers | BotJobDecide): JobOfferContext {
        return {
            botId,
            role: request.role,
            position: request.position,
            inventory: Object.fromEntries(request.inventory.map((item) => [item.name, item.count])),
        };
    }

    private botId(connection: ClientConnection, requested: string): string | null {
        if (connection.botId === undefined || connection.botId !== requested) return null;
        return connection.botId;
    }

    private static offer(offer: JobOffer): JobOfferPayload {
        return {
            taskId: offer.taskId,
            title: offer.title,
            priority: offer.priority,
            skillId: offer.skillId,
            target: offer.target,
            requiredRole: offer.requiredRole,
            distance: offer.distance,
            ...(offer.projectId === undefined ? {} : { projectId: offer.projectId }),
            ...(offer.structureId === undefined ? {} : { structureId: offer.structureId }),
        };
    }

    private decisionResponse(
        taskId: string,
        assignment: JobAssignment | null,
    ): BotJobDecideResponse {
        if (assignment === null) {
            return {
                ok: true,
                taskId,
                offer: null,
                task: null,
                fencingToken: null,
                leaseUntil: null,
            };
        }
        return {
            ok: true,
            taskId,
            offer: JobCommandHandler.offer(assignment.offer),
            task: {
                id: assignment.task.id,
                title: assignment.task.title,
                priority: assignment.task.priority,
                payload: assignment.task.payload,
                target: assignment.task.target,
                requiredRole: assignment.task.requiredRole,
                ...(assignment.task.projectId === undefined
                    ? {}
                    : { projectId: assignment.task.projectId }),
                ...(assignment.task.structureId === undefined
                    ? {}
                    : { structureId: assignment.task.structureId }),
                ...(assignment.task.workPackageId === undefined
                    ? {}
                    : { workPackageId: assignment.task.workPackageId }),
                ...(assignment.task.safety === undefined ? {} : { safety: assignment.task.safety }),
            },
            fencingToken: assignment.fencingToken,
            leaseUntil: assignment.leaseUntil,
        };
    }

    private offerFailure(reason: string): BotJobOffersResponse {
        return { ok: false, offers: [], reason };
    }

    private decisionFailure(taskId: string, reason: string): BotJobDecideResponse {
        return {
            ok: false,
            taskId,
            offer: null,
            task: null,
            fencingToken: null,
            leaseUntil: null,
            reason,
        };
    }

    private reply(
        connection: ClientConnection,
        request: Envelope,
        type: string,
        payload: BotJobOffersResponse | BotJobDecideResponse,
    ): void {
        const envelope = ProtocolEnvelope.create('response', type, payload, {
            replyTo: request.id,
        });
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'job response failed');
    }
}
