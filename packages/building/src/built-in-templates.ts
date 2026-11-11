import type { Result } from '@ticrafter/core';

import type { BuildingFailure } from './failures.js';
import { BridgeTemplate } from './template-bridge.js';
import { FarmTemplate } from './template-farm.js';
import { HouseTemplate } from './template-house.js';
import { TemplateRegistry } from './template-registry.js';
import { RoadTemplate } from './template-road.js';
import { StorageTemplate } from './template-storage.js';
import { WallTemplate } from './template-wall.js';
import { WatchtowerTemplate } from './template-watchtower.js';

export class BuiltInTemplates {
    static createRegistry(): Result<TemplateRegistry, BuildingFailure> {
        return TemplateRegistry.create([
            new HouseTemplate(),
            new RoadTemplate(),
            new FarmTemplate(),
            new WallTemplate(),
            new BridgeTemplate(),
            new StorageTemplate(),
            new WatchtowerTemplate(),
        ]);
    }
}
