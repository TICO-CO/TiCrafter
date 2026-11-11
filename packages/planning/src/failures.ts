import type { StorageFailure } from '@ticrafter/memory';

export type PlannerBudgetDenialReason = 'CALLS_PER_MINUTE' | 'TOKENS_PER_CALL' | 'CANCELLED';

export type PlannerFailure =
    | { type: 'DISABLED'; message: string }
    | { type: 'MISSING_ENDPOINT'; message: string }
    | { type: 'CONTEXT'; message: string }
    | { type: 'TRANSPORT'; message: string }
    | { type: 'HTTP'; status: number; message: string }
    | { type: 'MALFORMED_RESPONSE'; message: string }
    | { type: 'SCHEMA'; issues: readonly string[] }
    | { type: 'SEMANTIC'; issues: readonly string[] }
    | {
          type: 'BUDGET';
          reason: PlannerBudgetDenialReason;
          message: string;
      }
    | { type: 'REPAIR_EXHAUSTED'; attempts: number; failure: PlannerFailure }
    | { type: 'CACHE'; failure: StorageFailure }
    | { type: 'TRANSLATION'; message: string }
    | { type: 'ARBITRATION'; message: string };
