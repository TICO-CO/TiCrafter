import fileSystem from 'node:fs';
import path from 'node:path';

import { resolveGraph } from './resolve-graph.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const graphPath = path.join(root, 'docs/architecture/graph.json');
const mainPath = path.join(root, 'main.md');

const errors = [];
const warnings = [];
const graph = resolveGraph(JSON.parse(fileSystem.readFileSync(graphPath, 'utf8')));

const required = (value, fields, label) => {
    for (const field of fields) {
        if (value[field] === undefined || value[field] === null || value[field] === '') {
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
required(
    graph.meta,
    [
        'title',
        'version',
        'generatedFrom',
        'updated',
        'relationTypes',
        'allowedCycles',
        'forbiddenEdges',
        'dependencyPolicy',
    ],
    'meta',
);

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
if (policy.globalInstalls !== false)
    errors.push('meta.dependencyPolicy: globalInstalls must be false');
if (policy.systemPackageManager !== false)
    errors.push('meta.dependencyPolicy: systemPackageManager must be false');
assertArray(policy.installRoots, 'meta.dependencyPolicy.installRoots', 1);
assertArray(policy.runtimeForbiddenSystems, 'meta.dependencyPolicy.runtimeForbiddenSystems', 1);
assertArray(policy.bootstrapComponents, 'meta.dependencyPolicy.bootstrapComponents', 1);

const validatePinnedDependencies = (packageJson, section) => {
    for (const [name, versionSpec] of Object.entries(packageJson[section] ?? {})) {
        if (versionSpec === '*' || versionSpec === 'latest' || versionSpec === '') {
            errors.push(
                `package.json: ${section}.${name} must be pinned, got ${JSON.stringify(versionSpec)}`,
            );
        }
    }
};

const packageJsonPath = path.join(root, 'package.json');
const lockfilePath = path.join(root, 'bun.lock');
if (!fileSystem.existsSync(packageJsonPath)) {
    errors.push('package.json: missing repo root manifest');
} else {
    const packageJson = JSON.parse(fileSystem.readFileSync(packageJsonPath, 'utf8'));
    required(packageJson, ['engines', 'scripts'], 'package.json');
    required(packageJson.engines ?? {}, ['bun'], 'package.json.engines');
    required(packageJson.scripts ?? {}, ['bootstrap', 'validate:graph'], 'package.json.scripts');
    if (!String(packageJson.packageManager ?? '').startsWith('bun@')) {
        errors.push('package.json: packageManager must pin bun');
    }
    if (packageJson.private !== true) errors.push('package.json: private must be true');
    for (const section of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
    ])
        validatePinnedDependencies(packageJson, section);
}
if (!fileSystem.existsSync(lockfilePath)) errors.push('bun.lock: missing committed lockfile');

const systemIds = new Set();
const componentIds = new Set();
const externalIds = new Set();
const componentToSystem = new Map();
const systems = new Map();
const providers = new Map();
const relationTypes = new Set(graph.meta.relationTypes);
const protocols = new Set(graph.meta.protocols ?? []);

for (const external of graph.externals ?? []) {
    required(
        external,
        ['id', 'name', 'kind', 'boundary', 'contracts', 'failureModes'],
        `external ${external.id ?? '<unknown>'}`,
    );
    if (!/^ext\.[a-z0-9-]+$/.test(external.id ?? ''))
        errors.push(`external ${external.id}: invalid id`);
    if (externalIds.has(external.id)) errors.push(`duplicate external id ${external.id}`);
    externalIds.add(external.id);
}

const validateComponent = (system, component, componentNames) => {
    const label = `component ${component.id ?? '<unknown>'}`;
    required(
        component,
        [
            'id',
            'name',
            'responsibility',
            'plannedPath',
            'provides',
            'requires',
            'ownsState',
            'invariants',
            'failureModes',
            'tests',
            'metrics',
            'sourceRefs',
            'milestone',
        ],
        label,
    );
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(component.id ?? '')) errors.push(`${label}: invalid id`);
    if (componentIds.has(component.id)) errors.push(`duplicate component id ${component.id}`);
    if (componentNames.has(component.name))
        errors.push(`${system.id}: duplicate component name ${component.name}`);
    componentNames.add(component.name);
    componentIds.add(component.id);
    componentToSystem.set(component.id, system.id);
    assertArray(component.provides, `${label}.provides`, 1);
    for (const provided of component.provides ?? []) {
        if (providers.has(provided)) {
            errors.push(
                `${label}: duplicate provided interface ${provided} (also ${providers.get(provided)})`,
            );
        }
        providers.set(provided, component.id);
    }
    assertArray(component.requires, `${label}.requires`, 0);
    assertArray(component.invariants, `${label}.invariants`, 1);
    assertArray(component.failureModes, `${label}.failureModes`, 1);
    assertArray(component.tests, `${label}.tests`, 1);
    assertArray(component.metrics, `${label}.metrics`, 1);
    assertArray(component.sourceRefs, `${label}.sourceRefs`, 1);
    const placeholder = 'Single responsibility; no side effects outside the declared interface.';
    if ((component.invariants ?? []).includes(placeholder))
        errors.push(`${label}: placeholder invariant is not allowed`);
    if (!Number.isInteger(component.milestone) || component.milestone < 1)
        errors.push(`${label}: invalid milestone`);
    if (!component.plannedPath.startsWith(`${system.ownerPackage}/`)) {
        warnings.push(
            `${label}: plannedPath does not start with system ownerPackage ${system.ownerPackage}`,
        );
    }
};

const validateSystemComponents = (system) => {
    const componentNames = new Set();
    for (const component of system.components ?? []) {
        validateComponent(system, component, componentNames);
    }
};

for (const system of graph.systems ?? []) {
    required(
        system,
        [
            'id',
            'name',
            'purpose',
            'ownerPackage',
            'milestone',
            'sourceRefs',
            'invariants',
            'allowedDependencies',
            'forbiddenDependencies',
            'components',
        ],
        `system ${system.id ?? '<unknown>'}`,
    );
    if (!/^sys\.[a-z0-9-]+$/.test(system.id ?? '')) errors.push(`system ${system.id}: invalid id`);
    if (systemIds.has(system.id)) errors.push(`duplicate system id ${system.id}`);
    systemIds.add(system.id);
    systems.set(system.id, system);
    assertArray(system.sourceRefs, `${system.id}.sourceRefs`, 1);
    assertArray(system.invariants, `${system.id}.invariants`, 1);
    assertArray(system.components, `${system.id}.components`, 1);
    validateSystemComponents(system);
}

const components = (graph.systems ?? []).flatMap((system) => system.components ?? []);

const validateRequirements = (component) => {
    for (const requirement of component.requires ?? []) {
        if (!componentIds.has(requirement) && !externalIds.has(requirement)) {
            errors.push(`component ${component.id}: unknown requirement ${requirement}`);
        }
    }
};

for (const component of components) validateRequirements(component);

for (const id of policy.bootstrapComponents ?? []) {
    if (!componentIds.has(id))
        errors.push(`meta.dependencyPolicy: unknown bootstrap component ${id}`);
}
if (!systemIds.has('sys.toolchain'))
    errors.push('meta.dependencyPolicy: sys.toolchain system is required');

const relationIds = new Set();
const relationKeys = new Set();
const relationSources = new Map();
const relationTargets = new Map();
const validEndpoints = (id) => systemIds.has(id) || componentIds.has(id) || externalIds.has(id);

for (const relation of graph.relations ?? []) {
    const label = `relation ${relation.id ?? '<unknown>'}`;
    required(
        relation,
        [
            'id',
            'from',
            'to',
            'type',
            'protocol',
            'payload',
            'sync',
            'criticality',
            'failureBehavior',
            'notes',
        ],
        label,
    );
    if (!/^rel\.[0-9]{4}$/.test(relation.id ?? '')) errors.push(`${label}: invalid id`);
    if (relationIds.has(relation.id)) errors.push(`duplicate relation id ${relation.id}`);
    relationIds.add(relation.id);
    const key = `${relation.from}|${relation.to}|${relation.type}`;
    if (relationKeys.has(key)) errors.push(`${label}: duplicate relation ${key}`);
    relationKeys.add(key);
    if (!relationTypes.has(relation.type)) errors.push(`${label}: unknown type ${relation.type}`);
    if (protocols.size && !protocols.has(relation.protocol))
        errors.push(`${label}: unknown protocol ${relation.protocol}`);
    if (
        relation.criticality === 'soft' &&
        !/fallback|degrad|last good|deterministic|skip|drop/i.test(relation.failureBehavior ?? '')
    ) {
        errors.push(`${label}: soft relation must document a fallback in failureBehavior`);
    }
    if (!validEndpoints(relation.from))
        errors.push(`${label}: unknown from endpoint ${relation.from}`);
    if (!validEndpoints(relation.to)) errors.push(`${label}: unknown to endpoint ${relation.to}`);
    if (typeof relation.sync !== 'boolean') errors.push(`${label}: sync must be boolean`);
    if (!['hard', 'soft'].includes(relation.criticality))
        errors.push(`${label}: invalid criticality ${relation.criticality}`);
    if (!relation.failureBehavior) errors.push(`${label}: empty failureBehavior`);
    if (!relationSources.has(relation.from)) relationSources.set(relation.from, []);
    relationSources.get(relation.from).push(relation);
    if (!relationTargets.has(relation.to)) relationTargets.set(relation.to, []);
    relationTargets.get(relation.to).push(relation);
}

const processMap = graph.meta.processes ?? {};
for (const relation of graph.relations ?? []) {
    const fromSystem = componentToSystem.get(relation.from);
    const toSystem = componentToSystem.get(relation.to);
    if (!fromSystem || !toSystem) continue;
    const fromProcesses = processMap[fromSystem] ?? [];
    const toProcesses = processMap[toSystem] ?? [];
    if (!fromProcesses.length || !toProcesses.length) continue;
    if (fromProcesses.includes('dev') || toProcesses.includes('dev')) continue;
    const shared = fromProcesses.some((process) => toProcesses.includes(process));
    if (!shared && relation.protocol === 'in-process') {
        errors.push(
            `relation ${relation.id}: cross-process edge ${relation.from} -> ${relation.to} cannot use in-process`,
        );
    }
}

const validateRuntimeForbidden = (forbiddenSystem) => {
    for (const relation of graph.relations ?? []) {
        if (!['depends_on', 'controls', 'writes'].includes(relation.type)) continue;
        const toSystem =
            componentToSystem.get(relation.to) ?? (systemIds.has(relation.to) ? relation.to : null);
        if (toSystem !== forbiddenSystem) continue;
        const fromSystem =
            componentToSystem.get(relation.from) ??
            (systemIds.has(relation.from) ? relation.from : null);
        if (!fromSystem || fromSystem === forbiddenSystem) continue;
        const fromProcesses = processMap[fromSystem] ?? [];
        if (fromProcesses.includes('dev')) continue;
        errors.push(
            `relation ${relation.id}: runtime system ${fromSystem} cannot depend on ${forbiddenSystem}`,
        );
    }
};

for (const forbiddenSystem of policy.runtimeForbiddenSystems ?? []) {
    validateRuntimeForbidden(forbiddenSystem);
}

const globToRegExp = (pattern) =>
    new RegExp(
        `^${pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`,
    );

const validateForbiddenRule = (rule) => {
    const fromExpression = globToRegExp(rule.fromPattern);
    const toExpression = globToRegExp(rule.toPattern);
    for (const relation of graph.relations ?? []) {
        const fromMatch =
            fromExpression.test(relation.from) ||
            fromExpression.test(componentToSystem.get(relation.from) ?? '');
        const toMatch =
            toExpression.test(relation.to) ||
            toExpression.test(componentToSystem.get(relation.to) ?? '');
        const typeMatch = rule.types.includes('*') || rule.types.includes(relation.type);
        if (fromMatch && toMatch && typeMatch) {
            errors.push(
                `forbidden edge ${rule.id}: ${relation.from} -> ${relation.to} (${relation.type}) - ${rule.reason}`,
            );
        }
    }
};

for (const rule of graph.meta.forbiddenEdges ?? []) validateForbiddenRule(rule);

const owners = new Map();
for (const state of graph.stateOwnership ?? []) {
    required(
        state,
        ['state', 'owner', 'writers', 'readers'],
        `state ${state.state ?? '<unknown>'}`,
    );
    if (!componentIds.has(state.owner))
        errors.push(`state ${state.state}: unknown owner ${state.owner}`);
    if (owners.has(state.owner))
        warnings.push(
            `state owner ${state.owner} owns multiple states; keep state ownership explicit`,
        );
    owners.set(state.owner, state);
}

const stateWriters = (graph.stateOwnership ?? []).flatMap((state) =>
    (state.writers ?? []).map((writer) => ({ state, writer })),
);
for (const { state, writer } of stateWriters) {
    if (!componentIds.has(writer)) errors.push(`state ${state.state}: unknown writer ${writer}`);
}

const stateReaders = (graph.stateOwnership ?? []).flatMap((state) =>
    (state.readers ?? []).map((reader) => ({ state, reader })),
);
for (const { state, reader } of stateReaders) {
    if (!componentIds.has(reader)) errors.push(`state ${state.state}: unknown reader ${reader}`);
}

for (const relation of (graph.relations ?? []).filter((relation) => relation.type === 'writes')) {
    const state = owners.get(relation.to);
    if (!state) {
        errors.push(
            `write ${relation.from} -> ${relation.to}: target is not a declared state owner`,
        );
        continue;
    }
    if (!state.writers.includes(relation.from)) {
        errors.push(
            `write ${relation.from} -> ${relation.to}: source is not a declared writer for ${state.state}`,
        );
    }
}

const declaredStates = new Set((graph.stateOwnership ?? []).map((state) => state.state));
const ownedStates = components.flatMap((component) =>
    (component.ownsState ?? []).map((ownedState) => ({ component, ownedState })),
);
for (const { component, ownedState } of ownedStates) {
    if (!declaredStates.has(ownedState)) {
        errors.push(`component ${component.id}: owns undeclared state ${ownedState}`);
    }
}

const writeEdges = new Set(
    (graph.relations ?? [])
        .filter((relation) => relation.type === 'writes')
        .map((relation) => `${relation.from}|${relation.to}`),
);
for (const { state, writer } of stateWriters) {
    if (!writeEdges.has(`${writer}|${state.owner}`)) {
        warnings.push(
            `state ${state.state}: declared writer ${writer} has no writes edge to ${state.owner}`,
        );
    }
}

const mustValidate = graph.meta.destructiveExecutors ?? [];
for (const target of mustValidate) {
    const approved = (relationTargets.get(target) ?? []).some(
        (relation) => relation.type === 'validates' && relation.from === 'safety.action-veto-gate',
    );
    if (!approved)
        errors.push(`missing safety validation edge safety.action-veto-gate -> ${target}`);
}

const adjacency = new Map([...systemIds].map((id) => [id, new Set()]));
for (const relation of (graph.relations ?? []).filter(
    (relation) => relation.type === 'depends_on',
)) {
    const from = componentToSystem.get(relation.from);
    const to = componentToSystem.get(relation.to);
    if (from && to && from !== to) adjacency.get(from).add(to);
}

let index = 0;
const stack = [];
const onStack = new Set();
const indexes = new Map();
const lowlinks = new Map();
const stronglyConnectedComponents = [];
function strongConnect(vertex) {
    indexes.set(vertex, index);
    lowlinks.set(vertex, index);
    index += 1;
    stack.push(vertex);
    onStack.add(vertex);
    for (const neighbor of adjacency.get(vertex) ?? []) {
        if (!indexes.has(neighbor)) {
            strongConnect(neighbor);
            lowlinks.set(vertex, Math.min(lowlinks.get(vertex), lowlinks.get(neighbor)));
            continue;
        }
        if (!onStack.has(neighbor)) continue;
        lowlinks.set(vertex, Math.min(lowlinks.get(vertex), indexes.get(neighbor)));
    }
    if (lowlinks.get(vertex) === indexes.get(vertex)) {
        const component = [];
        let neighbor;
        do {
            neighbor = stack.pop();
            onStack.delete(neighbor);
            component.push(neighbor);
        } while (neighbor !== vertex);
        stronglyConnectedComponents.push(component.sort());
    }
}
for (const vertex of adjacency.keys()) {
    if (!indexes.has(vertex)) strongConnect(vertex);
}

const allowedCycles = new Set(graph.meta.allowedCycles ?? []);
for (const stronglyConnectedComponent of stronglyConnectedComponents.filter(
    (component) => component.length > 1,
)) {
    const signature = stronglyConnectedComponent.join('<->');
    if (!allowedCycles.has(signature))
        errors.push(`cross-system dependency cycle not allowed: ${signature}`);
}

const main = fileSystem.readFileSync(mainPath, 'utf8');
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
const systemSourceRefs = (graph.systems ?? []).flatMap((system) =>
    (system.sourceRefs ?? []).map((ref) => ({ system, ref })),
);
for (const { system, ref } of systemSourceRefs) {
    if (!ref.startsWith('main.md#')) {
        errors.push(`${system.id}: sourceRef ${ref} must target main.md#anchor`);
        continue;
    }
    const anchor = ref.slice('main.md#'.length);
    if (!anchors.has(anchor)) errors.push(`${system.id}: sourceRef anchor not found: ${ref}`);
}

const componentSourceRefs = components.flatMap((component) =>
    (component.sourceRefs ?? []).map((ref) => ({ component, ref })),
);
for (const { component, ref } of componentSourceRefs) {
    if (!ref.startsWith('main.md#')) {
        errors.push(`${component.id}: sourceRef ${ref} must target main.md#anchor`);
        continue;
    }
    const anchor = ref.slice('main.md#'.length);
    if (!anchors.has(anchor)) errors.push(`${component.id}: sourceRef anchor not found: ${ref}`);
}

const connected = new Set();
for (const relation of graph.relations ?? []) {
    connected.add(relation.from);
    connected.add(relation.to);
}
for (const component of componentIds) {
    if (!connected.has(component)) warnings.push(`component ${component}: no relations`);
}
for (const external of externalIds) {
    if (!connected.has(external)) warnings.push(`external ${external}: no relations`);
}

const crossSystem = new Set();
for (const relation of (graph.relations ?? []).filter(
    (relation) => relation.type === 'depends_on',
)) {
    const from = componentToSystem.get(relation.from);
    const to = componentToSystem.get(relation.to);
    if (from && to && from !== to) crossSystem.add(`${from}->${to}`);
}

const declaredDependencies = (graph.systems ?? []).flatMap((system) =>
    (system.allowedDependencies ?? []).map((dependency) => `${system.id}->${dependency}`),
);
const declared = new Set(declaredDependencies);
for (const dependency of crossSystem) {
    if (!declared.has(dependency)) {
        warnings.push(`system dependency not listed in allowedDependencies: ${dependency}`);
    }
}
for (const dependency of declared) {
    if (!crossSystem.has(dependency)) {
        warnings.push(`allowedDependencies lists unused dependency: ${dependency}`);
    }
}

const componentCount = [...componentIds].length;
const cycleCount = stronglyConnectedComponents.filter((component) => component.length > 1).length;

for (const warning of warnings) console.warn(`warn: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);

console.log(
    `graph: systems=${systemIds.size} components=${componentCount} relations=${relationIds.size} externals=${externalIds.size} cycles=${cycleCount} errors=${errors.length} warnings=${warnings.length}`,
);
if (errors.length > 0) process.exit(1);
