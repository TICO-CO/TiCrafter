import type { PersonalityModel } from './personality-model.js';
import type { SocialContext, SocialIntent } from './types.js';

const RATE_WINDOW_MILLISECONDS = 60_000;

export class SocialEngine {
    private sent: number[] = [];

    classify(message: string): SocialIntent {
        const text = message.trim().toLowerCase();
        if (text.length === 0) return 'unknown';
        if (/^(hi|hello|hey|good morning|good evening)\b/.test(text)) return 'greeting';
        if (/(help|need|can you|could you|please)\b/.test(text)) return 'request';
        if (/(have|here|take|share|offer|give)\b/.test(text)) return 'offer';
        if (/(danger|monster|zombie|creeper|lava|run|help!)\b/.test(text)) return 'danger';
        if (/(found|discovered|look|see|new)\b/.test(text)) return 'discovery';
        if (/(how are|what are you|status|doing)\b/.test(text)) return 'status';
        return 'small-talk';
    }

    reply(
        intent: SocialIntent,
        context: SocialContext,
        personality: PersonalityModel,
    ): string | null {
        const warm = personality.weight('sociability') > 0.5;
        switch (intent) {
            case 'greeting':
                return warm
                    ? `Hi ${context.recipient}. I am ${context.botName}.`
                    : `Hello ${context.recipient}.`;
            case 'status':
                return context.activeGoal === null
                    ? 'I am looking for something useful to do.'
                    : `I am working on ${context.activeGoal}.`;
            case 'request':
                return warm ? 'I can try to help. What do you need?' : 'What do you need?';
            case 'offer':
                return warm ? 'Thanks. I could use that.' : 'Thanks.';
            case 'danger':
                return 'Danger noted. Stay back.';
            case 'discovery':
                return 'Nice find. I will remember that.';
            case 'small-talk':
                return warm && context.phase === 'evening'
                    ? 'Quiet evening. Good time to sort inventory.'
                    : null;
            case 'unknown':
                return null;
        }
    }

    canSpeak(now: number, ratePerMinute: number): boolean {
        this.sent = this.sent.filter((timestamp) => now - timestamp < RATE_WINDOW_MILLISECONDS);
        return this.sent.length < ratePerMinute;
    }

    recordMessage(now: number): boolean {
        if (this.sent.includes(now)) return false;
        this.sent.push(now);
        return true;
    }
}
