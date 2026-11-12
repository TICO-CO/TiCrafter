export interface NightPrepConfig {
    enabled: boolean;
    duskLeadTicks: number;
    foodServings: number;
    minHealth: number;
    homeRadius: number;
    buildWindowTicks: number;
    buildMaterialCount: number;
    woolTarget: number;
    allowShelterBuild: boolean;
    allowDigIn: boolean;
}

export class NightPrepDefaults {
    static config(): NightPrepConfig {
        return {
            enabled: true,
            duskLeadTicks: 3_000,
            foodServings: 3,
            minHealth: 10,
            homeRadius: 8,
            buildWindowTicks: 2_000,
            buildMaterialCount: 32,
            woolTarget: 3,
            allowShelterBuild: true,
            allowDigIn: true,
        };
    }
}
