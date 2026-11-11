import type { Result, Vec3 } from '@ticrafter/core';

import { Blueprint } from './blueprint.js';
import type {
    SkillBlock,
    SkillBuildTarget,
    SkillContext,
    SkillFarmPlot,
    SkillInput,
} from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const DEFAULT_CROP_BLOCK_IDS = [
    'beetroots',
    'carrots',
    'melon',
    'nether_wart',
    'potatoes',
    'pumpkin',
    'sweet_berry_bush',
    'wheat',
] as const;

const MATURE_AGE: ReadonlyMap<string, number> = new Map([
    ['nether_wart', 3],
    ['sweet_berry_bush', 3],
]);

const AIR_BLOCK_IDS = new Set(['air', 'cave_air', 'void_air']);

export class FarmPlotResolver {
    static resolve(context: SkillContext, input: SkillInput): Result<SkillFarmPlot | null, string> {
        if (input.plot !== undefined) return [input.plot, null];
        if (input.plotId === undefined) return [null, null];
        const farms = context.services?.farms;
        if (farms === undefined) return [null, 'farm plot source unavailable'];
        return farms.getPlot(input.plotId);
    }
}

export class FarmScanner {
    static scan(context: SkillContext, plot: SkillFarmPlot): Result<readonly SkillBlock[], string> {
        if (context.world.blocksInBox === undefined) {
            return [null, 'world block scan unavailable'];
        }
        return [context.world.blocksInBox(plot.bbox), null];
    }

    static above(position: Vec3): Vec3 {
        return { x: position.x, y: position.y + 1, z: position.z };
    }

    static blockAt(context: SkillContext, position: Vec3): SkillBlock | null {
        const state = context.world.blockStateAt?.(position);
        if (state !== null && state !== undefined) {
            return { ...state, position };
        }
        const name = context.world.blockAt(position);
        if (name === null) return null;
        return { name, position, properties: {} };
    }
}

export class FarmCrops {
    static ids(plot: SkillFarmPlot): readonly string[] {
        if (plot.cropBlockIds !== undefined && plot.cropBlockIds.length > 0) {
            return plot.cropBlockIds;
        }
        return DEFAULT_CROP_BLOCK_IDS;
    }

    static isAir(blockName: string | null): boolean {
        return blockName === null || AIR_BLOCK_IDS.has(blockName);
    }

    static isMature(block: SkillBlock): boolean {
        const ageValue = block.properties.age;
        if (ageValue === undefined) return true;
        const age = Number.parseInt(ageValue, 10);
        if (Number.isNaN(age)) return true;
        return age >= (MATURE_AGE.get(block.name) ?? 7);
    }

    static isDryFarmland(block: SkillBlock): boolean {
        return block.name === 'farmland' && block.properties.moisture === '0';
    }

    static toTarget(block: SkillBlock): SkillBuildTarget {
        return {
            position: block.position,
            itemName: block.name,
            expectedBlockId: block.name,
        };
    }
}

export class FarmStateReader {
    static readTargets(value: unknown): SkillBuildTarget[] | null {
        return Blueprint.readTargets(value);
    }

    static readKeys(value: unknown): string[] | null {
        return Blueprint.readKeys(value);
    }

    static readActiveKey(value: unknown): Result<string | null, string> {
        if (value === null || value === undefined) return [null, null];
        const activeKey = SkillSharedUtilities.readString(value);
        if (activeKey === null) return [null, 'farm state has an invalid active key'];
        return [activeKey, null];
    }
}
