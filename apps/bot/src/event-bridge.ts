import { attempt, type LoggerPort, type Result, type TransportFailure } from '@ticrafter/core';
import type { Bot } from 'mineflayer';

export interface BridgeEvent {
    event: string;
    at: string;
    data?: unknown;
}

export type BridgeEmitter = (event: BridgeEvent) => Result<void, TransportFailure>;
export type BlockUpdateHandler = (block: unknown) => void;

export class BotEventBridge {
    private readonly detach: Array<() => void> = [];

    constructor(
        private readonly bot: Bot,
        private readonly emit: BridgeEmitter,
        private readonly logger: LoggerPort,
        private readonly blockUpdate?: BlockUpdateHandler,
        private readonly chat?: (username: string, message: string, playerId?: string) => void,
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
        this.bindBlockUpdates();
        this.bindChat();
    }

    detachAll(): void {
        this.detach.forEach((detach) => detach());
        this.detach.length = 0;
    }

    private bind(event: string, data: (...argumentsList: unknown[]) => unknown): void {
        const handler = (...argumentsList: unknown[]) => this.handle(event, data, argumentsList);
        this.bot.on(event as never, handler as never);
        this.detach.push(() => this.bot.removeListener(event as never, handler as never));
    }

    private bindChat(): void {
        if (this.chat === undefined) return;
        const handler = (username: string, message: string) => {
            const playerId = this.bot.players[username]?.uuid;
            this.emit({
                event: 'chat',
                at: new Date().toISOString(),
                data: { username, message, playerId },
            });
            this.chat?.(username, message, playerId);
        };
        this.bot.on('chat', handler as never);
        this.detach.push(() => this.bot.removeListener('chat', handler as never));
    }

    private bindBlockUpdates(): void {
        if (this.blockUpdate === undefined) return;
        const handler = (_oldBlock: unknown, newBlock: unknown) => {
            const [, handlerError] = attempt(() => this.blockUpdate?.(newBlock));
            if (handlerError) {
                this.logger.warn(
                    { event: 'blockUpdate', error: this.describe(handlerError) },
                    'block update bridge failed',
                );
            }
        };
        this.bot.world.on('blockUpdate', handler as never);
        this.detach.push(() => this.bot.world.removeListener('blockUpdate', handler as never));
    }

    private handle(
        event: string,
        data: (...argumentsList: unknown[]) => unknown,
        argumentsList: unknown[],
    ): void {
        const [value, dataError] = attempt(() => data(...argumentsList));
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
