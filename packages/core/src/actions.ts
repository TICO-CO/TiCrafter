import type { Result } from './kernel/index.js';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export type ActionRequest =
    | { kind: 'move-to'; position: Vec3; range?: number }
    | { kind: 'follow-path'; waypoints: readonly Vec3[]; range?: number }
    | { kind: 'break-block'; position: Vec3; expectedBlockId?: string }
    | { kind: 'place-block'; position: Vec3; itemName: string }
    | { kind: 'use-block'; position: Vec3; itemName?: string }
    | { kind: 'attack'; entityId?: number; entityName?: string }
    | { kind: 'equip'; itemName: string; destination?: 'hand' | 'off-hand' }
    | { kind: 'consume'; itemName?: string }
    | { kind: 'craft'; itemName: string; count: number }
    | { kind: 'collect-drops'; radius: number; itemName?: string }
    | {
          kind: 'transfer';
          direction: 'deposit' | 'withdraw';
          container: Vec3;
          itemName: string;
          count: number;
      }
    | { kind: 'wait'; milliseconds: number };

export type ActionFailureClass =
    | 'invalid'
    | 'unsafe'
    | 'no-path'
    | 'missing-item'
    | 'missing-tool'
    | 'target-missing'
    | 'timeout'
    | 'preempted'
    | 'execution-failed';

export interface ActionFailure {
    class: ActionFailureClass;
    message: string;
}

export type ActionOutcomeStatus = 'completed' | 'failed' | 'cancelled';

export interface ActionOutcome {
    request: ActionRequest;
    status: ActionOutcomeStatus;
    message?: string;
    failure?: ActionFailure;
}

export interface ActionDispatchPort {
    dispatch(request: ActionRequest): Result<string, string>;
    poll(handleId: string): Result<ActionOutcome | null, string>;
    cancel(handleId: string): Result<void, string>;
}

export const DESTRUCTIVE_ACTION_KINDS = ['break-block', 'place-block'] as const;
