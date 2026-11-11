import type { LoggerPort } from '@ticrafter/core';

export type OpsLogContext = Readonly<Record<string, unknown>>;

export class OpsStructuredLogger {
    constructor(
        private readonly logger: LoggerPort,
        private readonly context: OpsLogContext = {},
    ) {}

    child(context: OpsLogContext): OpsStructuredLogger {
        return new OpsStructuredLogger(this.logger, { ...this.context, ...context });
    }

    debug(payload?: unknown, message?: string): void {
        this.logger.debug(this.merge(payload), message);
    }

    info(payload?: unknown, message?: string): void {
        this.logger.info(this.merge(payload), message);
    }

    warn(payload?: unknown, message?: string): void {
        this.logger.warn(this.merge(payload), message);
    }

    error(payload?: unknown, message?: string): void {
        this.logger.error(this.merge(payload), message);
    }

    private merge(payload: unknown): OpsLogContext {
        if (payload === undefined) return this.context;
        if (OpsStructuredLogger.isRecord(payload)) return { ...this.context, ...payload };
        return { ...this.context, payload };
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
