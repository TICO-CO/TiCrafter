import type { LoggerPort } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { Coordinator, type CoordinatorOptions } from './coordinator.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const buildOptions = (order: string[], recoveryError = false, reconcileError = false) =>
    ({
        config: { transport: { host: '127.0.0.1', port: 8788 } },
        logger,
        database: { close: () => order.push('database.close') },
        transport: {
            start: async () => {
                order.push('transport.start');
                return [undefined, null];
            },
            close: async () => {
                order.push('transport.close');
                return [undefined, null];
            },
        },
        ops: {
            start: async () => {
                order.push('ops.start');
                return [undefined, null];
            },
            close: async () => {
                order.push('ops.close');
            },
        },
        scheduler: {
            start: () => order.push('scheduler.start'),
            stop: () => order.push('scheduler.stop'),
        },
        recovery: {
            run: () => {
                order.push('recovery');
                return recoveryError
                    ? [null, { type: 'READ_FAILED', message: 'recovery failed' }]
                    : [{ claims: 0, grants: 0, tasks: 0, bots: 0 }, null];
            },
        },
        reconcile: () => {
            order.push('reconcile');
            return reconcileError ? [null, 'reconcile failed'] : [undefined, null];
        },
        supervisor: {
            spawnAll: () => order.push('supervisor.spawnAll'),
            stopAll: () => order.push('supervisor.stopAll'),
        },
        decision: { close: async () => order.push('decision.close') },
    }) as unknown as CoordinatorOptions;

describe('coordinator startup', () => {
    it('runs recovery and reconciliation before scheduler and bots', async () => {
        const order: string[] = [];
        const coordinator = new Coordinator(buildOptions(order));
        const [, startError] = await coordinator.start();
        expect(startError).toBeNull();
        expect(order).toEqual([
            'transport.start',
            'ops.start',
            'recovery',
            'reconcile',
            'scheduler.start',
            'supervisor.spawnAll',
        ]);
    });

    it('blocks startup when recovery fails', async () => {
        const order: string[] = [];
        const coordinator = new Coordinator(buildOptions(order, true));
        const [started, startError] = await coordinator.start();
        expect(started).toBeNull();
        expect(startError).toBe('recovery failed');
        expect(order.includes('scheduler.start')).toBe(false);
        expect(order.includes('supervisor.spawnAll')).toBe(false);
    });

    it('blocks startup when reconciliation fails', async () => {
        const order: string[] = [];
        const coordinator = new Coordinator(buildOptions(order, false, true));
        const [started, startError] = await coordinator.start();
        expect(started).toBeNull();
        expect(startError).toBe('reconcile failed');
        expect(order.includes('scheduler.start')).toBe(false);
    });
});
