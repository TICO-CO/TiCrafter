import fileSystem from 'node:fs';
import path from 'node:path';

import { resolveGraph } from './resolve-graph.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const graph = resolveGraph(JSON.parse(fileSystem.readFileSync(graphPath, 'utf8')));

const aliases = new Map([
    ['apps/coordinator/src/core/process-bootstrap', 'apps/coordinator/src/main.ts'],
    [
        'apps/coordinator/src/core/service-composition',
        'apps/coordinator/src/coordinator-composition.ts',
    ],
    ['apps/coordinator/src/core/coordinator-epoch', 'apps/coordinator/src/core/epoch.ts'],
    ['apps/coordinator/src/core/global-scheduler', 'apps/coordinator/src/core/scheduler.ts'],
    ['apps/coordinator/src/core/restart-recovery', 'apps/coordinator/src/core/recovery.ts'],
    [
        'packages/core/src/transport/message-schema-registry',
        'packages/core/src/transport/messages.ts',
    ],
    ['packages/core/src/transport/ws-codec', 'packages/core/src/transport/codec.ts'],
    ['packages/skills/src/skill-contract', 'packages/skills/src/types.ts'],
    ['packages/skills/src/skill-registry', 'packages/skills/src/registry.ts'],
    ['packages/skills/src/shared-utilities', 'packages/skills/src/utilities.ts'],
    ['apps/bot/src/connection-lifecycle', 'apps/bot/src/bot-connection.ts'],
    ['apps/bot/src/join-auth', 'apps/bot/src/bot-connection.ts'],
    ['apps/bot/src/world-cache-adapter', 'apps/bot/src/world-cache.ts'],
    ['apps/bot/src/state-digest-collector', 'apps/bot/src/state-digest.ts'],
    ['apps/bot/src/guardian-hook', 'apps/bot/src/guardian.ts'],
    ['packages/core/src/config/config-schema-validator', 'packages/core/src/config/schema.ts'],
]);

const sourceCandidates = (target) => [
    target,
    `${target}.ts`,
    `${target}.mjs`,
    `${target}.js`,
    `${target}.py`,
    path.join(target, 'index.ts'),
    path.join(target, 'index.mjs'),
];

const resolvesToSource = (target) =>
    sourceCandidates(target).some((candidate) => fileSystem.existsSync(path.join(root, candidate)));

const resolvedPath = (component) => aliases.get(component.plannedPath) ?? component.plannedPath;

const components = graph.systems.flatMap((system) => system.components);
const missing = components
    .filter((component) => !resolvesToSource(resolvedPath(component)))
    .map((component) => ({
        id: component.id,
        plannedPath: component.plannedPath,
        resolvedPath: resolvedPath(component),
    }));

if (missing.length > 0) {
    for (const component of missing) {
        console.error(
            `${component.id}: ${component.plannedPath} -> ${component.resolvedPath} is missing`,
        );
    }
    process.exit(1);
}

console.log(`component paths resolved: ${components.length}`);
