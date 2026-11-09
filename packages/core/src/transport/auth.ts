import type { Result } from '../result.js';
import type { TransportFailure } from './failures.js';
import { sessionHelloSchema } from './messages.js';

export interface AuthenticatedBot {
    botId: string;
    name: string;
}

export class SessionAuthenticator {
    static authenticate(payload: unknown, allowedNames: string[]): Result<AuthenticatedBot, TransportFailure> {
        const parsed = sessionHelloSchema.safeParse(payload);
        if (!parsed.success) {
            const message = parsed.error.issues.map((issue) => issue.message).join('; ');
            return [null, { type: 'AUTH_FAILED', message }];
        }
        if (!allowedNames.includes(parsed.data.name)) {
            return [null, { type: 'AUTH_FAILED', message: `unknown bot name: ${parsed.data.name}` }];
        }
        if (parsed.data.botId !== parsed.data.name && !/^bot\.[a-z0-9-]+$/.test(parsed.data.botId)) {
            return [null, { type: 'AUTH_FAILED', message: `invalid bot id: ${parsed.data.botId}` }];
        }
        return [{ botId: parsed.data.botId, name: parsed.data.name }, null];
    }
}
