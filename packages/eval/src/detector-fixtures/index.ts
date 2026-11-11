import type { ChunkSnapshot, DetectionCandidate, VoxelBlock } from '@ticrafter/perception';

export interface DetectorFixture {
    name: string;
    snapshot: ChunkSnapshot;
    expectedDetectorIds: readonly string[];
}

export class DetectorFixtures {
    static cases(): readonly DetectorFixture[] {
        return [
            {
                name: 'path corridor',
                snapshot: DetectorFixtures.pathSnapshot(),
                expectedDetectorIds: ['path'],
            },
            {
                name: 'stone house',
                snapshot: DetectorFixtures.houseSnapshot(),
                expectedDetectorIds: ['house'],
            },
            {
                name: 'wheat farm',
                snapshot: DetectorFixtures.farmSnapshot(),
                expectedDetectorIds: ['farm'],
            },
            {
                name: 'storage cluster',
                snapshot: DetectorFixtures.storageSnapshot(),
                expectedDetectorIds: ['storage-workstation'],
            },
            {
                name: 'stone wall',
                snapshot: DetectorFixtures.wallSnapshot(),
                expectedDetectorIds: ['linear-structure'],
            },
        ];
    }

    static pathSnapshot(): ChunkSnapshot {
        return DetectorFixtures.snapshot(
            Array.from({ length: 10 }, (_, x) =>
                DetectorFixtures.block(x, 64, 0, 'stone_path', true),
            ),
        );
    }

    static houseSnapshot(): ChunkSnapshot {
        const blocks: VoxelBlock[] = [];
        for (let x = 0; x <= 4; x += 1) {
            for (let z = 0; z <= 4; z += 1) {
                blocks.push(DetectorFixtures.block(x, 64, z, 'stone_bricks', true));
                blocks.push(DetectorFixtures.block(x, 68, z, 'oak_planks', true));
            }
        }
        for (let y = 65; y <= 67; y += 1) {
            for (let x = 0; x <= 4; x += 1) {
                blocks.push(DetectorFixtures.block(x, y, 0, 'stone_bricks', true));
                blocks.push(DetectorFixtures.block(x, y, 4, 'stone_bricks', true));
            }
            for (let z = 1; z <= 3; z += 1) {
                blocks.push(DetectorFixtures.block(0, y, z, 'stone_bricks', true));
                blocks.push(DetectorFixtures.block(4, y, z, 'glass', true));
            }
        }
        blocks.push(DetectorFixtures.block(2, 65, 0, 'oak_door', true));
        blocks.push(DetectorFixtures.block(2, 66, 0, 'oak_door', true));
        blocks.push(DetectorFixtures.block(2, 65, 2, 'red_bed', true));
        return DetectorFixtures.snapshot(blocks);
    }

    static farmSnapshot(): ChunkSnapshot {
        const blocks: VoxelBlock[] = [];
        for (let x = 0; x < 3; x += 1) {
            for (let z = 0; z < 3; z += 1) {
                blocks.push(
                    DetectorFixtures.block(x, 64, z, 'farmland', true, {
                        moisture: '7',
                    }),
                );
                blocks.push(
                    DetectorFixtures.block(x, 65, z, 'wheat', false, {
                        age: '3',
                    }),
                );
            }
        }
        blocks.push(DetectorFixtures.block(3, 64, 1, 'water', false));
        return DetectorFixtures.snapshot(blocks);
    }

    static storageSnapshot(): ChunkSnapshot {
        return DetectorFixtures.snapshot([
            DetectorFixtures.block(0, 64, 0, 'chest', true),
            DetectorFixtures.block(1, 64, 0, 'barrel', true),
            DetectorFixtures.block(1, 64, 1, 'crafting_table', true),
            DetectorFixtures.block(2, 64, 1, 'furnace', true),
        ]);
    }

    static wallSnapshot(): ChunkSnapshot {
        const blocks: VoxelBlock[] = [];
        for (let x = 0; x < 10; x += 1) {
            blocks.push(DetectorFixtures.block(x, 64, 0, 'stone_bricks', true));
            blocks.push(DetectorFixtures.block(x, 65, 0, 'stone_bricks', true));
        }
        return DetectorFixtures.snapshot(blocks);
    }

    static expectedCandidates(fixture: DetectorFixture): readonly DetectionCandidate[] {
        return fixture.expectedDetectorIds.map((detectorId) => ({
            detectorId: detectorId as DetectionCandidate['detectorId'],
            type: DetectorFixtures.typeFor(detectorId),
            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 0, y: 64, z: 0 } },
            anchors: [],
            confidence: 0.5,
            evidence: fixture.name,
        }));
    }

    private static snapshot(blocks: readonly VoxelBlock[]): ChunkSnapshot {
        return {
            botId: 'bot.one',
            chunk: { x: 0, z: 0 },
            version: 1,
            observedAt: '2026-11-11T10:00:00.000Z',
            blocks,
        };
    }

    private static block(
        x: number,
        y: number,
        z: number,
        blockId: string,
        solid: boolean,
        properties?: Record<string, string>,
    ): VoxelBlock {
        return {
            position: { x, y, z },
            blockId,
            solid,
            ...(properties === undefined ? {} : { properties }),
        };
    }

    private static typeFor(detectorId: string): DetectionCandidate['type'] {
        switch (detectorId) {
            case 'path':
                return 'path';
            case 'house':
                return 'house';
            case 'farm':
                return 'farm';
            case 'storage-workstation':
                return 'storage';
            case 'linear-structure':
                return 'wall';
            default:
                return 'mineshaft';
        }
    }
}
