import type { SocialContext } from '@ticrafter/agency';
import { type ClockHandle, type ClockPort, type LoggerPort, type Result } from '@ticrafter/core';

import type { BehaviorTracePort } from '../index.js';
import type { ChatAdapter } from './chat-adapter.js';

export interface SocialPresenceOptions {
    botName: string;
    adapter: ChatAdapter;
    clock: ClockPort;
    logger: LoggerPort;
    chatDelay: () => number;
    trace?: BehaviorTracePort;
    lookAt?: (username: string) => void;
    context: (username: string) => SocialContext;
    permissionReply?: (playerId: string, username: string, message: string) => boolean;
}

export class SocialPresence {
    private readonly pending = new Set<ClockHandle>();
    private lastReply: string | null = null;

    constructor(private readonly options: SocialPresenceOptions) {}

    handleIncoming(username: string, message: string, playerId?: string): Result<void, string> {
        if (username === this.options.botName) return [undefined, null];
        if (
            playerId !== undefined &&
            this.options.permissionReply?.(playerId, username, message) === true
        ) {
            this.options.trace?.record('chat', 'incoming', {
                sender: username,
                playerId,
                text: message,
                permissionReply: true,
            });
            return [undefined, null];
        }
        const [reply, replyError] = this.options.adapter.handleIncoming(
            message,
            this.options.context(username),
        );
        if (replyError) return [null, replyError];
        if (reply === null || reply === this.lastReply) return [undefined, null];
        this.lastReply = reply;
        const delay = Math.max(0, this.options.chatDelay());
        const handle = this.options.clock.setTimeout(() => {
            this.pending.delete(handle);
            this.options.lookAt?.(username);
            const [, sendError] = this.options.adapter.send(reply);
            if (sendError) {
                this.options.logger.warn({ error: sendError }, 'social reply failed');
                return;
            }
            this.options.trace?.record('chat', 'outgoing', {
                recipient: username,
                text: reply,
                delayMilliseconds: delay,
            });
        }, delay);
        this.pending.add(handle);
        this.options.trace?.record('chat', 'incoming', {
            sender: username,
            text: message,
            replyDelayMilliseconds: delay,
        });
        return [undefined, null];
    }

    inquire(text: string, usernames: readonly string[]): Result<void, string> {
        const delay = Math.max(0, this.options.chatDelay());
        const recipient = usernames[0] ?? null;
        const handle = this.options.clock.setTimeout(() => {
            this.pending.delete(handle);
            if (recipient !== null) this.options.lookAt?.(recipient);
            const [, sendError] = this.options.adapter.sendNotice(text);
            if (sendError) {
                this.options.logger.warn({ error: sendError }, 'permission inquiry failed');
                return;
            }
            this.options.trace?.record('chat', 'outgoing', {
                recipients: [...usernames],
                text,
                delayMilliseconds: delay,
                permissionInquiry: true,
            });
        }, delay);
        this.pending.add(handle);
        return [undefined, null];
    }

    close(): void {
        this.pending.forEach((handle) => this.options.clock.clearTimeout(handle));
        this.pending.clear();
    }
}
