import {
    BLOCK_UPDATE_EVENT,
    type BlockUpdateMessage,
    blockUpdateSchema,
    CHUNK_SNAPSHOT_EVENT,
    type ChunkSnapshotMessage,
    chunkSnapshotSchema,
    DECISION_REQUEST,
    type DecisionRequest,
    decisionRequestSchema,
    type Envelope,
    LANDMARK_CANDIDATE_EVENT,
    type LandmarkCandidateMessage,
    landmarkCandidateSchema,
    type LoggerPort,
    SKILL_PROGRESS_EVENT,
    skillProgressSchema,
} from '@ticrafter/core';
import type { EventLogWriter } from '@ticrafter/memory';

import type { ClientConnection } from '../transport/index.js';
import type { CommandRouter } from './command-router.js';
import type { SessionHandshake } from './session-handshake.js';
import type { SessionManager } from './session-manager.js';

export interface MessageRouterOptions {
    sessions: SessionManager;
    router: CommandRouter;
    handshake: SessionHandshake;
    events: EventLogWriter;
    logger: LoggerPort;
    onChunkSnapshot?: (payload: ChunkSnapshotMessage) => void;
    onLandmarkCandidate?: (payload: LandmarkCandidateMessage) => void;
    onBlockUpdate?: (payload: BlockUpdateMessage) => void;
    onDecisionRequest?: (
        connection: ClientConnection,
        payload: DecisionRequest,
        envelope: Envelope,
    ) => void;
    onSessionClosed?: (botId: string) => void;
}

export class MessageRouter {
    constructor(private readonly options: MessageRouterOptions) {}

    handleMessage(connection: ClientConnection, envelope: Envelope): void {
        if (envelope.kind === 'request' && envelope.type === 'session.hello') {
            this.options.handshake.handle(connection, envelope);
            return;
        }
        if (!connection.botId) {
            this.options.logger.warn(
                { connectionId: connection.id },
                'message before session hello',
            );
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.heartbeat') {
            this.options.sessions.touch(connection.botId);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === 'bot.event') {
            this.options.logger.debug(
                { botId: connection.botId, event: envelope.payload },
                'bot event',
            );
            return;
        }
        if (envelope.kind === 'event' && envelope.type === SKILL_PROGRESS_EVENT) {
            const parsed = skillProgressSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid skill progress');
                return;
            }
            this.options.sessions.touch(connection.botId);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === CHUNK_SNAPSHOT_EVENT) {
            const parsed = chunkSnapshotSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid chunk snapshot');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onChunkSnapshot?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === LANDMARK_CANDIDATE_EVENT) {
            const parsed = landmarkCandidateSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid landmark candidate');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onLandmarkCandidate?.(parsed.data);
            return;
        }
        if (envelope.kind === 'event' && envelope.type === BLOCK_UPDATE_EVENT) {
            const parsed = blockUpdateSchema.safeParse(envelope.payload);
            if (!parsed.success || parsed.data.botId !== connection.botId) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid block update');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onBlockUpdate?.(parsed.data);
            return;
        }
        if (envelope.kind === 'request' && envelope.type === DECISION_REQUEST) {
            const parsed = decisionRequestSchema.safeParse(envelope.payload);
            if (!parsed.success) {
                this.options.logger.warn({ botId: connection.botId }, 'invalid decision request');
                return;
            }
            this.options.sessions.touch(connection.botId);
            this.options.onDecisionRequest?.(connection, parsed.data, envelope);
            return;
        }
        if (envelope.kind === 'request') {
            const [, routeError] = this.options.router.handle(connection, envelope);
            if (routeError) {
                this.options.logger.warn(
                    { error: routeError, type: envelope.type },
                    'command routing failed',
                );
            }
        }
    }

    handleClose(connection: ClientConnection): void {
        if (!connection.botId) return;
        this.options.onSessionClosed?.(connection.botId);
        const [, logError] = this.options.events.append({
            botId: connection.botId,
            type: 'session.left',
            payload: {},
        });
        if (logError) {
            this.options.logger.warn(
                { error: this.describe(logError) },
                'session leave log failed',
            );
        }
        this.options.sessions.remove(connection.botId);
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
