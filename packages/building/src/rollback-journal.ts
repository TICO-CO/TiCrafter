import type { Result, Vec3 } from '@ticrafter/core';

import type { BlockChange } from './block-verifier.js';
import type { BlueprintBlock, BlueprintBlockState } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockState } from './schematic-diff.js';

export interface BlockChangeRecord {
    botId: string;
    position: Vec3;
    before: WorldBlockState | null;
    after: WorldBlockState;
    grantId?: string;
    claimId?: string;
    planId?: string;
    createdAt?: string;
}

export interface BlockChangelogPort {
    append(change: BlockChangeRecord): Result<number, string>;
}

export interface StructureOwnershipView {
    id: string;
    ownerBotIds: readonly string[];
    status: string;
    designRevision: number;
}

export interface StructureLookupPort {
    structureAt(position: Vec3): Result<StructureOwnershipView | null, BuildingFailure>;
}

export interface BlockChangeFeedPort {
    subscribe(listener: (record: BlockChangeRecord) => void): () => void;
}

export interface JournalEntry extends BlockChangeRecord {
    id: string;
}

export type RollbackOperation =
    | { kind: 'break'; block: BlueprintBlock; expected: BlueprintBlockState }
    | { kind: 'place'; block: BlueprintBlock };

const ACTIVE_STRUCTURE_STATUSES: ReadonlySet<string> = new Set(['planned', 'claimed', 'building']);

export class RollbackJournal {
    private readonly entries: JournalEntry[] = [];
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly writer: BlockChangelogPort,
        private readonly structures?: StructureLookupPort,
    ) {}

    record(
        change: BlockChange,
        before: WorldBlockState | null,
    ): Result<JournalEntry, BuildingFailure> {
        const structureError = this.checkStructure(change, before);
        if (structureError) return [null, structureError];
        const record: BlockChangeRecord = {
            botId: change.botId,
            position: { x: change.target.x, y: change.target.y, z: change.target.z },
            before,
            after: change.target.state,
            ...(change.grantId === undefined ? {} : { grantId: change.grantId }),
            ...(change.claimId === undefined ? {} : { claimId: change.claimId }),
            ...(change.planId === undefined ? {} : { planId: change.planId }),
            createdAt: new Date().toISOString(),
        };
        const [id, writeError] = this.writer.append(record);
        if (writeError) return [null, { type: 'JOURNAL_FAILED', message: writeError }];
        if (id === null) {
            return [null, { type: 'JOURNAL_FAILED', message: 'changelog writer returned no id' }];
        }
        const entry: JournalEntry = { ...record, id: String(id) };
        this.entries.push(entry);
        return [entry, null];
    }

    subscribe(feed: BlockChangeFeedPort): void {
        this.unsubscribe?.();
        this.unsubscribe = feed.subscribe((record) => {
            this.entries.push({ ...record, id: String(this.entries.length + 1) });
        });
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    list(planId?: string): readonly JournalEntry[] {
        if (planId === undefined) return this.entries;
        return this.entries.filter((entry) => entry.planId === planId);
    }

    planRollback(planId?: string): readonly RollbackOperation[] {
        return this.list(planId).flatMap((entry) => this.operations(entry));
    }

    private operations(entry: JournalEntry): readonly RollbackOperation[] {
        const position = entry.position;
        if (entry.before === null) {
            return [
                {
                    kind: 'break',
                    block: this.block(position, entry.after),
                    expected: entry.after,
                },
            ];
        }
        if (entry.before.name === entry.after.name) return [];
        return [
            { kind: 'break', block: this.block(position, entry.after), expected: entry.after },
            { kind: 'place', block: this.block(position, entry.before) },
        ];
    }

    private block(position: Vec3, state: BlueprintBlockState): BlueprintBlock {
        return {
            x: position.x,
            y: position.y,
            z: position.z,
            state,
            priority: 0,
        };
    }

    private checkStructure(
        change: BlockChange,
        before: WorldBlockState | null,
    ): BuildingFailure | null {
        if (this.structures === undefined || before === null) return null;
        const [structure, structureError] = this.structures.structureAt({
            x: change.target.x,
            y: change.target.y,
            z: change.target.z,
        });
        if (structureError) return structureError;
        if (structure === null) return null;
        if (!ACTIVE_STRUCTURE_STATUSES.has(structure.status)) return null;
        if (change.grantId !== undefined) return null;
        return {
            type: 'JOURNAL_FAILED',
            message: `active structure ${structure.id} requires an edit grant`,
        };
    }
}
