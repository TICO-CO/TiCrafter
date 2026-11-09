import http from 'node:http';
import { attemptAsync, type Result } from '@ticrafter/core';
import type { Logger } from 'pino';

export interface OpsStatus {
    ok: boolean;
    epoch: number;
    uptimeSeconds: number;
    sessions: number;
    schemaVersion: number;
}

export interface OpsServerOptions {
    host: string;
    port: number;
    logger: Logger;
    status: () => OpsStatus;
}

export type OpsFailure = { type: 'LISTEN_FAILED'; message: string };

export class OpsServer {
    private server: http.Server | null = null;

    constructor(private readonly options: OpsServerOptions) {}

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
        if (started === null) return [null, { type: 'LISTEN_FAILED', message: 'server returned null' }];

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

    private handle(request: http.IncomingMessage, response: http.ServerResponse): void {
        const known = request.url === '/health' || request.url === '/status';
        if (!known) {
            response.writeHead(404, { 'content-type': 'application/json' });
            response.end(`${JSON.stringify({ error: 'not_found' })}\n`);
            return;
        }
        const body = this.options.status();
        response.writeHead(body.ok ? 200 : 503, { 'content-type': 'application/json' });
        response.end(`${JSON.stringify(body)}\n`);
    }
}
