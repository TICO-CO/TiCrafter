import type { SafetySignal } from './types.js';

export class SafetyReasons {
    static readonly emergencyStopActive = 'emergency stop active';
    static readonly safeModeActive = 'safe mode active';
    static readonly noSafetySignal = 'no safety signal';
}

export class SafetySignals {
    static hazardLava(): SafetySignal {
        return { code: 'hazard.lava', severity: 'critical', message: 'lava nearby' };
    }

    static hazardFire(): SafetySignal {
        return { code: 'hazard.fire', severity: 'critical', message: 'fire nearby' };
    }

    static hazardDrowning(): SafetySignal {
        return {
            code: 'hazard.drowning',
            severity: 'critical',
            message: 'oxygen low underwater',
        };
    }

    static hazardVoid(): SafetySignal {
        return { code: 'hazard.void', severity: 'critical', message: 'below void line' };
    }

    static hazardFall(): SafetySignal {
        return { code: 'hazard.fall', severity: 'critical', message: 'dangerous fall' };
    }

    static foodCritical(): SafetySignal {
        return { code: 'hunger.low', severity: 'critical', message: 'food critical' };
    }

    static foodLow(): SafetySignal {
        return { code: 'hunger.low', severity: 'warning', message: 'food low' };
    }

    static mobAdjacent(): SafetySignal {
        return { code: 'mob.threat', severity: 'critical', message: 'hostile mob adjacent' };
    }

    static mobNearby(): SafetySignal {
        return { code: 'mob.threat', severity: 'warning', message: 'hostile mob nearby' };
    }

    static mobRangedInRange(name: string): SafetySignal {
        return {
            code: 'mob.threat',
            severity: 'critical',
            message: `ranged ${name} in attack range`,
        };
    }

    static mobRangedNearby(name: string): SafetySignal {
        return {
            code: 'mob.threat',
            severity: 'warning',
            message: `ranged ${name} nearby`,
        };
    }

    static movementStuck15s(): SafetySignal {
        return {
            code: 'movement.stuck',
            severity: 'critical',
            message: 'movement stuck for 15s',
        };
    }

    static movementStuck5s(): SafetySignal {
        return {
            code: 'movement.stuck',
            severity: 'warning',
            message: 'movement stuck for 5s',
        };
    }

    static targetUnreachable10s(): SafetySignal {
        return {
            code: 'movement.unreachable',
            severity: 'warning',
            message: 'target unreachable for 10s',
        };
    }

    static inventoryFullWarning(percent: number): SafetySignal {
        return {
            code: 'inventory.full',
            severity: 'warning',
            message: `inventory ${percent}% full`,
        };
    }

    static inventoryFullCritical(percent: number): SafetySignal {
        return {
            code: 'inventory.full',
            severity: 'critical',
            message: `inventory ${percent}% full`,
        };
    }

    static claimMissing(): SafetySignal {
        return { code: 'claim.lost', severity: 'critical', message: 'active claim missing' };
    }

    static claimInvalidExpiry(): SafetySignal {
        return {
            code: 'claim.lost',
            severity: 'critical',
            message: 'active claim has invalid expiry',
        };
    }

    static claimEvaluationTimeInvalid(): SafetySignal {
        return {
            code: 'claim.lost',
            severity: 'critical',
            message: 'claim evaluation time is invalid',
        };
    }

    static claimExpired(): SafetySignal {
        return { code: 'claim.lost', severity: 'critical', message: 'active claim expired' };
    }

    static materialBan(material: string): SafetySignal {
        return {
            code: 'action.material-ban',
            severity: 'critical',
            message: `banned material ${material}`,
        };
    }

    static protectedRegion(): SafetySignal {
        return {
            code: 'action.protected-region',
            severity: 'critical',
            message: 'destructive action inside protected region',
        };
    }

    static activeBotSupport(): SafetySignal {
        return {
            code: 'action.active-bot-support',
            severity: 'critical',
            message: 'block supports an online bot',
        };
    }

    static emergencyStop(reason: string | null): SafetySignal {
        return {
            code: 'emergency-stop',
            severity: 'critical',
            message: reason ?? SafetyReasons.emergencyStopActive,
        };
    }
}
