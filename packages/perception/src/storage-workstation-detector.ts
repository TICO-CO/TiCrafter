import { BlockClusterer } from './block-clusterer.js';
import type { ChunkSnapshot, DetectionCandidate, DetectorPort, VoxelBlock } from './types.js';

const storageIds = new Set(['chest', 'trapped_chest', 'ender_chest', 'barrel', 'shulker_box']);
const workstationIds = new Set([
    'crafting_table',
    'furnace',
    'blast_furnace',
    'smoker',
    'anvil',
    'chipped_anvil',
    'damaged_anvil',
    'enchanting_table',
    'stonecutter',
    'loom',
    'cartography_table',
    'fletching_table',
    'smithing_table',
    'grindstone',
]);

export class StorageWorkstationDetector implements DetectorPort {
    readonly id = 'storage-workstation';

    constructor(private readonly clusterDistance = 2) {}

    detect(snapshot: ChunkSnapshot): readonly DetectionCandidate[] {
        const relevant = snapshot.blocks.filter((block) =>
            StorageWorkstationDetector.isRelevant(block),
        );
        return BlockClusterer.connected(relevant, this.clusterDistance).flatMap((cluster) => {
            const storage = cluster.blocks.filter((block) =>
                StorageWorkstationDetector.isStorage(block),
            );
            const workstations = cluster.blocks.filter((block) =>
                StorageWorkstationDetector.isWorkstation(block),
            );
            return [
                ...StorageWorkstationDetector.candidate('storage', storage),
                ...StorageWorkstationDetector.candidate('workstation', workstations),
            ];
        });
    }

    private static candidate(
        type: 'storage' | 'workstation',
        blocks: readonly VoxelBlock[],
    ): readonly DetectionCandidate[] {
        const bounds = BlockClusterer.bounds(blocks);
        if (bounds === null) return [];
        const types = [...new Set(blocks.map((block) => block.blockId))].sort();
        return [
            {
                detectorId: 'storage-workstation',
                type,
                bbox: bounds,
                anchors: blocks.map((block, index) => ({
                    name: `${block.blockId}-${index}`,
                    position: block.position,
                })),
                confidence: Math.min(0.95, 0.55 + blocks.length * 0.05),
                evidence: `${type} cluster blocks ${blocks.length} types ${types.join(',')}`,
            },
        ];
    }

    private static isRelevant(block: VoxelBlock): boolean {
        return (
            StorageWorkstationDetector.isStorage(block) ||
            StorageWorkstationDetector.isWorkstation(block)
        );
    }

    private static isStorage(block: VoxelBlock): boolean {
        return storageIds.has(block.blockId) || block.blockId.endsWith('_shulker_box');
    }

    private static isWorkstation(block: VoxelBlock): boolean {
        return workstationIds.has(block.blockId);
    }
}
