export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = Number.isFinite(seed) ? Math.trunc(seed) : 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    integer(minimum: number, maximum: number): number {
        const low = Math.ceil(Math.min(minimum, maximum));
        const high = Math.floor(Math.max(minimum, maximum));
        if (high < low) return low;
        return low + Math.floor(this.next() * (high - low + 1));
    }

    chance(probability: number): boolean {
        const bounded = Math.min(Math.max(probability, 0), 1);
        return this.next() < bounded;
    }

    pick<T>(values: readonly T[]): T | undefined {
        if (values.length === 0) return undefined;
        return values[this.integer(0, values.length - 1)];
    }

    shuffle<T>(values: readonly T[]): T[] {
        const shuffled = [...values];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const target = this.integer(0, index);
            const current = shuffled[index];
            const replacement = shuffled[target];
            if (current === undefined || replacement === undefined) continue;
            shuffled[index] = replacement;
            shuffled[target] = current;
        }
        return shuffled;
    }
}
