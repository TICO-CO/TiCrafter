import type { BehaviorTraceEntry, Vec3 } from '@ticrafter/core';

export type OddityId = 'zero-look-interact' | 'instant-turn' | 'instant-chat' | 'same-target-retry';

export interface OddityFinding {
    id: OddityId;
    index: number;
    botId: string;
    message: string;
    detail: Readonly<Record<string, unknown>>;
}

export interface OddityOptions {
    maximumGazeDeltaRadians?: number;
    minimumChatDelayMilliseconds?: number;
    maximumRepeatedActions?: number;
}

const DEFAULT_MAXIMUM_GAZE_DELTA = 0.4;
const DEFAULT_MINIMUM_CHAT_DELAY = 800;
const DEFAULT_MAXIMUM_REPEATED_ACTIONS = 3;
const INTERACTIVE_ACTIONS = new Set(['break-block', 'place-block', 'use-block', 'attack']);

export class OddityDetectors {
    static detect(
        entries: readonly BehaviorTraceEntry[],
        options: OddityOptions = {},
    ): readonly OddityFinding[] {
        return entries.flatMap((entry, index) => {
            switch (entry.kind) {
                case 'action':
                    return OddityDetectors.actionOddities(entries, entry, index, options);
                case 'gaze':
                    return OddityDetectors.instantTurn(entry, index, options);
                case 'chat':
                    return OddityDetectors.instantChat(entry, index, options);
                case 'decision':
                case 'plan':
                case 'movement':
                case 'pause':
                case 'permission':
                case 'perception':
                    return [];
            }
        });
    }

    private static actionOddities(
        entries: readonly BehaviorTraceEntry[],
        entry: BehaviorTraceEntry,
        index: number,
        options: OddityOptions,
    ): readonly OddityFinding[] {
        const findings: OddityFinding[] = [];
        if (OddityDetectors.zeroLook(entries, entry, index)) {
            findings.push({
                id: 'zero-look-interact',
                index,
                botId: entry.botId,
                message: `${entry.subject} completed without a preceding look`,
                detail: entry.detail,
            });
        }
        const repeated = OddityDetectors.repeatedAction(entries, entry, index, options);
        if (repeated > (options.maximumRepeatedActions ?? DEFAULT_MAXIMUM_REPEATED_ACTIONS)) {
            findings.push({
                id: 'same-target-retry',
                index,
                botId: entry.botId,
                message: `${entry.subject} repeated ${repeated} times without progress`,
                detail: entry.detail,
            });
        }
        return findings;
    }

    private static instantTurn(
        entry: BehaviorTraceEntry,
        index: number,
        options: OddityOptions,
    ): readonly OddityFinding[] {
        const yawDelta = OddityDetectors.number(entry.detail.yawDelta);
        const pitchDelta = OddityDetectors.number(entry.detail.pitchDelta);
        const elapsedMilliseconds = OddityDetectors.number(entry.detail.elapsedMilliseconds);
        const maximum =
            elapsedMilliseconds > 0
                ? Math.max(
                      options.maximumGazeDeltaRadians ?? DEFAULT_MAXIMUM_GAZE_DELTA,
                      3.5 * (elapsedMilliseconds / 1000) + 0.05,
                  )
                : (options.maximumGazeDeltaRadians ?? DEFAULT_MAXIMUM_GAZE_DELTA);
        if (Math.abs(yawDelta) <= maximum && Math.abs(pitchDelta) <= maximum) return [];
        return [
            {
                id: 'instant-turn',
                index,
                botId: entry.botId,
                message: 'gaze changed faster than the configured limit',
                detail: { yawDelta, pitchDelta },
            },
        ];
    }

    private static instantChat(
        entry: BehaviorTraceEntry,
        index: number,
        options: OddityOptions,
    ): readonly OddityFinding[] {
        if (entry.subject !== 'outgoing') return [];
        const delay = OddityDetectors.number(entry.detail.delayMilliseconds);
        const minimum = options.minimumChatDelayMilliseconds ?? DEFAULT_MINIMUM_CHAT_DELAY;
        if (delay >= minimum) return [];
        return [
            {
                id: 'instant-chat',
                index,
                botId: entry.botId,
                message: 'chat reply latency is below the configured floor',
                detail: { delayMilliseconds: delay },
            },
        ];
    }

    private static zeroLook(
        entries: readonly BehaviorTraceEntry[],
        entry: BehaviorTraceEntry,
        index: number,
    ): boolean {
        if (entry.detail.status !== 'completed' || !INTERACTIVE_ACTIONS.has(entry.subject)) {
            return false;
        }
        const target = OddityDetectors.vec3(entry.detail.target);
        if (target === null) return false;
        return !entries
            .slice(0, index)
            .some(
                (candidate) =>
                    candidate.botId === entry.botId &&
                    candidate.kind === 'gaze' &&
                    OddityDetectors.samePosition(candidate.detail.target, target),
            );
    }

    private static repeatedAction(
        entries: readonly BehaviorTraceEntry[],
        entry: BehaviorTraceEntry,
        index: number,
        options: OddityOptions,
    ): number {
        const target = OddityDetectors.vec3(entry.detail.target);
        if (target === null) return 0;
        let count = 0;
        for (let cursor = index; cursor >= 0; cursor -= 1) {
            const candidate = entries[cursor];
            if (candidate === undefined) break;
            if (candidate.botId !== entry.botId || candidate.kind !== 'action') continue;
            if (candidate.subject !== entry.subject) break;
            if (!OddityDetectors.samePosition(candidate.detail.target, target)) break;
            count += 1;
        }
        return count;
    }

    private static vec3(value: unknown): Vec3 | null {
        if (typeof value !== 'object' || value === null) return null;
        const record = value as Record<string, unknown>;
        const x = OddityDetectors.number(record.x);
        const y = OddityDetectors.number(record.y);
        const z = OddityDetectors.number(record.z);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
        return { x, y, z };
    }

    private static samePosition(value: unknown, target: Vec3): boolean {
        const position = OddityDetectors.vec3(value);
        if (position === null) return false;
        return position.x === target.x && position.y === target.y && position.z === target.z;
    }

    private static number(value: unknown): number {
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
}
