import { describe, expect, it } from 'bun:test';

import { BotConnectionFailures } from './bot-connection-failures.js';

describe('BotConnectionFailures', () => {
    it('marks transport failures as retryable', () => {
        expect(BotConnectionFailures.isFatal(BotConnectionFailures.transport('down'))).toBe(false);
    });

    it('marks minecraft failures as fatal', () => {
        expect(BotConnectionFailures.isFatal(BotConnectionFailures.minecraft('down'))).toBe(true);
    });

    it('exposes the transport message', () => {
        expect(BotConnectionFailures.transport('coordinator down')).toEqual({
            type: 'transport',
            message: 'coordinator down',
        });
    });

    it('exposes the minecraft message', () => {
        expect(BotConnectionFailures.minecraft('server down')).toEqual({
            type: 'minecraft',
            message: 'server down',
        });
    });
});
