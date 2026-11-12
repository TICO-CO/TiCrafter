import type { AgencySnapshot } from './types.js';

const FOOD_ITEMS = new Set([
    'apple',
    'baked_potato',
    'beef',
    'beetroot',
    'beetroot_soup',
    'bread',
    'carrot',
    'chicken',
    'cod',
    'cooked_beef',
    'cooked_chicken',
    'cooked_cod',
    'cooked_mutton',
    'cooked_porkchop',
    'cooked_rabbit',
    'cooked_salmon',
    'cookie',
    'dried_kelp',
    'glow_berries',
    'golden_apple',
    'golden_carrot',
    'melon_slice',
    'mushroom_stew',
    'mutton',
    'porkchop',
    'potato',
    'pufferfish',
    'rabbit',
    'rabbit_stew',
    'salmon',
    'sweet_berries',
    'tropical_fish',
]);

const WEAPON_TIERS: Readonly<Record<string, number>> = {
    wooden_sword: 1,
    wooden_axe: 1,
    stone_sword: 2,
    stone_axe: 2,
    iron_sword: 3,
    iron_axe: 3,
    diamond_sword: 4,
    diamond_axe: 4,
    netherite_sword: 5,
    netherite_axe: 5,
};

const BUILDING_ITEMS = new Set([
    'cobblestone',
    'cobbled_deepslate',
    'dirt',
    'oak_log',
    'birch_log',
    'spruce_log',
    'jungle_log',
    'acacia_log',
    'dark_oak_log',
    'mangrove_log',
    'oak_planks',
    'birch_planks',
    'spruce_planks',
    'jungle_planks',
    'acacia_planks',
    'dark_oak_planks',
    'mangrove_planks',
]);

const WOOL_COLORS = [
    'white',
    'orange',
    'magenta',
    'light_blue',
    'yellow',
    'lime',
    'pink',
    'gray',
    'light_gray',
    'cyan',
    'purple',
    'blue',
    'brown',
    'green',
    'red',
    'black',
];

export class ItemKnowledge {
    static count(snapshot: AgencySnapshot, name: string): number {
        return snapshot.inventory
            .filter((item) => item.name === name)
            .reduce((total, item) => total + item.count, 0);
    }

    static countSuffix(snapshot: AgencySnapshot, suffix: string): number {
        return snapshot.inventory
            .filter((item) => item.name.endsWith(suffix))
            .reduce((total, item) => total + item.count, 0);
    }

    static foodServings(snapshot: AgencySnapshot): number {
        return snapshot.inventory
            .filter((item) => FOOD_ITEMS.has(item.name))
            .reduce((total, item) => total + item.count, 0);
    }

    static hasFood(snapshot: AgencySnapshot): boolean {
        return ItemKnowledge.foodServings(snapshot) > 0;
    }

    static weaponTier(itemName: string | null | undefined): number {
        if (itemName === null || itemName === undefined) return 0;
        return WEAPON_TIERS[itemName] ?? 0;
    }

    static bestWeapon(snapshot: AgencySnapshot): { name: string; tier: number } | null {
        return snapshot.inventory.reduce<{ name: string; tier: number } | null>((best, item) => {
            const tier = ItemKnowledge.weaponTier(item.name);
            if (tier === 0) return best;
            if (best === null || tier > best.tier) return { name: item.name, tier };
            return best;
        }, null);
    }

    static craftableWeapon(snapshot: AgencySnapshot): string | null {
        if (ItemKnowledge.count(snapshot, 'stick') === 0) return null;
        if (ItemKnowledge.count(snapshot, 'iron_ingot') >= 2) return 'iron_sword';
        if (
            ItemKnowledge.count(snapshot, 'cobblestone') +
                ItemKnowledge.count(snapshot, 'cobbled_deepslate') >=
            2
        ) {
            return 'stone_sword';
        }
        if (ItemKnowledge.countSuffix(snapshot, '_planks') >= 2) return 'wooden_sword';
        return null;
    }

    static bedItem(snapshot: AgencySnapshot): string | null {
        return snapshot.inventory.find((item) => item.name.endsWith('_bed'))?.name ?? null;
    }

    static craftableBed(snapshot: AgencySnapshot): string | null {
        if (ItemKnowledge.countSuffix(snapshot, '_planks') === 0) return null;
        const wool = snapshot.inventory.find((item) => item.name.endsWith('_wool'));
        if (wool === undefined) return null;
        const color = wool.name.slice(0, -'_wool'.length);
        if (!WOOL_COLORS.includes(color)) return null;
        return `${color}_bed`;
    }

    static woolCount(snapshot: AgencySnapshot): number {
        return ItemKnowledge.countSuffix(snapshot, '_wool');
    }

    static buildingMaterialCount(snapshot: AgencySnapshot): number {
        return snapshot.inventory
            .filter((item) => BUILDING_ITEMS.has(item.name))
            .reduce((total, item) => total + item.count, 0);
    }

    static buildingMaterialName(snapshot: AgencySnapshot): string | null {
        const material = [...snapshot.inventory]
            .filter((item) => BUILDING_ITEMS.has(item.name))
            .sort((left, right) => right.count - left.count)[0];
        return material?.name ?? null;
    }
}
