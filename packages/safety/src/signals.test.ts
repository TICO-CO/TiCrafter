import { describe, expect, it } from 'bun:test';

import { SafetyReasons, SafetySignals } from './signals.js';

describe('SafetySignals', () => {
    it('creates hazard signals', () => {
        expect(SafetySignals.hazardLava()).toEqual({
            code: 'hazard.lava',
            severity: 'critical',
            message: 'lava nearby',
        });
        expect(SafetySignals.hazardFire()).toEqual({
            code: 'hazard.fire',
            severity: 'critical',
            message: 'fire nearby',
        });
        expect(SafetySignals.hazardDrowning()).toEqual({
            code: 'hazard.drowning',
            severity: 'critical',
            message: 'oxygen low underwater',
        });
        expect(SafetySignals.hazardVoid()).toEqual({
            code: 'hazard.void',
            severity: 'critical',
            message: 'below void line',
        });
        expect(SafetySignals.hazardFall()).toEqual({
            code: 'hazard.fall',
            severity: 'critical',
            message: 'dangerous fall',
        });
    });

    it('creates hunger and mob signals', () => {
        expect(SafetySignals.foodCritical()).toEqual({
            code: 'hunger.low',
            severity: 'critical',
            message: 'food critical',
        });
        expect(SafetySignals.foodLow()).toEqual({
            code: 'hunger.low',
            severity: 'warning',
            message: 'food low',
        });
        expect(SafetySignals.mobAdjacent()).toEqual({
            code: 'mob.threat',
            severity: 'critical',
            message: 'hostile mob adjacent',
        });
        expect(SafetySignals.mobNearby()).toEqual({
            code: 'mob.threat',
            severity: 'warning',
            message: 'hostile mob nearby',
        });
    });

    it('creates movement and inventory signals', () => {
        expect(SafetySignals.movementStuck15s()).toEqual({
            code: 'movement.stuck',
            severity: 'critical',
            message: 'movement stuck for 15s',
        });
        expect(SafetySignals.movementStuck5s()).toEqual({
            code: 'movement.stuck',
            severity: 'warning',
            message: 'movement stuck for 5s',
        });
        expect(SafetySignals.targetUnreachable10s()).toEqual({
            code: 'movement.unreachable',
            severity: 'warning',
            message: 'target unreachable for 10s',
        });
        expect(SafetySignals.inventoryFullWarning(95)).toEqual({
            code: 'inventory.full',
            severity: 'warning',
            message: 'inventory 95% full',
        });
        expect(SafetySignals.inventoryFullCritical(99)).toEqual({
            code: 'inventory.full',
            severity: 'critical',
            message: 'inventory 99% full',
        });
    });

    it('creates claim signals', () => {
        expect(SafetySignals.claimMissing()).toEqual({
            code: 'claim.lost',
            severity: 'critical',
            message: 'active claim missing',
        });
        expect(SafetySignals.claimInvalidExpiry()).toEqual({
            code: 'claim.lost',
            severity: 'critical',
            message: 'active claim has invalid expiry',
        });
        expect(SafetySignals.claimEvaluationTimeInvalid()).toEqual({
            code: 'claim.lost',
            severity: 'critical',
            message: 'claim evaluation time is invalid',
        });
        expect(SafetySignals.claimExpired()).toEqual({
            code: 'claim.lost',
            severity: 'critical',
            message: 'active claim expired',
        });
    });

    it('creates action and emergency signals', () => {
        expect(SafetySignals.materialBan('lava')).toEqual({
            code: 'action.material-ban',
            severity: 'critical',
            message: 'banned material lava',
        });
        expect(SafetySignals.protectedRegion()).toEqual({
            code: 'action.protected-region',
            severity: 'critical',
            message: 'destructive action inside protected region',
        });
        expect(SafetySignals.activeBotSupport()).toEqual({
            code: 'action.active-bot-support',
            severity: 'critical',
            message: 'block supports an online bot',
        });
        expect(SafetySignals.emergencyStop(null)).toEqual({
            code: 'emergency-stop',
            severity: 'critical',
            message: SafetyReasons.emergencyStopActive,
        });
        expect(SafetySignals.emergencyStop('manual stop')).toEqual({
            code: 'emergency-stop',
            severity: 'critical',
            message: 'manual stop',
        });
    });
});
