import { attempt, type Result } from '@ticrafter/core';
import type { Bot } from 'mineflayer';
import type { Logger } from 'pino';

export interface BridgeEvent {
    event: string;
    at: string;
    data?: unknown;
}

export type BridgeEmitter = (event: BridgeEvent) => Result<void, unknown>;

export class BotEventBridge {
    private readonly detach: Array<() => void> = [];

    constructor(
        private readonly bot: Bot,
        private readonly emit: BridgeEmitter,
        private readonly logger: Logger,
    ) {}

    attach(): void {
        this.bind('spawn', () => ({ username: this.bot.username }));
        this.bind('login', () => ({ username: this.bot.username }));
        this.bind('death', () => ({}));
        this.bind('kicked', (reason) => ({ reason }));
        this.bind('error', (error) => ({
            message: error instanceof Error ? error.message : String(error),
        }));
        this.bind('end', (reason) => ({ reason }));
    }

    detachAll(): void {
        for (const detach of this.detach) detach();
        this.detach.length = 0;
    }

    private bind(event: string, data: (...args: unknown[]) => unknown): void {
        const handler = (...args: unknown[]) => this.handle(event, data, args);
        this.bot.on(event as never, handler as never);
        this.detach.push(() => this.bot.removeListener(event as never, handler as never));
    }

    private handle(
        event: string,
        data: (...args: unknown[]) => unknown,
        args: unknown[],
    ): void {
        const [value, dataError] = attempt(() => data(...args));
        if (dataError) {
            this.logger.warn(
                { event, error: this.describe(dataError) },
                'event bridge payload failed',
            );
            return;
        }
        const [, emitError] = this.emit({
            event,
            at: new Date().toISOString(),
            data: value,
        });
        if (emitError) {
            this.logger.warn({ event, error: this.describe(emitError) }, 'event bridge failed');
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : JSON.stringify(error);
    }
}
