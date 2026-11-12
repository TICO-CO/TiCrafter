import {
    BOT_PROJECT_ABANDON_RESPONSE,
    BOT_PROJECT_RESPONSE,
    type BotProjectAbandon,
    type BotProjectAbandonResponse,
    type BotProjectPropose,
    type BotProjectRepair,
    type BotProjectResponse,
    type BotProjectRevise,
    type BotProjectRollback,
    type Envelope,
    type LoggerPort,
    type ProjectRecordPayload,
    ProtocolEnvelope,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { PersonalProjectService } from './personal-project-service.js';
import type { PersonalProjectRecord, ProjectFailure } from './types.js';

export class ProjectCommandHandler {
    constructor(
        private readonly projects: PersonalProjectService,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
        private readonly id: () => string = () => crypto.randomUUID(),
    ) {}

    handlePropose(
        connection: ClientConnection,
        request: BotProjectPropose,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('bot is offline'));
            return;
        }
        const [project, projectError] = this.projects.propose({
            id: this.id(),
            botId,
            title: request.title,
            kind: request.kind,
            anchor: request.anchor,
            bbox: request.bbox,
            storagePosition: request.storagePosition ?? null,
            ...(request.collaboration === undefined
                ? {}
                : { collaboration: request.collaboration }),
            ...(request.autoAcceptCompatibleHelpers === undefined
                ? {}
                : { autoAcceptCompatibleHelpers: request.autoAcceptCompatibleHelpers }),
        });
        if (projectError) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_RESPONSE,
                this.failure(this.describe(projectError)),
            );
            return;
        }
        if (project === null) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('project missing'));
            return;
        }
        this.reply(connection, envelope, BOT_PROJECT_RESPONSE, {
            ok: true,
            project: ProjectCommandHandler.project(project),
        });
    }

    handleRepair(
        connection: ClientConnection,
        request: BotProjectRepair,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('bot is offline'));
            return;
        }
        const [project, projectError] = this.projects.repair(request.projectId, botId);
        if (projectError) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_RESPONSE,
                this.failure(this.describe(projectError)),
            );
            return;
        }
        if (project === null) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('project missing'));
            return;
        }
        this.reply(connection, envelope, BOT_PROJECT_RESPONSE, {
            ok: true,
            project: ProjectCommandHandler.project(project),
        });
    }

    handleRollback(
        connection: ClientConnection,
        request: BotProjectRollback,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('bot is offline'));
            return;
        }
        const [project, projectError] = this.projects.rollback(request.projectId, botId);
        if (projectError) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_RESPONSE,
                this.failure(this.describe(projectError)),
            );
            return;
        }
        if (project === null) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('project missing'));
            return;
        }
        this.reply(connection, envelope, BOT_PROJECT_RESPONSE, {
            ok: true,
            project: ProjectCommandHandler.project(project),
        });
    }

    handleRevise(
        connection: ClientConnection,
        request: BotProjectRevise,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('bot is offline'));
            return;
        }
        const [project, projectError] = this.projects.revise({
            projectId: request.projectId,
            botId,
            ...(request.title === undefined ? {} : { title: request.title }),
            ...(request.kind === undefined ? {} : { kind: request.kind }),
            ...(request.anchor === undefined ? {} : { anchor: request.anchor }),
            ...(request.bbox === undefined ? {} : { bbox: request.bbox }),
            ...(request.collaboration === undefined
                ? {}
                : { collaboration: request.collaboration }),
            ...(request.autoAcceptCompatibleHelpers === undefined
                ? {}
                : { autoAcceptCompatibleHelpers: request.autoAcceptCompatibleHelpers }),
        });
        if (projectError) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_RESPONSE,
                this.failure(this.describe(projectError)),
            );
            return;
        }
        if (project === null) {
            this.reply(connection, envelope, BOT_PROJECT_RESPONSE, this.failure('project missing'));
            return;
        }
        this.reply(connection, envelope, BOT_PROJECT_RESPONSE, {
            ok: true,
            project: ProjectCommandHandler.project(project),
        });
    }

    handleAbandon(
        connection: ClientConnection,
        request: BotProjectAbandon,
        envelope: Envelope,
    ): void {
        const botId = connection.botId;
        if (botId === undefined) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_ABANDON_RESPONSE,
                this.failure('bot is offline'),
            );
            return;
        }
        const [project, projectError] = this.projects.abandon(
            request.projectId,
            botId,
            request.reason,
        );
        if (projectError) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_ABANDON_RESPONSE,
                this.failure(this.describe(projectError)),
            );
            return;
        }
        if (project === null) {
            this.reply(
                connection,
                envelope,
                BOT_PROJECT_ABANDON_RESPONSE,
                this.failure('project missing'),
            );
            return;
        }
        this.reply(connection, envelope, BOT_PROJECT_ABANDON_RESPONSE, {
            ok: true,
            project: ProjectCommandHandler.project(project),
        });
    }

    private static project(record: PersonalProjectRecord): ProjectRecordPayload {
        return {
            id: record.id,
            botId: record.botId,
            title: record.title,
            kind: record.kind,
            status: record.status,
            anchor: record.anchor,
            bbox: record.bbox,
            claims: record.claims.map((claim) => ({
                claimId: claim.claimId,
                fencingToken: claim.fencingToken,
            })),
            structureId: record.structureId,
            storageId: record.storageId,
            reason: record.reason,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private failure(reason: string): BotProjectResponse | BotProjectAbandonResponse {
        return { ok: false, project: null, reason };
    }

    private reply(
        connection: ClientConnection,
        request: Envelope,
        type: string,
        payload: BotProjectResponse | BotProjectAbandonResponse,
    ): void {
        const envelope = ProtocolEnvelope.create('response', type, payload, {
            replyTo: request.id,
        });
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'project response failed');
    }

    private describe(failure: ProjectFailure): string {
        switch (failure.type) {
            case 'STORAGE':
                return `${failure.type}: ${failure.failure.type}`;
            case 'PROJECT_NOT_FOUND':
            case 'PROJECT_EXISTS':
            case 'OWNER_MISMATCH':
                return `${failure.type}: ${failure.projectId}`;
            case 'BOT_NOT_FOUND':
                return `${failure.type}: ${failure.botId}`;
            case 'INVALID_PROJECT':
            case 'CLAIM_FAILED':
            case 'CONSTRUCTION_FAILED':
            case 'TASK_FAILED':
            case 'SIP_FAILED':
            case 'PROFILE_FAILED':
            case 'AGENCY_FAILED':
                return `${failure.type}: ${failure.message}`;
        }
    }
}
