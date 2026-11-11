import type { SkillFailureClass } from '@ticrafter/skills';

export type TaskFailureClass = 'transient' | 'precondition' | 'blocked' | 'invalid' | 'fatal';

export class FailureTaxonomy {
    static taskClassForSkill(failureClass: SkillFailureClass | string): TaskFailureClass {
        switch (failureClass) {
            case 'invalid-input':
            case 'unsupported':
                return 'invalid';
            case 'missing-item':
            case 'missing-tool':
                return 'precondition';
            case 'no-path':
            case 'target-missing':
                return 'blocked';
            case 'unsafe':
                return 'fatal';
            case 'timeout':
            case 'preempted':
            case 'cancelled':
            case 'execution-failed':
                return 'transient';
            default:
                return 'transient';
        }
    }
}
