import type { Result } from '@ticrafter/core';

import { BridgeSkill } from './bridge.js';
import { ClearSkill } from './clear.js';
import { CollectSkill } from './collect.js';
import { ConstructionSkill } from './construction.js';
import { CraftSkill } from './craft.js';
import { DepositSkill } from './deposit.js';
import { DigShelterSkill } from './dig-shelter.js';
import { EatSkill } from './eat.js';
import { EquipGearSkill } from './equip-gear.js';
import { ExploreSkill } from './explore.js';
import { FleeDefendSkill } from './flee-defend.js';
import { FollowPathSkill } from './follow-path.js';
import { GatherFoodSkill } from './gather-food.js';
import { GatherWoolSkill } from './gather-wool.js';
import { HarvestFarmSkill } from './harvest-farm.js';
import { MineSkill } from './mine.js';
import { NavigateSkill } from './navigate.js';
import { PlaceBedSkill } from './place-bed.js';
import { PlaceBuildSkill } from './place-build.js';
import { PlantFarmSkill } from './plant-farm.js';
import { SkillRegistry } from './registry.js';
import { RepairSkill } from './repair.js';
import { SchematicBuildSkill } from './schematic-build.js';
import { SleepSkill } from './sleep.js';
import { SmeltSkill } from './smelt.js';
import { WithdrawSkill } from './withdraw.js';

export class SkillCatalog {
    static createRegistry(): Result<SkillRegistry, string> {
        const registry = new SkillRegistry();
        const skills = [
            new NavigateSkill(),
            new FollowPathSkill(),
            new MineSkill(),
            new CollectSkill(),
            new ConstructionSkill(),
            new SmeltSkill(),
            new EatSkill(),
            new SleepSkill(),
            new EquipGearSkill(),
            new GatherFoodSkill(),
            new GatherWoolSkill(),
            new PlaceBedSkill(),
            new DigShelterSkill(),
            new DepositSkill(),
            new WithdrawSkill(),
            new FleeDefendSkill(),
            new ExploreSkill(),
            new BridgeSkill(),
            new ClearSkill(),
            new PlaceBuildSkill(),
            new SchematicBuildSkill(),
            new RepairSkill(),
            new HarvestFarmSkill(),
            new PlantFarmSkill(),
            new CraftSkill(),
        ];
        for (const skill of skills) {
            const [, registerError] = registry.register(skill);
            if (registerError) return [null, registerError];
        }
        return [registry, null];
    }
}
