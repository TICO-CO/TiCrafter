import { attempt, type Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import { type PlannerPlan, plannerPlanSchema } from './plan-schema.js';

export class PlannerSchemaValidator {
    validate(content: string): Result<PlannerPlan, PlannerFailure> {
        const [decoded, decodeError] = attempt(() => JSON.parse(content) as unknown);
        if (decodeError) {
            return [
                null,
                { type: 'SCHEMA', issues: [PlannerSchemaValidator.describe(decodeError)] },
            ];
        }
        const parsed = plannerPlanSchema.safeParse(decoded);
        if (!parsed.success) {
            return [
                null,
                {
                    type: 'SCHEMA',
                    issues: parsed.error.issues.map(
                        (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
                    ),
                },
            ];
        }
        return [parsed.data, null];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
