import { BOT_SAFETY_STOP, type Envelope, type LoggerPort } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import type { BotProfile } from '../bots/index.js';
import type { ClientConnection } from '../transport/index.js';
import { OpsFleetEmergencyStop } from './fleet-emergency-stop.js';
import { OpsStructuredLogger } from './structured-logger.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const profile = (botId: string): BotProfile => ({ botId }) as BotProfile;
const connection = (botId: string): ClientConnection => ({ botId }) as ClientConnection;

describe('OpsFleetEmergencyStop', () => {
    it('suspends profiles, broadcasts stop, and audits', () => {
        const sent: Envelope[] = [];
        const suspended: string[] = [];
        const audit: string[] = [];
        const stop = new OpsFleetEmergencyStop({
            transport: {
                list: () => [connection('bot.one'), connection('bot.two')],
                send: (_connection, envelope) => {
                    sent.push(envelope);
                    return [undefined, null];
                },
            },
            presence: {
                list: () => [[profile('bot.one'), profile('bot.two')], null],
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

        const result = stop.trigger('test stop');

        expect(result.bots).toEqual(['bot.one', 'bot.two']);
        expect(suspended).toEqual(['bot.one', 'bot.two']);
        expect(sent.every((envelope) => envelope.type === BOT_SAFETY_STOP)).toBe(true);
        expect(audit).toEqual(['ops.fleet-emergency-stop']);
    });

    it('reports broadcast failures', () => {
        const stop = new OpsFleetEmergencyStop({
            transport: {
                list: () => [connection('bot.one')],
                send: () => [null, { type: 'SEND_FAILED', message: 'closed' }],
            },
            presence: {
                list: () => [[profile('bot.one')], null],
                suspend: () => [null, null],
            },
            logger: new OpsStructuredLogger(logger),
        });

        const result = stop.trigger();

        expect(result.failures[0]?.type).toBe('COMMAND_FAILED');
    });
});
