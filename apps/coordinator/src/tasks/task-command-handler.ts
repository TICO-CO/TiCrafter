import {
    type BotTaskClaim,
    type BotTaskComplete,
    type BotTaskFail,
    type BotTaskRenew,
    type BotTaskResponse,
    type Envelope,
    type LoggerPort,
    ProtocolEnvelope,
    TASK_RESPONSE,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';
import type { TaskBoard } from './task-board.js';
import type { TaskFailure, TaskLease, TaskRecord } from './types.js';

export class TaskCommandHandler {
    constructor(
        private readonly tasks: TaskBoard,
        private readonly transport: TransportServer,
        private readonly logger: LoggerPort,
        private readonly onCompleted?: (task: TaskRecord) => void,
    ) {}

    handleClaim(connection: ClientConnection, request: BotTaskClaim, envelope: Envelope): void {
        if (connection.botId !== request.botId) {
            this.reply(connection, envelope, this.failure('botId mismatch'));
            return;
        }
        const [activeTaskCount, countError] = this.tasks.activeTaskCount(request.botId);
        if (countError) {
            this.reply(connection, envelope, this.failure(this.describe(countError)));
            return;
        }
        if (activeTaskCount === null) {
            this.reply(connection, envelope, this.failure('active task count missing'));
            return;
        }
        const [lease, claimError] = this.tasks.claimNext({
            botId: request.botId,
            botRole: request.role ?? null,
            botPosition: request.position,
            inventory: Object.fromEntries(request.inventory.map((item) => [item.name, item.count])),
            activeTaskCount,
        });
        if (claimError) {
            this.reply(connection, envelope, this.failure(this.describe(claimError)));
            return;
        }
        this.reply(connection, envelope, this.assignment(lease));
    }

    handleRenew(connection: ClientConnection, request: BotTaskRenew, envelope: Envelope): void {
        if (connection.botId !== request.botId) {
            this.reply(connection, envelope, this.failure('botId mismatch'));
            return;
        }
        const [renewed, renewError] = this.tasks.renew(
            request.taskId,
            request.botId,
            request.fencingToken,
        );
        if (renewError) {
            this.reply(connection, envelope, this.failure(this.describe(renewError)));
            return;
        }
        const renewable = renewed === true;
        this.reply(connection, envelope, {
            ok: renewable,
            taskId: request.taskId,
            task: null,
            fencingToken: request.fencingToken,
            leaseUntil: null,
            ...(renewable ? {} : { reason: 'task lease not renewable' }),
        });
    }

    handleComplete(
        connection: ClientConnection,
        request: BotTaskComplete,
        envelope: Envelope,
    ): void {
        if (connection.botId !== request.botId) {
            this.reply(connection, envelope, this.failure('botId mismatch'));
            return;
        }
        const [, leaseError] = this.tasks.verifyLease(
            request.taskId,
            request.botId,
            request.fencingToken,
        );
        if (leaseError) {
            this.reply(connection, envelope, this.failure(this.describe(leaseError)));
            return;
        }
        const [completed, completeError] = this.tasks.complete(request.taskId, request.botId);
        if (completeError) {
            this.reply(connection, envelope, this.failure(this.describe(completeError)));
            return;
        }
        if (completed !== null) this.onCompleted?.(completed);
        this.reply(connection, envelope, {
            ok: true,
            taskId: request.taskId,
            task: null,
            fencingToken: request.fencingToken,
            leaseUntil: null,
        });
    }

    handleFail(connection: ClientConnection, request: BotTaskFail, envelope: Envelope): void {
        if (connection.botId !== request.botId) {
            this.reply(connection, envelope, this.failure('botId mismatch'));
            return;
        }
        const [, leaseError] = this.tasks.verifyLease(
            request.taskId,
            request.botId,
            request.fencingToken,
        );
        if (leaseError) {
            this.reply(connection, envelope, this.failure(this.describe(leaseError)));
            return;
        }
        const [, failError] = this.tasks.fail(
            request.taskId,
            request.failureClass,
            request.reason,
            request.botId,
        );
        if (failError) {
            this.reply(connection, envelope, this.failure(this.describe(failError)));
            return;
        }
        this.reply(connection, envelope, {
            ok: true,
            taskId: request.taskId,
            task: null,
            fencingToken: request.fencingToken,
            leaseUntil: null,
        });
    }

    private assignment(lease: TaskLease | null): BotTaskResponse {
        if (lease === null) {
            return {
                ok: true,
                task: null,
                fencingToken: null,
                leaseUntil: null,
            };
        }
        return {
            ok: true,
            taskId: lease.task.id,
            task: {
                id: lease.task.id,
                title: lease.task.title,
                priority: lease.task.priority,
                payload: lease.task.payload,
                target: lease.task.target,
                requiredRole: lease.task.requiredRole,
                ...TaskCommandHandler.taskMetadata(lease.task.payload),
            },
            fencingToken: lease.fencingToken,
            leaseUntil: lease.leaseUntil,
        };
    }

    private static taskMetadata(payload: Readonly<Record<string, unknown>>): {
        projectId?: string;
        structureId?: string;
        workPackageId?: string;
    } {
        return {
            ...TaskCommandHandler.metadataField(payload, 'projectId'),
            ...TaskCommandHandler.metadataField(payload, 'structureId'),
            ...TaskCommandHandler.metadataField(payload, 'workPackageId'),
        };
    }

    private static metadataField(
        payload: Readonly<Record<string, unknown>>,
        key: 'projectId' | 'structureId' | 'workPackageId',
    ): { [K in typeof key]?: string } {
        const value = payload[key];
        if (typeof value !== 'string' || value.length === 0) return {};
        return { [key]: value } as { [K in typeof key]?: string };
    }

    private failure(reason: string): BotTaskResponse {
        return {
            ok: false,
            task: null,
            fencingToken: null,
            leaseUntil: null,
            reason,
        };
    }

    private reply(connection: ClientConnection, request: Envelope, payload: BotTaskResponse): void {
        const envelope = ProtocolEnvelope.create('response', TASK_RESPONSE, payload, {
            replyTo: request.id,
        });
        const [, sendError] = this.transport.send(connection, envelope);
        if (sendError) this.logSendFailure(sendError);
    }

    private logSendFailure(failure: TransportFailure): void {
        this.logger.warn({ error: failure.type }, 'task response failed');
    }

    private describe(failure: TaskFailure): string {
        switch (failure.type) {
            case 'STORAGE':
                return failure.failure.type;
            case 'TASK_NOT_FOUND':
            case 'DUPLICATE_TASK':
            case 'INVALID_TRANSITION':
            case 'CLAIM_CONFLICT':
                return `${failure.type}: ${failure.taskId}`;
            case 'INVALID_TASK':
            case 'MALFORMED_TASK':
                return `${failure.type}: ${failure.message}`;
            case 'DEPENDENCY_CYCLE':
                return `${failure.type}: ${failure.taskIds.join(',')}`;
            case 'PRECONDITION_FAILED':
                return `${failure.type}: ${failure.failures.map((item) => item.reason).join(',')}`;
        }
    }
}
