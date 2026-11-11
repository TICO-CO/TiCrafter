import type { Result, Vec3 } from '@ticrafter/core';

import type {
    Skill,
    SkillCheckpoint,
    SkillContext,
    SkillInput,
    SkillRun,
    SkillStep,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';
import { WorldScan } from './world-scan.js';

const GOLDEN_ANGLE = 2.399963229728653;
const DEFAULT_RADIUS = 16;
const DEFAULT_MAX_STEPS = 8;

export class ExploreSkill implements Skill {
    readonly id = 'explore';

    canRun(context: SkillContext, input: SkillInput): Result<boolean, string> {
        const hasWaypoints = input.waypoints !== undefined && input.waypoints.length > 0;
        if (!hasWaypoints && input.center === undefined) {
            return [null, 'explore requires waypoints or center'];
        }
        return [true, null];
    }

    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string> {
        const hasWaypoints = input.waypoints !== undefined && input.waypoints.length > 0;
        if (!hasWaypoints && input.center === undefined) {
            return [null, 'explore requires waypoints or center'];
        }
        const radius = input.radius ?? DEFAULT_RADIUS;
        if (radius <= 0) return [null, 'explore radius must be positive'];
        const maxSteps = input.maxSteps ?? input.waypoints?.length ?? DEFAULT_MAX_STEPS;
        if (!Number.isInteger(maxSteps) || maxSteps < 1) {
            return [null, 'explore maxSteps must be positive'];
        }
        return [{ ...input, radius, maxSteps }, null];
    }

    start(context: SkillContext, input: SkillInput): Result<SkillStep, string> {
        const radius = input.radius ?? DEFAULT_RADIUS;
        const [waypoints, waypointError] = this.resolveWaypoints(input, radius);
        if (waypointError) return [null, waypointError];
        if (waypoints === null) return [null, 'explore requires waypoints or center'];
        const maxSteps = input.maxSteps ?? waypoints.length;
        const run: SkillRun = {
            skillId: this.id,
            state: {
                waypoints,
                index: 0,
                visited: [],
                steps: 0,
                maxSteps,
                radius,
                range: input.range ?? 1,
                phase: 'move',
            },
        };
        return this.selectNext(context, run);
    }

    step(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        if (context.lastAction?.status === 'failed') {
            return [
                SkillSharedUtilities.failed(
                    run,
                    SkillSharedUtilities.failureClassFor(context.lastAction),
                    context.lastAction.message ?? 'exploration failed',
                ),
                null,
            ];
        }
        if (context.lastAction?.status !== 'completed') return this.selectNext(context, run);
        const waypoints = this.readWaypoints(run.state.waypoints);
        if (waypoints === null) return [null, 'explore state lost its waypoints'];
        const activeIndex = SkillSharedUtilities.readNumber(run.state.activeIndex, -1);
        const activePosition = activeIndex >= 0 ? waypoints[activeIndex] : undefined;
        if (activePosition === undefined) return this.selectNext(context, run);
        const key = WorldScan.key(activePosition);
        const visited = WorldScan.readStrings(run.state.visited) ?? [];
        const alreadyVisited = visited.includes(key);
        const steps = SkillSharedUtilities.readNumber(run.state.steps, 0);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: {
                ...run.state,
                visited: alreadyVisited ? visited : [...visited, key],
                steps: alreadyVisited ? steps : steps + 1,
                index: activeIndex + 1,
                activeIndex: -1,
            },
        };
        return this.selectNext(context, nextRun);
    }

    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string> {
        return [SkillSharedUtilities.cancelled(run, reason), null];
    }

    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string> {
        return [SkillSharedUtilities.checkpoint(context, run), null];
    }

    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string> {
        if (this.readWaypoints(checkpoint.state.waypoints) === null) {
            return [null, 'checkpoint has no waypoints'];
        }
        if (WorldScan.readStrings(checkpoint.state.visited) === null) {
            return [null, 'checkpoint has no visited keys'];
        }
        return [{ skillId: this.id, state: checkpoint.state }, null];
    }

    private selectNext(context: SkillContext, run: SkillRun): Result<SkillStep, string> {
        const waypoints = this.readWaypoints(run.state.waypoints);
        if (waypoints === null) return [null, 'explore state lost its waypoints'];
        const maxSteps = SkillSharedUtilities.readNumber(run.state.maxSteps, waypoints.length);
        const steps = SkillSharedUtilities.readNumber(run.state.steps, 0);
        if (steps >= maxSteps) {
            return [SkillSharedUtilities.completed(run, 'exploration complete'), null];
        }
        const visited = new Set(WorldScan.readStrings(run.state.visited) ?? []);
        let index = SkillSharedUtilities.readNumber(run.state.index, 0);
        while (index < waypoints.length) {
            const position = waypoints[index];
            if (position === undefined) break;
            const key = WorldScan.key(position);
            if (!visited.has(key)) {
                const [isProtected, protectionError] = this.isProtected(context, position);
                if (protectionError) return [null, protectionError];
                if (isProtected !== true) {
                    return [this.moveTo(run, position, key, index, steps, maxSteps), null];
                }
            }
            index += 1;
        }
        return [SkillSharedUtilities.completed(run, 'exploration complete'), null];
    }

    private moveTo(
        run: SkillRun,
        position: Vec3,
        key: string,
        index: number,
        steps: number,
        maxSteps: number,
    ): SkillStep {
        const range = SkillSharedUtilities.readNumber(run.state.range, 1);
        const nextRun: SkillRun = {
            skillId: this.id,
            state: { ...run.state, index, activeIndex: index, phase: 'move' },
        };
        return SkillSharedUtilities.running(
            nextRun,
            { kind: 'move-to', position, range },
            steps,
            maxSteps,
            `exploring ${key}`,
        );
    }

    private isProtected(context: SkillContext, position: Vec3): Result<boolean, string> {
        const spatial = context.services?.spatial;
        if (spatial === undefined) return [false, null];
        return spatial.isProtected(position);
    }

    private resolveWaypoints(input: SkillInput, radius: number): Result<readonly Vec3[], string> {
        if (input.waypoints !== undefined && input.waypoints.length > 0) {
            return [input.waypoints, null];
        }
        if (input.center === undefined) {
            return [null, 'explore requires waypoints or center'];
        }
        return [this.generate(input.center, radius, input.maxSteps ?? DEFAULT_MAX_STEPS), null];
    }

    private readWaypoints(value: unknown): readonly Vec3[] | null {
        const waypoints = WorldScan.readPositions(value);
        if (waypoints === null || waypoints.length === 0) return null;
        return waypoints;
    }

    private generate(center: Vec3, radius: number, maxSteps: number): readonly Vec3[] {
        const positions: Vec3[] = [];
        const seen = new Set<string>();
        for (let step = 0; step < maxSteps; step += 1) {
            const distance = Math.max(1, Math.round(((step + 1) / maxSteps) * radius));
            const angle = step * GOLDEN_ANGLE;
            const position = {
                x: Math.floor(center.x + Math.cos(angle) * distance),
                y: center.y,
                z: Math.floor(center.z + Math.sin(angle) * distance),
            };
            const key = WorldScan.key(position);
            if (seen.has(key)) continue;
            seen.add(key);
            positions.push(position);
        }
        return positions;
    }
}
