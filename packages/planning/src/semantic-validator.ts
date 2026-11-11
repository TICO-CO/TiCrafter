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

export interface PlannerSemanticValidatorOptions {
    skills: PlannerSkillCatalogPort;
    sip: PlannerSipValidationPort;
    maxTasks?: number;
    maxBlueprints?: number;
    maxMutations?: number;
    maxDistanceBlocks?: number;
}

export class PlannerSemanticValidator {
    constructor(private readonly options: PlannerSemanticValidatorOptions) {}

    validate(plan: PlannerPlan, context: PlannerContext): Result<void, PlannerFailure> {
        const issues: string[] = [];
        this.validateCounts(plan, issues);
        this.validateRevision(plan, context, issues);
        this.validateIdentifiers(plan, issues);
        this.validateTasks(plan, context, issues);
        this.validateSkills(plan, issues);
        this.validateSip(plan, context, issues);
        this.validateRegions(plan, context, issues);
        this.validateDistance(plan, context, issues);
        this.validateMaterials(plan, context, issues);
        if (issues.length > 0) return [null, { type: 'SEMANTIC', issues }];
        return [undefined, null];
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
