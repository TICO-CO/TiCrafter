import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const mainPath = path.join(root, 'main.md');

const errors = [];
const warnings = [];
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const required = (obj, fields, label) => {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      errors.push(`${label}: missing required field ${field}`);
    }
  }
};

const assertArray = (value, label, min = 0) => {
  if (!Array.isArray(value)) {
    errors.push(`${label}: expected array`);
    return false;
  }
  if (value.length < min) errors.push(`${label}: expected at least ${min} item(s)`);
  return true;
};

required(graph, ['meta', 'externals', 'systems', 'stateOwnership', 'relations'], 'graph');
required(graph.meta, ['title', 'version', 'generatedFrom', 'updated', 'relationTypes', 'allowedCycles', 'forbiddenEdges'], 'meta');

const systemIds = new Set();
const componentIds = new Set();
const externalIds = new Set();
const componentToSystem = new Map();
const systems = new Map();
const relationTypes = new Set(graph.meta.relationTypes);

for (const ext of graph.externals ?? []) {
  required(ext, ['id', 'name', 'kind', 'boundary', 'contracts', 'failureModes'], `external ${ext.id ?? '<unknown>'}`);
  if (!/^ext\.[a-z0-9-]+$/.test(ext.id ?? '')) errors.push(`external ${ext.id}: invalid id`);
  if (externalIds.has(ext.id)) errors.push(`duplicate external id ${ext.id}`);
  externalIds.add(ext.id);
}

for (const sys of graph.systems ?? []) {
  required(sys, ['id', 'name', 'purpose', 'ownerPackage', 'milestone', 'sourceRefs', 'invariants', 'allowedDependencies', 'forbiddenDependencies', 'components'], `system ${sys.id ?? '<unknown>'}`);
  if (!/^sys\.[a-z0-9-]+$/.test(sys.id ?? '')) errors.push(`system ${sys.id}: invalid id`);
  if (systemIds.has(sys.id)) errors.push(`duplicate system id ${sys.id}`);
  systemIds.add(sys.id);
  systems.set(sys.id, sys);
  assertArray(sys.sourceRefs, `${sys.id}.sourceRefs`, 1);
  assertArray(sys.invariants, `${sys.id}.invariants`, 1);
  assertArray(sys.components, `${sys.id}.components`, 1);

  const componentNames = new Set();
  for (const comp of sys.components ?? []) {
    const label = `component ${comp.id ?? '<unknown>'}`;
    required(comp, ['id', 'name', 'responsibility', 'plannedPath', 'provides', 'requires', 'ownsState', 'invariants', 'failureModes', 'tests', 'metrics', 'sourceRefs', 'milestone'], label);
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(comp.id ?? '')) errors.push(`${label}: invalid id`);
    if (componentIds.has(comp.id)) errors.push(`duplicate component id ${comp.id}`);
    if (componentNames.has(comp.name)) errors.push(`${sys.id}: duplicate component name ${comp.name}`);
    componentNames.add(comp.name);
    componentIds.add(comp.id);
    componentToSystem.set(comp.id, sys.id);
    assertArray(comp.provides, `${label}.provides`, 1);
    assertArray(comp.requires, `${label}.requires`, 0);
    assertArray(comp.invariants, `${label}.invariants`, 1);
    assertArray(comp.failureModes, `${label}.failureModes`, 1);
    assertArray(comp.tests, `${label}.tests`, 1);
    assertArray(comp.metrics, `${label}.metrics`, 1);
    assertArray(comp.sourceRefs, `${label}.sourceRefs`, 1);
    if (!Number.isInteger(comp.milestone) || comp.milestone < 1) errors.push(`${label}: invalid milestone`);
    if (!comp.plannedPath.startsWith(`${sys.ownerPackage}/`)) {
      warnings.push(`${label}: plannedPath does not start with system ownerPackage ${sys.ownerPackage}`);
    }
  }
}

for (const sys of graph.systems ?? []) {
  for (const comp of sys.components ?? []) {
    for (const req of comp.requires ?? []) {
      if (!componentIds.has(req) && !externalIds.has(req)) errors.push(`component ${comp.id}: unknown requirement ${req}`);
    }
  }
}

const relationIds = new Set();
const relationKeys = new Set();
const relationSources = new Map();
const relationTargets = new Map();
const validEndpoints = (id) => systemIds.has(id) || componentIds.has(id) || externalIds.has(id);

for (const rel of graph.relations ?? []) {
  const label = `relation ${rel.id ?? '<unknown>'}`;
  required(rel, ['id', 'from', 'to', 'type', 'protocol', 'payload', 'sync', 'criticality', 'failureBehavior', 'notes'], label);
  if (!/^rel\.[0-9]{4}$/.test(rel.id ?? '')) errors.push(`${label}: invalid id`);
  if (relationIds.has(rel.id)) errors.push(`duplicate relation id ${rel.id}`);
  relationIds.add(rel.id);
  const key = `${rel.from}|${rel.to}|${rel.type}`;
  if (relationKeys.has(key)) errors.push(`${label}: duplicate relation ${key}`);
  relationKeys.add(key);
  if (!relationTypes.has(rel.type)) errors.push(`${label}: unknown type ${rel.type}`);
  if (!validEndpoints(rel.from)) errors.push(`${label}: unknown from endpoint ${rel.from}`);
  if (!validEndpoints(rel.to)) errors.push(`${label}: unknown to endpoint ${rel.to}`);
  if (typeof rel.sync !== 'boolean') errors.push(`${label}: sync must be boolean`);
  if (!['hard', 'soft'].includes(rel.criticality)) errors.push(`${label}: invalid criticality ${rel.criticality}`);
  if (!rel.failureBehavior) errors.push(`${label}: empty failureBehavior`);
  if (!relationSources.has(rel.from)) relationSources.set(rel.from, []);
  relationSources.get(rel.from).push(rel);
  if (!relationTargets.has(rel.to)) relationTargets.set(rel.to, []);
  relationTargets.get(rel.to).push(rel);
}

const globToRegExp = (pattern) => new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

for (const rule of graph.meta.forbiddenEdges ?? []) {
  const fromRe = globToRegExp(rule.fromPattern);
  const toRe = globToRegExp(rule.toPattern);
  for (const rel of graph.relations ?? []) {
    const fromMatch = fromRe.test(rel.from) || fromRe.test(componentToSystem.get(rel.from) ?? '');
    const toMatch = toRe.test(rel.to) || toRe.test(componentToSystem.get(rel.to) ?? '');
    const typeMatch = rule.types.includes('*') || rule.types.includes(rel.type);
    if (fromMatch && toMatch && typeMatch) {
      errors.push(`forbidden edge ${rule.id}: ${rel.from} -> ${rel.to} (${rel.type}) - ${rule.reason}`);
    }
  }
}

const owners = new Map();
for (const state of graph.stateOwnership ?? []) {
  required(state, ['state', 'owner', 'writers', 'readers'], `state ${state.state ?? '<unknown>'}`);
  if (!componentIds.has(state.owner)) errors.push(`state ${state.state}: unknown owner ${state.owner}`);
  if (owners.has(state.owner)) warnings.push(`state owner ${state.owner} owns multiple states; keep state ownership explicit`);
  owners.set(state.owner, state);
  for (const writer of state.writers ?? []) {
    if (!componentIds.has(writer)) errors.push(`state ${state.state}: unknown writer ${writer}`);
  }
  for (const reader of state.readers ?? []) {
    if (!componentIds.has(reader)) errors.push(`state ${state.state}: unknown reader ${reader}`);
  }
}

for (const rel of (graph.relations ?? []).filter((r) => r.type === 'writes')) {
  const state = owners.get(rel.to);
  if (!state) {
    errors.push(`write ${rel.from} -> ${rel.to}: target is not a declared state owner`);
    continue;
  }
  if (!state.writers.includes(rel.from)) {
    errors.push(`write ${rel.from} -> ${rel.to}: source is not a declared writer for ${state.state}`);
  }
}

const mustValidate = ['bot-runtime.action-executor', 'building.block-executor'];
for (const target of mustValidate) {
  const approved = (relationTargets.get(target) ?? []).some((rel) => rel.type === 'validates' && rel.from === 'safety.action-veto-gate');
  if (!approved) errors.push(`missing safety validation edge safety.action-veto-gate -> ${target}`);
}

const adjacency = new Map([...systemIds].map((id) => [id, new Set()]));
for (const rel of (graph.relations ?? []).filter((r) => r.type === 'depends_on')) {
  const from = componentToSystem.get(rel.from);
  const to = componentToSystem.get(rel.to);
  if (from && to && from !== to) adjacency.get(from).add(to);
}

let index = 0;
const stack = [];
const onStack = new Set();
const indexes = new Map();
const lowlinks = new Map();
const sccs = [];
function strongConnect(v) {
  indexes.set(v, index);
  lowlinks.set(v, index);
  index += 1;
  stack.push(v);
  onStack.add(v);
  for (const w of adjacency.get(v) ?? []) {
    if (!indexes.has(w)) {
      strongConnect(w);
      lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
    } else if (onStack.has(w)) {
      lowlinks.set(v, Math.min(lowlinks.get(v), indexes.get(w)));
    }
  }
  if (lowlinks.get(v) === indexes.get(v)) {
    const component = [];
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      component.push(w);
    } while (w !== v);
    sccs.push(component.sort());
  }
}
for (const v of adjacency.keys()) if (!indexes.has(v)) strongConnect(v);

const allowedCycles = new Set(graph.meta.allowedCycles ?? []);
for (const scc of sccs.filter((c) => c.length > 1)) {
  const signature = scc.join('<->');
  if (!allowedCycles.has(signature)) errors.push(`cross-system dependency cycle not allowed: ${signature}`);
}

const main = fs.readFileSync(mainPath, 'utf8');
const anchors = new Set();
for (const line of main.split('\n')) {
  const match = line.match(/^#{1,6}\s+(.+)$/);
  if (!match) continue;
  const anchor = match[1]
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  anchors.add(anchor);
}
for (const sys of graph.systems ?? []) {
  for (const ref of sys.sourceRefs ?? []) {
    if (!ref.startsWith('main.md#')) {
      errors.push(`${sys.id}: sourceRef ${ref} must target main.md#anchor`);
      continue;
    }
    const anchor = ref.slice('main.md#'.length);
    if (!anchors.has(anchor)) errors.push(`${sys.id}: sourceRef anchor not found: ${ref}`);
  }
}

const connected = new Set();
for (const rel of graph.relations ?? []) {
  connected.add(rel.from);
  connected.add(rel.to);
}
for (const comp of componentIds) {
  if (!connected.has(comp)) warnings.push(`component ${comp}: no relations`);
}
for (const ext of externalIds) {
  if (!connected.has(ext)) warnings.push(`external ${ext}: no relations`);
}

const crossSystem = new Set();
for (const rel of (graph.relations ?? []).filter((r) => r.type === 'depends_on')) {
  const from = componentToSystem.get(rel.from);
  const to = componentToSystem.get(rel.to);
  if (from && to && from !== to) crossSystem.add(`${from}->${to}`);
}

const declared = new Set();
for (const sys of graph.systems ?? []) for (const dep of sys.allowedDependencies ?? []) declared.add(`${sys.id}->${dep}`);
for (const dep of crossSystem) if (!declared.has(dep)) warnings.push(`system dependency not listed in allowedDependencies: ${dep}`);
for (const dep of declared) if (!crossSystem.has(dep)) warnings.push(`allowedDependencies lists unused dependency: ${dep}`);

const componentCount = [...componentIds].length;
const cycleCount = sccs.filter((c) => c.length > 1).length;

for (const warning of warnings) console.warn(`warn: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);

console.log(`graph: systems=${systemIds.size} components=${componentCount} relations=${relationIds.size} externals=${externalIds.size} cycles=${cycleCount} errors=${errors.length} warnings=${warnings.length}`);
if (errors.length > 0) process.exit(1);
