import { type EnclosedRegion, EnclosureGeometry } from './enclosure-geometry.js';
import type {
    ChunkSnapshot,
    DetectionAnchor,
    DetectionBoundingBox,
    DetectionCandidate,
    DetectorPort,
    VoxelBlock,
} from './types.js';
import { VoxelGeometry } from './voxel-geometry.js';

export class HouseDetector implements DetectorPort {
    readonly id = 'house';

    constructor(private readonly minimumVolume = 4) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        return EnclosureGeometry.enclosedRegions(
            snapshot.blocks,
            this.minimumVolume,
            HouseDetector.isBarrier,
        )
            .map((region) => HouseDetector.candidate(region, snapshot.blocks))
            .filter((candidate): candidate is DetectionCandidate => candidate !== null);
    }

    private static candidate(
        region: EnclosedRegion,
        blocks: readonly VoxelBlock[],
    ): DetectionCandidate | null {
        const interiorHeight = region.bounds.max.y - region.bounds.min.y + 1;
        if (interiorHeight < 2) return null;
        const bbox = HouseDetector.expand(region.bounds, 1);
        const nearby = blocks.filter((block) => VoxelGeometry.inside(block.position, bbox));
        const features = HouseDetector.features(region, nearby);
        if (!HouseDetector.hasStrongEvidence(features)) return null;
        const materials = VoxelGeometry.materials(nearby, bbox);
        const anchors: DetectionAnchor[] = [
            { name: 'center', position: VoxelGeometry.center(region.bounds) },
        ];
        const door = nearby.find((block) => HouseDetector.isDoor(block.blockId));
        if (door !== undefined) anchors.push({ name: 'door', position: door.position });
        return {
            detectorId: 'house',
            type: 'house',
            bbox,
            anchors,
            confidence: HouseDetector.confidence(region.positions.length, features.length),
            evidence: `enclosed interior volume ${region.positions.length} shell ${materials.join(',')} features ${features.join(',') || 'none'}`,
        };
    }

    private static isBarrier(block: VoxelBlock): boolean {
        return (
            block.solid ||
            HouseDetector.isDoor(block.blockId) ||
            block.blockId.includes('trapdoor') ||
            HouseDetector.isWindow(block.blockId)
        );
    }

    private static hasStrongEvidence(features: readonly string[]): boolean {
        return features.some(
            (feature) => feature === 'door' || feature === 'bed' || feature === 'window',
        );
    }

    private static features(
        region: EnclosedRegion,
        nearby: readonly VoxelBlock[],
    ): readonly string[] {
        const features = new Set<string>();
        nearby.forEach((block) => {
            if (HouseDetector.isDoor(block.blockId)) features.add('door');
            if (block.blockId.includes('bed')) features.add('bed');
            if (HouseDetector.isWindow(block.blockId)) features.add('window');
        });
        if (HouseDetector.hasRoof(region, nearby)) features.add('roof');
        return [...features].sort();
    }

    private static hasRoof(region: EnclosedRegion, nearby: readonly VoxelBlock[]): boolean {
        const footprint =
            (region.bounds.max.x - region.bounds.min.x + 1) *
            (region.bounds.max.z - region.bounds.min.z + 1);
        if (footprint === 0) return false;
        const roofY = region.bounds.max.y + 1;
        const roofBlocks = nearby.filter(
            (block) =>
                block.solid &&
                block.position.y === roofY &&
                block.position.x >= region.bounds.min.x &&
                block.position.x <= region.bounds.max.x &&
                block.position.z >= region.bounds.min.z &&
                block.position.z <= region.bounds.max.z,
        );
        return roofBlocks.length / footprint >= 0.5;
    }

    private static confidence(volume: number, featureCount: number): number {
        return Math.min(0.95, 0.5 + Math.min(volume, 40) / 80 + featureCount * 0.05);
    }

    private static isDoor(blockId: string): boolean {
        return blockId.endsWith('_door');
    }

    private static isWindow(blockId: string): boolean {
        return blockId.includes('glass') || blockId === 'iron_bars';
    }

    private static expand(bounds: DetectionBoundingBox, distance: number): DetectionBoundingBox {
        return {
            min: {
                x: bounds.min.x - distance,
                y: bounds.min.y - distance,
                z: bounds.min.z - distance,
            },
            max: {
                x: bounds.max.x + distance,
                y: bounds.max.y + distance,
                z: bounds.max.z + distance,
            },
        };
    }
}
