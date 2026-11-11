import type { LoggerPort } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { OpsStructuredLogger } from './structured-logger.js';

class FakeLogger implements LoggerPort {
    readonly calls: { level: string; payload: unknown; message?: string }[] = [];

    debug(payload: unknown, message?: string): void {
        this.calls.push({ level: 'debug', payload, message });
    }

    info(payload: unknown, message?: string): void {
        this.calls.push({ level: 'info', payload, message });
    }

    warn(payload: unknown, message?: string): void {
        this.calls.push({ level: 'warn', payload, message });
    }

    error(payload: unknown, message?: string): void {
        this.calls.push({ level: 'error', payload, message });
    }
}

describe('OpsStructuredLogger', () => {
    it('merges child context into log payloads', () => {
        const logger = new FakeLogger();
        const structured = new OpsStructuredLogger(logger).child({ botId: 'bot.one' });

        structured.info({ taskId: 'task-1' }, 'working');

        expect(logger.calls[0]?.payload).toEqual({ botId: 'bot.one', taskId: 'task-1' });
        expect(logger.calls[0]?.message).toBe('working');
    });

    it('wraps non-object payloads without losing context', () => {
        const logger = new FakeLogger();
        const structured = new OpsStructuredLogger(logger).child({ traceId: 'trace-1' });

        structured.warn('failed');

        expect(logger.calls[0]?.payload).toEqual({ traceId: 'trace-1', payload: 'failed' });
    });
});
