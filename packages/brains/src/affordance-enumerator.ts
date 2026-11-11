import type { Result } from '@ticrafter/core';
import type { Skill, SkillContext, SkillInput, SkillRegistry } from '@ticrafter/skills';

export interface AffordanceRequest {
    skillId: string;
    input: SkillInput;
    reason: string;
    label?: string;
    priority: number;
}

export interface Affordance extends AffordanceRequest {
    id: string;
}

const MINIMUM_AFFORDANCES = 8;
const MAXIMUM_AFFORDANCES = 16;
const MAXIMUM_LABEL_WORDS = 12;

export class AffordanceEnumerator {
    constructor(private readonly registry: SkillRegistry) {}

    enumerate(
        context: SkillContext | null,
        requests: readonly AffordanceRequest[],
    ): Result<readonly Affordance[], string> {
        const affordances: Affordance[] = [];
        for (const [index, request] of requests.entries()) {
            const label = request.label ?? request.reason;
            if (!this.isValidLabel(label)) {
                return [null, `affordance ${request.skillId} label must be 1-12 words`];
            }
            const [skill, resolveError] = this.registry.resolve(request.skillId);
            if (resolveError) return [null, resolveError];
            if (skill === null) return [null, `skill ${request.skillId} resolved null`];
            const [canRun, canRunError] = this.canRun(skill, context, request.input);
            if (canRunError) return [null, canRunError];
            if (canRun !== true) continue;
            affordances.push({ ...request, id: `${request.skillId}:${index}` });
            if (affordances.length > MAXIMUM_AFFORDANCES) {
                return [null, `affordance list exceeds ${MAXIMUM_AFFORDANCES} options`];
            }
        }
        if (affordances.length < MINIMUM_AFFORDANCES) {
            return [null, `affordance list requires at least ${MINIMUM_AFFORDANCES} options`];
        }
        return [affordances, null];
    }

    private canRun(
        skill: Skill,
        context: SkillContext | null,
        input: SkillInput,
    ): Result<boolean, string> {
        if (context === null) return [true, null];
        return skill.canRun(context, input);
    }

    private isValidLabel(label: string): boolean {
        const trimmed = label.trim();
        if (trimmed.length === 0) return false;
        return trimmed.split(/\s+/).length <= MAXIMUM_LABEL_WORDS;
    }
}
