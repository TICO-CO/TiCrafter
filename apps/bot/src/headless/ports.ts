import type { AgencySnapshot, NightIntent, ProjectSummary } from '@ticrafter/agency';
import type { ProcurementCatalogPort } from '@ticrafter/building';
import type { ActionDispatchPort, ClockPort, Result, Vec3 } from '@ticrafter/core';
import type { DetectionCandidate } from '@ticrafter/perception';
import type { SafetyHostile, SafetySnapshot } from '@ticrafter/safety';
import type { SkillBBox, SkillBlock, SkillBlockState, SkillWorldView } from '@ticrafter/skills';

import type { AgencyHomeSnapshot } from '../index.js';
import type { BuildingWorldView, ContainerRefreshPort } from '../index.js';
import type { ObservedPlayer } from '../village/index.js';

export type { ContainerRefreshPort } from '../index.js';

export interface HeadlessBlockChange {
    position: Vec3;
    blockId: string;
    solid: boolean;
    properties?: Readonly<Record<string, string>>;
}

export interface HeadlessWorldView extends BuildingWorldView, SkillWorldView {
    blockStateAt(position: Vec3): SkillBlockState | null;
    blocksInBox(bbox: SkillBBox): readonly SkillBlock[];
    onBlockChanged(listener: (change: HeadlessBlockChange) => void): () => void;
}

export interface HeadlessInventoryPort {
    items(): readonly { name: string; count: number }[];
    count(name: string): number;
    add(name: string, count: number): Result<void, string>;
    remove(name: string, count: number): Result<void, string>;
}

export interface HeadlessChatPort {
    send(text: string): Result<void, string>;
    listen(listener: (username: string, message: string, playerId?: string) => void): () => void;
}

export interface HeadlessPerceptionPort {
    candidates(): readonly DetectionCandidate[];
}

export interface BotPlatformPorts {
    world: HeadlessWorldView;
    inventory: HeadlessInventoryPort;
    containers: ContainerRefreshPort;
    procurement: ProcurementCatalogPort;
    dispatch: ActionDispatchPort;
    clock: ClockPort;
    position: () => Vec3;
    health: () => number;
    food: () => number;
    timeOfDay: () => number | null;
    hostiles: () => readonly SafetyHostile[];
    safety: () => Result<SafetySnapshot, string>;
    home: () => AgencyHomeSnapshot | null;
    project: () => ProjectSummary | null;
    nightIntent: () => NightIntent | null;
    chat?: HeadlessChatPort;
    players?: () => readonly ObservedPlayer[];
    villagers?: () => readonly Vec3[];
    perception?: HeadlessPerceptionPort;
    resources?: () => readonly { kind: string; position: Vec3 }[];
    stations?: () => readonly { kind: string; position: Vec3 }[];
    waterSources?: () => readonly Vec3[];
}

export type AgencySnapshotPort = { read(): Result<AgencySnapshot, string> };
