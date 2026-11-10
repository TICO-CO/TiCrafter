import type { Result } from '@ticrafter/core';

import type { Skill } from './types.js';

export class SkillRegistry {
    private readonly skills = new Map<string, Skill>();

    register(skill: Skill): Result<void, string> {
        if (skill.id.length === 0) return [null, 'skill id required'];
        if (this.skills.has(skill.id)) return [null, `duplicate skill ${skill.id}`];
        this.skills.set(skill.id, skill);
        return [undefined, null];
    }

    resolve(skillId: string): Result<Skill, string> {
        const skill = this.skills.get(skillId);
        if (!skill) return [null, `unknown skill ${skillId}`];
        return [skill, null];
    }

    list(): readonly Skill[] {
        return Array.from(this.skills.values());
    }
}
