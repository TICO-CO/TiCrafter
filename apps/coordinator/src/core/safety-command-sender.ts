import {
    BOT_SAFETY_RESUME,
    ProtocolEnvelope,
    type Result,
    type TransportFailure,
} from '@ticrafter/core';

import type { ClientConnection, TransportServer } from '../transport/index.js';

export interface SafetyResumeCommand {
    reason?: string;
}

export class SafetyCommandSender {
    constructor(private readonly transport: TransportServer) {}

    resume(
        connection: ClientConnection,
        command: SafetyResumeCommand = {},
    ): Result<void, TransportFailure> {
        const envelope = ProtocolEnvelope.create('request', BOT_SAFETY_RESUME, {
            ...(command.reason === undefined ? {} : { reason: command.reason }),
        });
        return this.transport.send(connection, envelope);
    }
}
