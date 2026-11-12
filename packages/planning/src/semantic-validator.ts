import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import { PlannerGeometry } from './geometry.js';
import type {
    PlannerPlan,
    PlannerPosition,
    PlannerSipMutation,
    PlannerTask,
} from './plan-schema.js';
import type { PlannerContext, PlannerSipValidationPort, PlannerSkillCatalogPort } from './types.js';

const ACTIONABLE_TASK_STATUSES = new Set(['pending', 'ready', 'claimed', 'running']);

export interface PlannerSemanticValidatorOptions {
    skills: PlannerSkillCatalogPort;
    sip: PlannerSipValidationPort;
    maxTasks?: number;
    maxBlueprints?: number;
    maxMutations?: number;
    maxDistanceBlocks?: number;
    reserveTasksPerBot?: number;
    strategicIntentRequired?: boolean;
    maxBotOverrides?: number;
    goalKinds?: ReadonlySet<string>;
    blueprints?: { has(reference: string): boolean };
}

export class PlannerSemanticValidator {
    constructor(private readonly options: PlannerSemanticValidatorOptions) {}

    validate(plan: PlannerPlan, context: PlannerContext): Result<void, PlannerFailure> {
        const issues: string[] = [];
        this.validateCounts(plan, issues);
        this.validateRevision(plan, context, issues);
        this.validateIdentifiers(plan, issues);
        this.validateIndependence(plan, issues);
        this.validateTasks(plan, context, issues);
        this.validateCancellations(plan, context, issues);
        this.validateWorkContinuity(plan, context, issues);
        this.validateSkills(plan, issues);
        this.validateSip(plan, context, issues);
        this.validateRegions(plan, context, issues);
        this.validateDistance(plan, context, issues);
        this.validateMaterials(plan, context, issues);
        this.validateStrategicIntent(plan, context, issues);
        if (issues.length > 0) return [null, { type: 'SEMANTIC', issues }];
        return [undefined, null];
    }

    private validateStrategicIntent(
        plan: PlannerPlan,
        context: PlannerContext,
        issues: string[],
    ): void {
        const intent = plan.strategicIntent;
        if (intent === undefined) {
            if (this.options.strategicIntentRequired === true) {
                issues.push('plan is missing strategicIntent');
            }
            return;
        }
        if (intent.planId !== plan.planId) {
            issues.push(`strategic intent planId ${intent.planId} does not match ${plan.planId}`);
        }
        const goals = [intent.primaryGoal, ...intent.secondaryGoals];
        for (const goal of goals) {
            if (this.options.goalKinds !== undefined && !this.options.goalKinds.has(goal.kind)) {
                issues.push(`strategic intent references unknown goal kind ${goal.kind}`);
            }
            if (
                goal.blueprintRef !== undefined &&
                this.options.blueprints !== undefined &&
                !this.options.blueprints.has(goal.blueprintRef)
            ) {
                issues.push(`strategic intent references unknown blueprint ${goal.blueprintRef}`);
            }
        }
        const botIds = new Set(context.bots.map((bot) => bot.id));
        const seen = new Set<string>();
        for (const override of intent.perBot) {
            if (!botIds.has(override.botId)) {
                issues.push(`strategic intent references unknown bot ${override.botId}`);
            }
            if (seen.has(override.botId)) {
                issues.push(`strategic intent has duplicate bot override ${override.botId}`);
            }
            seen.add(override.botId);
        }
        const maximum = this.options.maxBotOverrides;
        if (maximum !== undefined && intent.perBot.length > maximum) {
            issues.push(
                `strategic intent has ${intent.perBot.length} bot overrides, limit is ${maximum}`,
            );
        }
    }

    private validateCounts(plan: PlannerPlan, issues: string[]): void {
        if (plan.tasks.length > (this.options.maxTasks ?? 64)) {
            issues.push(`plan exceeds task cap ${this.options.maxTasks ?? 64}`);
        }
        if (plan.blueprints.length > (this.options.maxBlueprints ?? 16)) {
            issues.push(`plan exceeds blueprint cap ${this.options.maxBlueprints ?? 16}`);
        }
        if (plan.sipMutations.length > (this.options.maxMutations ?? 128)) {
            issues.push(`plan exceeds SIP mutation cap ${this.options.maxMutations ?? 128}`);
        }
    }

    private validateRevision(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        if (plan.baseRevision !== context.sip.revision) {
            issues.push(
                `plan baseRevision ${plan.baseRevision} does not match SIP revision ${context.sip.revision}`,
            );
        }
    }

    private validateIdentifiers(plan: PlannerPlan, issues: string[]): void {
        PlannerSemanticValidator.duplicates(plan.goals.map((goal) => goal.id)).forEach((id) =>
            issues.push(`duplicate goal id ${id}`),
        );
        PlannerSemanticValidator.duplicates(plan.tasks.map((task) => task.id)).forEach((id) =>
            issues.push(`duplicate task id ${id}`),
        );
        PlannerSemanticValidator.duplicates(
            plan.blueprints.map((blueprint) => blueprint.id),
        ).forEach((id) => issues.push(`duplicate blueprint id ${id}`));
        PlannerSemanticValidator.duplicates(
            plan.sipMutations.map((mutation) =>
                PlannerSemanticValidator.mutationIdentity(mutation),
            ),
        ).forEach((id) => issues.push(`duplicate SIP mutation id ${id}`));
    }

    private validateIndependence(plan: PlannerPlan, issues: string[]): void {
        const anchors = new Map<string, string>();
        for (const task of plan.tasks) {
            if (task.parentId !== null) {
                issues.push(`task ${task.id} must not have a parent`);
            }
            if (task.dependencies.length > 0) {
                issues.push(`task ${task.id} must not have dependencies`);
            }
            const anchor = PlannerSemanticValidator.workAnchor(task);
            if (anchor === null) continue;
            const key = `${anchor.x},${anchor.y},${anchor.z}`;
            const existing = anchors.get(key);
            if (existing !== undefined) {
                issues.push(`tasks ${existing} and ${task.id} share work anchor ${key}`);
                continue;
            }
            anchors.set(key, task.id);
        }
    }

    private validateCancellations(
        plan: PlannerPlan,
        context: PlannerContext,
        issues: string[],
    ): void {
        const existing = new Map(context.tasks.map((task) => [task.id, task]));
        const planIds = new Set(plan.tasks.map((task) => task.id));
        const seen = new Set<string>();
        for (const taskId of plan.cancelTaskIds) {
            if (seen.has(taskId)) {
                issues.push(`duplicate cancellation task id ${taskId}`);
                continue;
            }
            seen.add(taskId);
            if (planIds.has(taskId)) {
                issues.push(`task ${taskId} cannot be both planned and cancelled`);
                continue;
            }
            const task = existing.get(taskId);
            if (task === undefined) {
                issues.push(`cancellation references unknown task ${taskId}`);
                continue;
            }
            if (!ACTIONABLE_TASK_STATUSES.has(task.status)) {
                issues.push(`cancellation references non-open task ${taskId}`);
            }
        }
    }

    private validateTasks(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        const planIds = new Set(plan.tasks.map((task) => task.id));
        const existingIds = new Set(context.tasks.map((task) => task.id));
        for (const task of plan.tasks) {
            if (
                task.parentId !== null &&
                !planIds.has(task.parentId) &&
                !existingIds.has(task.parentId)
            ) {
                issues.push(`task ${task.id} has unknown parent ${task.parentId}`);
            }
            for (const dependency of task.dependencies) {
                if (!planIds.has(dependency) && !existingIds.has(dependency)) {
                    issues.push(`task ${task.id} has unknown dependency ${dependency}`);
                }
            }
        }
        const cycle = PlannerSemanticValidator.findCycle(plan.tasks, existingIds);
        if (cycle !== null) issues.push(`task dependency cycle involving ${cycle}`);
    }

    private validateWorkContinuity(
        plan: PlannerPlan,
        context: PlannerContext,
        issues: string[],
    ): void {
        const existingIds = new Set(context.tasks.map((task) => task.id));
        const cancelledIds = new Set(plan.cancelTaskIds);
        const effectiveOpen = context.tasks.filter(
            (task) => ACTIONABLE_TASK_STATUSES.has(task.status) && !cancelledIds.has(task.id),
        ).length;
        const newTasks = plan.tasks.filter((task) => !existingIds.has(task.id)).length;
        const onlineBots = context.bots.filter((bot) => bot.online).length;
        const requiredTasks = onlineBots * (1 + (this.options.reserveTasksPerBot ?? 0));
        if (effectiveOpen + newTasks < requiredTasks) {
            const botLabel = onlineBots === 1 ? 'bot' : 'bots';
            issues.push(
                `plan must provide ${requiredTasks} actionable independent tasks for ${onlineBots} online ${botLabel}: ${effectiveOpen + newTasks} available`,
            );
        }
    }

    private validateSkills(plan: PlannerPlan, issues: string[]): void {
        plan.tasks.forEach((task) => {
            if (!this.options.skills.has(task.skillId)) {
                issues.push(`task ${task.id} references unknown skill ${task.skillId}`);
            }
        });
    }

    private validateSip(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        if (plan.sipMutations.length === 0) return;
        const [, validationError] = this.options.sip.validate(plan.sipMutations);
        if (validationError) issues.push(`SIP mutation validation failed: ${validationError}`);
        const structureIds = new Set(context.sip.structures.map((structure) => structure.id));
        const roadIds = new Set(context.sip.roads.map((road) => road.id));
        const farmIds = new Set(context.sip.farms.map((farm) => farm.id));
        const containerIds = new Set(context.sip.containers.map((container) => container.id));
        for (const mutation of plan.sipMutations) {
            const referenceError = PlannerSemanticValidator.referenceError(
                mutation,
                structureIds,
                roadIds,
                farmIds,
                containerIds,
            );
            if (referenceError !== null) issues.push(referenceError);
        }
    }

    private validateRegions(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        const positions = [
            ...PlannerGeometry.planPositions(plan),
            ...plan.sipMutations.flatMap((mutation) =>
                PlannerGeometry.mutationBboxes(mutation).map((bbox) => bbox.min),
            ),
        ];
        for (const position of positions) {
            if (
                context.sip.protectedBboxes.some((bounds) =>
                    PlannerGeometry.contains(bounds, position),
                )
            ) {
                issues.push(
                    `plan position ${PlannerSemanticValidator.format(position)} is protected`,
                );
            }
            if (
                context.sip.noBuildZones.some((zone) =>
                    PlannerGeometry.insidePolygon(position, zone),
                )
            ) {
                issues.push(
                    `plan position ${PlannerSemanticValidator.format(position)} is in a no-build zone`,
                );
            }
        }
        for (const mutation of plan.sipMutations) {
            for (const bbox of PlannerGeometry.mutationBboxes(mutation)) {
                if (
                    context.sip.protectedBboxes.some((bounds) =>
                        PlannerGeometry.overlaps(bounds, bbox),
                    )
                ) {
                    issues.push(
                        `SIP mutation ${PlannerSemanticValidator.mutationIdentity(mutation)} overlaps a protected region`,
                    );
                }
            }
        }
    }

    private validateDistance(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        const anchors = [
            ...context.bots
                .filter((bot) => bot.online && bot.position !== null)
                .map((bot) => bot.position)
                .filter((position): position is PlannerPosition => position !== null),
            ...context.sip.containers.map((container) => container.pos),
            ...context.sip.zones
                .filter((zone) => zone.type === 'base')
                .map((zone) => PlannerGeometry.fromPositions(zone.polygon)?.min)
                .filter((position): position is PlannerPosition => position !== undefined),
        ];
        if (anchors.length === 0) return;
        const maximum = this.options.maxDistanceBlocks ?? 256;
        for (const position of PlannerGeometry.planPositions(plan)) {
            const distance = anchors.reduce(
                (minimum, anchor) => Math.min(minimum, PlannerGeometry.distance(position, anchor)),
                Number.POSITIVE_INFINITY,
            );
            if (distance > maximum) {
                issues.push(
                    `plan position ${PlannerSemanticValidator.format(position)} is ${distance} blocks from the nearest anchor`,
                );
            }
        }
    }

    private validateMaterials(plan: PlannerPlan, context: PlannerContext, issues: string[]): void {
        const required = new Map<string, number>();
        plan.blueprints.forEach((blueprint) => {
            blueprint.materials.forEach((material) => {
                required.set(material.item, (required.get(material.item) ?? 0) + material.count);
            });
        });
        for (const [item, count] of required.entries()) {
            const available = context.inventory[item] ?? 0;
            if (available < count) {
                issues.push(`material ${item} requires ${count} but fleet has ${available}`);
            }
        }
    }

    private static workAnchor(task: PlannerTask): PlannerPosition | null {
        if (task.target !== null) return task.target;
        return PlannerSemanticValidator.readPosition(task.payload.center);
    }

    private static readPosition(value: unknown): PlannerPosition | null {
        if (typeof value !== 'object' || value === null) return null;
        const x = Reflect.get(value, 'x');
        const y = Reflect.get(value, 'y');
        const z = Reflect.get(value, 'z');
        if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            typeof z !== 'number' ||
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            !Number.isInteger(z)
        ) {
            return null;
        }
        return { x, y, z };
    }

    private static findCycle(
        tasks: readonly PlannerTask[],
        existingIds: ReadonlySet<string>,
    ): string | null {
        const planIds = new Set(tasks.map((task) => task.id));
        const indegree = new Map<string, number>(tasks.map((task) => [task.id, 0]));
        const outgoing = new Map<string, string[]>(tasks.map((task) => [task.id, []]));
        tasks.forEach((task) => {
            task.dependencies.forEach((dependency) => {
                if (!planIds.has(dependency) || existingIds.has(dependency)) return;
                indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
                outgoing.get(dependency)?.push(task.id);
            });
        });
        const ready = [...indegree.entries()]
            .filter(([, degree]) => degree === 0)
            .map(([id]) => id);
        let visited = 0;
        while (ready.length > 0) {
            const id = ready.shift();
            if (id === undefined) break;
            visited += 1;
            for (const dependent of outgoing.get(id) ?? []) {
                const next = (indegree.get(dependent) ?? 0) - 1;
                indegree.set(dependent, next);
                if (next === 0) ready.push(dependent);
            }
        }
        if (visited === tasks.length) return null;
        return [...indegree.entries()].find(([, degree]) => degree > 0)?.[0] ?? 'unknown';
    }

    private static referenceError(
        mutation: PlannerSipMutation,
        structures: ReadonlySet<string>,
        roads: ReadonlySet<string>,
        farms: ReadonlySet<string>,
        containers: ReadonlySet<string>,
    ): string | null {
        switch (mutation.kind) {
            case 'structure.remove':
                return structures.has(mutation.structureId)
                    ? null
                    : `unknown structure ${mutation.structureId}`;
            case 'road.remove':
                return roads.has(mutation.roadId) ? null : `unknown road ${mutation.roadId}`;
            case 'farm.remove':
                return farms.has(mutation.farmId) ? null : `unknown farm ${mutation.farmId}`;
            case 'container.remove':
                return containers.has(mutation.containerId)
                    ? null
                    : `unknown container ${mutation.containerId}`;
            case 'zone.upsert':
            case 'zone.remove':
            case 'structure.upsert':
            case 'road.upsert':
            case 'farm.upsert':
            case 'container.upsert':
            case 'path-graph.replace':
            case 'rules.replace':
                return null;
        }
    }

    private static mutationIdentity(mutation: PlannerSipMutation): string {
        switch (mutation.kind) {
            case 'zone.upsert':
                return mutation.zone.id;
            case 'zone.remove':
                return mutation.zoneId;
            case 'structure.upsert':
                return mutation.structure.id;
            case 'structure.remove':
                return mutation.structureId;
            case 'road.upsert':
                return mutation.road.id;
            case 'road.remove':
                return mutation.roadId;
            case 'farm.upsert':
                return mutation.farm.id;
            case 'farm.remove':
                return mutation.farmId;
            case 'container.upsert':
                return mutation.container.id;
            case 'container.remove':
                return mutation.containerId;
            case 'path-graph.replace':
                return 'path-graph';
            case 'rules.replace':
                return 'rules';
        }
    }

    private static duplicates(values: readonly string[]): readonly string[] {
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        values.forEach((value) => {
            if (seen.has(value)) duplicates.add(value);
            seen.add(value);
        });
        return [...duplicates];
    }

    private static format(position: PlannerPosition): string {
        return `(${position.x},${position.y},${position.z})`;
    }
}
