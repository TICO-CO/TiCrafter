import type { Result } from '@ticrafter/core';

import type { SimulationClock } from './simulation-clock.js';

export interface SimulationKernelOptions {
    clock: SimulationClock;
    tickMilliseconds?: number;
    maximumTicks: number;
    shouldStop: () => boolean;
    onTick?: (tick: number) => void;
}

export class SimulationKernel {
    private readonly tickMilliseconds: number;

    constructor(private readonly options: SimulationKernelOptions) {
        this.tickMilliseconds = options.tickMilliseconds ?? 250;
    }

    async run(): Promise<Result<number, string>> {
        for (let tick = 1; tick <= this.options.maximumTicks; tick += 1) {
            await this.settle();
            if (this.options.shouldStop()) return [tick, null];
            this.options.clock.advanceBy(this.tickMilliseconds);
            this.options.onTick?.(tick);
            await this.settle();
            if (this.options.shouldStop()) return [tick, null];
        }
        return [null, `scenario exceeded ${this.options.maximumTicks} ticks`];
    }

    private async settle(): Promise<void> {
        for (let round = 0; round < 4; round += 1) {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }
}
