import type { Result, Vec3 } from '@ticrafter/core';

import type { SkillContext } from './types.js';

export interface EntityTarget {
    id?: number;
    name: string;
    position: Vec3;
}

export class EntityTargeting {
    static nearest(
        context: SkillContext,
        names: ReadonlySet<string>,
        ignored: (entity: EntityTarget) => boolean = () => false,
    ): EntityTarget | null {
        const entities = context.world.entities?.() ?? [];
        const candidates = entities
            .filter((entity) => names.has(entity.name) && !ignored(entity))
            .map((entity) => ({
                entity,
                distance: Math.hypot(
                    entity.position.x - context.position.x,
                    entity.position.y - context.position.y,
                    entity.position.z - context.position.z,
                ),
            }))
            .sort((left, right) => left.distance - right.distance);
        return candidates[0]?.entity ?? null;
    }

    static refresh(context: SkillContext, target: EntityTarget): EntityTarget | null {
        const entities = context.world.entities?.() ?? [];
        if (target.id !== undefined) {
            return entities.find((entity) => entity.id === target.id) ?? null;
        }
        return (
            entities.find(
                (entity) =>
                    entity.name === target.name &&
                    Math.hypot(
                        entity.position.x - target.position.x,
                        entity.position.z - target.position.z,
                    ) < 2,
            ) ?? null
        );
    }

    static exists(context: SkillContext, target: EntityTarget): boolean {
        const entities = context.world.entities?.() ?? [];
        return entities.some(
            (entity) =>
                (target.id !== undefined && entity.id === target.id) ||
                (entity.name === target.name &&
                    Math.hypot(
                        entity.position.x - target.position.x,
                        entity.position.z - target.position.z,
                    ) < 2),
        );
    }
}
