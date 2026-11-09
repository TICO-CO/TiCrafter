export interface BackoffOptions {
    baseMs?: number;
    maxMs?: number;
    jitter?: number;
}

export class ReconnectPolicy {
    static delay(attempt: number, options: BackoffOptions = {}): number {
        const base = options.baseMs ?? 250;
        const max = options.maxMs ?? 10_000;
        const jitter = options.jitter ?? 0.2;
        const exponential = Math.min(max, base * 2 ** Math.max(0, attempt));
        const factor = 1 - jitter + Math.random() * jitter * 2;
        return Math.round(exponential * factor);
    }
}
