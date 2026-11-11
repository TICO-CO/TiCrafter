import {
    BOT_SKILL_CANCEL,
    BOT_SKILL_RESUME,
    BOT_SKILL_START,
    type BotSkillStartMessage,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';

export interface SkillCancelCommand {
    skillId?: string;
    taskId?: string;
    reason?: string;
}

export class SkillCommandSender {
    constructor(private readonly transport: TransportServer) {}

    start(
        connection: ClientConnection,
        skillId: string,
        input: BotSkillStartMessage['input'],
        taskId?: string,
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create('request', BOT_SKILL_START, {
            skillId,
            input,
            ...(taskId === undefined ? {} : { taskId }),
        });
        return this.transport.send(connection, envelope);
    }

    resume(
        connection: ClientConnection,
        skillId: string,
        taskId?: string,
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create('request', BOT_SKILL_RESUME, {
            skillId,
            ...(taskId === undefined ? {} : { taskId }),
        });
        return this.transport.send(connection, envelope);
    }

    cancel(
        connection: ClientConnection,
        command: SkillCancelCommand = {},
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create('request', BOT_SKILL_CANCEL, {
            ...(command.skillId === undefined ? {} : { skillId: command.skillId }),
            ...(command.taskId === undefined ? {} : { taskId: command.taskId }),
            ...(command.reason === undefined ? {} : { reason: command.reason }),
        });
        return this.transport.send(connection, envelope);
    }
}
