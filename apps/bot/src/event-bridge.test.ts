import { EventEmitter } from 'node:events';

import type { LoggerPort, Result, TransportFailure } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { BotEventBridge } from './event-bridge.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

function ignoredEmit(): Result<void, TransportFailure> {
    return [undefined, null];
}

describe('BotEventBridge', () => {
    it('forwards block updates from the mineflayer world', () => {
        const bot = new EventEmitter() as unknown as Bot;
        const world = new EventEmitter();
        Object.assign(bot, { world });
        const received: unknown[] = [];
        const bridge = new BotEventBridge(bot, ignoredEmit, logger, (block) =>
            received.push(block),
        );

        bridge.attach();
        world.emit('blockUpdate', null, { name: 'stone' });
        bridge.detachAll();
        world.emit('blockUpdate', null, { name: 'dirt' });

        expect(received).toEqual([{ name: 'stone' }]);
    });
});
