import http from 'node:http';

import { attempt, attemptAsync, type Result } from '@ticrafter/core';
import { z as zod } from 'zod';

import type { AgencyStatusView } from './agency-status-view.js';
import type { OpsAuditViewer } from './audit-viewer.js';
import type { OpsFleetEmergencyStop } from './fleet-emergency-stop.js';
import type { OpsHealthReadiness } from './health-readiness.js';
import type { OpsMetricsRegistry } from './metrics-registry.js';
import { OpsHttp, type OpsHttpResponse } from './ops-http.js';
import type { OpsPauseResumeController } from './pause-resume-controller.js';
import type { OpsSipDump } from './sip-dump.js';
import type { OpsStatusAggregator } from './status-aggregator.js';
import type { OpsStructuredLogger } from './structured-logger.js';
import type { OpsControlRequest, OpsControlResult, OpsFailure } from './types.js';

const controlSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export interface OpsApiContext {
    epoch: number;
    schemaVersion: number;
    sessions(): number;
    uptimeSeconds(): number;
}

export interface OpsApiOptions {
    host: string;
    port: number;
    logger: OpsStructuredLogger;
    metrics: OpsMetricsRegistry;
    status: OpsStatusAggregator;
    health: OpsHealthReadiness;
    agency: AgencyStatusView;
    sip: OpsSipDump;
    audit: OpsAuditViewer;
    pauseResume: OpsPauseResumeController;
    emergencyStop: OpsFleetEmergencyStop;
    context: OpsApiContext;
}

export class OpsApi {
    private server: http.Server | null = null;

    constructor(private readonly options: OpsApiOptions) {}

    async start(): Promise<Result<void, OpsFailure>> {
        const server = http.createServer((request, response) => this.handle(request, response));
        this.server = server;
        const [started, startError] = await attemptAsync<void, OpsFailure>(
            () =>
                new Promise<void>((resolve, reject) => {
                    server.once('error', (error) =>
                        reject({ type: 'LISTEN_FAILED', message: error.message }),
                    );
                    server.listen(this.options.port, this.options.host, () => resolve());
                }),
        );
        if (startError) return [null, startError];
        if (started === null) {
            return [null, { type: 'LISTEN_FAILED', message: 'server returned null' }];
        }
        this.options.logger.info(
            { host: this.options.host, port: this.options.port },
            'ops server listening',
        );
        return [undefined, null];
    }

    async close(): Promise<void> {
        const server = this.server;
        this.server = null;
        if (!server) return;
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    get listeningPort(): number {
        const address = this.server?.address();
        return typeof address === 'object' && address !== null ? address.port : this.options.port;
    }

    private handle(request: http.IncomingMessage, response: http.ServerResponse): void {
        void this.dispatchSafely(request, response);
    }

    private async dispatchSafely(
        request: http.IncomingMessage,
        response: http.ServerResponse,
    ): Promise<void> {
        const startedAt = Date.now();
        const [result, dispatchError] = await this.dispatch(request);
        this.options.metrics.observe('ops_ops_api_latency_ms', Date.now() - startedAt);
        if (dispatchError || result === null) {
            this.options.metrics.increment('ops_ops_api_errors_total');
            OpsHttp.send(
                response,
                OpsHttp.failure(
                    dispatchError ?? { type: 'UNAVAILABLE', message: 'empty response' },
                ),
            );
            return;
        }
        if (result.status >= 400) this.options.metrics.increment('ops_ops_api_errors_total');
        OpsHttp.send(response, result);
    }

    private async dispatch(
        request: http.IncomingMessage,
    ): Promise<Result<OpsHttpResponse, OpsFailure>> {
        const method = request.method ?? 'GET';
        const [url, urlError] = attempt(() => new URL(request.url ?? '/', 'http://localhost'));
        if (urlError || url === null) {
            return [null, { type: 'INVALID_REQUEST', message: 'invalid request URL' }];
        }
        if (method === 'GET') return this.get(url);
        if (method === 'POST') return this.post(url, request);
        return [null, { type: 'INVALID_REQUEST', message: `unsupported method ${method}` }];
    }

    private get(url: URL): Result<OpsHttpResponse, OpsFailure> {
        const botAgency = /^\/bots\/([^/]+)\/agency$/.exec(url.pathname);
        if (botAgency !== null && botAgency[1] !== undefined) {
            return this.agencyOne(botAgency[1]);
        }
        const botEpisodes = /^\/bots\/([^/]+)\/episodes$/.exec(url.pathname);
        if (botEpisodes !== null && botEpisodes[1] !== undefined) {
            return this.agencyEpisodes(
                botEpisodes[1],
                OpsHttp.limit(url.searchParams.get('limit'), 20),
            );
        }
        switch (url.pathname) {
            case '/health':
                return this.health();
            case '/status':
                return this.status();
            case '/metrics':
                return [
                    { status: 200, body: { ok: true, metrics: this.options.metrics.snapshot() } },
                    null,
                ];
            case '/sip':
                return this.sip();
            case '/agency':
                return this.agencyFleet();
            case '/audit/events':
                return this.auditResponse(
                    this.options.audit.events(OpsHttp.limit(url.searchParams.get('limit'), 100)),
                    'events',
                );
            case '/audit/blocks':
                return this.auditResponse(
                    this.options.audit.blocks(
                        OpsHttp.limit(url.searchParams.get('limit'), 100),
                        url.searchParams.get('botId') ?? undefined,
                    ),
                    'blocks',
                );
            case '/audit/episodes':
                return this.auditResponse(
                    this.options.audit.episodes(OpsHttp.limit(url.searchParams.get('limit'), 100)),
                    'episodes',
                );
            default:
                return [{ status: 404, body: { ok: false, error: 'not_found' } }, null];
        }
    }

    private async post(
        url: URL,
        request: http.IncomingMessage,
    ): Promise<Result<OpsHttpResponse, OpsFailure>> {
        const [body, bodyError] = await OpsHttp.readJson(request);
        if (bodyError || body === null) {
            return [null, bodyError ?? { type: 'INVALID_REQUEST', message: 'body unavailable' }];
        }
        const parsed = controlSchema.safeParse(body);
        if (!parsed.success) {
            return [null, { type: 'INVALID_REQUEST', message: parsed.error.message }];
        }
        const botAction = /^\/bots\/([^/]+)\/(pause|resume)$/.exec(url.pathname);
        if (botAction !== null) {
            const [, botId, action] = botAction;
            if (botId === undefined || action === undefined) {
                return [null, { type: 'INVALID_REQUEST', message: 'invalid bot route' }];
            }
            const requestPayload: OpsControlRequest = { botId, ...parsed.data };
            return this.controlResponse(
                action === 'pause'
                    ? this.options.pauseResume.pause(requestPayload)
                    : this.options.pauseResume.resume(requestPayload),
            );
        }
        if (url.pathname === '/fleet/pause') {
            return this.controlResponse(this.options.pauseResume.pause(parsed.data));
        }
        if (url.pathname === '/fleet/resume') {
            return this.controlResponse(this.options.pauseResume.resume(parsed.data));
        }
        if (url.pathname === '/fleet/emergency-stop') {
            return this.controlResponse(
                this.options.emergencyStop.trigger(parsed.data.reason ?? 'operator emergency stop'),
            );
        }
        return [{ status: 404, body: { ok: false, error: 'not_found' } }, null];
    }

    private health(): Result<OpsHttpResponse, OpsFailure> {
        const [report, reportError] = this.options.health.check();
        if (reportError || report === null) {
            return [null, reportError ?? { type: 'UNAVAILABLE', message: 'health unavailable' }];
        }
        return [{ status: report.ok ? 200 : 503, body: report }, null];
    }

    private status(): Result<OpsHttpResponse, OpsFailure> {
        const [snapshot, snapshotError] = this.options.status.snapshot();
        if (snapshotError || snapshot === null) {
            return [null, snapshotError ?? { type: 'UNAVAILABLE', message: 'status unavailable' }];
        }
        return [
            {
                status: 200,
                body: {
                    ok: true,
                    epoch: this.options.context.epoch,
                    uptimeSeconds: this.options.context.uptimeSeconds(),
                    sessions: this.options.context.sessions(),
                    schemaVersion: this.options.context.schemaVersion,
                    ...snapshot,
                },
            },
            null,
        ];
    }

    private sip(): Result<OpsHttpResponse, OpsFailure> {
        const [snapshot, snapshotError] = this.options.sip.snapshot();
        if (snapshotError || snapshot === null) {
            return [null, snapshotError ?? { type: 'UNAVAILABLE', message: 'SIP unavailable' }];
        }
        return [{ status: 200, body: { ok: true, sip: snapshot } }, null];
    }

    private agencyFleet(): Result<OpsHttpResponse, OpsFailure> {
        const [snapshots, snapshotError] = this.options.agency.fleet();
        if (snapshotError !== null) {
            return [null, { type: 'UNAVAILABLE', message: snapshotError }];
        }
        if (snapshots === null) {
            return [null, { type: 'UNAVAILABLE', message: 'agency unavailable' }];
        }
        return [{ status: 200, body: { ok: true, agency: snapshots } }, null];
    }

    private agencyOne(botId: string): Result<OpsHttpResponse, OpsFailure> {
        const [snapshot, snapshotError] = this.options.agency.one(botId);
        if (snapshotError !== null) {
            return [null, { type: 'UNAVAILABLE', message: snapshotError }];
        }
        if (snapshot === null) {
            return [{ status: 404, body: { ok: false, error: 'not_found' } }, null];
        }
        return [{ status: 200, body: { ok: true, agency: snapshot } }, null];
    }

    private agencyEpisodes(botId: string, limit: number): Result<OpsHttpResponse, OpsFailure> {
        const [episodes, episodeError] = this.options.agency.episodes(botId, limit);
        if (episodeError || episodes === null) {
            return [
                null,
                episodeError === null
                    ? { type: 'UNAVAILABLE', message: 'episodes unavailable' }
                    : { type: 'UNAVAILABLE', message: episodeError },
            ];
        }
        return [{ status: 200, body: { ok: true, episodes } }, null];
    }

    private auditResponse<T>(
        result: Result<readonly T[], OpsFailure>,
        key: string,
    ): Result<OpsHttpResponse, OpsFailure> {
        const [items, itemsError] = result;
        if (itemsError || items === null) {
            return [null, itemsError ?? { type: 'UNAVAILABLE', message: 'audit unavailable' }];
        }
        return [{ status: 200, body: { ok: true, [key]: items } }, null];
    }

    private controlResponse(result: OpsControlResult): Result<OpsHttpResponse, OpsFailure> {
        return [
            {
                status: result.bots.length === 0 && result.failures.length > 0 ? 409 : 200,
                body: {
                    ok: result.failures.length === 0,
                    bots: result.bots,
                    failures: result.failures,
                },
            },
            null,
        ];
    }
}
