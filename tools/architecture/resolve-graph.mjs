const clone = (value) => JSON.parse(JSON.stringify(value));

const resolveComponent = (component, templates, problems) => {
    const templateName = component.template;
    const template = templateName ? templates[templateName] : null;
    if (templateName && !template) {
        problems.push(`component ${component.id}: unknown template ${templateName}`);
    }

    component.invariants = component.invariants ?? template?.invariants ?? [];
    component.failureModes = component.failureModes ?? template?.failureModes ?? [];
    component.tests = component.tests ?? template?.tests ?? [];

    if (component.extraInvariants?.length) {
        component.invariants = [...component.invariants, ...component.extraInvariants];
    }
    if (component.extraFailureModes?.length) {
        component.failureModes = [...component.failureModes, ...component.extraFailureModes];
    }
    if (component.extraTests?.length) {
        component.tests = [...component.tests, ...component.extraTests];
    }

    delete component.template;
    delete component.extraInvariants;
    delete component.extraFailureModes;
    delete component.extraTests;
};

export function resolveGraph(graph) {
    const resolved = clone(graph);
    const templates = resolved.meta?.componentTemplates ?? {};
    const problems = [];
    const components = (resolved.systems ?? []).flatMap((system) => system.components ?? []);
    for (const component of components) resolveComponent(component, templates, problems);

    if (problems.length) throw new Error(problems.join('\n'));
    return resolved;
}
