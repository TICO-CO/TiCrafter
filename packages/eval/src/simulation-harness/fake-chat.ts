import type { HeadlessChatPort } from '@ticrafter/bot/headless';
import type { Result } from '@ticrafter/core';

export class FakeChat implements HeadlessChatPort {
    readonly sent: string[] = [];
    private readonly listeners = new Set<
        (username: string, message: string, playerId?: string) => void
    >();

    send(text: string): Result<void, string> {
        this.sent.push(text);
        return [undefined, null];
    }

    listen(listener: (username: string, message: string, playerId?: string) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    deliver(username: string, message: string, playerId?: string): void {
        this.listeners.forEach((listener) => listener(username, message, playerId));
    }
}
