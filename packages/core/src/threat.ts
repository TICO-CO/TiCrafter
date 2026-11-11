import type { Vec3 } from './actions.js';

export interface HostileThreatObservation {
    name: string;
    position: Vec3;
    distance: number;
    ranged: boolean;
    attackRange: number;
    hasLineOfSight: boolean;
}

export type HostileThreatLevel = 'critical' | 'warning' | 'none';

export class MobThreatRules {
    static readonly immediateDistance = 4;
    static readonly nearbyDistance = 8;
    static readonly rangedWarningMargin = 8;

    static level(hostile: HostileThreatObservation): HostileThreatLevel {
        if (MobThreatRules.isCritical(hostile)) return 'critical';
        if (MobThreatRules.isWarning(hostile)) return 'warning';
        return 'none';
    }

    static isCritical(hostile: HostileThreatObservation): boolean {
        if (MobThreatRules.isRangedInRange(hostile)) return true;
        return MobThreatRules.isImmediate(hostile);
    }

    static isImmediate(hostile: HostileThreatObservation): boolean {
        return hostile.distance <= MobThreatRules.immediateDistance;
    }

    static isRangedInRange(hostile: HostileThreatObservation): boolean {
        return hostile.ranged && hostile.hasLineOfSight && hostile.distance <= hostile.attackRange;
    }

    static isWarning(hostile: HostileThreatObservation): boolean {
        if (hostile.distance <= Math.max(MobThreatRules.nearbyDistance, hostile.attackRange)) {
            return true;
        }
        return (
            hostile.hasLineOfSight &&
            hostile.distance <= hostile.attackRange + MobThreatRules.rangedWarningMargin
        );
    }
}
