import type { BenchmarkProvider, BenchmarkReport } from './types.js';

export const LAYA_WARM_P95_BUDGET_MS = 250;

export interface ProviderGateReport {
    budgetMilliseconds: number;
    inputTokenBudget: number | null;
    p95WithinBudget: boolean;
    inputWithinBudget: boolean;
    passingProviders: BenchmarkProvider[];
    webgpuFasterThanCpu: boolean | null;
    recommendedProvider: BenchmarkProvider | null;
    reasons: string[];
}

export class ProviderGate {
    static evaluate(
        reports: readonly BenchmarkReport[],
        options: { maxInputTokens?: number } = {},
    ): ProviderGateReport {
        const reasons: string[] = [];
        const inputTokenBudget = options.maxInputTokens ?? null;
        const inputWithinBudget = ProviderGate.inputsWithinBudget(reports, inputTokenBudget);
        const cpu = reports.find((report) => report.requestedProvider === 'cpu') ?? null;
        const webgpu = reports.find((report) => report.requestedProvider === 'webgpu') ?? null;
        const cpuPasses = cpu !== null && ProviderGate.passesBudget(cpu);
        const webgpuPasses = webgpu !== null && ProviderGate.passesBudget(webgpu);
        const passingProviders: BenchmarkProvider[] = [];
        if (cpuPasses) passingProviders.push('cpu');
        if (webgpuPasses) passingProviders.push('webgpu');

        if (!inputWithinBudget && inputTokenBudget !== null) {
            const oversized = reports
                .filter((report) => report.inputTokens !== null)
                .map((report) => `${report.requestedProvider}=${report.inputTokens}`);
            reasons.push(
                `input tokens exceed ${inputTokenBudget}: ${oversized.join(', ') || 'unknown'}`,
            );
        }
        if (cpu === null) reasons.push('CPU report missing');
        if (webgpu === null) reasons.push('WebGPU report missing');
        if (cpu !== null && !cpuPasses) {
            reasons.push(`CPU p95 exceeds ${LAYA_WARM_P95_BUDGET_MS}ms or is missing`);
        }
        if (webgpu !== null && !webgpuPasses) {
            reasons.push(`WebGPU p95 exceeds ${LAYA_WARM_P95_BUDGET_MS}ms or is missing`);
        }

        const webgpuFasterThanCpu =
            cpu !== null && webgpu !== null
                ? ProviderGate.p95(webgpu) < ProviderGate.p95(cpu)
                : null;
        if (webgpu !== null && webgpu.provider !== 'webgpu') {
            reasons.push(
                `WebGPU fell back to ${webgpu.provider}: ${webgpu.fallbackReason ?? 'unknown reason'}`,
            );
        }
        if (webgpuFasterThanCpu === false) reasons.push('WebGPU p95 is not faster than CPU p95');
        if (webgpuFasterThanCpu === true) reasons.push('WebGPU p95 is faster than CPU p95');

        const webgpuSoakComplete = webgpu?.soak?.completed === true;
        if (webgpu !== null && !webgpuSoakComplete) {
            reasons.push('WebGPU 2h stability soak has not completed');
        }
        if (webgpuSoakComplete) reasons.push('WebGPU stability soak completed');

        const recommendedProvider = ProviderGate.recommend(
            cpuPasses,
            webgpuPasses,
            webgpuFasterThanCpu,
            webgpuSoakComplete,
        );

        return {
            budgetMilliseconds: LAYA_WARM_P95_BUDGET_MS,
            inputTokenBudget,
            p95WithinBudget: passingProviders.length > 0,
            inputWithinBudget,
            passingProviders,
            webgpuFasterThanCpu,
            recommendedProvider,
            reasons,
        };
    }

    private static recommend(
        cpuPasses: boolean,
        webgpuPasses: boolean,
        webgpuFasterThanCpu: boolean | null,
        webgpuSoakComplete: boolean,
    ): BenchmarkProvider | null {
        if (webgpuPasses && webgpuFasterThanCpu === true && webgpuSoakComplete) return 'webgpu';
        if (cpuPasses) return 'cpu';
        return null;
    }

    private static inputsWithinBudget(
        reports: readonly BenchmarkReport[],
        budget: number | null,
    ): boolean {
        if (budget === null) return true;
        return reports.every(
            (report) => report.inputTokens !== null && report.inputTokens <= budget,
        );
    }

    private static passesBudget(report: BenchmarkReport): boolean {
        return ProviderGate.p95(report) <= LAYA_WARM_P95_BUDGET_MS;
    }

    private static p95(report: BenchmarkReport): number {
        return report.soak?.latency?.p95 ?? report.latency?.p95 ?? Number.POSITIVE_INFINITY;
    }
}
