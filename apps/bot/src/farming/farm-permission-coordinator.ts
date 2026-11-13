import type { ClockHandle, ClockPort, LoggerPort, Result } from '@ticrafter/core';

import type { FarmPermissionService, FarmPermissionVerdict, FarmPlotRef } from './index.js';

export interface FarmPermissionCoordinatorOptions {
    plots: () => readonly FarmPlotRef[];
    permissions: FarmPermissionService;
    clock: ClockPort;
    logger: LoggerPort;
    intervalMilliseconds: number;
}

export class FarmPermissionCoordinator {
    private timer: ClockHandle | null = null;

    constructor(private readonly options: FarmPermissionCoordinatorOptions) {}

    start(): void {
        if (this.timer !== null) return;
        const [, error] = this.runOnce();
        if (error !== null) {
            this.options.logger.warn({ error }, 'farm permission preauthorization failed');
        }
        this.timer = this.options.clock.setInterval(
            () => this.runOnce(),
            this.options.intervalMilliseconds,
        );
    }

    stop(): void {
        if (this.timer === null) return;
        this.options.clock.clearInterval(this.timer);
        this.timer = null;
    }

    runOnce(): Result<void, string> {
        const plots = this.options.plots();
        for (const plot of plots) {
            void this.authorize(plot);
        }
        return [undefined, null];
    }

    private async authorize(plot: FarmPlotRef): Promise<void> {
        const [verdict, error] = await this.options.permissions.authorize(plot);
        if (error !== null) {
            this.options.logger.warn(
                { error, plotId: plot.id },
                'farm permission authorization failed',
            );
            return;
        }
        this.trace(plot.id, verdict);
    }

    private trace(plotId: string, verdict: FarmPermissionVerdict | null): void {
        if (verdict !== 'ask') return;
        this.options.logger.debug({ plotId }, 'farm permission inquiry sent');
    }
}
