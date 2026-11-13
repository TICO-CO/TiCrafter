import { PersonalityModel, SocialEngine } from '@ticrafter/agency';
import type { BehaviorTraceEntry, ClockHandle, ClockPort } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ChatAdapter } from './chat-adapter.js';
import { SocialPresence } from './social-presence.js';

class FakeClock implements ClockPort {
    private sequence = 0;
    private readonly timers = new Map<number, { callback: () => void; at: number }>();
    private current = 0;
    now(): number {
        return this.current;
    }
    setTimeout(callback: () => void, delayMilliseconds: number): ClockHandle {
        this.sequence += 1;
        this.timers.set(this.sequence, { callback, at: this.current + delayMilliseconds });
        return this.sequence;
    }
    clearTimeout(handle: ClockHandle): void {
        if (typeof handle === 'number') this.timers.delete(handle);
    }
    setInterval(): ClockHandle {
        return 0;
    }
    clearInterval(): void {}
    advance(milliseconds: number): void {
        this.current += milliseconds;
        for (const [handle, timer] of [...this.timers]) {
            if (timer.at > this.current) continue;
            this.timers.delete(handle);
            timer.callback();
        }
    }
}

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

describe('social presence', () => {
    it('delays and traces a reply', () => {
        const clock = new FakeClock();
        const sent: string[] = [];
        const traces: BehaviorTraceEntry[] = [];
        const presence = new SocialPresence({
            botName: 'TiBot1',
            adapter: new ChatAdapter({
                transport: {
                    send: (text) => {
                        sent.push(text);
                        return [undefined, null];
                    },
                },
                engine: new SocialEngine(),
                personality: PersonalityModel.fromBotIndex(0),
                ratePerMinute: 10,
                now: () => clock.now(),
            }),
            clock,
            logger,
            chatDelay: () => 1200,
            trace: {
                record: (kind, subject, detail) =>
                    traces.push({
                        at: new Date(clock.now()).toISOString(),
                        botId: 'bot.tibot1',
                        kind,
                        subject,
                        detail,
                    }),
            },
            context: (username) => ({
                botName: 'TiBot1',
                recipient: username,
                phase: 'day',
                activeGoal: null,
            }),
        });
        const [, error] = presence.handleIncoming('Alex', 'hello TiBot1');
        expect(error).toBeNull();
        expect(sent).toHaveLength(0);
        clock.advance(1200);
        expect(sent).toHaveLength(1);
        expect(traces.some((entry) => entry.kind === 'chat' && entry.subject === 'outgoing')).toBe(
            true,
        );
    });

    it('does not reply to itself', () => {
        const clock = new FakeClock();
        const sent: string[] = [];
        const presence = new SocialPresence({
            botName: 'TiBot1',
            adapter: new ChatAdapter({
                transport: { send: (text) => (sent.push(text), [undefined, null]) },
                engine: new SocialEngine(),
                personality: PersonalityModel.fromBotIndex(0),
                ratePerMinute: 10,
            }),
            clock,
            logger,
            chatDelay: () => 1000,
            context: (username) => ({
                botName: 'TiBot1',
                recipient: username,
                phase: 'day',
                activeGoal: null,
            }),
        });
        presence.handleIncoming('TiBot1', 'hello');
        clock.advance(1000);
        expect(sent).toHaveLength(0);
    });

    it('routes permission replies before social handling', () => {
        const clock = new FakeClock();
        const sent: string[] = [];
        const replies: string[] = [];
        const presence = new SocialPresence({
            botName: 'TiBot1',
            adapter: new ChatAdapter({
                transport: { send: (text) => (sent.push(text), [undefined, null]) },
                engine: new SocialEngine(),
                personality: PersonalityModel.fromBotIndex(0),
                ratePerMinute: 10,
                now: () => clock.now(),
            }),
            clock,
            logger,
            chatDelay: () => 1000,
            permissionReply: (playerId, _username, message) => {
                replies.push(`${playerId}:${message}`);
                return true;
            },
            context: (username) => ({
                botName: 'TiBot1',
                recipient: username,
                phase: 'day',
                activeGoal: null,
            }),
        });
        presence.handleIncoming('Alex', 'yes', 'uuid.alex');
        clock.advance(1000);
        expect(replies).toEqual(['uuid.alex:yes']);
        expect(sent).toHaveLength(0);
    });

    it('sends delayed permission inquiries and traces them', () => {
        const clock = new FakeClock();
        const sent: string[] = [];
        const traces: BehaviorTraceEntry[] = [];
        const presence = new SocialPresence({
            botName: 'TiBot1',
            adapter: new ChatAdapter({
                transport: { send: (text) => (sent.push(text), [undefined, null]) },
                engine: new SocialEngine(),
                personality: PersonalityModel.fromBotIndex(0),
                ratePerMinute: 10,
                now: () => clock.now(),
            }),
            clock,
            logger,
            chatDelay: () => 1500,
            trace: {
                record: (kind, subject, detail) =>
                    traces.push({
                        at: new Date(clock.now()).toISOString(),
                        botId: 'bot.tibot1',
                        kind,
                        subject,
                        detail,
                    }),
            },
            context: (username) => ({
                botName: 'TiBot1',
                recipient: username,
                phase: 'day',
                activeGoal: null,
            }),
        });
        const [, error] = presence.inquire('May I farm?', ['Alex']);
        expect(error).toBeNull();
        expect(sent).toHaveLength(0);
        clock.advance(1500);
        expect(sent).toEqual(['May I farm?']);
        expect(
            traces.some(
                (entry) =>
                    entry.kind === 'chat' &&
                    entry.subject === 'outgoing' &&
                    (entry.detail as { permissionInquiry?: boolean }).permissionInquiry === true,
            ),
        ).toBe(true);
    });
});
