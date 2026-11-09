import fs from 'node:fs';
import path from 'node:path';
import { resolveGraph } from './resolve-graph.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const mainPath = path.join(root, 'main.md');

const errors = [];
const warnings = [];
const graph = resolveGraph(JSON.parse(fs.readFileSync(graphPath, 'utf8')));

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
required(graph.meta, ['title', 'version', 'generatedFrom', 'updated', 'relationTypes', 'allowedCycles', 'forbiddenEdges', 'dependencyPolicy'], 'meta');

const policy = graph.meta.dependencyPolicy ?? {};
required(
  policy,
  [
    'bootstrapCommand',
    'manifest',
    'installRoots',
    'globalInstalls',
    'systemPackageManager',
    'networkAtInstall',
    'eulaConsentRequired',
    'browserProvider',
    'runtimeForbiddenSystems',
    'bootstrapComponents',
  ],
  'meta.dependencyPolicy',
);
if (policy.globalInstalls !== false) errors.push('meta.dependencyPolicy: globalInstalls must be false');
if (policy.systemPackageManager !== false) errors.push('meta.dependencyPolicy: systemPackageManager must be false');
assertArray(policy.installRoots, 'meta.dependencyPolicy.installRoots', 1);
assertArray(policy.runtimeForbiddenSystems, 'meta.dependencyPolicy.runtimeForbiddenSystems', 1);
assertArray(policy.bootstrapComponents, 'meta.dependencyPolicy.bootstrapComponents', 1);

const packageJsonPath = path.join(root, 'package.json');
const lockfilePath = path.join(root, 'package-lock.json');
if (!fs.existsSync(packageJsonPath)) {
  errors.push('package.json: missing repo root manifest');
} else {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  required(pkg, ['engines', 'scripts'], 'package.json');
  required(pkg.engines ?? {}, ['node'], 'package.json.engines');
  required(pkg.scripts ?? {}, ['bootstrap', 'validate:graph'], 'package.json.scripts');
  if (pkg.private !== true) errors.push('package.json: private must be true');
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, spec] of Object.entries(pkg[section] ?? {})) {
      if (spec === '*' || spec === 'latest' || spec === '') {
        errors.push(`package.json: ${section}.${name} must be pinned, got ${JSON.stringify(spec)}`);
      }
    }
  }
}
if (!fs.existsSync(lockfilePath)) errors.push('package-lock.json: missing committed lockfile');

const systemIds = new Set();
const componentIds = new Set();
const externalIds = new Set();
const componentToSystem = new Map();
const systems = new Map();
const providers = new Map();
const relationTypes = new Set(graph.meta.relationTypes);
const protocols = new Set(graph.meta.protocols ?? []);

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
    for (const provided of comp.provides ?? []) {
      if (providers.has(provided)) {
        errors.push(`${label}: duplicate provided interface ${provided} (also ${providers.get(provided)})`);
      }
      providers.set(provided, comp.id);
    }
    assertArray(comp.requires, `${label}.requires`, 0);
    assertArray(comp.invariants, `${label}.invariants`, 1);
    assertArray(comp.failureModes, `${label}.failureModes`, 1);
    assertArray(comp.tests, `${label}.tests`, 1);
    assertArray(comp.metrics, `${label}.metrics`, 1);
    assertArray(comp.sourceRefs, `${label}.sourceRefs`, 1);
    const placeholder = 'Single responsibility; no side effects outside the declared interface.';
    if ((comp.invariants ?? []).includes(placeholder)) errors.push(`${label}: placeholder invariant is not allowed`);
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

for (const id of policy.bootstrapComponents ?? []) {
  if (!componentIds.has(id)) errors.push(`meta.dependencyPolicy: unknown bootstrap component ${id}`);
}
if (!systemIds.has('sys.toolchain')) errors.push('meta.dependencyPolicy: sys.toolchain system is required');

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
  if (protocols.size && !protocols.has(rel.protocol)) errors.push(`${label}: unknown protocol ${rel.protocol}`);
  if (rel.criticality === 'soft' && !/fallback|degrad|last good|deterministic|skip|drop/i.test(rel.failureBehavior ?? '')) {
    errors.push(`${label}: soft relation must document a fallback in failureBehavior`);
  }
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

const processMap = graph.meta.processes ?? {};
for (const rel of graph.relations ?? []) {
  const fromSystem = componentToSystem.get(rel.from);
  const toSystem = componentToSystem.get(rel.to);
  if (!fromSystem || !toSystem) continue;
  const fromProcesses = processMap[fromSystem] ?? [];
  const toProcesses = processMap[toSystem] ?? [];
  if (!fromProcesses.length || !toProcesses.length) continue;
  if (fromProcesses.includes('dev') || toProcesses.includes('dev')) continue;
  const shared = fromProcesses.some((process) => toProcesses.includes(process));
  if (!shared && rel.protocol === 'in-process') {
    errors.push(`relation ${rel.id}: cross-process edge ${rel.from} -> ${rel.to} cannot use in-process`);
  }
}

for (const forbiddenSystem of policy.runtimeForbiddenSystems ?? []) {
  for (const rel of graph.relations ?? []) {
    if (!['depends_on', 'controls', 'writes'].includes(rel.type)) continue;
    const toSystem = componentToSystem.get(rel.to) ?? (systemIds.has(rel.to) ? rel.to : null);
    if (toSystem !== forbiddenSystem) continue;
    const fromSystem = componentToSystem.get(rel.from) ?? (systemIds.has(rel.from) ? rel.from : null);
    if (!fromSystem || fromSystem === forbiddenSystem) continue;
    const fromProcesses = processMap[fromSystem] ?? [];
    if (fromProcesses.includes('dev')) continue;
    errors.push(`relation ${rel.id}: runtime system ${fromSystem} cannot depend on ${forbiddenSystem}`);
  }
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

const declaredStates = new Set((graph.stateOwnership ?? []).map((state) => state.state));
for (const sys of graph.systems ?? []) {
  for (const comp of sys.components ?? []) {
    for (const owned of comp.ownsState ?? []) {
      if (!declaredStates.has(owned)) errors.push(`component ${comp.id}: owns undeclared state ${owned}`);
    }
  }
}

const writeEdges = new Set((graph.relations ?? []).filter((r) => r.type === 'writes').map((r) => `${r.from}|${r.to}`));
for (const state of graph.stateOwnership ?? []) {
  for (const writer of state.writers ?? []) {
    if (!writeEdges.has(`${writer}|${state.owner}`)) {
      warnings.push(`state ${state.state}: declared writer ${writer} has no writes edge to ${state.owner}`);
    }
  }
}

const mustValidate = graph.meta.destructiveExecutors ?? [];
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
for (const sys of graph.systems ?? []) {
  for (const comp of sys.components ?? []) {
    for (const ref of comp.sourceRefs ?? []) {
      if (!ref.startsWith('main.md#')) {
        errors.push(`${comp.id}: sourceRef ${ref} must target main.md#anchor`);
        continue;
      }
      const anchor = ref.slice('main.md#'.length);
      if (!anchors.has(anchor)) errors.push(`${comp.id}: sourceRef anchor not found: ${ref}`);
    }
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
