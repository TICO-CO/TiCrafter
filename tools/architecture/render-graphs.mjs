import fs from 'node:fs';
import path from 'node:path';
import { resolveGraph } from './resolve-graph.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const outDir = path.join(root, 'docs/architecture');
const graphDir = path.join(outDir, 'graphs');
const graph = resolveGraph(JSON.parse(fs.readFileSync(graphPath, 'utf8')));

fs.mkdirSync(graphDir, { recursive: true });

const systems = graph.systems;
const externals = graph.externals;
const relations = graph.relations;
const systemById = new Map(systems.map((s) => [s.id, s]));
const componentById = new Map();
const componentToSystem = new Map();
const externalById = new Map(externals.map((e) => [e.id, e]));
for (const sys of systems) {
  for (const comp of sys.components) {
    componentById.set(comp.id, comp);
    componentToSystem.set(comp.id, sys.id);
  }
}

const relationTypeDescriptions = {
  depends_on: 'Source requires the target to function; synchronous failure propagates unless a documented fallback exists.',
  controls: 'Source has authority to command, veto, stop, or otherwise constrain the target.',
  reads: 'Source reads state owned by the target through the target interface.',
  writes: 'Source writes state owned by the target; the target is the state owner and the source must be a declared writer.',
  proposes_to: 'Source produces an untrusted proposal; target validates and commits or rejects it.',
  validates: 'Source validates or vetoes the target before the target may act.',
  publishes: 'Source publishes an event to the target or event stream.',
  subscribes: 'Source subscribes to events produced by the target.',
  persists_to: 'Source persists state through the target repository or storage boundary.',
  observes: 'Source emits telemetry or reads observability data without owning target state.',
  delegates_to: 'Source hands a job to the target while retaining responsibility for the outcome.',
};

const esc = (value) => String(value).replaceAll('"', "'").replaceAll('\n', ' ');
const idFor = (() => {
  let n = 0;
  const map = new Map();
  return (key) => {
    if (!map.has(key)) map.set(key, `n${n++}`);
    return map.get(key);
  };
})();

const endpointName = (id) => {
  if (componentById.has(id)) return componentById.get(id).name;
  if (systemById.has(id)) return systemById.get(id).name;
  if (externalById.has(id)) return externalById.get(id).name;
  return id;
};

const endpointSystem = (id) => componentToSystem.get(id) ?? (systemById.has(id) ? id : 'external');

const aggregatedSystemEdges = () => {
  const map = new Map();
  for (const rel of relations) {
    const from = componentToSystem.get(rel.from) ?? (systemById.has(rel.from) ? rel.from : rel.from);
    const to = componentToSystem.get(rel.to) ?? (systemById.has(rel.to) ? rel.to : rel.to);
    if (from === to) continue;
    const key = `${from}|${to}`;
    if (!map.has(key)) map.set(key, { from, to, types: new Map(), count: 0 });
    const entry = map.get(key);
    entry.count += 1;
    entry.types.set(rel.type, (entry.types.get(rel.type) ?? 0) + 1);
  }
  return [...map.values()];
};

const edgeLabel = (entry) => [...entry.types.entries()].map(([type, count]) => `${type}×${count}`).join(', ');

function mermaidOverview() {
  const lines = ['flowchart LR'];
  const systemNodes = systems.map((sys) => `${idFor(sys.id)}["${esc(sys.name)}"]`);
  const extNodes = externals.map((ext) => `${idFor(ext.id)}(["${esc(ext.name)}"])`);
  lines.push(...systemNodes, ...extNodes);
  for (const entry of aggregatedSystemEdges()) {
    const from = entry.from.startsWith('ext.') ? entry.from : entry.from;
    const to = entry.to.startsWith('ext.') ? entry.to : entry.to;
    lines.push(`${idFor(from)} -->|${esc(edgeLabel(entry))}| ${idFor(to)}`);
  }
  lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
  lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
  lines.push(`class ${systems.map((s) => idFor(s.id)).join(',')} system;`);
  lines.push(`class ${externals.map((e) => idFor(e.id)).join(',')} external;`);
  return `${lines.join('\n')}\n`;
}

function mermaidCrossSystem() {
  const lines = ['flowchart LR'];
  for (const sys of systems) lines.push(`${idFor(sys.id)}["${esc(sys.name)}"]`);
  for (const entry of aggregatedSystemEdges()) {
    if (!systemById.has(entry.from) || !systemById.has(entry.to)) continue;
    lines.push(`${idFor(entry.from)} -->|${esc(edgeLabel(entry))}| ${idFor(entry.to)}`);
  }
  lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
  lines.push(`class ${systems.map((s) => idFor(s.id)).join(',')} system;`);
  return `${lines.join('\n')}\n`;
}

function mermaidSafetyControl() {
  const keepSystems = new Set(['sys.safety', 'sys.bot-runtime', 'sys.building', 'sys.ops', 'sys.core', 'sys.decision', 'sys.planner', 'sys.skill-runtime', 'sys.brains']);
  const keepTypes = new Set(['controls', 'validates', 'proposes_to', 'delegates_to']);
  const lines = ['flowchart TD'];
  for (const sys of systems.filter((s) => keepSystems.has(s.id))) lines.push(`${idFor(sys.id)}["${esc(sys.name)}"]`);
  lines.push(`${idFor('ext.operator')}(["Fleet Operator"])`);
  const seen = new Set();
  for (const rel of relations.filter((r) => keepTypes.has(r.type))) {
    const from = endpointSystem(rel.from);
    const to = endpointSystem(rel.to);
    if (from === to) continue;
    if (!keepSystems.has(from) && from !== 'ext.operator') continue;
    if (!keepSystems.has(to) && to !== 'ext.operator') continue;
    const key = `${from}|${to}|${rel.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${idFor(from)} -->|${esc(rel.type)}| ${idFor(to)}`);
  }
  for (const sys of systems.filter((s) => keepSystems.has(s.id))) {
    for (const comp of sys.components) {
      if (relations.some((r) => keepTypes.has(r.type) && (r.from === comp.id || r.to === comp.id))) {
        lines.push(`${idFor(comp.id)}["${esc(comp.name)}"]`);
      }
    }
  }
  for (const rel of relations.filter((r) => keepTypes.has(r.type))) {
    if (!componentById.has(rel.from) || !componentById.has(rel.to)) continue;
    const fromSys = componentToSystem.get(rel.from);
    const toSys = componentToSystem.get(rel.to);
    if (!keepSystems.has(fromSys) || !keepSystems.has(toSys)) continue;
    lines.push(`${idFor(rel.from)} -->|${esc(rel.type)}| ${idFor(rel.to)}`);
  }
  lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
  lines.push('classDef component fill:#f8fafc,stroke:#64748b,color:#0f172a;');
  lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
  const sysNodeIds = systems.filter((s) => keepSystems.has(s.id)).map((s) => idFor(s.id));
  const compNodeIds = systems.filter((s) => keepSystems.has(s.id)).flatMap((s) => s.components.map((c) => c.id)).filter((id) => lines.some((line) => line.startsWith(`${idFor(id)}[`)));
  lines.push(`class ${sysNodeIds.join(',')} system;`);
  if (compNodeIds.length) lines.push(`class ${compNodeIds.map((id) => idFor(id)).join(',')} component;`);
  lines.push(`class ${idFor('ext.operator')} external;`);
  return `${lines.join('\n')}\n`;
}

function mermaidDataFlow() {
  const keepSystems = new Set(['sys.perception', 'sys.world', 'sys.sip', 'sys.decision', 'sys.skill-runtime', 'sys.skills', 'sys.building', 'sys.bot-runtime', 'sys.safety', 'sys.memory', 'sys.transport', 'sys.planner', 'sys.brains']);
  const keepTypes = new Set(['reads', 'writes', 'publishes', 'subscribes', 'proposes_to', 'persists_to']);
  const lines = ['flowchart LR'];
  for (const sys of systems.filter((s) => keepSystems.has(s.id))) lines.push(`${idFor(sys.id)}["${esc(sys.name)}"]`);
  const seen = new Set();
  for (const rel of relations.filter((r) => keepTypes.has(r.type))) {
    const from = endpointSystem(rel.from);
    const to = endpointSystem(rel.to);
    if (!keepSystems.has(from) || !keepSystems.has(to)) continue;
    if (from === to) continue;
    const key = `${from}|${to}|${rel.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${idFor(from)} -->|${esc(rel.type)}| ${idFor(to)}`);
  }
  lines.push('classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
  lines.push(`class ${systems.filter((s) => keepSystems.has(s.id)).map((s) => idFor(s.id)).join(',')} system;`);
  return `${lines.join('\n')}\n`;
}

function mermaidSystem(sys) {
  const lines = ['flowchart LR'];
  const local = new Set(sys.components.map((c) => c.id));
  const included = new Set(sys.components.map((c) => c.id));
  for (const rel of relations) {
    if (local.has(rel.from) || local.has(rel.to)) {
      if (componentById.has(rel.from)) included.add(rel.from);
      if (componentById.has(rel.to)) included.add(rel.to);
      if (externalById.has(rel.from)) included.add(rel.from);
      if (externalById.has(rel.to)) included.add(rel.to);
    }
  }
  for (const compId of included) {
    const comp = componentById.get(compId);
    if (comp) {
      const outside = componentToSystem.get(compId) !== sys.id;
      const suffix = outside ? ` (${systemById.get(componentToSystem.get(compId))?.name ?? 'external'})` : '';
      lines.push(`${idFor(compId)}["${esc(comp.name + suffix)}"]`);
    } else if (externalById.has(compId)) {
      lines.push(`${idFor(compId)}(["${esc(externalById.get(compId).name)}"])`);
    }
  }
  for (const rel of relations) {
    if (!included.has(rel.from) || !included.has(rel.to)) continue;
    if (rel.from === rel.to) continue;
    lines.push(`${idFor(rel.from)} -->|${esc(rel.type)}| ${idFor(rel.to)}`);
  }
  const internal = [...local];
  const external = [...included].filter((id) => !local.has(id) && componentById.has(id));
  const extNodes = [...included].filter((id) => externalById.has(id));
  lines.push('classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;');
  lines.push('classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;');
  lines.push(`class ${internal.map((id) => idFor(id)).join(',')} internal;`);
  if (external.length || extNodes.length) lines.push(`class ${[...external, ...extNodes].map((id) => idFor(id)).join(',')} external;`);
  return `${lines.join('\n')}\n`;
}

const graphFiles = new Map();
graphFiles.set('fleet-overview.mmd', mermaidOverview());
graphFiles.set('cross-system.mmd', mermaidCrossSystem());
graphFiles.set('safety-control.mmd', mermaidSafetyControl());
graphFiles.set('data-flow.mmd', mermaidDataFlow());
for (const sys of systems) graphFiles.set(`system-${sys.id.replace(/^sys\./, '')}.mmd`, mermaidSystem(sys));

for (const [name, content] of graphFiles) fs.writeFileSync(path.join(graphDir, name), content);

const countByType = new Map();
for (const rel of relations) countByType.set(rel.type, (countByType.get(rel.type) ?? 0) + 1);

const componentCount = systems.reduce((n, s) => n + s.components.length, 0);
const headingSlug = (value) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const header = (title) => `# ${title}\n\n> Generated from \`docs/architecture/graph.json\`. Edit the graph, then run \`node tools/architecture/render-graphs.mjs\`.\n\n`;

const decomposition = [];
decomposition.push(header('TiCrafter System Decomposition'));
decomposition.push(`**Version:** ${graph.meta.version}  \n**Source:** \`${graph.meta.generatedFrom}\`  \n**Systems:** ${systems.length}  \n**Components:** ${componentCount}  \n**Relations:** ${relations.length}  \n**Externals:** ${externals.length}\n`);
decomposition.push('## Reading this catalog\n');
decomposition.push('A component is the smallest owned implementation boundary in this architecture. It has one responsibility, one owning package path, an explicit interface, owned state (if any), invariants, failure modes, tests, and metrics. Components are not individual functions.\n');
decomposition.push('## System index\n');
decomposition.push('| ID | System | Components | Owner package | Milestone |');
decomposition.push('|---|---|---:|---|---:|');
for (const sys of systems) {
  decomposition.push(`| \`${sys.id}\` | [${sys.name}](#${headingSlug(sys.name)}) | ${sys.components.length} | \`${sys.ownerPackage}\` | ${sys.milestone} |`);
}
decomposition.push('');
for (const sys of systems) {
  decomposition.push(`## ${sys.name}\n`);
  decomposition.push(`- **ID:** \`${sys.id}\``);
  decomposition.push(`- **Owner package:** \`${sys.ownerPackage}\``);
  decomposition.push(`- **Milestone:** ${sys.milestone}`);
  decomposition.push(`- **Source refs:** ${sys.sourceRefs.map((r) => `\`${r}\``).join(', ')}`);
  decomposition.push(`- **Allowed cross-system dependencies:** ${sys.allowedDependencies.length ? sys.allowedDependencies.map((d) => `\`${d}\``).join(', ') : 'none'}`);
  decomposition.push(`- **Forbidden dependencies:** ${sys.forbiddenDependencies.length ? sys.forbiddenDependencies.map((d) => `\`${d}\``).join(', ') : 'none'}`);
  decomposition.push('');
  decomposition.push('**Purpose.** ' + sys.purpose + '\n');
  decomposition.push('**System invariants.**');
  for (const inv of sys.invariants) decomposition.push(`- ${inv}`);
  decomposition.push('');
  decomposition.push('### Components\n');
  decomposition.push('| ID | Component | Responsibility | Owner path | Milestone |');
  decomposition.push('|---|---|---|---|---:|');
  for (const comp of sys.components) {
    decomposition.push(`| \`${comp.id}\` | ${comp.name} | ${comp.responsibility} | \`${comp.plannedPath}\` | ${comp.milestone} |`);
  }
  decomposition.push('');
  for (const comp of sys.components) {
    decomposition.push(`### \`${comp.id}\` — ${comp.name}\n`);
    decomposition.push(`- **Responsibility:** ${comp.responsibility}`);
    decomposition.push(`- **Owner path:** \`${comp.plannedPath}\``);
    decomposition.push(`- **Provides:** ${comp.provides.map((v) => `\`${v}\``).join(', ')}`);
    decomposition.push(`- **Requires:** ${comp.requires.length ? comp.requires.map((v) => `\`${v}\``).join(', ') : 'none'}`);
    decomposition.push(`- **Owns state:** ${comp.ownsState.length ? comp.ownsState.map((v) => `\`${v}\``).join(', ') : 'none'}`);
    decomposition.push(`- **Source refs:** ${comp.sourceRefs.map((r) => `\`${r}\``).join(', ')}`);
    decomposition.push(`- **Milestone:** ${comp.milestone}`);
    decomposition.push('- **Invariants:**');
    for (const inv of comp.invariants) decomposition.push(`  - ${inv}`);
    decomposition.push('- **Failure modes:**');
    for (const failure of comp.failureModes) decomposition.push(`  - ${failure}`);
    decomposition.push('- **Tests:**');
    for (const test of comp.tests) decomposition.push(`  - ${test}`);
    decomposition.push('- **Metrics:**');
    for (const metric of comp.metrics) decomposition.push(`  - \`${metric}\``);
    decomposition.push('');
  }
  decomposition.push('---\n');
}
fs.writeFileSync(path.join(outDir, 'decomposition.md'), decomposition.join('\n'));

const relationsDoc = [];
relationsDoc.push(header('TiCrafter Relation Catalog'));
relationsDoc.push(`**Relations:** ${relations.length}  \n**State owners:** ${graph.stateOwnership.length}  \n**Allowed cycles:** ${graph.meta.allowedCycles.length}\n`);
relationsDoc.push('## Relation types\n');
relationsDoc.push('| Type | Semantics |');
relationsDoc.push('|---|---|');
for (const [type, desc] of Object.entries(relationTypeDescriptions)) relationsDoc.push(`| \`${type}\` | ${desc} |`);
relationsDoc.push('');
relationsDoc.push('## Relation counts\n');
relationsDoc.push('| Type | Count |');
relationsDoc.push('|---|---:|');
for (const [type, count] of [...countByType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) relationsDoc.push(`| \`${type}\` | ${count} |`);
relationsDoc.push('');
relationsDoc.push('## State ownership\n');
relationsDoc.push('Every `writes` edge must target a declared state owner and originate from a declared writer.\n');
relationsDoc.push('| State | Owner | Writers | Readers |');
relationsDoc.push('|---|---|---|---|');
for (const state of graph.stateOwnership) {
  relationsDoc.push(`| \`${state.state}\` | \`${state.owner}\` | ${state.writers.map((w) => `\`${w}\``).join(', ')} | ${state.readers.map((r) => `\`${r}\``).join(', ')} |`);
}
relationsDoc.push('');
relationsDoc.push('## Cross-system summary\n');
const aggregated = aggregatedSystemEdges().filter((entry) => systemById.has(entry.from) && systemById.has(entry.to));
const bySource = new Map();
for (const entry of aggregated) {
  if (!bySource.has(entry.from)) bySource.set(entry.from, []);
  bySource.get(entry.from).push(entry);
}
relationsDoc.push('| From system | To system | Relations | Types |');
relationsDoc.push('|---|---|---:|---|');
for (const sys of systems) {
  for (const entry of (bySource.get(sys.id) ?? []).sort((a, b) => a.to.localeCompare(b.to))) {
    relationsDoc.push(`| \`${sys.name}\` | \`${systemById.get(entry.to).name}\` | ${entry.count} | ${edgeLabel(entry)} |`);
  }
}
relationsDoc.push('');
relationsDoc.push('## Allowed dependency cycles\n');
if (graph.meta.allowedCycles.length === 0) relationsDoc.push('None.\n');
else {
  relationsDoc.push('These are explicit architectural exceptions. Any unlisted cross-system `depends_on` cycle fails validation.\n');
  for (const cycle of graph.meta.allowedCycles) relationsDoc.push(`- \`${cycle}\``);
  relationsDoc.push('');
}
relationsDoc.push('## Forbidden edges\n');
relationsDoc.push('| Rule | From pattern | To pattern | Types | Reason |');
relationsDoc.push('|---|---|---|---|---|');
for (const rule of graph.meta.forbiddenEdges) relationsDoc.push(`| \`${rule.id}\` | \`${rule.fromPattern}\` | \`${rule.toPattern}\` | ${rule.types.map((t) => `\`${t}\``).join(', ')} | ${rule.reason} |`);
relationsDoc.push('');
for (const sys of systems) {
  const sysRelations = relations.filter((rel) => (componentToSystem.get(rel.from) ?? rel.from) === sys.id);
  if (sysRelations.length === 0) continue;
  relationsDoc.push(`## ${sys.name} relations\n`);
  relationsDoc.push('| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |');
  relationsDoc.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const rel of sysRelations) relationsDoc.push(`| \`${rel.id}\` | \`${rel.from}\` | \`${rel.type}\` | \`${rel.to}\` | \`${rel.protocol}\` | ${rel.sync ? 'sync' : 'async'} | ${rel.criticality} | ${rel.payload} | ${rel.failureBehavior} | ${rel.notes} |`);
  relationsDoc.push('');
}
fs.writeFileSync(path.join(outDir, 'relations.md'), relationsDoc.join('\n'));

const diagramsDoc = [];
diagramsDoc.push(header('TiCrafter Architecture Graphs'));
diagramsDoc.push('Mermaid source lives in `docs/architecture/graphs/`. GitHub renders these fenced blocks directly. For local SVG rendering, run `npm run render:svg -- <input.mmd> <output.svg>`; it uses the installed Firefox browser and never downloads Chromium.\n');
const graphEntries = [
  ['fleet-overview.mmd', 'Fleet overview', 'Systems and externals with aggregated relation counts.'],
  ['cross-system.mmd', 'Cross-system dependencies', 'System-to-system view with relation types.'],
  ['safety-control.mmd', 'Safety and control authority', 'Guardian veto, grant/claim control, ops stop path, and planner proposal path.'],
  ['data-flow.mmd', 'Data flow', 'Perception, world model, SIP, decisions, skills, building, and persistence.'],
];
for (const [file, title, description] of graphEntries) {
  diagramsDoc.push(`## ${title}\n`);
  diagramsDoc.push(description + '\n');
  diagramsDoc.push('```mermaid');
  diagramsDoc.push(graphFiles.get(file).trimEnd());
  diagramsDoc.push('```\n');
}
diagramsDoc.push('## Per-system graphs\n');
for (const sys of systems) {
  const file = `system-${sys.id.replace(/^sys\./, '')}.mmd`;
  diagramsDoc.push(`### ${sys.name}\n`);
  diagramsDoc.push(`Source: \`docs/architecture/graphs/${file}\`\n`);
  diagramsDoc.push('```mermaid');
  diagramsDoc.push(graphFiles.get(file).trimEnd());
  diagramsDoc.push('```\n');
}
fs.writeFileSync(path.join(outDir, 'diagrams.md'), diagramsDoc.join('\n'));

console.log(`wrote ${path.join(outDir, 'decomposition.md')}`);
console.log(`wrote ${path.join(outDir, 'relations.md')}`);
console.log(`wrote ${path.join(outDir, 'diagrams.md')}`);
console.log(`wrote ${graphFiles.size} mermaid graphs to ${graphDir}`);
