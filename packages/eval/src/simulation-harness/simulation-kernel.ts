import type { Result } from '@ticrafter/core';

import type { SimulationClock } from './simulation-clock.js';

export interface SimulationKernelOptions {
    clock: SimulationClock;
    tickMilliseconds?: number;
    maximumTicks: number;
    durationTicks?: number;
    shouldStop: () => boolean;
    onTick?: (tick: number) => void | Promise<void>;
}

export class SimulationKernel {
    private readonly tickMilliseconds: number;

    constructor(private readonly options: SimulationKernelOptions) {
        this.tickMilliseconds = options.tickMilliseconds ?? 250;
    }

    async run(): Promise<Result<number, string>> {
        const maximumTicks = this.options.durationTicks ?? this.options.maximumTicks;
        for (let tick = 1; tick <= maximumTicks; tick += 1) {
            await this.settle();
            if (this.options.shouldStop()) return [tick, null];
            this.options.clock.advanceBy(this.tickMilliseconds);
            await this.options.onTick?.(tick);
            await this.settle();
            if (this.options.shouldStop()) return [tick, null];
        }
        if (this.options.durationTicks !== undefined) return [maximumTicks, null];
        return [null, `scenario exceeded ${this.options.maximumTicks} ticks`];
    }

    private async settle(): Promise<void> {
        for (let round = 0; round < 4; round += 1) {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }
}
