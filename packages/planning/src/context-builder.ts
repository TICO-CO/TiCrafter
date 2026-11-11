import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type {
    PlannerChatMessage,
    PlannerContext,
    PlannerContextSource,
    PlannerPrompt,
    PlannerTrigger,
} from './types.js';

const systemPrompt = [
    'You are the TiCrafter fleet planner.',
    'Return one strict JSON object, with no markdown and no prose.',
    'Required fields: schemaVersion=1, planId, baseRevision, goals, sipMutations, tasks, blueprints, recovery, notes.',
    'goals: array of {id, description, priority, status}.',
    'sipMutations: array of zone, structure, road, farm, container, path-graph, or rules mutations.',
    'tasks: array of {id, title, parentId, priority, dependencies, preconditions, requiredRole, target, skillId, payload}.',
    'blueprints: array of {id, template, anchor, rotation, materials, parameters}.',
    'recovery: {mode: continue|retry|safe_mode|stop, notes}.',
    'Never emit block placement commands. Only propose SIP mutations and tasks.',
    'Keep ids stable and within the context budget.',
].join(' ');

export interface PlannerContextBuilderOptions {
    source: PlannerContextSource;
    maxContextCharacters: number;
    now?: () => number;
}

export class PlannerContextBuilder {
    constructor(private readonly options: PlannerContextBuilderOptions) {}

    build(trigger: PlannerTrigger): Result<PlannerPrompt, PlannerFailure> {
        const [snapshot, snapshotError] = this.options.source.snapshot();
        if (snapshotError) return [null, { type: 'CONTEXT', message: snapshotError }];
        if (snapshot === null) return [null, { type: 'CONTEXT', message: 'SIP snapshot missing' }];
        const [tasks, tasksError] = this.options.source.tasks();
        if (tasksError) return [null, { type: 'CONTEXT', message: tasksError }];
        if (tasks === null) return [null, { type: 'CONTEXT', message: 'tasks missing' }];
        const [bots, botsError] = this.options.source.bots();
        if (botsError) return [null, { type: 'CONTEXT', message: botsError }];
        if (bots === null) return [null, { type: 'CONTEXT', message: 'bots missing' }];
        const [landmarks, landmarksError] = this.options.source.landmarks();
        if (landmarksError) return [null, { type: 'CONTEXT', message: landmarksError }];
        if (landmarks === null) {
            return [null, { type: 'CONTEXT', message: 'landmarks missing' }];
        }
        const [inventory, inventoryError] = this.options.source.inventory();
        if (inventoryError) return [null, { type: 'CONTEXT', message: inventoryError }];
        if (inventory === null) return [null, { type: 'CONTEXT', message: 'inventory missing' }];

        const context = this.fit({
            createdAt: new Date(this.now()).toISOString(),
            trigger,
            sip: snapshot,
            tasks,
            bots,
            landmarks,
            inventory,
        });
        const serialized = JSON.stringify(context);
        if (serialized.length > this.options.maxContextCharacters) {
            return [
                null,
                {
                    type: 'CONTEXT',
                    message: `context exceeds ${this.options.maxContextCharacters} characters`,
                },
            ];
        }
        const messages: readonly PlannerChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Plan request: ${serialized}` },
        ];
        return [
            {
                context,
                messages,
                contextHash: PlannerContextBuilder.hash(serialized),
            },
            null,
        ];
    }

    private fit(context: PlannerContext): PlannerContext {
        let scale = 1;
        let candidate = context;
        while (scale > 0) {
            candidate = PlannerContextBuilder.slice(context, scale);
            if (JSON.stringify(candidate).length <= this.options.maxContextCharacters) {
                return candidate;
            }
            scale = Math.floor(scale * 100) / 125;
        }
        return PlannerContextBuilder.slice(context, 0);
    }

    private static slice(context: PlannerContext, scale: number): PlannerContext {
        const limit = (length: number, maximum: number): number =>
            Math.max(1, Math.floor(maximum * scale));
        return {
            ...context,
            sip: {
                ...context.sip,
                zones: context.sip.zones.slice(0, limit(context.sip.zones.length, 32)),
                structures: context.sip.structures
                    .slice(0, limit(context.sip.structures.length, 48))
                    .map((structure) => ({
                        ...structure,
                        workPackages: structure.workPackages.slice(
                            0,
                            limit(structure.workPackages.length, 8),
                        ),
                    })),
                roads: context.sip.roads.slice(0, limit(context.sip.roads.length, 24)),
                farms: context.sip.farms
                    .slice(0, limit(context.sip.farms.length, 16))
                    .map((farm) => ({
                        ...farm,
                        plots: farm.plots.slice(0, limit(farm.plots.length, 16)),
                    })),
                containers: context.sip.containers.slice(
                    0,
                    limit(context.sip.containers.length, 24),
                ),
                protectedBboxes: context.sip.protectedBboxes.slice(
                    0,
                    limit(context.sip.protectedBboxes.length, 16),
                ),
                noBuildZones: context.sip.noBuildZones.slice(
                    0,
                    limit(context.sip.noBuildZones.length, 16),
                ),
            },
            tasks: context.tasks.slice(0, limit(context.tasks.length, 48)),
            bots: context.bots.slice(0, limit(context.bots.length, 8)),
            landmarks: context.landmarks.slice(0, limit(context.landmarks.length, 24)),
        };
    }

    private static hash(value: string): string {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    private now(): number {
        return this.options.now?.() ?? Date.now();
    }
}
