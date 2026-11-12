import type { StorageFailure } from '@ticrafter/memory';

import type { ProjectFailure } from './types.js';

export class ProjectFailures {
    static storage(failure: StorageFailure): ProjectFailure {
        return { type: 'STORAGE', failure };
    }

    static invalidProject(message: string): ProjectFailure {
        return { type: 'INVALID_PROJECT', message };
    }

    static projectNotFound(projectId: string): ProjectFailure {
        return { type: 'PROJECT_NOT_FOUND', projectId };
    }

    static projectExists(projectId: string): ProjectFailure {
        return { type: 'PROJECT_EXISTS', projectId };
    }

    static ownerMismatch(projectId: string, botId: string): ProjectFailure {
        return { type: 'OWNER_MISMATCH', projectId, botId };
    }

    static botNotFound(botId: string): ProjectFailure {
        return { type: 'BOT_NOT_FOUND', botId };
    }

    static claimFailed(message: string): ProjectFailure {
        return { type: 'CLAIM_FAILED', message };
    }

    static constructionFailed(message: string): ProjectFailure {
        return { type: 'CONSTRUCTION_FAILED', message };
    }

    static taskFailed(message: string): ProjectFailure {
        return { type: 'TASK_FAILED', message };
    }

    static sipFailed(message: string): ProjectFailure {
        return { type: 'SIP_FAILED', message };
    }

    static profileFailed(message: string): ProjectFailure {
        return { type: 'PROFILE_FAILED', message };
    }

    static agencyFailed(message: string): ProjectFailure {
        return { type: 'AGENCY_FAILED', message };
    }
}
