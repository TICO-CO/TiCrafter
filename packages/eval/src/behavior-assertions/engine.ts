import {
    BlueprintIr,
    BuiltInTemplates,
    SchematicDiffCalculator,
    TemplateInstantiator,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';

import type { AssertionContext, AssertionResult, ScenarioAssertion } from './types.js';

export class AssertionEngine {
    static evaluate(
        assertions: readonly ScenarioAssertion[],
        context: AssertionContext,
    ): readonly AssertionResult[] {
        return assertions.map((assertion) => AssertionEngine.evaluateOne(assertion, context));
    }

    private static evaluateOne(
        assertion: ScenarioAssertion,
        context: AssertionContext,
    ): AssertionResult {
        switch (assertion.kind) {
            case 'world.diff-empty':
                return AssertionEngine.diffEmpty(assertion, context);
            case 'world.block-exists': {
                const actual = context.world.blockAt(assertion.position);
                return AssertionEngine.result(
                    assertion,
                    actual === assertion.blockId,
                    assertion.blockId,
                    actual,
                );
            }
            case 'world.no-duplicate-writes': {
                const seen = new Set<string>();
                const duplicates = context.blockWrites.filter((write) => {
                    const key = `${write.position.x},${write.position.y},${write.position.z}`;
                    if (seen.has(key)) return true;
                    seen.add(key);
                    return false;
                });
                return AssertionEngine.result(
                    assertion,
                    duplicates.length === 0,
                    0,
                    duplicates.length,
                );
            }
            case 'task.status': {
                const task = context.tasks.find((candidate) => candidate.id === assertion.taskId);
                return AssertionEngine.result(
                    assertion,
                    task?.status === assertion.status,
                    assertion.status,
                    task?.status ?? null,
                );
            }
            case 'task.failure-class': {
                const task = context.tasks.find((candidate) => candidate.id === assertion.taskId);
                return AssertionEngine.result(
                    assertion,
                    task?.failureClass === assertion.failureClass,
                    assertion.failureClass,
                    task?.failureClass ?? null,
                );
            }
            case 'event.exists':
                return AssertionEngine.result(
                    assertion,
                    context.events.some((event) => event.type === assertion.eventType),
                    true,
                    context.events.some((event) => event.type === assertion.eventType),
                );
            case 'event.absent':
                return AssertionEngine.result(
                    assertion,
                    !context.events.some((event) => event.type === assertion.eventType),
                    false,
                    context.events.some((event) => event.type === assertion.eventType),
                );
            case 'safety.no-veto':
                return AssertionEngine.result(
                    assertion,
                    context.vetoes.length === 0,
                    0,
                    context.vetoes.length,
                );
            case 'safety.veto':
                return AssertionEngine.result(
                    assertion,
                    context.vetoes.some((veto) => veto.reason === assertion.reason),
                    assertion.reason,
                    context.vetoes.map((veto) => veto.reason),
                );
            case 'inventory.has': {
                const inventory =
                    assertion.botId === undefined
                        ? context.inventory
                        : (context.inventories?.[assertion.botId] ?? []);
                const actual =
                    inventory.find((item) => item.name === assertion.itemName)?.count ?? 0;
                return AssertionEngine.result(
                    assertion,
                    actual >= assertion.minimum,
                    assertion.minimum,
                    actual,
                );
            }
            case 'world.blocks-in-box': {
                const blocks = context.world.blocksInBox?.(assertion.bbox) ?? [];
                const actual = blocks.filter((block) => block.name === assertion.blockId).length;
                const maximum = assertion.maximum ?? Number.POSITIVE_INFINITY;
                return AssertionEngine.result(
                    assertion,
                    actual >= assertion.minimum && actual <= maximum,
                    { minimum: assertion.minimum, maximum: assertion.maximum ?? null },
                    actual,
                );
            }
            case 'behavior.trace-present': {
                const entries = context.behavior.filter(
                    (entry) =>
                        entry.kind === assertion.traceKind &&
                        entry.subject === assertion.subject &&
                        (assertion.plotId === undefined ||
                            entry.detail.plotId === assertion.plotId) &&
                        (assertion.botId === undefined || entry.botId === assertion.botId),
                );
                return AssertionEngine.result(
                    assertion,
                    entries.length >= assertion.minimum,
                    assertion.minimum,
                    entries.length,
                );
            }
            case 'metric.threshold': {
                const actual = context.metrics[assertion.metric] ?? 0;
                const passed =
                    assertion.comparator === 'gte'
                        ? actual >= assertion.value
                        : actual <= assertion.value;
                return AssertionEngine.result(assertion, passed, assertion.value, actual);
            }
            case 'behavior.idle-fraction': {
                const metrics = AssertionEngine.metricsFor(assertion.botId, context);
                const actual = metrics.idleFraction ?? 0;
                return AssertionEngine.result(
                    assertion,
                    actual >= assertion.minimum && actual <= assertion.maximum,
                    { minimum: assertion.minimum, maximum: assertion.maximum },
                    actual,
                );
            }
            case 'behavior.switch-rate': {
                const metrics = AssertionEngine.metricsFor(assertion.botId, context);
                const actual = metrics.goalSwitchesPerTenMinutes ?? 0;
                return AssertionEngine.result(
                    assertion,
                    actual <= assertion.maximumPerTenMinutes,
                    assertion.maximumPerTenMinutes,
                    actual,
                );
            }
            case 'behavior.dwell': {
                const metrics = AssertionEngine.metricsFor(assertion.botId, context);
                const actual = metrics.dwellMedianMilliseconds ?? 0;
                return AssertionEngine.result(
                    assertion,
                    actual >= assertion.minimumMedianMilliseconds,
                    assertion.minimumMedianMilliseconds,
                    actual,
                );
            }
            case 'behavior.farm-permission': {
                const entries = context.behavior.filter(
                    (entry) =>
                        entry.kind === 'permission' &&
                        entry.subject === 'farm-permission' &&
                        entry.detail.plotId === assertion.plotId &&
                        (assertion.botId === undefined || entry.botId === assertion.botId),
                );
                const last = entries.at(-1);
                const decision = last?.detail.decision;
                const reason = last?.detail.reason;
                const allowed =
                    assertion.decision === 'allow' &&
                    entries.some((entry) => entry.detail.decision === 'allow');
                const denied =
                    assertion.decision === 'deny' &&
                    entries.some((entry) => entry.detail.decision === 'deny');
                const asked =
                    assertion.decision === 'ask' &&
                    entries.some((entry) => entry.detail.decision === 'ask');
                const timedOut =
                    assertion.decision === 'timeout' &&
                    entries.some(
                        (entry) =>
                            entry.detail.decision === 'deny' &&
                            entry.detail.reason === 'inquiry-timeout',
                    );
                return AssertionEngine.result(
                    assertion,
                    allowed || denied || asked || timedOut,
                    assertion.decision,
                    { decision: decision ?? null, reason: reason ?? null },
                );
            }
        }
    }

    private static metricsFor(
        botId: string | undefined,
        context: AssertionContext,
    ): Readonly<Record<string, number>> {
        if (botId === undefined) return context.metrics;
        return context.metricsByBot?.[botId] ?? context.metrics;
    }

    private static diffEmpty(
        assertion: Extract<ScenarioAssertion, { kind: 'world.diff-empty' }>,
        context: AssertionContext,
    ): AssertionResult {
        const [blueprint] = AssertionEngine.blueprint(assertion.schematicId, assertion.anchor);
        if (blueprint === null) {
            return AssertionEngine.result(assertion, false, 0, null, ['blueprint missing']);
        }
        const [diff] = new SchematicDiffCalculator().diff(blueprint, {
            blockAt: (position: Vec3) => {
                const state = context.world.blockStateAt?.(position);
                if (state !== undefined) {
                    return state === null
                        ? [null, null]
                        : [{ name: state.name, properties: state.properties }, null];
                }
                const name = context.world.blockAt(position);
                return [name === null ? null : { name }, null];
            },
        });
        if (diff === null) {
            return AssertionEngine.result(assertion, false, 0, null, ['schematic diff failed']);
        }
        const remaining = diff.missing.length + diff.extra.length + diff.mismatched.length;
        return AssertionEngine.result(assertion, remaining === 0, 0, {
            missing: diff.missing.map((block) => block.state.name),
            extra: diff.extra,
            mismatched: diff.mismatched.map((block) => ({
                expected: block.state,
                actual: context.world.blockStateAt?.(BlueprintIr.position(block)) ?? null,
                position: BlueprintIr.position(block),
            })),
        });
    }

    private static blueprint(
        schematicId: string,
        anchor: Vec3,
    ): Result<ReturnType<TemplateInstantiator['instantiate']>[0], string> {
        const [registry, registryError] = BuiltInTemplates.createRegistry();
        if (registryError || registry === null) return [null, 'template registry unavailable'];
        const type = schematicId.startsWith('template:')
            ? schematicId.slice('template:'.length)
            : schematicId;
        const [blueprint, error] = new TemplateInstantiator(registry).instantiate({
            id: schematicId,
            type,
            anchor,
            rotation: 0,
        });
        return error === null ? [blueprint, null] : [null, `unknown template ${type}`];
    }

    private static result(
        assertion: ScenarioAssertion,
        passed: boolean,
        expected: unknown,
        actual: unknown,
        refs: readonly string[] = [],
    ): AssertionResult {
        return {
            id: assertion.id,
            passed,
            expected,
            actual,
            message: passed ? `assertion ${assertion.id} passed` : assertion.message,
            refs,
        };
    }
}
