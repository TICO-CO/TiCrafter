import fileSystem from 'node:fs';
import path from 'node:path';

import { resolveGraph } from './resolve-graph.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const outputDirectory = path.join(root, 'docs/architecture');
const graphDirectory = path.join(outputDirectory, 'graphs');
const graph = resolveGraph(JSON.parse(fileSystem.readFileSync(graphPath, 'utf8')));

fileSystem.mkdirSync(graphDirectory, { recursive: true });

const systems = graph.systems;
const externals = graph.externals;
const relations = graph.relations;
const systemById = new Map(systems.map((system) => [system.id, system]));
const componentById = new Map();
const componentToSystem = new Map();
const externalById = new Map(externals.map((external) => [external.id, external]));
const componentEntries = systems.flatMap((system) =>
    system.components.map((component) => ({ component, systemId: system.id })),
);
for (const { component, systemId } of componentEntries) {
    componentById.set(component.id, component);
    componentToSystem.set(component.id, systemId);
}

const relationTypeDescriptions = {
    depends_on:
        'Source requires the target to function; synchronous failure propagates unless a documented fallback exists.',
    controls: 'Source has authority to command, veto, stop, or otherwise constrain the target.',
    reads: 'Source reads state owned by the target through the target interface.',
    writes: 'Source writes state owned by the target; the target is the state owner and the source must be a declared writer.',
    proposes_to:
        'Source produces an untrusted proposal; target validates and commits or rejects it.',
    validates: 'Source validates or vetoes the target before the target may act.',
    publishes: 'Source publishes an event to the target or event stream.',
    subscribes: 'Source subscribes to events produced by the target.',
    persists_to: 'Source persists state through the target repository or storage boundary.',
    observes: 'Source emits telemetry or reads observability data without owning target state.',
    delegates_to:
        'Source hands a job to the target while retaining responsibility for the outcome.',
};

const escapeMermaid = (value) => String(value).replaceAll('"', "'").replaceAll('\n', ' ');
const idFor = (() => {
    let nodeCounter = 0;
    const identifierMap = new Map();
    return (key) => {
        if (!identifierMap.has(key)) identifierMap.set(key, `n${nodeCounter++}`);
        return identifierMap.get(key);
    };
})();

const endpointName = (id) => {
    if (componentById.has(id)) return componentById.get(id).name;
    if (systemById.has(id)) return systemById.get(id).name;
    if (externalById.has(id)) return externalById.get(id).name;
    return id;
};

const endpointSystem = (id) => componentToSystem.get(id) ?? (systemById.has(id) ? id : 'external');

const appendExternalNode = (lines, externalId) => {
    const external = externalById.get(externalId);
    if (external === undefined) return;
    lines.push(`${idFor(externalId)}(["${escapeMermaid(external.name)}"])`);
};

const aggregatedSystemEdges = () => {
    const identifierMap = new Map();
    for (const relation of relations) {
        const from =
            componentToSystem.get(relation.from) ??
            (systemById.has(relation.from) ? relation.from : relation.from);
        const to =
            componentToSystem.get(relation.to) ??
            (systemById.has(relation.to) ? relation.to : relation.to);
        if (from === to) continue;
        const key = `${from}|${to}`;
        if (!identifierMap.has(key))
            identifierMap.set(key, { from, to, types: new Map(), count: 0 });
        const entry = identifierMap.get(key);
        entry.count += 1;
        entry.types.set(relation.type, (entry.types.get(relation.type) ?? 0) + 1);
    }
    return [...identifierMap.values()];
};

const edgeLabel = (entry) =>
    [...entry.types.entries()].map(([type, count]) => `${type}×${count}`).join(', ');

function mermaidOverview() {
    const lines = ['flowchart LR'];
    const systemNodes = systems.map(
        (system) => `${idFor(system.id)}["${escapeMermaid(system.name)}"]`,
    );
    const externalNodes = externals.map(
        (external) => `${idFor(external.id)}(["${escapeMermaid(external.name)}"])`,
    );
    lines.push(...systemNodes, ...externalNodes);
    for (const entry of aggregatedSystemEdges()) {
        const from = entry.from.startsWith('ext.') ? entry.from : entry.from;
        const to = entry.to.startsWith('ext.') ? entry.to : entry.to;
        lines.push(`${idFor(from)} -->|${escapeMermaid(edgeLabel(entry))}| ${idFor(to)}`);
    }
    lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
    lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
    lines.push(`class ${systems.map((system) => idFor(system.id)).join(',')} system;`);
    lines.push(`class ${externals.map((external) => idFor(external.id)).join(',')} external;`);
    return `${lines.join('\n')}\n`;
}

function mermaidCrossSystem() {
    const lines = ['flowchart LR'];
    for (const system of systems)
        lines.push(`${idFor(system.id)}["${escapeMermaid(system.name)}"]`);
    for (const entry of aggregatedSystemEdges()) {
        if (!systemById.has(entry.from) || !systemById.has(entry.to)) continue;
        lines.push(
            `${idFor(entry.from)} -->|${escapeMermaid(edgeLabel(entry))}| ${idFor(entry.to)}`,
        );
    }
    lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
    lines.push(`class ${systems.map((system) => idFor(system.id)).join(',')} system;`);
    return `${lines.join('\n')}\n`;
}

function mermaidSafetyControl() {
    const keepSystems = new Set([
        'sys.safety',
        'sys.bot-runtime',
        'sys.building',
        'sys.ops',
        'sys.core',
        'sys.decision',
        'sys.planner',
        'sys.skill-runtime',
        'sys.brains',
    ]);
    const keepTypes = new Set(['controls', 'validates', 'proposes_to', 'delegates_to']);
    const lines = ['flowchart TD'];
    for (const system of systems.filter((system) => keepSystems.has(system.id)))
        lines.push(`${idFor(system.id)}["${escapeMermaid(system.name)}"]`);
    lines.push(`${idFor('ext.operator')}(["Fleet Operator"])`);
    const seen = new Set();
    for (const relation of relations.filter((relation) => keepTypes.has(relation.type))) {
        const from = endpointSystem(relation.from);
        const to = endpointSystem(relation.to);
        if (from === to) continue;
        if (!keepSystems.has(from) && from !== 'ext.operator') continue;
        if (!keepSystems.has(to) && to !== 'ext.operator') continue;
        const key = `${from}|${to}|${relation.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`${idFor(from)} -->|${escapeMermaid(relation.type)}| ${idFor(to)}`);
    }
    const keptComponents = systems
        .filter((system) => keepSystems.has(system.id))
        .flatMap((system) => system.components);
    for (const component of keptComponents) {
        const relevant = relations.some(
            (relation) =>
                keepTypes.has(relation.type) &&
                (relation.from === component.id || relation.to === component.id),
        );
        if (!relevant) continue;
        lines.push(`${idFor(component.id)}["${escapeMermaid(component.name)}"]`);
    }
    for (const relation of relations.filter((relation) => keepTypes.has(relation.type))) {
        if (!componentById.has(relation.from) || !componentById.has(relation.to)) continue;
        const fromSys = componentToSystem.get(relation.from);
        const toSys = componentToSystem.get(relation.to);
        if (!keepSystems.has(fromSys) || !keepSystems.has(toSys)) continue;
        lines.push(
            `${idFor(relation.from)} -->|${escapeMermaid(relation.type)}| ${idFor(relation.to)}`,
        );
    }
    lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
    lines.push('classDef component fill:#f8fafc,stroke:#64748b,color:#0f172a;');
    lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
    const sysNodeIds = systems
        .filter((system) => keepSystems.has(system.id))
        .map((system) => idFor(system.id));
    const compNodeIds = systems
        .filter((system) => keepSystems.has(system.id))
        .flatMap((system) => system.components.map((component) => component.id))
        .filter((id) => lines.some((line) => line.startsWith(`${idFor(id)}[`)));
    lines.push(`class ${sysNodeIds.join(',')} system;`);
    if (compNodeIds.length)
        lines.push(`class ${compNodeIds.map((id) => idFor(id)).join(',')} component;`);
    lines.push(`class ${idFor('ext.operator')} external;`);
    return `${lines.join('\n')}\n`;
}

function mermaidDataFlow() {
    const keepSystems = new Set([
        'sys.perception',
        'sys.world',
        'sys.sip',
        'sys.decision',
        'sys.skill-runtime',
        'sys.skills',
        'sys.building',
        'sys.bot-runtime',
        'sys.safety',
        'sys.memory',
        'sys.transport',
        'sys.planner',
        'sys.brains',
    ]);
    const keepTypes = new Set([
        'reads',
        'writes',
        'publishes',
        'subscribes',
        'proposes_to',
        'persists_to',
    ]);
    const lines = ['flowchart LR'];
    for (const system of systems.filter((system) => keepSystems.has(system.id)))
        lines.push(`${idFor(system.id)}["${escapeMermaid(system.name)}"]`);
    const seen = new Set();
    for (const relation of relations.filter((relation) => keepTypes.has(relation.type))) {
        const from = endpointSystem(relation.from);
        const to = endpointSystem(relation.to);
        if (!keepSystems.has(from) || !keepSystems.has(to)) continue;
        if (from === to) continue;
        const key = `${from}|${to}|${relation.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`${idFor(from)} -->|${escapeMermaid(relation.type)}| ${idFor(to)}`);
    }
    lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
    lines.push(
        `class ${systems
            .filter((system) => keepSystems.has(system.id))
            .map((system) => idFor(system.id))
            .join(',')} system;`,
    );
    return `${lines.join('\n')}\n`;
}

function mermaidSystem(system) {
    const lines = ['flowchart LR'];
    const localComponentIds = new Set(system.components.map((component) => component.id));
    const includedComponentIds = new Set(system.components.map((component) => component.id));
    for (const relation of relations) {
        const touchesLocal =
            localComponentIds.has(relation.from) || localComponentIds.has(relation.to);
        if (!touchesLocal) continue;
        if (componentById.has(relation.from)) includedComponentIds.add(relation.from);
        if (componentById.has(relation.to)) includedComponentIds.add(relation.to);
        if (externalById.has(relation.from)) includedComponentIds.add(relation.from);
        if (externalById.has(relation.to)) includedComponentIds.add(relation.to);
    }
    for (const componentId of includedComponentIds) {
        const component = componentById.get(componentId);
        if (component === undefined) {
            appendExternalNode(lines, componentId);
            continue;
        }
        const outside = componentToSystem.get(componentId) !== system.id;
        const suffix = outside
            ? ` (${systemById.get(componentToSystem.get(componentId))?.name ?? 'external'})`
            : '';
        lines.push(`${idFor(componentId)}["${escapeMermaid(component.name + suffix)}"]`);
    }
    for (const relation of relations) {
        if (!includedComponentIds.has(relation.from) || !includedComponentIds.has(relation.to))
            continue;
        if (relation.from === relation.to) continue;
        lines.push(
            `${idFor(relation.from)} -->|${escapeMermaid(relation.type)}| ${idFor(relation.to)}`,
        );
    }
    const internalComponentIds = [...localComponentIds];
    const externalComponentIds = [...includedComponentIds].filter(
        (id) => !localComponentIds.has(id) && componentById.has(id),
    );
    const externalNodes = [...includedComponentIds].filter((id) => externalById.has(id));
    lines.push('classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
    lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
    lines.push(`class ${internalComponentIds.map((id) => idFor(id)).join(',')} internal;`);
    if (externalComponentIds.length || externalNodes.length)
        lines.push(
            `class ${[...externalComponentIds, ...externalNodes].map((id) => idFor(id)).join(',')} external;`,
        );
    return `${lines.join('\n')}\n`;
}

const graphFiles = new Map();
graphFiles.set('fleet-overview.mmd', mermaidOverview());
graphFiles.set('cross-system.mmd', mermaidCrossSystem());
graphFiles.set('safety-control.mmd', mermaidSafetyControl());
graphFiles.set('data-flow.mmd', mermaidDataFlow());
for (const system of systems)
    graphFiles.set(`system-${system.id.replace(/^sys\./, '')}.mmd`, mermaidSystem(system));

for (const [name, content] of graphFiles)
    fileSystem.writeFileSync(path.join(graphDirectory, name), content);

const countByType = new Map();
for (const relation of relations)
    countByType.set(relation.type, (countByType.get(relation.type) ?? 0) + 1);

const componentCount = systems.reduce((count, system) => count + system.components.length, 0);
const headingSlug = (value) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

const header = (title) =>
    `# ${title}\n\n> Generated from \`docs/architecture/graph.json\`. Edit the graph, then run \`bun tools/architecture/render-graphs.mjs\`.\n\n`;

function appendSystemIndex(document, systemList) {
    document.push('## System index\n');
    document.push('| ID | System | Components | Owner package | Milestone |');
    document.push('|---|---|---:|---|---:|');
    for (const system of systemList) {
        document.push(
            `| \`${system.id}\` | [${system.name}](#${headingSlug(system.name)}) | ${system.components.length} | \`${system.ownerPackage}\` | ${system.milestone} |`,
        );
    }
    document.push('');
}

function appendComponentTable(document, system) {
    document.push('### Components\n');
    document.push('| ID | Component | Responsibility | Owner path | Milestone |');
    document.push('|---|---|---|---|---:|');
    for (const component of system.components) {
        document.push(
            `| \`${component.id}\` | ${component.name} | ${component.responsibility} | \`${component.plannedPath}\` | ${component.milestone} |`,
        );
    }
    document.push('');
}

function appendComponentDetails(document, component) {
    document.push(`### \`${component.id}\` — ${component.name}\n`);
    document.push(`- **Responsibility:** ${component.responsibility}`);
    document.push(`- **Owner path:** \`${component.plannedPath}\``);
    document.push(
        `- **Provides:** ${component.provides.map((providedInterface) => `\`${providedInterface}\``).join(', ')}`,
    );
    document.push(
        `- **Requires:** ${component.requires.length ? component.requires.map((providedInterface) => `\`${providedInterface}\``).join(', ') : 'none'}`,
    );
    document.push(
        `- **Owns state:** ${component.ownsState.length ? component.ownsState.map((providedInterface) => `\`${providedInterface}\``).join(', ') : 'none'}`,
    );
    document.push(
        `- **Source refs:** ${component.sourceRefs.map((sourceRef) => `\`${sourceRef}\``).join(', ')}`,
    );
    document.push(`- **Milestone:** ${component.milestone}`);
    document.push('- **Invariants:**');
    for (const invariant of component.invariants) document.push(`  - ${invariant}`);
    document.push('- **Failure modes:**');
    for (const failureMode of component.failureModes) document.push(`  - ${failureMode}`);
    document.push('- **Tests:**');
    for (const test of component.tests) document.push(`  - ${test}`);
    document.push('- **Metrics:**');
    for (const metric of component.metrics) document.push(`  - \`${metric}\``);
    document.push('');
}

function appendSystemCatalog(document, system) {
    document.push(`## ${system.name}\n`);
    document.push(`- **ID:** \`${system.id}\``);
    document.push(`- **Owner package:** \`${system.ownerPackage}\``);
    document.push(`- **Milestone:** ${system.milestone}`);
    document.push(
        `- **Source refs:** ${system.sourceRefs.map((sourceRef) => `\`${sourceRef}\``).join(', ')}`,
    );
    document.push(
        `- **Allowed cross-system dependencies:** ${system.allowedDependencies.length ? system.allowedDependencies.map((dependency) => `\`${dependency}\``).join(', ') : 'none'}`,
    );
    document.push(
        `- **Forbidden dependencies:** ${system.forbiddenDependencies.length ? system.forbiddenDependencies.map((dependency) => `\`${dependency}\``).join(', ') : 'none'}`,
    );
    document.push('');
    document.push('**Purpose.** ' + system.purpose + '\n');
    document.push('**System invariants.**');
    for (const invariant of system.invariants) document.push(`- ${invariant}`);
    document.push('');
    appendComponentTable(document, system);
    for (const component of system.components) appendComponentDetails(document, component);
    document.push('---\n');
}

function appendSystemRelations(document, system) {
    const systemRelations = relations.filter(
        (relation) => (componentToSystem.get(relation.from) ?? relation.from) === system.id,
    );
    if (systemRelations.length === 0) return;
    document.push(`## ${system.name} relations\n`);
    document.push(
        '| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |',
    );
    document.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const relation of systemRelations) {
        document.push(
            `| \`${relation.id}\` | \`${relation.from}\` | \`${relation.type}\` | \`${relation.to}\` | \`${relation.protocol}\` | ${relation.sync ? 'sync' : 'async'} | ${relation.criticality} | ${relation.payload} | ${relation.failureBehavior} | ${relation.notes} |`,
        );
    }
    document.push('');
}

const decomposition = [];
decomposition.push(header('TiCrafter System Decomposition'));
decomposition.push(
    `**Version:** ${graph.meta.version}  \n**Source:** \`${graph.meta.generatedFrom}\`  \n**Systems:** ${systems.length}  \n**Components:** ${componentCount}  \n**Relations:** ${relations.length}  \n**Externals:** ${externals.length}\n`,
);
decomposition.push('## Reading this catalog\n');
decomposition.push(
    'A component is the smallest owned implementation boundary in this architecture. It has one responsibility, one owning package path, an explicit interface, owned state (if any), invariants, failure modes, tests, and metrics. Components are not individual functions.\n',
);
appendSystemIndex(decomposition, systems);
for (const system of systems) appendSystemCatalog(decomposition, system);
fileSystem.writeFileSync(path.join(outputDirectory, 'decomposition.md'), decomposition.join('\n'));

const relationsDocument = [];
relationsDocument.push(header('TiCrafter Relation Catalog'));
relationsDocument.push(
    `**Relations:** ${relations.length}  \n**State owners:** ${graph.stateOwnership.length}  \n**Allowed cycles:** ${graph.meta.allowedCycles.length}\n`,
);
relationsDocument.push('## Relation types\n');
relationsDocument.push('| Type | Semantics |');
relationsDocument.push('|---|---|');
for (const [type, description] of Object.entries(relationTypeDescriptions))
    relationsDocument.push(`| \`${type}\` | ${description} |`);
relationsDocument.push('');
relationsDocument.push('## Relation counts\n');
relationsDocument.push('| Type | Count |');
relationsDocument.push('|---|---:|');
for (const [type, count] of [...countByType.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
))
    relationsDocument.push(`| \`${type}\` | ${count} |`);
relationsDocument.push('');
relationsDocument.push('## State ownership\n');
relationsDocument.push(
    'Every `writes` edge must target a declared state owner and originate from a declared writer.\n',
);
relationsDocument.push('| State | Owner | Writers | Readers |');
relationsDocument.push('|---|---|---|---|');
for (const state of graph.stateOwnership) {
    relationsDocument.push(
        `| \`${state.state}\` | \`${state.owner}\` | ${state.writers.map((writer) => `\`${writer}\``).join(', ')} | ${state.readers.map((reader) => `\`${reader}\``).join(', ')} |`,
    );
}
relationsDocument.push('');
relationsDocument.push('## Cross-system summary\n');
const aggregated = aggregatedSystemEdges().filter(
    (entry) => systemById.has(entry.from) && systemById.has(entry.to),
);
const bySource = new Map();
for (const entry of aggregated) {
    if (!bySource.has(entry.from)) bySource.set(entry.from, []);
    bySource.get(entry.from).push(entry);
}
relationsDocument.push('| From system | To system | Relations | Types |');
relationsDocument.push('|---|---|---:|---|');
const systemEntries = systems.flatMap((system) =>
    (bySource.get(system.id) ?? [])
        .sort((left, right) => left.to.localeCompare(right.to))
        .map((entry) => ({ system, entry })),
);
for (const { system, entry } of systemEntries) {
    relationsDocument.push(
        `| \`${system.name}\` | \`${systemById.get(entry.to).name}\` | ${entry.count} | ${edgeLabel(entry)} |`,
    );
}
relationsDocument.push('');
relationsDocument.push('## Allowed dependency cycles\n');
if (graph.meta.allowedCycles.length === 0) relationsDocument.push('None.\n');
else {
    relationsDocument.push(
        'These are explicit architectural exceptions. Any unlisted cross-system `depends_on` cycle fails validation.\n',
    );
    for (const cycle of graph.meta.allowedCycles) relationsDocument.push(`- \`${cycle}\``);
    relationsDocument.push('');
}
relationsDocument.push('## Forbidden edges\n');
relationsDocument.push('| Rule | From pattern | To pattern | Types | Reason |');
relationsDocument.push('|---|---|---|---|---|');
for (const rule of graph.meta.forbiddenEdges)
    relationsDocument.push(
        `| \`${rule.id}\` | \`${rule.fromPattern}\` | \`${rule.toPattern}\` | ${rule.types.map((relationType) => `\`${relationType}\``).join(', ')} | ${rule.reason} |`,
    );
relationsDocument.push('');
for (const system of systems) appendSystemRelations(relationsDocument, system);
fileSystem.writeFileSync(path.join(outputDirectory, 'relations.md'), relationsDocument.join('\n'));

const diagramsDocument = [];
diagramsDocument.push(header('TiCrafter Architecture Graphs'));
diagramsDocument.push(
    'Mermaid source lives in `docs/architecture/graphs/`. GitHub renders these fenced blocks directly. For local SVG rendering, run `bun run render:svg -- <input.mmd> <output.svg>`; it uses the installed Firefox browser and never downloads Chromium.\n',
);
const graphEntries = [
    [
        'fleet-overview.mmd',
        'Fleet overview',
        'Systems and externals with aggregated relation counts.',
    ],
    ['cross-system.mmd', 'Cross-system dependencies', 'System-to-system view with relation types.'],
    [
        'safety-control.mmd',
        'Safety and control authority',
        'Guardian veto, grant/claim control, ops stop path, and planner proposal path.',
    ],
    [
        'data-flow.mmd',
        'Data flow',
        'Perception, world model, SIP, decisions, skills, building, and persistence.',
    ],
];
for (const [file, title, description] of graphEntries) {
    diagramsDocument.push(`## ${title}\n`);
    diagramsDocument.push(description + '\n');
    diagramsDocument.push('```mermaid');
    diagramsDocument.push(graphFiles.get(file).trimEnd());
    diagramsDocument.push('```\n');
}
diagramsDocument.push('## Per-system graphs\n');
for (const system of systems) {
    const file = `system-${system.id.replace(/^sys\./, '')}.mmd`;
    diagramsDocument.push(`### ${system.name}\n`);
    diagramsDocument.push(`Source: \`docs/architecture/graphs/${file}\`\n`);
    diagramsDocument.push('```mermaid');
    diagramsDocument.push(graphFiles.get(file).trimEnd());
    diagramsDocument.push('```\n');
}
fileSystem.writeFileSync(path.join(outputDirectory, 'diagrams.md'), diagramsDocument.join('\n'));

console.log(`wrote ${path.join(outputDirectory, 'decomposition.md')}`);
console.log(`wrote ${path.join(outputDirectory, 'relations.md')}`);
console.log(`wrote ${path.join(outputDirectory, 'diagrams.md')}`);
console.log(`wrote ${graphFiles.size} mermaid graphs to ${graphDirectory}`);
