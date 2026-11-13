export type PermissionReply = 'affirmative' | 'negative' | null;

const AFFIRMATIVE = new Set(['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'go ahead', 'fine']);
const NEGATIVE = new Set(['no', 'nope', 'not now', 'denied', 'stop', 'never']);

export class PermissionReplyParser {
    static parse(message: string): PermissionReply {
        const normalized = message
            .trim()
            .toLowerCase()
            .replace(/[.!?,]+$/g, '')
            .replace(/\s+/g, ' ');
        if (AFFIRMATIVE.has(normalized)) return 'affirmative';
        if (NEGATIVE.has(normalized)) return 'negative';
        if (/\b(yes|yeah|yep|sure|okay|ok|fine)\b/.test(normalized)) return 'affirmative';
        if (/\b(no|nope|denied|never|stop)\b/.test(normalized)) return 'negative';
        return null;
    }
}
