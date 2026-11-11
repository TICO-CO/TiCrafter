import type { Envelope, LoggerPort } from '@ticrafter/core';
import { BOT_AUTONOMY_PAUSE, BOT_AUTONOMY_RESUME, BOT_SAFETY_RESUME } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { ClientConnection } from '../transport/index.js';
import { OpsPauseResumeController } from './pause-resume-controller.js';
import { OpsStructuredLogger } from './structured-logger.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function connection(botId: string): ClientConnection {
    return { botId } as ClientConnection;
}

describe('OpsPauseResumeController', () => {
    it('pauses and resumes a fleet while marking presence', () => {
        const sent: Envelope[] = [];
        const suspended: string[] = [];
        const online: string[] = [];
        const audit: string[] = [];
        const controller = new OpsPauseResumeController({
            transport: {
                list: () => [connection('bot.one'), connection('bot.two')],
                send: (_connection, envelope) => {
                    sent.push(envelope);
                    return [undefined, null];
                },
            },
            presence: {
                markOnline: (botId) => {
                    online.push(botId);
                    return [null, null];
                },
                suspend: (botId) => {
                    suspended.push(botId);
                    return [null, null];
                },
            },
            audit: {
                append: (event) => {
                    audit.push(event.type);
                    return [1, null];
                },
            },
            logger: new OpsStructuredLogger(logger),
        });

        const paused = controller.pause({ reason: 'maintenance' });
        const resumed = controller.resume({});

        expect(paused.bots).toEqual(['bot.one', 'bot.two']);
        expect(resumed.bots).toEqual(['bot.one', 'bot.two']);
        expect(sent.filter((envelope) => envelope.type === BOT_AUTONOMY_PAUSE)).toHaveLength(2);
        expect(sent.filter((envelope) => envelope.type === BOT_AUTONOMY_RESUME)).toHaveLength(2);
        expect(sent.filter((envelope) => envelope.type === BOT_SAFETY_RESUME)).toHaveLength(2);
        expect(suspended).toEqual(['bot.one', 'bot.two']);
        expect(online).toEqual(['bot.one', 'bot.two']);
        expect(audit).toEqual(['ops.pause', 'ops.resume']);
    });

    it('reports a missing bot', () => {
        const controller = new OpsPauseResumeController({
            transport: { list: () => [], send: () => [undefined, null] },
            presence: {
                markOnline: () => [null, null],
                suspend: () => [null, null],
            },
            logger: new OpsStructuredLogger(logger),
        });

        const result = controller.pause({ botId: 'bot.missing' });

        expect(result.bots).toHaveLength(0);
        expect(result.failures[0]?.type).toBe('BOT_NOT_CONNECTED');
    });
});
