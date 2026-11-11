import { attemptAsync, type Result } from '@ticrafter/core';

import type { PlannerHttpPort, PlannerHttpRequest, PlannerHttpResponse } from './types.js';

export class FetchPlannerHttpPort implements PlannerHttpPort {
    async post(request: PlannerHttpRequest): Promise<Result<PlannerHttpResponse, string>> {
        const [response, requestError] = await attemptAsync(() =>
            fetch(request.url, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${request.apiKey}`,
                    'content-type': 'application/json',
                },
                body: request.bodyJson,
                signal: request.signal,
            }),
        );
        if (requestError) return [null, FetchPlannerHttpPort.describe(requestError)];
        if (response === null) return [null, 'planner request returned null'];
        const [bodyText, bodyError] = await attemptAsync(() => response.text());
        if (bodyError) return [null, FetchPlannerHttpPort.describe(bodyError)];
        if (bodyText === null) return [null, 'planner response body returned null'];
        return [{ status: response.status, bodyText }, null];
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
