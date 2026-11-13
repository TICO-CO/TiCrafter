import type { Result } from '@ticrafter/core';
import type { SkillFarmPlot, SkillFarmPlotSource } from '@ticrafter/skills';

export interface FarmPlotPermissionPort {
    isPermitted(plotId: string): boolean;
    consume?(plotId: string): boolean;
}

export class AuthorizedFarmPlotSource implements SkillFarmPlotSource {
    constructor(
        private readonly plots: SkillFarmPlotSource,
        private readonly permissions: FarmPlotPermissionPort,
    ) {}

    getPlot(plotId: string): Result<SkillFarmPlot | null, string> {
        if (!this.permissions.isPermitted(plotId)) {
            return [null, `farm plot ${plotId} is not permitted`];
        }
        if (this.permissions.consume !== undefined && !this.permissions.consume(plotId)) {
            return [null, `farm plot ${plotId} permission could not be consumed`];
        }
        return this.plots.getPlot(plotId);
    }
}
