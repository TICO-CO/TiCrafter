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
bun run bootstrap
bun run bootstrap:check
bun tools/architecture/validate-graph.mjs
bun tools/architecture/check-component-paths.mjs
bun tools/architecture/render-graphs.mjs
```

`validate-graph.mjs` exits non-zero on:

- duplicate or dangling IDs
- missing component fields
- duplicate provided interfaces
- unknown relation endpoints, types, or protocols
- forbidden edges
- `writes` edges without a declared state owner or writer
- missing safety validation on every component listed in `meta.destructiveExecutors`
- `soft` relations whose `failureBehavior` documents no fallback
- cross-process relations labeled `in-process`
- unlisted cross-system `depends_on` cycles
- source refs that do not resolve to `main.md` headings
- placeholder invariants
- missing dependency policy or unpinned package specs
- bootstrap components missing from the graph
- runtime systems depending on `sys.toolchain`

`render-graphs.mjs` is deterministic. Re-running it with the same `graph.json` produces identical output.

`check-component-paths.mjs` resolves every component `plannedPath` to a source file.
Intentional aliases are declared in the tool; an unlisted missing path fails the check.

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
- a `template`, or explicit invariants, failure modes, and tests
- metrics
- `main.md` source refs
- milestone

Use a template when components in the same category share invariants, failure modes, and tests. Override any field only where behavior differs; `extraInvariants`, `extraFailureModes`, and `extraTests` append to the template. The resolver in `resolve-graph.mjs` runs before validation and rendering.

When adding a relation, use one of the declared types and provide protocol, payload, sync/async, criticality, failure behavior, and notes.

## Component templates

`meta.componentTemplates` holds the shared defaults. A component with `template` inherits any field it does not declare. This keeps 233 components readable without duplicating boilerplate.

## Tunables

`meta.tunables` holds the numeric contract from `main.md`: confidence gate `0.60`, warm p95 budget `250ms`, choice cardinality `16`, option tokens `192`, threads `3`/`8`, WebGPU stability `2h`, retention `30d`, LAN endpoint, and fleet size per profile.

## Protocols

| Protocol     | Boundary                                      |
| ------------ | --------------------------------------------- |
| `in-process` | Same OS process.                              |
| `ws`         | Coordinator to bot child process data plane.  |
| `ipc`        | Coordinator to bot child process supervision. |
| `https`      | Cloud planner endpoint.                       |
| `http`       | Operator to ops API.                          |
| `tcp`        | Bot runtime to Minecraft server.              |
| `native`     | ONNX Runtime / WebGPU driver.                 |

`meta.processes` declares which systems run in the coordinator, in bot processes, or only in dev. The validator rejects `in-process` on edges whose process sets do not overlap.

## Relation types

| Type           | Meaning                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `depends_on`   | Source needs target to function; failure propagates unless a fallback exists. |
| `controls`     | Source commands, vetoes, stops, or constrains target.                         |
| `reads`        | Source reads state owned by target through the target interface.              |
| `writes`       | Source writes target-owned state and must be a declared writer.               |
| `proposes_to`  | Source emits an untrusted proposal; target validates and commits or rejects.  |
| `validates`    | Source validates or vetoes target before target acts.                         |
| `publishes`    | Source publishes an event.                                                    |
| `subscribes`   | Source consumes an event.                                                     |
| `persists_to`  | Source persists through target storage boundary.                              |
| `observes`     | Source emits telemetry or reads observability data.                           |
| `delegates_to` | Source hands a job to target but remains accountable.                         |

## Architecture guardrails

The validator enforces the rules that prevent the worst implementation failures:

- no model or planner calls `bot-runtime.action-executor`
- agency components never call `bot-runtime.action-executor` or write SIP state
- chat never triggers physical actions directly
- planner never writes SIP state
- bot processes never open SQLite directly
- perception, skills, Laya, and agency never write SIP state
- destructive executors listed in `meta.destructiveExecutors` require `safety.action-veto-gate` validation
- training code is not a runtime dependency
- cross-system `depends_on` cycles are rejected
- every `writes` edge has a state owner and declared writer
- every declared state writer has a matching `writes` edge
- `soft` relations must document a fallback
- cross-process edges cannot be labeled `in-process`
- every provided interface is unique

These rules are intentionally encoded as data, not prose. Add new forbidden edges to `meta.forbiddenEdges`, new destructive executors to `meta.destructiveExecutors`, and new allowed cycles to `meta.allowedCycles` only with a documented reason.

## Rendering

GitHub renders the fenced Mermaid blocks in `diagrams.md`. For local SVG or PNG output, use the installed Firefox browser through the repo-local Mermaid CLI:

```sh
bun run render:svg -- docs/architecture/graphs/fleet-overview.mmd /tmp/fleet-overview.svg
```

Set `FIREFOX=/path/to/firefox` to override browser detection. No Chromium download is performed.

## Coverage

Current graph:

- 24 internal systems
- 255 owned components
- 532 typed relations
- 5 external actors and services
- 23 state owners
- 23 component templates
- 7 protocols

The graph is intentionally at module/service granularity. A component is not a function. If a proposed component has no owned interface, state, test, or failure mode, it should remain part of its parent component.
