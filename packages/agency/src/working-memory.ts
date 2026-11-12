import type { Result } from '@ticrafter/core';

import type {
    WorkingMemory,
    WorkingMemoryCommitment,
    WorkingMemoryExperience,
    WorkingMemoryFocus,
    WorkingMemoryInterruption,
    WorkingMemoryTacticalDecision,
} from './types.js';

export const MAXIMUM_COMMITMENTS = 4;
export const MAXIMUM_RECENT_EXPERIENCES = 8;

export class WorkingMemoryModel {
    private constructor(readonly snapshot: WorkingMemory) {}

    static create(): WorkingMemoryModel {
        return new WorkingMemoryModel({
            revision: 0,
            focus: null,
            commitments: [],
            interruption: null,
            recentExperiences: [],
            lastTacticalDecision: null,
        });
    }

    static restore(input: WorkingMemory | null | undefined): Result<WorkingMemoryModel, string> {
        if (input === null || input === undefined) return [WorkingMemoryModel.create(), null];
        const validationError = WorkingMemoryModel.validate(input);
        if (validationError !== null) return [null, validationError];
        return [new WorkingMemoryModel(input), null];
    }

    get revision(): number {
        return this.snapshot.revision;
    }

    get focus(): WorkingMemoryFocus | null {
        return this.snapshot.focus;
    }

    get commitments(): readonly WorkingMemoryCommitment[] {
        return this.snapshot.commitments;
    }

    get interruption(): WorkingMemoryInterruption | null {
        return this.snapshot.interruption;
    }

    get recentExperiences(): readonly WorkingMemoryExperience[] {
        return this.snapshot.recentExperiences;
    }

    get lastTacticalDecision(): WorkingMemoryTacticalDecision | null {
        return this.snapshot.lastTacticalDecision;
    }

    withFocus(focus: WorkingMemoryFocus): WorkingMemoryModel {
        return this.next({ focus: { ...focus } });
    }

    withoutFocus(): WorkingMemoryModel {
        if (this.snapshot.focus === null) return this;
        return this.next({ focus: null });
    }

    withInterruption(interruption: WorkingMemoryInterruption): WorkingMemoryModel {
        return this.next({ interruption: { ...interruption } });
    }

    withoutInterruption(): WorkingMemoryModel {
        if (this.snapshot.interruption === null) return this;
        return this.next({ interruption: null });
    }

    withCommitment(commitment: WorkingMemoryCommitment): Result<WorkingMemoryModel, string> {
        if (this.snapshot.commitments.length >= MAXIMUM_COMMITMENTS) {
            return [null, `working memory already has ${MAXIMUM_COMMITMENTS} commitments`];
        }
        if (commitment.id.length === 0) return [null, 'commitment id is required'];
        if (commitment.description.length === 0) {
            return [null, 'commitment description is required'];
        }
        if (!Number.isFinite(commitment.priority)) {
            return [null, 'commitment priority must be finite'];
        }
        return [
            this.next({
                commitments: [...this.snapshot.commitments, { ...commitment }],
            }),
            null,
        ];
    }

    withoutCommitment(id: string): WorkingMemoryModel {
        const commitments = this.snapshot.commitments.filter((commitment) => commitment.id !== id);
        if (commitments.length === this.snapshot.commitments.length) return this;
        return this.next({ commitments });
    }

    withExperience(experience: WorkingMemoryExperience): WorkingMemoryModel {
        return this.next({
            recentExperiences: [...this.snapshot.recentExperiences, { ...experience }].slice(
                -MAXIMUM_RECENT_EXPERIENCES,
            ),
        });
    }

    withTacticalDecision(decision: WorkingMemoryTacticalDecision): WorkingMemoryModel {
        return this.next({ lastTacticalDecision: { ...decision } });
    }

    private next(changes: Partial<WorkingMemory>): WorkingMemoryModel {
        return new WorkingMemoryModel({
            ...this.snapshot,
            ...changes,
            revision: this.snapshot.revision + 1,
        });
    }

    private static validate(input: WorkingMemory): string | null {
        if (!Number.isInteger(input.revision) || input.revision < 0) {
            return 'working memory revision must be a non-negative integer';
        }
        const focusError = WorkingMemoryModel.validateFocus(input.focus);
        if (focusError !== null) return focusError;
        if (input.commitments.length > MAXIMUM_COMMITMENTS) {
            return `working memory exceeds ${MAXIMUM_COMMITMENTS} commitments`;
        }
        const commitmentError = input.commitments.find(
            (commitment) => commitment.id.length === 0 || commitment.description.length === 0,
        );
        if (commitmentError !== undefined) return 'working memory commitment is invalid';
        const interruptionError = WorkingMemoryModel.validateInterruption(input.interruption);
        if (interruptionError !== null) return interruptionError;
        if (input.recentExperiences.length > MAXIMUM_RECENT_EXPERIENCES) {
            return `working memory exceeds ${MAXIMUM_RECENT_EXPERIENCES} recent experiences`;
        }
        const experienceError = input.recentExperiences.find(
            (experience) => experience.event.length === 0 || experience.outcome.length === 0,
        );
        if (experienceError !== undefined) return 'working memory experience is invalid';
        const decision = input.lastTacticalDecision;
        if (decision !== null) {
            if (decision.choiceId.length === 0) {
                return 'working memory tactical decision is invalid';
            }
            if (!Number.isInteger(decision.revision) || decision.revision < 0) {
                return 'working memory tactical revision must be a non-negative integer';
            }
        }
        return null;
    }

    private static validateFocus(focus: WorkingMemoryFocus | null): string | null {
        if (focus === null) return null;
        if (focus.id.length === 0) return 'working memory focus id is required';
        if (focus.label.length === 0) return 'working memory focus label is required';
        if (focus.startedAt.length === 0) return 'working memory focus timestamp is required';
        return null;
    }

    private static validateInterruption(
        interruption: WorkingMemoryInterruption | null,
    ): string | null {
        if (interruption === null) return null;
        if (interruption.reason.length === 0)
            return 'working memory interruption reason is required';
        if (interruption.resumeCondition.length === 0) {
            return 'working memory interruption resume condition is required';
        }
        if (interruption.interruptedFocusId.length === 0) {
            return 'working memory interruption focus id is required';
        }
        if (interruption.at.length === 0) {
            return 'working memory interruption timestamp is required';
        }
        return null;
    }
}
