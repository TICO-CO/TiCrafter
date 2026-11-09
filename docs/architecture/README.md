# TiCrafter Architecture

This directory is the implementation contract for TiCrafter. It turns `main.md` into a machine-readable decomposition before code exists.

## Source of truth

`graph.json` is canonical. Everything else is generated:

- `decomposition.md` — systems, components, ownership, invariants, failure modes, tests, metrics
- `relations.md` — relation semantics, state ownership, cross-system summary, full relation catalog
- `diagrams.md` — rendered Mermaid blocks for all graphs
- `graphs/*.mmd` — Mermaid source for the fleet, cross-system, safety, data-flow, and per-system views
- `graph.schema.json` — JSON Schema for `graph.json`

Do not edit generated Markdown. Edit `graph.json`, then regenerate.

## Commands

```sh
node tools/architecture/validate-graph.mjs
node tools/architecture/render-graphs.mjs
```

`validate-graph.mjs` exits non-zero on:

- duplicate or dangling IDs
- missing component fields
- unknown relation endpoints or types
- forbidden edges
- `writes` edges without a declared state owner or writer
- missing safety validation on destructive executors
- unlisted cross-system `depends_on` cycles
- source refs that do not resolve to `main.md` headings

`render-graphs.mjs` is deterministic. Re-running it with the same `graph.json` produces identical output.

## Editing workflow

1. Change `graph.json`.
2. Run the validator.
3. Regenerate docs and graphs.
4. Review the affected system graph in `docs/architecture/graphs/`.

When adding a component, define all of:

- one responsibility
- one owner path under the system `ownerPackage`
- provided and required interfaces
- owned state, if any
- invariants
- failure modes
- tests
- metrics
- `main.md` source refs
- milestone

When adding a relation, use one of the declared types and provide protocol, payload, sync/async, criticality, failure behavior, and notes.

## Relation types

| Type | Meaning |
|---|---|
| `depends_on` | Source needs target to function; failure propagates unless a fallback exists. |
| `controls` | Source commands, vetoes, stops, or constrains target. |
| `reads` | Source reads state owned by target through the target interface. |
| `writes` | Source writes target-owned state and must be a declared writer. |
| `proposes_to` | Source emits an untrusted proposal; target validates and commits or rejects. |
| `validates` | Source validates or vetoes target before target acts. |
| `publishes` | Source publishes an event. |
| `subscribes` | Source consumes an event. |
| `persists_to` | Source persists through target storage boundary. |
| `observes` | Source emits telemetry or reads observability data. |
| `delegates_to` | Source hands a job to target but remains accountable. |

## Architecture guardrails

The validator enforces the rules that prevent the worst implementation failures:

- no model or planner calls `bot-runtime.action-executor`
- planner never writes SIP state
- bot processes never open SQLite directly
- perception, skills, and Laya never write SIP state
- destructive executors require `safety.action-veto-gate` validation
- training code is not a runtime dependency
- cross-system `depends_on` cycles are rejected
- every `writes` edge has a state owner and declared writer

These rules are intentionally encoded as data, not prose. Add new forbidden edges to `meta.forbiddenEdges` and new allowed cycles to `meta.allowedCycles` only with a documented reason.

## Rendering

GitHub renders the fenced Mermaid blocks in `diagrams.md`. For local SVG or PNG output:

```sh
npx @mermaid-js/mermaid-cli -i docs/architecture/graphs/fleet-overview.mmd -o /tmp/fleet-overview.svg
```

## Coverage

Current graph:

- 21 internal systems
- 230 owned components
- 473 typed relations
- 5 external actors and services
- 20 state owners

The graph is intentionally at module/service granularity. A component is not a function. If a proposed component has no owned interface, state, test, or failure mode, it should remain part of its parent component.
