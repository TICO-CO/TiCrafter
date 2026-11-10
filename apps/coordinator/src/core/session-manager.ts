import type { ClientConnection } from '../transport/index.js';

export interface Session {
    botId: string;
    name: string;
    connectionId: string;
    connectedAt: string;
    lastSeen: string;
}

export class SessionManager {
    private readonly sessions = new Map<string, Session>();

    add(session: Session): void {
        this.sessions.set(session.botId, session);
    }

    get(botId: string): Session | undefined {
        return this.sessions.get(botId);
    }

    touch(botId: string, at = new Date().toISOString()): void {
        const session = this.sessions.get(botId);
        if (session) session.lastSeen = at;
    }

    removeByConnection(connection: ClientConnection): void {
        if (connection.botId) this.sessions.delete(connection.botId);
    }

    remove(botId: string): void {
        this.sessions.delete(botId);
    }

    list(): Session[] {
        return [...this.sessions.values()];
    }

    count(): number {
        return this.sessions.size;
    }

    pruneStale(timeoutMs: number, now = Date.now()): string[] {
        const removed: string[] = [];
        for (const [botId, session] of this.sessions) {
            if (now - Date.parse(session.lastSeen) > timeoutMs) {
                this.sessions.delete(botId);
                removed.push(botId);
            }
        }
        return removed;
    }
}
