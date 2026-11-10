import type { Landmark, LandmarkAnchor, LandmarkEvidence } from './types.js';

export class LandmarkComparison {
    static sameGeometry(left: Landmark, right: Landmark): boolean {
        return (
            left.type === right.type &&
            left.bbox.min.x === right.bbox.min.x &&
            left.bbox.min.y === right.bbox.min.y &&
            left.bbox.min.z === right.bbox.min.z &&
            left.bbox.max.x === right.bbox.max.x &&
            left.bbox.max.y === right.bbox.max.y &&
            left.bbox.max.z === right.bbox.max.z &&
            LandmarkComparison.sameAnchors(left.anchors, right.anchors)
        );
    }

    static mergeEvidence(existing: Landmark, incoming: Landmark): readonly LandmarkEvidence[] {
        const merged = [...existing.evidence];
        incoming.evidence.forEach((evidence) => {
            const duplicate = merged.some(
                (candidate) =>
                    candidate.sourceBotId === evidence.sourceBotId &&
                    candidate.observedAt === evidence.observedAt,
            );
            if (!duplicate) merged.push(evidence);
        });
        return merged;
    }

    static latestReliability(landmark: Landmark): number {
        const latest = landmark.evidence.at(-1);
        return latest?.reliability ?? 0;
    }

    static compareTimestamps(left: string, right: string): number | null {
        const leftMilliseconds = Date.parse(left);
        const rightMilliseconds = Date.parse(right);
        if (!Number.isFinite(leftMilliseconds) || !Number.isFinite(rightMilliseconds)) {
            return null;
        }
        return leftMilliseconds - rightMilliseconds;
    }

    private static sameAnchors(
        left: readonly LandmarkAnchor[],
        right: readonly LandmarkAnchor[],
    ): boolean {
        if (left.length !== right.length) return false;
        return left.every((anchor, index) => {
            const other = right[index];
            if (other === undefined) return false;
            return (
                anchor.name === other.name &&
                anchor.position.x === other.position.x &&
                anchor.position.y === other.position.y &&
                anchor.position.z === other.position.z
            );
        });
    }
}
