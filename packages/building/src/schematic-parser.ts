import { attemptAsync, type Result, type Vec3 } from '@ticrafter/core';
import { Schematic } from 'prismarine-schematic';

import { type Blueprint, type BlueprintBlock, BlueprintIr } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export type SchematicFormat = 'schem' | 'litematic';

export interface DecodedSchematicBlock {
    x: number;
    y: number;
    z: number;
    stateName: string;
    properties?: Readonly<Record<string, string>>;
}

export interface DecodedSchematic {
    size: Vec3;
    blocks: readonly DecodedSchematicBlock[];
}

export interface SchematicDecoderPort {
    decode(buffer: Buffer, version?: string): Promise<Result<DecodedSchematic, BuildingFailure>>;
}

export interface SchematicParseOptions {
    id: string;
    anchor: Vec3;
    format?: SchematicFormat;
    version?: string;
}

export class PrismarineSchematicDecoder implements SchematicDecoderPort {
    async decode(
        buffer: Buffer,
        version?: string,
    ): Promise<Result<DecodedSchematic, BuildingFailure>> {
        const [schematic, readError] = await attemptAsync(() =>
            Schematic.read(buffer, version ?? undefined),
        );
        if (readError) {
            return [null, { type: 'PARSE_FAILED', message: this.describe(readError) }];
        }
        if (schematic === null) {
            return [null, { type: 'PARSE_FAILED', message: 'schematic decoder returned null' }];
        }
        const blocks: DecodedSchematicBlock[] = [];
        const [, iterationError] = await attemptAsync(() =>
            schematic.forEach((stateId, position) => {
                const block = stateId as unknown as {
                    name?: string;
                    getProperties?: () => Record<string, string | number | boolean>;
                };
                const stateName = block.name ?? 'air';
                if (stateName === 'air' || stateName === 'cave_air' || stateName === 'void_air') {
                    return;
                }
                blocks.push({
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    stateName,
                    properties: this.properties(block),
                });
            }),
        );
        if (iterationError) {
            return [null, { type: 'PARSE_FAILED', message: this.describe(iterationError) }];
        }
        return [
            {
                size: { x: schematic.size.x, y: schematic.size.y, z: schematic.size.z },
                blocks,
            },
            null,
        ];
    }

    private properties(block: {
        getProperties?: () => Record<string, string | number | boolean>;
    }): Readonly<Record<string, string>> | undefined {
        const properties = block.getProperties?.();
        if (properties === undefined) return undefined;
        return Object.fromEntries(
            Object.entries(properties).map(([key, value]) => [key, String(value)]),
        );
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class SchematicParser {
    constructor(
        private readonly decoder: SchematicDecoderPort = new PrismarineSchematicDecoder(),
    ) {}

    async parse(
        buffer: Buffer,
        options: SchematicParseOptions,
    ): Promise<Result<Blueprint, BuildingFailure>> {
        if (options.format === 'litematic') {
            return [null, { type: 'UNSUPPORTED_FORMAT', format: 'litematic' }];
        }
        const [decoded, decodeError] = await this.decoder.decode(buffer, options.version);
        if (decodeError) return [null, decodeError];
        if (decoded === null) {
            return [null, { type: 'PARSE_FAILED', message: 'schematic decoder returned null' }];
        }
        const blocks = decoded.blocks.map<BlueprintBlock>((block) => ({
            x: block.x + options.anchor.x,
            y: block.y + options.anchor.y,
            z: block.z + options.anchor.z,
            state:
                block.properties === undefined
                    ? { name: block.stateName }
                    : { name: block.stateName, properties: block.properties },
            priority: 0,
        }));
        if (blocks.length === 0) {
            return [null, { type: 'PARSE_FAILED', message: 'schematic contains no solid blocks' }];
        }
        return [
            {
                id: options.id,
                anchor: options.anchor,
                rotation: 0,
                blocks,
                materials: BlueprintIr.materialNeeds(blocks),
                constraints: [],
            },
            null,
        ];
    }
}
