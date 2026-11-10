export interface SyncCursor {
    sipRevision: number;
    taskBoardRevision: number;
    chunkVersions: Record<string, number>;
}

export class DeltaSync {
    static initialCursor(): SyncCursor {
        return { sipRevision: 0, taskBoardRevision: 0, chunkVersions: {} };
    }

    static shouldResync(local: SyncCursor, remote: SyncCursor): boolean {
        if (local.sipRevision !== remote.sipRevision) return true;
        if (local.taskBoardRevision !== remote.taskBoardRevision) return true;
        const keys = new Set([
            ...Object.keys(local.chunkVersions),
            ...Object.keys(remote.chunkVersions),
        ]);
        for (const key of keys) {
            if ((local.chunkVersions[key] ?? 0) !== (remote.chunkVersions[key] ?? 0)) return true;
        }
        return false;
    }
}
