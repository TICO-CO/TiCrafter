import { describe, expect, it } from 'bun:test';

import { PlannerTriggerEvaluator } from './trigger-evaluator.js';

describe('PlannerTriggerEvaluator', () => {
    it('fires interval triggers with cooldown', () => {
        const evaluator = new PlannerTriggerEvaluator({ intervalMilliseconds: 100 });
        expect(evaluator.evaluateInterval(1_000)?.kind).toBe('interval');
        expect(evaluator.evaluateInterval(1_050)).toBeNull();
        expect(evaluator.evaluateInterval(1_100)?.kind).toBe('interval');
    });

    it('fires failure bursts once per window', () => {
        const evaluator = new PlannerTriggerEvaluator({
            intervalMilliseconds: 100,
            failureBurstThreshold: 3,
            failureBurstWindowMilliseconds: 1_000,
        });
        expect(evaluator.observeTaskFailure(1_000)).toBeNull();
        expect(evaluator.observeTaskFailure(1_100)).toBeNull();
        const burst = evaluator.observeTaskFailure(1_200);
        expect(burst?.kind).toBe('task_failure_burst');
        expect(evaluator.observeTaskFailure(1_300)).toBeNull();
    });

    it('fires work-gap triggers with cooldown', () => {
        const evaluator = new PlannerTriggerEvaluator({
            intervalMilliseconds: 100,
            workGapCooldownMilliseconds: 1_000,
        });
        expect(evaluator.observeWorkGap(4, 4, 1_000)).toBeNull();
        expect(evaluator.observeWorkGap(3, 4, 1_000)?.kind).toBe('work_gap');
        expect(evaluator.observeWorkGap(2, 4, 1_500)).toBeNull();
        expect(evaluator.observeWorkGap(2, 4, 2_000)?.kind).toBe('work_gap');
        expect(evaluator.observeWorkGap(0, 0, 3_000)).toBeNull();
    });

    it('fires death clusters and chat requests', () => {
        const evaluator = new PlannerTriggerEvaluator({
            intervalMilliseconds: 100,
            deathClusterThreshold: 2,
        });
        expect(evaluator.observeDeath(1_000)).toBeNull();
        expect(evaluator.observeDeath(1_100)?.kind).toBe('death_cluster');
        expect(evaluator.observeChat('build a farm', 1_200).kind).toBe('chat_request');
    });

    it('applies conflict and landmark cooldowns', () => {
        const evaluator = new PlannerTriggerEvaluator({
            intervalMilliseconds: 100,
            conflictCooldownMilliseconds: 1_000,
            landmarkCooldownMilliseconds: 2_000,
        });
        expect(evaluator.observeConflict('conflict', 1_000)?.kind).toBe('sip_conflict');
        expect(evaluator.observeConflict('conflict', 1_500)).toBeNull();
        expect(evaluator.observeLandmark('landmark-1', 1_000)?.kind).toBe('landmark');
        expect(evaluator.observeLandmark('landmark-2', 2_000)).toBeNull();
        expect(evaluator.observeLandmark('landmark-3', 3_100)?.kind).toBe('landmark');
    });
});
