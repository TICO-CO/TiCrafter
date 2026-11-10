import type { Result } from '@ticrafter/core';
import type { SkillContext, SkillInput, SkillRegistry } from '@ticrafter/skills';

export interface AffordanceRequest {
    skillId: string;
    input: SkillInput;
    reason: string;
    priority: number;
}

export interface Affordance extends AffordanceRequest {
    id: string;
}

export class AffordanceEnumerator {
    constructor(private readonly registry: SkillRegistry) {}

    enumerate(
        context: SkillContext,
        requests: readonly AffordanceRequest[],
    ): Result<readonly Affordance[], string> {
        const affordances: Affordance[] = [];
        for (const [index, request] of requests.entries()) {
            const [skill, resolveError] = this.registry.resolve(request.skillId);
            if (resolveError) return [null, resolveError];
            if (skill === null) return [null, `skill ${request.skillId} resolved null`];
            const [canRun, canRunError] = skill.canRun(context, request.input);
            if (canRunError) return [null, canRunError];
            if (canRun !== true) continue;
            affordances.push({ ...request, id: `${request.skillId}:${index}` });
        }
        return [affordances, null];
    }
}
