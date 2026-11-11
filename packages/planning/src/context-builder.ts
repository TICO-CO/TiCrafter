import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type { PlannerPosition } from './plan-schema.js';
import type {
    PlannerChatMessage,
    PlannerContext,
    PlannerContextSource,
    PlannerPrompt,
    PlannerTrigger,
} from './types.js';

export interface PlannerContextBuilderOptions {
    source: PlannerContextSource;
    allowedSkills: readonly string[];
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
        const examplePosition = context.bots.find((bot) => bot.position !== null)?.position ?? {
            x: 0,
            y: 64,
            z: 0,
        };
        const messages: readonly PlannerChatMessage[] = [
            {
                role: 'system',
                content: PlannerContextBuilder.buildSystemPrompt(
                    this.options.allowedSkills,
                    context.sip.revision,
                    examplePosition,
                ),
            },
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

    private static buildSystemPrompt(
        allowedSkills: readonly string[],
        baseRevision: number,
        position: PlannerPosition,
    ): string {
        const example = JSON.stringify({
            schemaVersion: 1,
            planId: 'plan-example',
            baseRevision,
            goals: [
                {
                    id: 'goal-example',
                    description: 'Establish a starter working area',
                    priority: 1,
                    status: 'active',
                },
            ],
            sipMutations: [],
            tasks: [
                {
                    id: 'task-example',
                    title: 'Explore near the fleet',
                    parentId: null,
                    priority: 1,
                    dependencies: [],
                    preconditions: [],
                    requiredRole: null,
                    target: { x: position.x, y: position.y, z: position.z },
                    skillId: 'explore',
                    payload: {
                        center: { x: position.x, y: position.y, z: position.z },
                        radius: 32,
                        maxSteps: 16,
                    },
                },
            ],
            cancelTaskIds: [],
            blueprints: [],
            recovery: { mode: 'continue', notes: '' },
            notes: '',
        });

        return [
            'You are the TiCrafter fleet planner.',
            'Return exactly one strict JSON object, with no markdown, prose, or code fences.',
            'Every object rejects unknown fields.',
            'schemaVersion must be the number 1.',
            'baseRevision must equal context.sip.revision.',
            'goals must contain at least one goal.',
            'sipMutations must be an empty array unless the plan changes the SIP.',
            'Allowed skillId values are: ' + allowedSkills.join(', ') + '.',
            'task target must be an integer x/y/z position or null.',
            'Use context.bots positions for task targets and explore centers.',
            'Every task must be independent: parentId must be null and dependencies must be [].',
            'Use unique task IDs that do not already exist in context.tasks.',
            'Give each task a distinct target or explore center.',
            'When actionable open tasks plus new tasks are fewer than online bots, add enough independent tasks to cover every online bot.',
            'Use context.tasks titles, skillIds, and targets to decide whether to keep or cancel current work.',
            'Set cancelTaskIds to existing open task IDs that no longer make sense; otherwise use [].',
            'Do not cancel a task and create a task with the same ID.',
            'Do not emit blueprints unless inventory covers every listed material; propose gathering or crafting tasks first.',
            'All positions must avoid context.sip.protectedBboxes and context.sip.noBuildZones.',
            'Never emit block placement commands. Only propose SIP mutations and tasks.',
            'Use the provided context values instead of the example values.',
            `Example plan shape: ${example}`,
        ].join('\n');
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
