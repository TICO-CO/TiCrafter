import type { GazePosition } from './gaze-controller.js';

export interface PerceptionCandidate {
    kind: string;
    position: GazePosition;
}

export interface PerceptionSighting extends PerceptionCandidate {
    seenAt: number;
}

export interface VisibilityContext {
    origin: GazePosition;
    yaw: number;
    now: number;
    candidates: readonly PerceptionCandidate[];
    lineOfSight: (position: GazePosition) => boolean;
}

export interface PerceptionFilterOptions {
    focusRadius: number;
    sightingTtlMilliseconds: number;
    halfAngleRadians: number;
}

const DEFAULT_HALF_ANGLE = Math.PI / 3;

export class PerceptionFilter {
    private readonly sightings = new Map<string, PerceptionSighting>();

    constructor(private readonly options: PerceptionFilterOptions) {}

    observe(context: VisibilityContext): readonly PerceptionSighting[] {
        this.prune(context.now);
        const visible: PerceptionSighting[] = [];
        for (const candidate of context.candidates) {
            if (!this.visible(context, candidate.position)) continue;
            const sighting = { ...candidate, seenAt: context.now };
            this.sightings.set(PerceptionFilter.key(candidate), sighting);
            visible.push(sighting);
        }
        return visible;
    }

    nearest(
        kinds: readonly string[],
        origin: GazePosition,
        now: number,
        maxDistance: number,
    ): PerceptionSighting | null {
        this.prune(now);
        let nearest: PerceptionSighting | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const sighting of this.sightings.values()) {
            if (!kinds.includes(sighting.kind)) continue;
            const distance = PerceptionFilter.distance(origin, sighting.position);
            if (distance > maxDistance || distance >= nearestDistance) continue;
            nearest = sighting;
            nearestDistance = distance;
        }
        return nearest;
    }

    clear(): void {
        this.sightings.clear();
    }

    private visible(context: VisibilityContext, position: GazePosition): boolean {
        const deltaX = position.x - context.origin.x;
        const deltaZ = position.z - context.origin.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > this.options.focusRadius) return false;
        if (distance > 0.001) {
            const directionX = Math.sin(-context.yaw);
            const directionZ = Math.cos(-context.yaw);
            const dot = (deltaX / distance) * directionX + (deltaZ / distance) * directionZ;
            const halfAngle = this.options.halfAngleRadians ?? DEFAULT_HALF_ANGLE;
            if (dot < Math.cos(halfAngle)) return false;
        }
        return context.lineOfSight(position);
    }

    private prune(now: number): void {
        for (const [key, sighting] of this.sightings) {
            if (now - sighting.seenAt > this.options.sightingTtlMilliseconds) {
                this.sightings.delete(key);
            }
        }
    }

    private static key(candidate: PerceptionCandidate): string {
        return `${candidate.kind}:${candidate.position.x},${candidate.position.y},${candidate.position.z}`;
    }

    private static distance(first: GazePosition, second: GazePosition): number {
        return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
    }
}
