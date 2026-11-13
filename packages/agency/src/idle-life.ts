import type { AgencySnapshot } from './types.js';

export interface IdlePlan {
    id: string;
    label: string;
    radius: number;
    maxSteps: number;
}

const PLANS: readonly Omit<IdlePlan, 'id'>[] = [
    { label: 'Scan the surroundings', radius: 8, maxSteps: 1 },
    { label: 'Inspect the nearby base', radius: 12, maxSteps: 3 },
    { label: 'Patrol the area briefly', radius: 20, maxSteps: 5 },
];

export class IdleLife {
    static plan(snapshot: AgencySnapshot): IdlePlan {
        const seed = `${snapshot.at}:${snapshot.position.x}:${snapshot.position.z}`;
        const index = Math.abs(IdleLife.hash(seed)) % PLANS.length;
        const plan = PLANS[index] ?? PLANS[0];
        return {
            id: IdleLife.slug(plan?.label ?? 'Scan the surroundings'),
            label: plan?.label ?? 'Scan the surroundings',
            radius: plan?.radius ?? 8,
            maxSteps: plan?.maxSteps ?? 1,
        };
    }

    private static hash(value: string): number {
        let result = 0;
        for (const character of value) {
            result = (result * 31 + character.charCodeAt(0)) | 0;
        }
        return result;
    }

    private static slug(label: string): string {
        return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
}
