import type { Vec3 } from '@ticrafter/core';

export interface ShelterBlock {
    position: Vec3;
    itemName: string;
}

export class ShelterPlan {
    static shell(anchor: Vec3, material: string): readonly ShelterBlock[] {
        const minimumX = Math.floor(anchor.x) - 1;
        const maximumX = Math.floor(anchor.x) + 1;
        const minimumZ = Math.floor(anchor.z) - 1;
        const maximumZ = Math.floor(anchor.z) + 1;
        const floorY = Math.floor(anchor.y) - 1;
        const blocks: ShelterBlock[] = [];
        for (let x = minimumX; x <= maximumX; x += 1) {
            for (let z = minimumZ; z <= maximumZ; z += 1) {
                blocks.push({ position: { x, y: floorY, z }, itemName: material });
            }
        }
        ShelterPlan.addWalls(blocks, minimumX, maximumX, minimumZ, maximumZ, floorY, material);
        for (let x = minimumX; x <= maximumX; x += 1) {
            for (let z = minimumZ; z <= maximumZ; z += 1) {
                blocks.push({ position: { x, y: floorY + 3, z }, itemName: material });
            }
        }
        return blocks;
    }

    private static addWalls(
        blocks: ShelterBlock[],
        minimumX: number,
        maximumX: number,
        minimumZ: number,
        maximumZ: number,
        floorY: number,
        material: string,
    ): void {
        const doorX = Math.floor((minimumX + maximumX) / 2);
        for (let level = 1; level <= 2; level += 1) {
            const y = floorY + level;
            for (let x = minimumX; x <= maximumX; x += 1) {
                ShelterPlan.addWall(blocks, x, y, minimumZ, doorX, maximumZ, material);
                ShelterPlan.addWall(blocks, x, y, maximumZ, doorX, maximumZ, material);
            }
            for (let z = minimumZ + 1; z < maximumZ; z += 1) {
                ShelterPlan.addWall(blocks, minimumX, y, z, doorX, maximumZ, material);
                ShelterPlan.addWall(blocks, maximumX, y, z, doorX, maximumZ, material);
            }
        }
    }

    private static addWall(
        blocks: ShelterBlock[],
        x: number,
        y: number,
        z: number,
        doorX: number,
        doorZ: number,
        material: string,
    ): void {
        if (x === doorX && z === doorZ) return;
        blocks.push({ position: { x, y, z }, itemName: material });
    }
}
