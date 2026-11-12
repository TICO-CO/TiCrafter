import type { LoggerPort } from '@ticrafter/core';
import { afterEach, describe, expect, it } from 'bun:test';

import type { AgencyStatusView } from './agency-status-view.js';
import type { OpsAuditViewer } from './audit-viewer.js';
import type { OpsFleetEmergencyStop } from './fleet-emergency-stop.js';
import type { OpsHealthReadiness } from './health-readiness.js';
import { OpsMetricsRegistry } from './metrics-registry.js';
import { OpsApi } from './ops-api.js';
import type { OpsPauseResumeController } from './pause-resume-controller.js';
import type { OpsSipDump } from './sip-dump.js';
import type { OpsStatusAggregator } from './status-aggregator.js';
import { OpsStructuredLogger } from './structured-logger.js';
import type { OpsControlRequest } from './types.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const api = (overrides: Partial<ConstructorParameters<typeof OpsApi>[0]> = {}): OpsApi => {
    const metrics = new OpsMetricsRegistry();
    return new OpsApi({
        host: '127.0.0.1',
        port: 0,
        logger: new OpsStructuredLogger(logger),
        metrics,
        status: {
            snapshot: () => [{ at: '2026-11-11T10:00:00.000Z', bots: { total: 1 } }, null],
        } as unknown as OpsStatusAggregator,
        health: {
            check: () => [
                { ok: true, checks: {}, at: '2026-11-11T10:00:00.000Z', uptimeSeconds: 1 },
                null,
            ],
        } as unknown as OpsHealthReadiness,
        agency: {
            one: () => [
                {
                    botId: 'bot.one',
                    phase: 'day',
                    activeGoal: 'Gather nearby wood',
                    needs: {},
                    homeStructureId: null,
                    lastDeliberationAt: null,
                    recentGoalOutcomes: [],
                },
                null,
            ],
            fleet: () => [[], null],
            episodes: () => [[], null],
        } as unknown as AgencyStatusView,
        sip: { snapshot: () => [{ revision: 3 }, null] } as unknown as OpsSipDump,
        audit: {
            events: () => [[{ type: 'task.created' }], null],
            blocks: () => [[], null],
            episodes: () => [[], null],
        } as unknown as OpsAuditViewer,
        pauseResume: {
            pause: (request: OpsControlRequest) => ({
                bots: [request.botId ?? 'bot.one'],
                failures: [],
            }),
            resume: (request: OpsControlRequest) => ({
                bots: [request.botId ?? 'bot.one'],
                failures: [],
            }),
        } as unknown as OpsPauseResumeController,
        emergencyStop: {
            trigger: () => ({ bots: ['bot.one'], failures: [] }),
        } as unknown as OpsFleetEmergencyStop,
        context: {
            epoch: 4,
            schemaVersion: 8,
            sessions: () => 1,
            uptimeSeconds: () => 20,
        },
        ...overrides,
    });
};

const json = async (response: Response): Promise<Record<string, unknown>> =>
    (await response.json()) as Record<string, unknown>;

describe('OpsApi', () => {
    const running: OpsApi[] = [];

    afterEach(async () => {
        await Promise.all(running.splice(0).map((server) => server.close()));
    });

    const start = async (server = api()): Promise<string> => {
        const [, startError] = await server.start();
        expect(startError).toBeNull();
        running.push(server);
        return `http://127.0.0.1:${server.listeningPort}`;
    };

    it('serves status, metrics, SIP, and audit views', async () => {
        const baseUrl = await start();

        const status = await fetch(`${baseUrl}/status`);
        const metrics = await fetch(`${baseUrl}/metrics`);
        const sip = await fetch(`${baseUrl}/sip`);
        const events = await fetch(`${baseUrl}/audit/events?limit=10`);

        const statusBody = (await json(status)) as { epoch: number };
        const metricsBody = (await json(metrics)) as { metrics: { counters: unknown } };
        const sipBody = (await json(sip)) as { sip: { revision: number } };
        const eventsBody = (await json(events)) as { events: unknown[] };

        expect(status.status).toBe(200);
        expect(statusBody.epoch).toBe(4);
        expect(metricsBody.metrics.counters).toEqual({});
        expect(sipBody.sip.revision).toBe(3);
        expect(eventsBody.events).toHaveLength(1);
    });

    it('serves agency state and episode views', async () => {
        const baseUrl = await start();

        const fleet = await fetch(`${baseUrl}/agency`);
        const one = await fetch(`${baseUrl}/bots/bot.one/agency`);
        const episodes = await fetch(`${baseUrl}/bots/bot.one/episodes?limit=5`);
        const fleetBody = (await json(fleet)) as { agency: unknown[] };
        const oneBody = (await json(one)) as { agency: { botId: string } };
        const episodeBody = (await json(episodes)) as { episodes: unknown[] };

        expect(fleet.status).toBe(200);
        expect(fleetBody.agency).toEqual([]);
        expect(oneBody.agency.botId).toBe('bot.one');
        expect(episodeBody.episodes).toEqual([]);
    });

    it('runs fleet controls and validates bodies', async () => {
        const baseUrl = await start();

        const pause = await fetch(`${baseUrl}/fleet/pause`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: 'maintenance' }),
        });
        const stop = await fetch(`${baseUrl}/fleet/emergency-stop`, {
            method: 'POST',
            body: '{}',
        });
        const invalid = await fetch(`${baseUrl}/fleet/resume`, {
            method: 'POST',
            body: '{',
        });
        const botPause = await fetch(`${baseUrl}/bots/bot.two/pause`, {
            method: 'POST',
            body: '{}',
        });

        const pauseBody = (await json(pause)) as { bots: string[] };
        const botPauseBody = (await json(botPause)) as { bots: string[] };

        expect(pause.status).toBe(200);
        expect(pauseBody.bots).toEqual(['bot.one']);
        expect(stop.status).toBe(200);
        expect(invalid.status).toBe(400);
        expect(botPauseBody.bots).toEqual(['bot.two']);
    });

    it('returns not found for unknown routes', async () => {
        const baseUrl = await start();

        const response = await fetch(`${baseUrl}/missing`);

        expect(response.status).toBe(404);
    });

    it('reports health status code', async () => {
        const baseUrl = await start();

        const response = await fetch(`${baseUrl}/health`);

        expect(response.status).toBe(200);
    });
});
