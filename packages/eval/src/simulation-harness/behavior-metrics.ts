import type { BehaviorTraceEntry } from '@ticrafter/core';

import { OddityDetectors } from '../behavior-assertions/index.js';

export interface BehaviorMetrics {
    traceEvents: number;
    movementEvents: number;
    gazeEvents: number;
    pauseEvents: number;
    chatIncoming: number;
    chatOutgoing: number;
    permissionEvents: number;
    goalsStarted: number;
    goalsCompleted: number;
    goalsAbandoned: number;
    goalSwitches: number;
    goalSwitchesPerTenMinutes: number;
    leisureGoals: number;
    leisureMilliseconds: number;
    idleMilliseconds: number;
    awakeMilliseconds: number;
    idleFraction: number;
    dwellMedianMilliseconds: number;
    zeroLookInteractions: number;
    instantTurns: number;
    sameTargetRetries: number;
    instantChatReplies: number;
    noIdleOddities: number;
    switchStormOddities: number;
}

export interface BehaviorMetricsOptions {
    durationMilliseconds?: number;
    minimumIdleFraction?: number;
    maximumSwitchesPerTenMinutes?: number;
}

interface GoalSpan {
    at: number;
    kind: string;
}

export class BehaviorMetricsReader {
    static readByBot(
        entries: readonly BehaviorTraceEntry[],
        options: BehaviorMetricsOptions = {},
    ): Readonly<Record<string, BehaviorMetrics>> {
        const byBot = new Map<string, BehaviorTraceEntry[]>();
        for (const entry of entries) {
            const list = byBot.get(entry.botId) ?? [];
            list.push(entry);
            byBot.set(entry.botId, list);
        }
        return Object.fromEntries(
            [...byBot.entries()].map(([botId, botEntries]) => [
                botId,
                BehaviorMetricsReader.read(botEntries, options),
            ]),
        );
    }

    static read(
        entries: readonly BehaviorTraceEntry[],
        options: BehaviorMetricsOptions = {},
    ): BehaviorMetrics {
        const oddities = OddityDetectors.detect(entries);
        const ordered = [...entries].sort((first, second) => first.at.localeCompare(second.at));
        const open = new Map<string, GoalSpan>();
        const durations: number[] = [];
        let goalsStarted = 0;
        let goalsCompleted = 0;
        let goalsAbandoned = 0;
        let goalSwitches = 0;
        let leisureGoals = 0;
        let leisureMilliseconds = 0;
        let idleMilliseconds = 0;
        let lastEndAt: number | null = null;
        for (const entry of ordered) {
            const at = Date.parse(entry.at);
            if (!Number.isFinite(at)) continue;
            if (entry.kind !== 'decision') continue;
            if (entry.subject === 'agency.goal.started') {
                const goalId = BehaviorMetricsReader.text(entry.detail.goalId);
                const kind = BehaviorMetricsReader.text(entry.detail.goalKind) ?? 'unknown';
                if (goalId === null) continue;
                if (lastEndAt !== null) {
                    idleMilliseconds += Math.max(0, at - lastEndAt);
                    lastEndAt = null;
                }
                goalsStarted += 1;
                if (kind === 'leisure') leisureGoals += 1;
                open.set(goalId, { at, kind });
                continue;
            }
            if (entry.subject === 'agency.goal.switched') {
                goalSwitches += 1;
                const previousGoalId = BehaviorMetricsReader.text(entry.detail.previousGoalId);
                if (previousGoalId !== null) {
                    leisureMilliseconds += BehaviorMetricsReader.closeGoal(
                        previousGoalId,
                        open,
                        durations,
                        at,
                    );
                }
                continue;
            }
            if (
                entry.subject !== 'agency.goal.completed' &&
                entry.subject !== 'agency.goal.abandoned'
            ) {
                continue;
            }
            const goalId = BehaviorMetricsReader.text(entry.detail.goalId);
            if (goalId === null) continue;
            if (entry.subject === 'agency.goal.completed') goalsCompleted += 1;
            else goalsAbandoned += 1;
            leisureMilliseconds += BehaviorMetricsReader.closeGoal(goalId, open, durations, at);
            lastEndAt = at;
        }
        const awakeMilliseconds =
            options.durationMilliseconds ?? BehaviorMetricsReader.span(ordered);
        const idleFraction =
            awakeMilliseconds > 0
                ? Math.min(1, Math.max(0, idleMilliseconds / awakeMilliseconds))
                : 0;
        const goalSwitchesPerTenMinutes =
            awakeMilliseconds > 0 ? goalSwitches / (awakeMilliseconds / 600_000) : 0;
        const minimumIdleFraction = options.minimumIdleFraction ?? 0.05;
        const maximumSwitchesPerTenMinutes = options.maximumSwitchesPerTenMinutes ?? 2;
        return {
            traceEvents: entries.length,
            movementEvents: entries.filter((entry) => entry.kind === 'movement').length,
            gazeEvents: entries.filter((entry) => entry.kind === 'gaze').length,
            pauseEvents: entries.filter((entry) => entry.kind === 'pause').length,
            chatIncoming: entries.filter(
                (entry) => entry.kind === 'chat' && entry.subject === 'incoming',
            ).length,
            chatOutgoing: entries.filter(
                (entry) => entry.kind === 'chat' && entry.subject === 'outgoing',
            ).length,
            permissionEvents: entries.filter((entry) => entry.kind === 'permission').length,
            goalsStarted,
            goalsCompleted,
            goalsAbandoned,
            goalSwitches,
            goalSwitchesPerTenMinutes,
            leisureGoals,
            leisureMilliseconds,
            idleMilliseconds,
            awakeMilliseconds,
            idleFraction,
            dwellMedianMilliseconds: BehaviorMetricsReader.median(
                durations.filter((duration) => duration >= 1_000),
            ),
            zeroLookInteractions: oddities.filter((finding) => finding.id === 'zero-look-interact')
                .length,
            instantTurns: oddities.filter((finding) => finding.id === 'instant-turn').length,
            sameTargetRetries: oddities.filter((finding) => finding.id === 'same-target-retry')
                .length,
            instantChatReplies: oddities.filter((finding) => finding.id === 'instant-chat').length,
            noIdleOddities:
                awakeMilliseconds >= 60_000 && idleFraction < minimumIdleFraction ? 1 : 0,
            switchStormOddities: goalSwitchesPerTenMinutes > maximumSwitchesPerTenMinutes ? 1 : 0,
        };
    }

    private static closeGoal(
        goalId: string,
        open: Map<string, GoalSpan>,
        durations: number[],
        at: number,
    ): number {
        const span = open.get(goalId);
        if (span === undefined) return 0;
        open.delete(goalId);
        const duration = Math.max(0, at - span.at);
        durations.push(duration);
        return span.kind === 'leisure' ? duration : 0;
    }

    private static span(entries: readonly BehaviorTraceEntry[]): number {
        if (entries.length < 2) return 0;
        const first = Date.parse(entries[0]?.at ?? '');
        const last = Date.parse(entries.at(-1)?.at ?? '');
        if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
        return Math.max(0, last - first);
    }

    private static median(values: readonly number[]): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((first, second) => first - second);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
        return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
    }

    private static text(value: unknown): string | null {
        return typeof value === 'string' && value.length > 0 ? value : null;
    }
}
