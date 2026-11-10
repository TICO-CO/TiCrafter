import type { LoadedChunkSnapshot, VoxelBlock, VoxelPosition } from '@ticrafter/perception';
import type { Bot } from 'mineflayer';

interface BlockLike {
    name?: string;
    boundingBox?: string;
    getProperties?: () => Record<string, string | number | boolean>;
}

interface ChunkColumnLike {
    minY?: number;
    worldHeight?: number;
    getBlock: (position: { x: number; y: number; z: number }) => BlockLike | null;
}

interface LoadedColumn {
    chunkX: string | number;
    chunkZ: string | number;
    column: ChunkColumnLike;
}

interface WorldWithColumns {
    getColumns: () => readonly LoadedColumn[];
}

export interface PerceptionSource {
    position: () => VoxelPosition | null;
    nextLoadedChunk: (position: VoxelPosition, ringRadius: number) => LoadedChunkSnapshot | null;
}

const airBlockIds = new Set(['air', 'cave_air', 'void_air']);

export class MineflayerPerceptionSource implements PerceptionSource {
    private readonly versions = new Map<string, number>();
    private cursor = 0;

    constructor(private readonly bot: Bot) {}

    position(): VoxelPosition | null {
        const position = this.bot.entity?.position;
        if (position === undefined) return null;
        return {
            x: Math.floor(position.x),
            y: Math.floor(position.y),
            z: Math.floor(position.z),
        };
    }

    nextLoadedChunk(position: VoxelPosition, ringRadius: number): LoadedChunkSnapshot | null {
        const candidates = this.columns()
            .map((loaded) => ({ loaded, distance: this.distance(loaded, position) }))
            .filter((candidate) => candidate.distance <= ringRadius)
            .sort((left, right) => left.distance - right.distance);
        if (candidates.length === 0) return null;
        const selected = candidates[this.cursor % candidates.length];
        this.cursor = (this.cursor + 1) % candidates.length;
        return selected === undefined ? null : this.snapshot(selected.loaded);
    }

    private columns(): readonly LoadedColumn[] {
        const world = this.bot.world as unknown as WorldWithColumns;
        return world.getColumns().filter((loaded) => {
            const chunkX = Number(loaded.chunkX);
            const chunkZ = Number(loaded.chunkZ);
            return Number.isInteger(chunkX) && Number.isInteger(chunkZ);
        });
    }

    private snapshot(loaded: LoadedColumn): LoadedChunkSnapshot {
        const chunk = { x: Number(loaded.chunkX), z: Number(loaded.chunkZ) };
        const observedAt = new Date().toISOString();
        const key = `${chunk.x},${chunk.z}`;
        const version = Math.max(Date.now(), (this.versions.get(key) ?? 0) + 1);
        this.versions.set(key, version);
        return {
            chunk,
            version,
            observedAt,
            blocks: this.blocks(loaded.column, chunk),
        };
    }

    private blocks(
        column: ChunkColumnLike,
        chunk: { x: number; z: number },
    ): readonly VoxelBlock[] {
        const minY = Number(column.minY ?? 0);
        const worldHeight = Number(column.worldHeight ?? 256);
        const blocks: VoxelBlock[] = [];
        for (let y = minY; y < minY + worldHeight; y += 1) {
            for (let z = 0; z < 16; z += 1) {
                for (let x = 0; x < 16; x += 1) {
                    const block = column.getBlock({ x, y, z });
                    if (
                        block === null ||
                        block.name === undefined ||
                        block.name.length === 0 ||
                        airBlockIds.has(block.name)
                    ) {
                        continue;
                    }
                    const properties = this.properties(block);
                    blocks.push({
                        position: { x: chunk.x * 16 + x, y, z: chunk.z * 16 + z },
                        blockId: block.name,
                        solid: block.boundingBox === 'block',
                        ...(properties === null ? {} : { properties }),
                    });
                }
            }
        }
        return blocks;
    }

    private properties(block: BlockLike): Readonly<Record<string, string>> | null {
        const properties = block.getProperties?.();
        if (properties === undefined) return null;
        const entries = Object.entries(properties).map(([key, value]) => [key, String(value)]);
        return entries.length === 0
            ? null
            : (Object.fromEntries(entries) as Record<string, string>);
    }

    private distance(loaded: LoadedColumn, position: VoxelPosition): number {
        const deltaX = Number(loaded.chunkX) * 16 + 8 - position.x;
        const deltaZ = Number(loaded.chunkZ) * 16 + 8 - position.z;
        return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    }
}
