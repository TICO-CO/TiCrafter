import { attempt, type Result } from '@ticrafter/core';
import type { Database } from 'bun:sqlite';

import { type StorageFailure, StorageFailures } from './failures.js';

export type PlannerResponseStatus = 'success' | 'failure';

export interface PlannerPlanRecord {
    id: string;
    revision: number;
    contextHash: string | null;
    planJson: string;
    createdAt: string;
}

export interface PlannerResponseRecord {
    planId: string | null;
    status: PlannerResponseStatus;
    content: string;
    error: string | null;
    createdAt: string;
}

interface PlannerPlanRow {
    id: string;
    revision: number;
    contextHash: string | null;
    planJson: string;
    createdAt: string;
}

interface PlannerResponseRow {
    planId: string | null;
    status: PlannerResponseStatus;
    content: string;
    error: string | null;
    createdAt: string;
}

const planColumns = `
    id, revision, context_hash AS contextHash, plan_json AS planJson, created_at AS createdAt
`;

const responseColumns = `
    plan_id AS planId, status, content, error, created_at AS createdAt
`;

export class SqlitePlannerPlanStore {
    constructor(private readonly database: Database) {}

    savePlan(record: PlannerPlanRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO planner_plans (id, revision, context_hash, plan_json, created_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                         revision = excluded.revision,
                         context_hash = excluded.context_hash,
                         plan_json = excluded.plan_json,
                         created_at = excluded.created_at`,
                )
                .run(
                    record.id,
                    record.revision,
                    record.contextHash,
                    record.planJson,
                    record.createdAt,
                );
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    loadPlan(id: string): Result<PlannerPlanRecord | null, StorageFailure> {
        const [row, readError] = attempt<PlannerPlanRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(`SELECT ${planColumns} FROM planner_plans WHERE id = ?`)
                    .get(id) as PlannerPlanRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        return [row ?? null, null];
    }

    latestPlan(): Result<PlannerPlanRecord | null, StorageFailure> {
        const [row, readError] = attempt<PlannerPlanRow | undefined, unknown>(
            () =>
                this.database
                    .prepare(
                        `SELECT ${planColumns} FROM planner_plans
                         ORDER BY created_at DESC, id DESC LIMIT 1`,
                    )
                    .get() as PlannerPlanRow | undefined,
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        return [row ?? null, null];
    }

    appendResponse(record: PlannerResponseRecord): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `INSERT INTO planner_responses (plan_id, status, content, error, created_at)
                     VALUES (?, ?, ?, ?, ?)`,
                )
                .run(record.planId, record.status, record.content, record.error, record.createdAt);
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }

    recentResponses(limit: number): Result<readonly PlannerResponseRecord[], StorageFailure> {
        const [rows, readError] = attempt<PlannerResponseRow[], unknown>(
            () =>
                this.database
                    .prepare(
                        `SELECT ${responseColumns} FROM planner_responses
                         ORDER BY id DESC LIMIT ?`,
                    )
                    .all(limit) as PlannerResponseRow[],
        );
        if (readError) return [null, StorageFailures.from('READ_FAILED', readError)];
        return [rows ?? [], null];
    }

    prune(planLimit: number, responseLimit: number): Result<void, StorageFailure> {
        const [, writeError] = attempt<void, unknown>(() => {
            this.database
                .prepare(
                    `DELETE FROM planner_plans WHERE id NOT IN (
                        SELECT id FROM planner_plans ORDER BY created_at DESC, id DESC LIMIT ?
                     )`,
                )
                .run(planLimit);
            this.database
                .prepare(
                    `DELETE FROM planner_responses WHERE id NOT IN (
                        SELECT id FROM planner_responses ORDER BY id DESC LIMIT ?
                     )`,
                )
                .run(responseLimit);
        });
        if (writeError) return [null, StorageFailures.from('WRITE_FAILED', writeError)];
        return [undefined, null];
    }
}
