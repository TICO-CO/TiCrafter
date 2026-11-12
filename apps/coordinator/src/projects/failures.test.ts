import { describe, expect, it } from 'bun:test';

import { ProjectFailures } from './failures.js';

describe('ProjectFailures', () => {
    it('constructs each project failure variant', () => {
        expect(ProjectFailures.invalidProject('bad')).toEqual({
            type: 'INVALID_PROJECT',
            message: 'bad',
        });
        expect(ProjectFailures.projectNotFound('project-1')).toEqual({
            type: 'PROJECT_NOT_FOUND',
            projectId: 'project-1',
        });
        expect(ProjectFailures.projectExists('project-1')).toEqual({
            type: 'PROJECT_EXISTS',
            projectId: 'project-1',
        });
        expect(ProjectFailures.ownerMismatch('project-1', 'bot.one')).toEqual({
            type: 'OWNER_MISMATCH',
            projectId: 'project-1',
            botId: 'bot.one',
        });
        expect(ProjectFailures.botNotFound('bot.one')).toEqual({
            type: 'BOT_NOT_FOUND',
            botId: 'bot.one',
        });
        expect(ProjectFailures.claimFailed('bad')).toEqual({
            type: 'CLAIM_FAILED',
            message: 'bad',
        });
        expect(ProjectFailures.constructionFailed('bad')).toEqual({
            type: 'CONSTRUCTION_FAILED',
            message: 'bad',
        });
        expect(ProjectFailures.taskFailed('bad')).toEqual({ type: 'TASK_FAILED', message: 'bad' });
        expect(ProjectFailures.sipFailed('bad')).toEqual({ type: 'SIP_FAILED', message: 'bad' });
        expect(ProjectFailures.profileFailed('bad')).toEqual({
            type: 'PROFILE_FAILED',
            message: 'bad',
        });
        expect(ProjectFailures.agencyFailed('bad')).toEqual({
            type: 'AGENCY_FAILED',
            message: 'bad',
        });
    });
});
