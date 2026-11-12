# Coding style — TiCrafter agent rules

Normative for agents working in this repo. `spec.md` is normative for the build;
`docs.md` (theory) wins on conflict. Do not invent theory.

## 1. Result pattern, heavily

Standardize on the existing tuple (`packages/core/src/kernel/result.ts`):

```ts
export type Result<T, E = unknown> = [value: T | null, err: E | null];
```

- Return `Result` for all expected failures: validation, parsing, guards, LLM
  validation, replay/sync.
- `T` may be a single value or an object payload. Prefer one
  `Result<object, E>` over multiple returns or out-params:

```ts
type MdlScore = { gain: number; cost: number };

const scoreSplit = (): Result<MdlScore, string> => {
    if (bad) return [null, 'MDL_BLOAT_REJECTED'];

    return [{ gain, cost }, null];
};

const [scored, err] = scoreSplit();
if (err) return [null, err];
```

- Destructure as `const [value, err] = ...`, check `err` first, early-return.
  Never use `value` when `err` is non-null.
- Type `E` narrowly (`string` or a `FailureType` union). Never leave bare
  `unknown` at call sites.
- Reference example: `packages/core/src/config/schema.ts`.

## 2. Exceptions only at the irreplacable boundary

- Never write `try-catch` and never `throw` for domain failures or control
  flow. The only `try-catch` in the repo lives inside `attempt` /
  `attemptAsync` themselves.
- At throwing boundaries (`fs`, `bun:sqlite`, network/SDK calls,
  `JSON.parse`, and similar APIs that cannot avoid throwing) always use
  `attempt` / `attemptAsync` from `@core/result.js`. They wrap the call into
  a `Result` immediately; use pure `Result` flow inward from there.
- The process entrypoint's terminal `.catch` (log + non-zero exit) is the
  single allowed rejection handler outside `attempt`. Never swallow errors.
- The only sanctioned `throw` is `assertNever(value: never)` from
  `packages/core/src/kernel/assert.ts`: unreachable-arm guard for exhaustive
  `switch` defaults (§6). Never call it for reachable control flow.

## 3. OOP by default, functional iteration style

- Behavior lives with the data it mutates. Entities and aggregates encapsulate
  their transitions and invariants (reference: `RunState` in
  `apps/server/src/reasoning/run-state.ts`). Services hold their dependencies;
  storage, hubs, ids, hashers, clocks, and fs are injected at the composition
  root (`buildApp` / `main.ts`), never reached for inside domain code.
- Stateless helpers: single-consumer helpers are `private` methods of their
  owner. Shared pure helpers remain `static` utility classes (references:
  `TypeAlgebra`, `LogicFormatter`, `GraphFactory`, `KindComparators`).
  Module-level free functions are never allowed.
- A class of all-`static` methods is only acceptable when it is a pure
  namespace: no state, no dependencies, no invariants. Anything holding state
  or collaborating with the outside world is an instance.
- Composition roots (`buildApp` / `main.ts`, `GraphStore.open`) are the only
  places that construct collaborators or touch edge singletons (`sseHub`);
  inward code receives ports (`EventSink`, `Clock`, `LLMProvider`). No DI
  container or service locator: runtime resolution fails with exceptions
  instead of `Result` and hides the graph from the type checker.
- "Functional" means iteration style: prefer `.map` / `.filter` / `.find` /
  `.reduce` / `.forEach` / `.some` / `.every` over `for` loops for collection
  processing. Use plain loops for repetition and control flow.
- Never use recursion as a substitute for a loop. Recursion is only for
  inherently recursive processing (grammar parsing, compositional evaluation
  over trees); tree transforms and searches use explicit stacks with loops.
- Never mutate inputs — this is critical for `reduce(state, event)`.
- Keep methods and files small and focused. Delete rather than abstract.
- Prefer files under 150 lines; split a file that grows past that instead of
  adding to it.

## 4. DDD tactics

- Apply DDD tactics: entities, value objects, aggregates with encapsulated
  invariants. No anemic bags of getters/setters.
- Aggregates are not data bags: mutation happens through intention-revealing
  methods (`beginStep`, `record`, `ask`, `answer`, `finish`), not public field
  writes. Reads may use getters; adapters consume a DTO/snapshot (`runDto`)
  instead of poking at internals.
- Thin adapters (routes, SSE, event-log I/O, views) stay thin; they may be
  functions or thin classes, but hold no domain logic.

### Schema ownership [NORMATIVE]

- Every wire or domain schema belongs to the bounded context that owns the
  concept. Schemas live in `packages/core/src/schemas/<context>.ts`; schema
  declarations and their inferred types are exported together from that file.
- `packages/core/src/schemas/index.ts` is the shared facade. Consumers outside
  the folder import schemas through it.
- Shared value objects live in `packages/core/src/schemas/shared.ts`; do not
  redefine positions, bounding boxes, chunk coordinates, inventory items, or
  roles in another context.
- A plural `schemas.ts` file is forbidden. The canonical `schemas/` directory
  is required; do not create a schema dumping ground anywhere else.
- `packages/core/src/transport` owns the envelope, registry, codec, auth, event
  stream, reconnect, flow control, and delta sync. It must not define domain
  payload schemas.
- Message type constants live with the schema that owns them. Do not keep a
  separate cross-domain event-constant file.
- Schemas stay in `packages/core/src/schemas` while every dependent package
  imports `@ticrafter/core`. Moving a schema into another package requires
  changing the import chain first so no package cycle is introduced.
- Schema files import siblings directly through `./<sibling>.js`; they never
  import `./index.js` from inside the folder, to avoid cycles.
- Enforcement: `@ticrafter/no-schema-dumping-ground` rejects plural `schemas`
  files outside the canonical directory and rejects exported schema
  declarations under `packages/core/src/transport`.

## 5. Formatting [NORMATIVE]

- **Prettier is the source of truth.** `.prettierrc.json` is normative:
  `semi: true`, `singleQuote: true`, `tabWidth: 4`, `printWidth: 100`,
  `trailingComma: all`, `endOfLine: lf`. `eslint-config-prettier`
  only disables conflicting ESLint rules — it does not replace Prettier.
- **All code must be formatted.** Before committing, pushing, or opening a
  PR, run `bun run format` (`prettier --write .`). CI and local checks run
  `bun run format:check` (`prettier --check .`); unformatted code fails the
  build. `bun run lint` must also pass, but lint passing does not imply
  formatting is correct.
- Leave blank lines between logical blocks. One concept per line.
- No golfed one-liners, no chained ternaries, no over-compacted pipelines.
- Prefer descriptive names over abbreviations.
- Do not reformat unrelated files except to fix formatting violations; when
  touching a file, ensure the whole file is formatted via Prettier.
- Do not add `// prettier-ignore` or `/* prettier-ignore */` except for
  generated assets or when explicitly justified; comment the justification.

### Naming [NORMATIVE]

- Use complete, descriptive names for variables, parameters, functions,
  methods, types, and constants.
- Never use single-letter or cryptic identifiers. Banned examples: `v`, `l`,
  `e`, `i`, `n`, `pkg`, `ctx`, `req`, `res`, `msg`, `obj`, `fn`, `cb`, `idx`,
  `len`, `tmp`, `val`, `dir`, `src`, `dst`.
- Prefer full words over abbreviations: `database` not `db`, `environment` not
  `env`, `currentWorkingDirectory` not `cwd`, `fileSystem` not `fs`,
  `operatingSystem` not `os`, `packageJson` not `pkg`, `cliArguments` not
  `args`, `context` not `ctx`, `payload`/`message` not `obj`/`msg`, `zod` not
  `z` when importing zod.
- Loop variables use `index`, `botIndex`, `downloadIndex`, and similar names;
  never `i`, `j`, or `k`.
- Test fixtures use descriptive keys, never `a`, `b`, or `c`.
- Exceptions: coordinate axes `x`, `y`, and `z` in Minecraft position fields;
  the wire-format field `v`; standard acronyms `id`, `url`, and `apiKey`; and
  `value`/`err` in the `Result` tuple.
- Applies to TypeScript and JavaScript, including tests, tools, and ESLint
  rules. External wire-format fields and third-party API names are exempt.

## 6. Airtight TypeScript designs

- Use `satisfies` for configs, registries, and maps.
- Give objects fully typed fields; do not rely on widened inference.
- Prefer exhaustive matching over branch checking. When branching on a union
  kind (`EventOp`, `LogicNode.kind`, `RelationType`, `Standing`, failure
  unions), `switch` the discriminant with a `never` default so a new variant
  fails compilation. Never use `if` / `else` chains to pick union arms;
  guard clauses stay for booleans and preconditions only. Close with
  `const _exhaustive: never = x; return _exhaustive;` or
  `assertNever(x: never): never`; never let `default` silently return a value.
  Reference examples: `packages/engine/reduce/reduce.ts`,
  `packages/engine/logical-form/formatter.ts`.
- Model failures as discriminated unions, not loose strings or `any`.
- `no any`. Narrow `unknown` with type guards (`isInt` / `isNum` style).
- No `!` non-null assertion. No silent fallbacks — fail closed.

## 7. Spec and architecture invariants

- `packages/core` and `packages/engine` stay pure: no `fs`, `node:*`, `bun:*`,
  or provider SDKs (enforced in `eslint.config.mjs`). They must run in a
  browser/worker. `packages/core` holds code shared with `apps/web` (model,
  config, `Result`); `packages/engine` holds the server-side domain algorithms.
- Only `packages/events/storage` may import `bun:sqlite`, `node:sqlite`, or
  `better-sqlite3` (enforced in `eslint.config.mjs`). All SQLite access goes
  through `SqliteEdge`; `SqliteCache` and `Projector` take the edge and return
  `Result<T, StorageFailure>`. `GraphStore` maps storage failures to strings.
- `reduce(state, event)` is the only mutation: pure, synchronous,
  deterministic, returns a new state, idempotent by `hash`.
- The event file is the authority; SQLite is a disposable projection.
- Rejected proposals are never persisted as graph events; each rejection (full proposal + reason) is journaled to `data/runs/<graphId>.jsonl` via `RejectionSink` (D9).
- LLM output is never trusted: recompute `definitionHash` and canonical forms
  server-side and re-run core checks.

## 8. Toolchain, imports, tests

- `bun` runs package sources directly; imports resolve through the
  `tsconfig.json` path aliases (`@core`, `@engine`, `@schemas`, `@events`,
  `@llm`). Root scripts are the entrypoints (`bun run build|lint|test`).
- Local imports use `.js` extensions. Keep `simple-import-sort` order.
- New logic needs a test: property test `replay(E) === fold(reduce, E)`,
  AF `§17.1` fixtures, guard thresholds.
- Aggregate transitions need colocated unit tests with fake ports (e.g. a fake
  `RunEvents` sink in `apps/server/src/reasoning/run-state.test.ts`).
- Tests: colocated `*.test.ts` for units and package property tests, root
  `tests/` for integration (`tests/events/`) and golden traces
  (`tests/golden.test.ts`). Run the whole suite with `bun run test`.

## 9. No code comments

- Do not write `//`, `/* */`, `/** */`, or JSX comments in code.
- Code must be self-explanatory through descriptive names and small methods.
- Markdown docs (`AGENTS.md`, `README.md`, `spec.md`) may still use prose.

## 10. Low complexity, flat indentation

- Keep cyclomatic complexity low: one method, one decision family. Add a
  helper instead of adding a branch.
- Never nest deeper than 2 levels; prefer 1. The method body is level 0.
- Minimize indentation. Keep code at the shallowest level that still reads
  correctly; never indent code just because a wrapper (`if`, loop, function)
  was convenient.
- Flatten aggressively: guard clauses, early returns, `continue`, and
  extracted helpers instead of indented blocks. If a block can be lifted out
  of a wrapper, lift it.
- A nesting level must earn its place; unnecessary indentation is a defect,
  not a style preference.
- Use guard clauses: early-return, `continue`, fail fast.
- Never use `else if` blocks; use `switch` with small arms instead (for union
  kinds see §6 exhaustive matching). Avoid
  `else` entirely through early returns; use `else` only when extremely
  necessary. No `else` after `return` / `continue`. No nested iteration;
  extract the inner iteration into a helper.
- Prefer flat sequential `Result` chains over nested conditionals.
- Split any method that needs more than ~3 branches.

## 11. Keep related lines adjacent (Go-style declaration + verification)

- A `Result` acquire and its guards are one atomic block, exactly like Go's
  `v, err := f()` immediately followed by `if err != nil { ... }`: the
  destructure, the `err` check, and the `null` / `undefined` check are
  **adjacent lines with no blank lines between them**:

```ts
const [withEnv, envErr] = applyEnvOverrides(merged, env);
if (envErr) {
    return [null, envErr];
}
if (withEnv === null) {
    return [null, 'Env overlay returned null'];
}

return validateAppConfig(withEnv);
```

- Never separate the declaration from its verification with blank lines. A
  blank line belongs only _after_ the guard block, when the next statement
  stops processing that `Result` — a new call, a transform of other data, or
  the final return.
- The same holds for the whole guard chain: `err` check, then `null` /
  `undefined` check, then any further guard on the same acquire, all adjacent.
  In tests, `expect(err).toBeNull()` is the `err` check and follows the
  destructure immediately, with the `null` / `undefined` guard right after it.

## 12. Facade pattern, always (Rust modules)

- Every directory is a module and must declare its interface (like `mod.rs`):
  `packages/<pkg>/` and every directory beneath it owns `index.ts`,
  including intermediate directories that only contain subdirectories
  (e.g. `packages/engine/`). `apps/<app>/` owns `main.ts` instead of
  `index.ts` (bin root, like `main.rs`); every other module directory under
  `apps/<app>/` owns `index.ts`, except the conventional `src/` container
  (like Rust's `src/`). Exempt: `scripts/` (each file is its own bin),
  `tests/` (each file owns its integration suite; subdirs mirror packages),
  asset-only directories (`packages/llm/prompts/`), runtime data.
- Consumers outside the folder import only via the nearest facade:
  `@core/model/index.js` counts, `@core/model/types.js` does not.
  `./storage/index.js` counts, `./storage/sqlite-cache.js` does not.
- Siblings inside the same folder may import each other relatively
  (e.g. `event-writer.ts` imports `./manifest-reader.js` directly).
  This avoids `index` → impl → `index` cycles.
- File-local helpers stay unexported. Shared-but-internal helpers are
  exported from their file but omitted from `index.ts` (e.g. `SqliteEdge`,
  `NodeWriter`, `StatusWriter` never leave `packages/events/storage`).
- Existence is enforced in `eslint.config.mjs` by the local `require-facade`
  rule (ancestor walk up to the package root / app `src/` container);
  import targets are enforced via `no-restricted-imports` `regex`
  (gitignore-style `group` cannot express "except `index.js`").
  Reference facade: `packages/events/storage/index.ts`.

## 13. Centralize discriminated-union payloads [NORMATIVE]

Failure unions, safety signals, and similar discriminated unions must not be
constructed with inline discriminant literals at callsites. A repeated
`type:` or `code:` literal drifts, duplicates messages, and hides the domain
decision inside control flow.

Use one pure static factory namespace per union and package. Reference
implementations:

- `WorldFailures` in `packages/worldmodel/src/failures.ts`
- `PerceptionFailures` in `packages/perception/src/failures.ts`
- `SafetySignals` and `SafetyReasons` in `packages/safety/src/signals.ts`

Forbidden:

```ts
return [null, { type: 'INVALID_TIMESTAMP', value: observedAt }];

signals.push({
    code: 'hazard.drowning',
    severity: 'critical',
    message: 'oxygen low underwater',
});
```

Required:

```ts
return [null, WorldFailures.invalidTimestamp(observedAt)];

signals.push(SafetySignals.hazardDrowning());
```

Rules:

- The factory owns the discriminant, fixed severity values, default reasons,
  and repeated message strings. Callsites pass only dynamic data.
- Name factory methods after the domain condition (`invalidTimestamp`,
  `hazardDrowning`), not after the discriminant (`create('INVALID_TIMESTAMP')`).
- Do not introduce a generic `createFailure(type, payload)` helper. It moves
  the literal to the callsite instead of removing it and defeats exhaustiveness.
- Colocate the factory with the union it constructs and export it through the
  package `index.ts`. Static-only namespaces are sanctioned when they hold no
  state and no dependencies (§3).
- Put repeated strings such as `'emergency stop active'` in a named constant
  class (`SafetyReasons`), not in multiple callsites.
- Add colocated factory tests asserting the exact `type`/`code`, severity, and
  message payloads.
- A new union variant requires a union arm, a factory method, and a factory
  test in the same change.
- Inline discriminant literals are allowed only in the union declaration and
  its factory.

This section is about sum types, not state machines. Safety signals and
failures are payloads emitted by guards; `RecoveryLadder` is the actual state
machine. Do not turn failure construction into a generic transition engine.

## 14. Agency code rules [NORMATIVE]

- `packages/agency` stays pure: no `fs`, `node:*`, `bun:*`, mineflayer, SQLite,
  or provider SDKs.
- Agency code emits goals, intentions, and social proposals only. It never
  executes actions.
- Deterministic utility policy is the primary fallback. Laya and the planner are
  advisory.
- Do not put LLM text generation inside the agency control loop.
- Social output is typed, rate-limited, and generated from local templates or a
  policy port, never by echoing arbitrary input.
- Chat adaptation stays thin in `apps/bot`. Conversation classification and
  reply selection belong in `packages/agency`.
- Need, trait, goal, and intention values are bounded and validated at
  construction. Invalid values fail closed with a `Result`.
- Persist agency state through coordinator repositories. Bot processes never
  open SQLite.
- Every goal completion and abandonment records a typed reason and timestamp.

## TiCrafter mapping and exceptions

The rules above are preserved verbatim. This appendix maps foreign references to
this repository and records sanctioned exceptions.

- **Specification names:** `spec.md` maps to `main.md`. `docs.md` maps to
  `docs/architecture/graph.json` plus generated `decomposition.md`.
- **Toolchain:** Bun 1.4.2 is the package manager, runner, test runner, and
  SQLite provider. `bun run …` commands are literal. `bun run format`,
  `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun test`, and
  `bun run validate:graph` are the repository commands.
- **Result module:** `packages/core/result.ts` maps to
  `packages/core/src/kernel/result.ts`. `packages/core/assert.ts` maps to
  `packages/core/src/kernel/assert.ts`.
- **Path aliases:** `@core` maps to `@ticrafter/core`. `@engine`, `@schemas`,
  `@events`, and `@llm` do not exist yet. `apps/server` maps to
  `apps/coordinator`. `apps/web` does not exist yet.
- **Storage edge:** `packages/events/storage` maps to `packages/memory`.
  `packages/memory` is the only package allowed to import `bun:sqlite`.
  `SqliteEdge` maps to `SqliteRuntime`; `StorageFailure` maps to the
  `packages/memory` failure union.
- **Package purity:** `packages/core` must not import `fs`, `node:*`, `bun:*`,
  or provider SDKs. Configuration and transport receive ports from the
  composition root.
- **App entrypoints:** `apps/coordinator/src/main.ts` and
  `apps/bot/src/main.ts` are the bin roots. Every other module directory under
  `apps/*/src` owns `index.ts`.
- **CLI exemption:** `tools/**/*.mjs` are bin scripts. They are exempt from
  OOP, facade, and `Result` requirements, but must follow Prettier, import
  order, and no-comments rules. Exceptions may be caught at the CLI entry
  boundary.
- **Sanctioned free functions:** `attempt`, `attemptAsync`, and `assertNever`
  are the only allowed module-level free functions. Test framework globals
  (`describe`, `it`, `expect`, `beforeEach`, `afterEach`) are exempt.
- **Sanctioned throws:** only `assertNever`. `attempt` and `attemptAsync` may
  contain `try-catch` internally.
- **Composition roots:** `apps/coordinator/src/main.ts`,
  `apps/bot/src/main.ts`, and bootstrap CLI entrypoints may construct
  collaborators.
- **Comments:** Markdown files, generated architecture output, and CLI usage
  text may contain prose. TypeScript and JavaScript code must not contain
  comments.
