import { readFileSync } from 'node:fs';

import {
    ConfigSchemaValidator,
    type DecisionRequest,
    type LoggerPort,
    type TicrafterConfig,
} from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { DecisionConfidenceCalibrator } from './confidence-calibrator.js';
import { DecisionService } from './decision-service.js';
import { DecisionDigestAssembler } from './digest-assembler.js';
import { DecisionDigestCache } from './digest-cache.js';
import { DecisionLatencyMetrics } from './latency-metrics.js';
import { DecisionOutputParser } from './output-parser.js';
import { DecisionQueue } from './queue.js';
import { DecisionRateLimiter } from './rate-limiter.js';
import { DecisionSingleInflightGuard } from './single-inflight-guard.js';
import type {
    DecisionAnswer,
    DecisionModelLoaderPort,
    DecisionModelLoadOptions,
    DecisionModelPort,
    DecisionProvider,
    DecisionQuestions,
    DecisionState,
} from './types.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

const configText = readFileSync(
    new URL('../../../../config/default.json', import.meta.url),
    'utf8',
);
const config = ConfigSchemaValidator.validate(JSON.parse(configText))[0] as TicrafterConfig;

function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
    return {
        botId: 'bot.tibot1',
        at: '2026-11-11T12:00:00.000Z',
        digest: {
            health: 20,
            food: 18,
            position: { x: 0, y: 64, z: 0 },
            inventoryCount: 3,
            inventorySummary: [{ name: 'oak_log', count: 12 }],
            hazards: [],
            currentSkill: 'mine',
        },
        affordances: Array.from({ length: 8 }, (_, index) => ({
            id: `skill:${index}`,
            skillId: `skill-${index}`,
            label: `Do skill ${index}`,
            priority: index,
        })),
        ...overrides,
    };
}

function layaAnswer(choice: string, confidence: number) {
    return {
        answers: {
            nextAction: {
                type: 'choice',
                choice,
                probabilities: { [choice]: confidence, 'skill:1': 1 - confidence },
                answer_confidence: confidence,
            },
            danger: { type: 'noul', noul: 0.1, answer_confidence: 0.9 },
            shouldContinue: { type: 'noul', noul: 0.9, answer_confidence: 0.9 },
        },
        usage: { input_tokens: 100, output_tokens: 10 },
    };
}

class FakeModel implements DecisionModelPort {
    readonly loadedProvider: DecisionProvider = 'cpu';
    readonly fallbackReason: string | null = null;
    readonly modelDir = '/fake/laya';
    calls = 0;

    constructor(
        private readonly value: unknown = layaAnswer('skill:0', 0.9),
        private readonly delayMilliseconds = 0,
    ) {}

    async answer(
        _state: DecisionState,
        _questions: DecisionQuestions,
    ): Promise<[DecisionAnswer, null]> {
        this.calls += 1;
        if (this.delayMilliseconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMilliseconds));
        }
        return [this.value as DecisionAnswer, null];
    }

    async close(): Promise<[undefined, null]> {
        return [undefined, null];
    }
}

class FakeLoader implements DecisionModelLoaderPort {
    constructor(private readonly model: DecisionModelPort | null) {}

    async load(
        _options: DecisionModelLoadOptions,
    ): Promise<[DecisionModelPort | null, string | null]> {
        if (this.model === null) return [null, 'model unavailable'];
        return [this.model, null];
    }
}

describe('DecisionDigestAssembler', () => {
    it('normalizes and caches bounded state', () => {
        const assembler = new DecisionDigestAssembler(600);
        const [assembled, assembleError] = assembler.assemble(request());
        expect(assembleError).toBeNull();
        expect(assembled?.state.inventorySummary).toHaveLength(1);
        const cache = new DecisionDigestCache(1);
        cache.set(assembled?.key ?? '', assembled?.state as DecisionState);
        expect(cache.get(assembled?.key ?? '')).not.toBeNull();
    });

    it('carries working-memory revision and focus into the digest', () => {
        const assembler = new DecisionDigestAssembler(600);
        const [assembled, assembleError] = assembler.assemble(
            request({
                digest: {
                    ...request().digest,
                    workingMemoryRevision: 7,
                    focus: { kind: 'project', id: 'project-1', label: 'Home' },
                    commitments: [{ id: 'commitment-1', description: 'finish work', priority: 1 }],
                    recentExperiences: [
                        { event: 'goal.completed', outcome: 'ok', at: '2026-11-11T12:00:00.000Z' },
                    ],
                    interruption: null,
                    strategicGoal: { kind: 'gather', weight: 0.5 },
                    strategicConstraints: ['prioritize-safety'],
                },
            }),
        );
        expect(assembleError).toBeNull();
        expect(assembled?.state.workingMemoryRevision).toBe(7);
        expect(assembled?.state.focus?.id).toBe('project-1');
        expect(assembled?.state.strategicGoal?.kind).toBe('gather');
    });

    it('drops optional context before revision and focus', () => {
        const largeText = 'x'.repeat(400);
        const assembler = new DecisionDigestAssembler(220);
        const [assembled, assembleError] = assembler.assemble(
            request({
                digest: {
                    ...request().digest,
                    workingMemoryRevision: 9,
                    focus: { kind: 'agency', id: 'goal-1', label: 'Gather wood' },
                    commitments: Array.from({ length: 4 }, (_, index) => ({
                        id: `commitment-${index}`,
                        description: largeText,
                        priority: index,
                    })),
                    recentExperiences: Array.from({ length: 8 }, (_, index) => ({
                        event: `event-${index}`,
                        outcome: largeText,
                        at: '2026-11-11T12:00:00.000Z',
                    })),
                    interruption: null,
                    strategicGoal: { kind: 'gather', weight: 0.5 },
                    strategicConstraints: ['prioritize-safety'],
                },
            }),
        );
        expect(assembleError).toBeNull();
        expect(assembled?.state.workingMemoryRevision).toBe(9);
        expect(assembled?.state.focus?.id).toBe('goal-1');
        expect(assembled?.state.recentExperiences).toBe(undefined);
    });

    it('rejects labels over the word limit', () => {
        const assembler = new DecisionDigestAssembler(600);
        const tooLong = request({
            affordances: [
                {
                    id: 'skill:0',
                    skillId: 'mine',
                    label: 'one two three four five six seven eight nine ten eleven twelve thirteen',
                    priority: 1,
                },
            ],
        });
        expect(assembler.assemble(tooLong)[1]?.type).toBe('INVALID_OUTPUT');
    });
});

describe('Decision queue and rates', () => {
    it('orders by priority and bounds depth', () => {
        const queue = new DecisionQueue(1);
        const job = {
            id: 'job-1',
            botId: 'bot.one',
            request: request(),
            priority: 10,
            createdAt: 0,
            resolve: () => undefined,
        };
        expect(queue.enqueue(job)[1]).toBeNull();
        expect(queue.enqueue({ ...job, id: 'job-2', priority: 20 })[1]?.type).toBe('QUEUE_FULL');
        expect(queue.take()?.id).toBe('job-1');
    });

    it('enforces per-bot and fleet rates', () => {
        const limiter = new DecisionRateLimiter(2, 1);
        expect(limiter.allow('bot.one', 0)[1]).toBeNull();
        expect(limiter.allow('bot.one', 10)[1]?.type).toBe('RATE_LIMITED');
        expect(limiter.allow('bot.two', 20)[1]).toBeNull();
        expect(limiter.allow('bot.three', 30)[1]?.type).toBe('RATE_LIMITED');
        expect(limiter.allow('bot.one', 1100)[1]).toBeNull();
    });

    it('scales the fleet rate under backpressure', () => {
        const limiter = new DecisionRateLimiter(4, 1);
        limiter.setRateScale(0.5);
        expect(limiter.allow('bot.one', 0)[1]).toBeNull();
        expect(limiter.allow('bot.two', 10)[1]).toBeNull();
        expect(limiter.allow('bot.three', 20)[1]?.type).toBe('RATE_LIMITED');
    });
});

describe('Decision parsing and calibration', () => {
    it('parses typed answers and applies the confidence gate', () => {
        const [parsed, parseError] = new DecisionOutputParser().parse(layaAnswer('skill:0', 0.55));
        expect(parseError).toBeNull();
        const calibrated = new DecisionConfidenceCalibrator(
            { nextAction: 1, danger: 1, shouldContinue: 1 },
            0.6,
        ).calibrate(parsed as NonNullable<typeof parsed>);
        expect(calibrated.belowGate).toBe(true);
        expect(calibrated.danger).toBe(false);
    });

    it('rejects free text output', () => {
        const [parsed, parseError] = new DecisionOutputParser().parse({ answer: 'mine stone' });
        expect(parsed).toBeNull();
        expect(parseError?.type).toBe('INVALID_OUTPUT');
    });
});

describe('DecisionSingleInflightGuard', () => {
    it('allows one pass and times out slow work', async () => {
        const guard = new DecisionSingleInflightGuard();
        const [value, valueError] = await guard.run(async () => 'done', 100);
        expect(valueError).toBeNull();
        expect(value).toBe('done');
        const second = new DecisionSingleInflightGuard();
        const [, timeoutError] = await second.run(
            () => new Promise((resolve) => setTimeout(() => resolve('late'), 50)),
            5,
        );
        expect(timeoutError?.type).toBe('TIMEOUT');
    });
});

describe('DecisionService', () => {
    it('returns a typed choice from the loaded model', async () => {
        const model = new FakeModel();
        const service = new DecisionService({
            config,
            logger,
            loader: new FakeLoader(model),
        });
        const [outcome, outcomeError] = await service.decide('bot.tibot1', request());
        expect(outcomeError).toBeNull();
        expect(outcome?.response.source).toBe('laya');
        expect(outcome?.response.choiceId).toBe('skill:0');
        expect(outcome?.fallback).toBeNull();
        await service.close();
    });

    it('falls back when the model is unavailable', async () => {
        const service = new DecisionService({
            config,
            logger,
            loader: new FakeLoader(null),
        });
        const [outcome, outcomeError] = await service.decide('bot.tibot1', request());
        expect(outcomeError).toBeNull();
        expect(outcome?.response.source).toBe('fallback');
        expect(outcome?.response.choiceId).toBeNull();
        await service.close();
    });

    it('falls back below the confidence gate', async () => {
        const service = new DecisionService({
            config,
            logger,
            loader: new FakeLoader(new FakeModel(layaAnswer('skill:0', 0.2))),
        });
        const [outcome] = await service.decide('bot.tibot1', request());
        expect(outcome?.response.source).toBe('fallback');
        expect(outcome?.response.reason).toBe('confidence below gate');
        await service.close();
    });
});

describe('DecisionLatencyMetrics', () => {
    it('summarizes latency and fallback rate', () => {
        const metrics = new DecisionLatencyMetrics();
        metrics.record({
            latencyMilliseconds: 10,
            queueWaitMilliseconds: 1,
            provider: 'cpu',
            fallback: false,
        });
        metrics.record({
            latencyMilliseconds: 30,
            queueWaitMilliseconds: 2,
            provider: 'cpu',
            fallback: true,
        });
        const snapshot = metrics.snapshot();
        expect(snapshot.samples).toBe(2);
        expect(snapshot.p50).toBe(30);
        expect(snapshot.fallbackRate).toBe(0.5);
    });
});
