import type http from 'node:http';

import { attempt, attemptAsync, type Result } from '@ticrafter/core';

import type { OpsFailure } from './types.js';

export interface OpsHttpResponse {
    status: number;
    body: unknown;
}

export class OpsHttp {
    static async readJson(
        request: http.IncomingMessage,
        maximumBytes = 16_384,
    ): Promise<Result<unknown, OpsFailure>> {
        const [body, readError] = await attemptAsync<string, OpsFailure>(
            () =>
                new Promise<string>((resolve, reject) => {
                    let settled = false;
                    let size = 0;
                    const chunks: Buffer[] = [];
                    const fail = (message: string): void => {
                        if (settled) return;
                        settled = true;
                        reject({ type: 'INVALID_REQUEST', message });
                    };
                    request.on('data', (chunk: Buffer) => {
                        size += chunk.length;
                        if (size > maximumBytes) {
                            fail('request body too large');
                            request.destroy();
                            return;
                        }
                        chunks.push(chunk);
                    });
                    request.on('end', () => {
                        if (settled) return;
                        settled = true;
                        resolve(Buffer.concat(chunks).toString('utf8'));
                    });
                    request.on('error', (error) => fail(error.message));
                }),
        );
        if (readError || body === null) {
            return [null, readError ?? { type: 'INVALID_REQUEST', message: 'body unavailable' }];
        }
        const [parsed, parseError] = attempt<unknown, OpsFailure>(() =>
            body.trim().length === 0 ? {} : JSON.parse(body),
        );
        if (parseError) {
            return [null, { type: 'INVALID_REQUEST', message: 'invalid JSON body' }];
        }
        return [parsed, null];
    }

    static send(response: http.ServerResponse, result: OpsHttpResponse): void {
        const [encoded, encodeError] = attempt(() => JSON.stringify(result.body ?? null));
        const payload =
            encodeError || encoded === null
                ? '{"ok":false,"error":"serialization_failed"}'
                : encoded;
        response.writeHead(result.status, { 'content-type': 'application/json' });
        response.end(`${payload}\n`);
    }

    static limit(value: string | null, fallback: number, maximum = 1000): number {
        if (value === null) return fallback;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) return fallback;
        return Math.min(parsed, maximum);
    }

    static failure(failure: OpsFailure): OpsHttpResponse {
        return {
            status: OpsHttp.statusFor(failure),
            body: {
                ok: false,
                error: {
                    type: failure.type,
                    message: OpsHttp.message(failure),
                },
            },
        };
    }

    private static statusFor(failure: OpsFailure): number {
        switch (failure.type) {
            case 'INVALID_REQUEST':
                return 400;
            case 'BOT_NOT_CONNECTED':
                return 409;
            case 'LISTEN_FAILED':
            case 'STORAGE':
            case 'COMMAND_FAILED':
            case 'UNAVAILABLE':
                return 500;
        }
    }

    private static message(failure: OpsFailure): string {
        switch (failure.type) {
            case 'STORAGE':
                return failure.failure.message;
            case 'BOT_NOT_CONNECTED':
                return `bot is not connected: ${failure.botId}`;
            case 'LISTEN_FAILED':
            case 'COMMAND_FAILED':
            case 'INVALID_REQUEST':
            case 'UNAVAILABLE':
                return failure.message;
        }
    }
}
