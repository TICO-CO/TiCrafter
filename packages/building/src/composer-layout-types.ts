import type { MotifFacing } from './motif-library.js';

export interface ComposerRoom {
    kind: string;
    x: number;
    z: number;
    width: number;
    depth: number;
}

export interface ComposerOpening {
    kind: 'door' | 'window' | 'interior-door';
    x: number;
    y: number;
    z: number;
    facing: MotifFacing;
}

export interface ComposerLayout {
    width: number;
    depth: number;
    storeys: number;
    wallHeight: number;
    storeyHeight: number;
    rooms: readonly ComposerRoom[];
    corridorZ: number | null;
    entrance: { x: number; z: number; facing: MotifFacing };
    stairwell: { x: number; z: number } | null;
    openings: readonly ComposerOpening[];
}

export interface RoomDemand {
    kind: string;
    minimumSize: number;
}

export const defaultRoomMinimumSize = 2;
