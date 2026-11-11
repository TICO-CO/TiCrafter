import { MobThreatRules, type Result } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillHostile,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const FLEE_DISTANCE = 10;
const FLEE_MARGIN = 4;
const CRITICAL_HEALTH = 8;

export class FleeDefendSkill implements Skill {
    readonly id = 'flee-defend';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        return [this.threat(context) !== null, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        return [input, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const hostile = this.threat(context);
        if (hostile === null) return [null, 'no hostile mob nearby'];
        const run: SkillRun = { skillId: this.id, state: {} };
        return [this.react(context, hostile, run), null];
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'flee or defend failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status === 'completed') {
            return [SkillSharedUtilities.completed(run, 'survival action complete'), null];
        }
        const hostile = this.threat(context);
        if (hostile === null) {
            return [SkillSharedUtilities.completed(run, 'threat gone'), null];
        }
        return [this.react(context, hostile, run), null];
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private react(context: SkillContext, hostile: SkillHostile, run: SkillRun): SkillStep {
        if (this.mustFlee(context, hostile)) {
            const distance = Math.max(FLEE_DISTANCE, hostile.attackRange + FLEE_MARGIN);
            return SkillSharedUtilities.running(
                run,
                {
                    kind: 'move-to',
                    position: SkillSharedUtilities.awayFrom(
                        context.position,
                        hostile.position,
                        distance,
                    ),
                    range: 1,
                },
                0,
                1,
                'fleeing',
            );
        }
        const entityId = hostile.entityId;
        return SkillSharedUtilities.running(
            run,
            {
                kind: 'attack',
                ...(entityId === undefined ? {} : { entityId }),
                entityName: hostile.name,
            },
            0,
            1,
            `defending against ${hostile.name}`,
        );
    }

    private mustFlee(context: SkillContext, hostile: SkillHostile): boolean {
        if (context.health < CRITICAL_HEALTH) return true;
        if (MobThreatRules.isImmediate(hostile)) return true;
        return MobThreatRules.isRangedInRange(hostile);
    }

    private threat(context: SkillContext): SkillHostile | null {
        const threats = context.hostiles.filter(
            (hostile) => MobThreatRules.level(hostile) !== 'none',
        );
        if (threats.length === 0) return null;
        return threats.reduce((nearest, current) =>
            this.threatRank(current) > this.threatRank(nearest) ? current : nearest,
        );
    }

    private threatRank(hostile: SkillHostile): number {
        const critical = MobThreatRules.isCritical(hostile) ? 1_000 : 0;
        return critical - hostile.distance;
    }
}
