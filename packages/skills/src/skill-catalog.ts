import type { Result } from '@ticrafter/core';

import { CollectSkill } from './collect.js';
import { CraftSkill } from './craft.js';
import { DepositSkill } from './deposit.js';
import { EatSkill } from './eat.js';
import { FleeDefendSkill } from './flee-defend.js';
import { FollowPathSkill } from './follow-path.js';
import { MineSkill } from './mine.js';
import { NavigateSkill } from './navigate.js';
import { SkillRegistry } from './registry.js';
import { WithdrawSkill } from './withdraw.js';

export class SkillCatalog {
    static createRegistry(): Result<SkillRegistry, string> {
        const registry = new SkillRegistry();
        const skills = [
            new NavigateSkill(),
            new FollowPathSkill(),
            new MineSkill(),
            new CollectSkill(),
            new EatSkill(),
            new FleeDefendSkill(),
            new CraftSkill(),
            new DepositSkill(),
            new WithdrawSkill(),
        ];
        for (const skill of skills) {
            const [, registerError] = registry.register(skill);
            if (registerError) return [null, registerError];
        }
        return [registry, null];
    }
}
