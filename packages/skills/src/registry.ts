import type { Result } from '@ticrafter/core';

import type { Skill } from './types.js';

const REQUIRED_METHODS = [
    'canRun',
    'plan',
    'start',
    'step',
    'cancel',
    'checkpoint',
    'restore',
] as const;

export class SkillRegistry {
    private readonly skills = new Map<string, Skill>();

    register(skill: Skill): Result<void, string> {
        if (typeof skill.id !== 'string' || skill.id.length === 0) {
            return [null, 'skill id required'];
        }
        if (this.skills.has(skill.id)) return [null, `duplicate skill ${skill.id}`];
        const contractError = SkillRegistry.validateContract(skill);
        if (contractError !== null) return [null, contractError];
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

    private static validateContract(skill: Skill): string | null {
        const candidate = skill as unknown as Record<string, unknown>;
        for (const method of REQUIRED_METHODS) {
            if (typeof candidate[method] !== 'function') {
                return `skill ${skill.id} is missing ${method}`;
            }
        }
        return null;
    }
}
