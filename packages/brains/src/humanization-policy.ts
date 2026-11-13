export interface RandomSource {
    next(): number;
}

export interface HumanizationTraits {
    caution: number;
    orderliness: number;
    patience: number;
}

export interface SprintContext {
    distance: number;
    indoor: boolean;
    nearHazard: boolean;
    surface: 'open' | 'confined';
}

export interface HumanizationConfig {
    reactionLatencyMilliseconds: { minimum: number; maximum: number };
    pauseChance: number;
    pauseDurationMilliseconds: { minimum: number; maximum: number };
    scanChance: number;
    chatDelayMilliseconds: { minimum: number; maximum: number };
    switchThreshold: number;
    sprintDistanceThreshold: number;
}

const DEFAULT_CONFIG: HumanizationConfig = {
    reactionLatencyMilliseconds: { minimum: 50, maximum: 250 },
    pauseChance: 0.12,
    pauseDurationMilliseconds: { minimum: 400, maximum: 1600 },
    scanChance: 0.2,
    chatDelayMilliseconds: { minimum: 800, maximum: 3000 },
    switchThreshold: 0.2,
    sprintDistanceThreshold: 24,
};

export class SeededRandomSource implements RandomSource {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    }
}

export class HumanizationPolicy {
    private readonly config: HumanizationConfig;

    constructor(
        private readonly random: RandomSource,
        private readonly traits: HumanizationTraits,
        config: Partial<HumanizationConfig> = {},
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    reactionLatency(): number {
        return this.between(
            this.config.reactionLatencyMilliseconds.minimum,
            this.config.reactionLatencyMilliseconds.maximum,
        );
    }

    pauseChance(): number {
        return this.clamp(
            this.config.pauseChance + this.traits.patience * 0.08 - this.traits.caution * 0.04,
        );
    }

    pauseDuration(): number {
        return this.between(
            this.config.pauseDurationMilliseconds.minimum,
            this.config.pauseDurationMilliseconds.maximum,
        );
    }

    scanChance(): number {
        return this.clamp(this.config.scanChance + this.traits.caution * 0.1);
    }

    chatDelay(): number {
        return this.between(
            this.config.chatDelayMilliseconds.minimum,
            this.config.chatDelayMilliseconds.maximum,
        );
    }

    switchThreshold(): number {
        return this.clamp(this.config.switchThreshold + this.traits.caution * 0.1);
    }

    sprintAllowed(context: SprintContext): boolean {
        if (context.indoor || context.nearHazard) return false;
        if (context.surface !== 'open') return false;
        return context.distance >= this.config.sprintDistanceThreshold;
    }

    shouldPause(): boolean {
        return this.random.next() < this.pauseChance();
    }

    shouldScan(): boolean {
        return this.random.next() < this.scanChance();
    }

    private between(minimum: number, maximum: number): number {
        return Math.round(minimum + this.random.next() * Math.max(0, maximum - minimum));
    }

    private clamp(value: number): number {
        return Math.max(0, Math.min(1, value));
    }
}
