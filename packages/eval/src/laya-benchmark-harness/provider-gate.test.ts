import { describe, expect, it } from 'bun:test';

import { ProviderGate } from './provider-gate.js';
import type { BenchmarkProvider, BenchmarkReport } from './types.js';

class ReportFixture {
    static create(
        provider: BenchmarkProvider,
        p95: number,
        soakCompleted: boolean | null,
        inputTokens: number | null = null,
    ): BenchmarkReport {
        return {
            generatedAt: '2026-11-10T00:00:00.000Z',
            profile: 'home-full',
            provider,
            requestedProvider: provider,
            fallbackReason: null,
            fixtureVariant: 'standard',
            threads: 8,
            revision: 'test',
            modelDir: '/fake/laya',
            warmupRequests: 10,
            measuredRequests: 200,
            inputTokens,
            latency: { p50: p95, p95, mean: p95, min: p95, max: p95 },
            memory: {
                rssBeforeBytes: 0,
                rssAfterLoadBytes: 0,
                rssAfterBytes: 0,
                rssPeakBytes: 0,
                vramBeforeBytes: null,
                vramAfterLoadBytes: null,
                vramAfterBytes: null,
                vramPeakBytes: null,
                vramTotalBytes: null,
            },
            soak:
                soakCompleted === null
                    ? null
                    : {
                          durationMilliseconds: 7_200_000,
                          intervalMilliseconds: 1000,
                          samples: 7200,
                          completed: soakCompleted,
                          latency: { p50: p95, p95, mean: p95, min: p95, max: p95 },
                      },
        };
    }
}

describe('ProviderGate', () => {
    it('adopts WebGPU only after a clean soak and lower p95', () => {
        const gate = ProviderGate.evaluate([
            ReportFixture.create('cpu', 200, null),
            ReportFixture.create('webgpu', 150, true),
        ]);

        expect(gate.p95WithinBudget).toBe(true);
        expect(gate.webgpuFasterThanCpu).toBe(true);
        expect(gate.recommendedProvider).toBe('webgpu');
    });

    it('keeps CPU when the WebGPU soak is missing', () => {
        const gate = ProviderGate.evaluate([
            ReportFixture.create('cpu', 200, null),
            ReportFixture.create('webgpu', 150, null),
        ]);

        expect(gate.webgpuFasterThanCpu).toBe(true);
        expect(gate.recommendedProvider).toBe('cpu');
        expect(gate.reasons.includes('WebGPU 2h stability soak has not completed')).toBe(true);
    });

    it('keeps CPU when WebGPU exceeds the latency budget', () => {
        const gate = ProviderGate.evaluate([
            ReportFixture.create('cpu', 200, null),
            ReportFixture.create('webgpu', 300, true),
        ]);

        expect(gate.p95WithinBudget).toBe(true);
        expect(gate.passingProviders).toEqual(['cpu']);
        expect(gate.recommendedProvider).toBe('cpu');
    });

    it('does not recommend CPU when only WebGPU passes and the soak is pending', () => {
        const gate = ProviderGate.evaluate([
            ReportFixture.create('cpu', 1000, null),
            ReportFixture.create('webgpu', 180, null),
        ]);

        expect(gate.p95WithinBudget).toBe(true);
        expect(gate.passingProviders).toEqual(['webgpu']);
        expect(gate.recommendedProvider).toBeNull();
    });

    it('adopts WebGPU when CPU misses the budget and the soak completes', () => {
        const gate = ProviderGate.evaluate([
            ReportFixture.create('cpu', 1000, null),
            ReportFixture.create('webgpu', 180, true),
        ]);

        expect(gate.recommendedProvider).toBe('webgpu');
    });

    it('rejects prompts over the input-token budget', () => {
        const gate = ProviderGate.evaluate(
            [
                ReportFixture.create('cpu', 200, null, 577),
                ReportFixture.create('webgpu', 150, null, 908),
            ],
            { maxInputTokens: 600 },
        );

        expect(gate.inputWithinBudget).toBe(false);
        expect(gate.inputTokenBudget).toBe(600);
        expect(gate.reasons.some((reason) => reason.startsWith('input tokens exceed 600'))).toBe(
            true,
        );
    });

    it('recommends CPU when only the CPU report exists', () => {
        const gate = ProviderGate.evaluate([ReportFixture.create('cpu', 200, null)]);

        expect(gate.webgpuFasterThanCpu).toBeNull();
        expect(gate.recommendedProvider).toBe('cpu');
        expect(gate.reasons.includes('WebGPU report missing')).toBe(true);
    });
});
