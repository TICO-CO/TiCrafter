import { type PersonalityModel, type SocialContext, SocialEngine } from '@ticrafter/agency';
import type { Result } from '@ticrafter/core';

export interface ChatTransportPort {
    send(text: string): Result<void, string>;
}

export interface ChatAdapterOptions {
    transport: ChatTransportPort;
    engine: SocialEngine;
    personality: PersonalityModel;
    ratePerMinute: number;
    now?: () => number;
}

export class ChatAdapter {
    constructor(private readonly options: ChatAdapterOptions) {}

    handleIncoming(message: string, context: SocialContext): Result<string | null, string> {
        const now = this.options.now?.() ?? Date.now();
        if (!this.options.engine.canSpeak(now, this.options.ratePerMinute)) return [null, null];
        const intent = this.options.engine.classify(message);
        const reply = this.options.engine.reply(intent, context, this.options.personality);
        if (reply === null) return [null, null];
        if (!this.options.engine.recordMessage(now)) return [null, null];
        return [reply, null];
    }

    send(text: string): Result<void, string> {
        return this.options.transport.send(text);
    }

    sendNotice(text: string): Result<void, string> {
        const now = this.options.now?.() ?? Date.now();
        if (!this.options.engine.canSpeak(now, this.options.ratePerMinute)) {
            return [null, 'chat rate limit reached'];
        }
        if (!this.options.engine.recordMessage(now)) {
            return [null, 'chat rate limit reached'];
        }
        return this.options.transport.send(text);
    }
}
