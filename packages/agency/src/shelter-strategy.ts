import type { NightPrepConfig } from './night-prep-config.js';
import type { AgencySnapshot, ShelterStrategy } from './types.js';

export interface ShelterStrategyInput {
    snapshot: AgencySnapshot;
    ticksUntilNight: number;
    materialCount: number;
}

export class ShelterStrategyModel {
    static choose(input: ShelterStrategyInput, config: NightPrepConfig): ShelterStrategy {
        if (input.snapshot.isSheltered) return 'keep';
        if (ShelterStrategyModel.canBuild(input, config)) return 'build';
        if (ShelterStrategyModel.canDigIn(input, config)) return 'dig-in';
        return 'none';
    }

    private static canBuild(input: ShelterStrategyInput, config: NightPrepConfig): boolean {
        if (!config.allowShelterBuild) return false;
        if (input.ticksUntilNight < config.buildWindowTicks) return false;
        return input.materialCount >= config.buildMaterialCount;
    }

    private static canDigIn(input: ShelterStrategyInput, config: NightPrepConfig): boolean {
        if (!config.allowDigIn) return false;
        return input.snapshot.digSite !== null;
    }
}
