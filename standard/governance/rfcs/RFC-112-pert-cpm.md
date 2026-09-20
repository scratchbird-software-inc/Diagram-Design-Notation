# RFC 112 — PERT/CPM critical-path profile (`pert.cpm@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile pert.cpm@1; extension x_estimate; capabilities.json unsupported[] clause removal (critical-path scheduling)

## Problem and motivating example

Project plans need the computed critical path, not just drawn dependencies
(D1). The existing `graph` projection can draw tasks and finish-before links
(`analysis.task`, `analysis.precedes`), but nothing computes which chain of
tasks actually determines the delivery date, so the most decision-relevant
fact in a plan is left to the reader's eyeballing.

Motivating example: a synthetic release plan where the
design→build→integrate→test chain determines the ship date — `design` (3d)
precedes `build_api` (4d) and `build_ui` (5d), both precede `integrate` (2d),
then `test` (2d), then `ship` (1d). The computed critical chain is
design→build_ui→integrate→test→ship (13 days); `build_api` carries 1 day of
slack. Users write `projection { kind:graph; profile:"pert.cpm@1"; }`.

## Proposed syntax

No grammar change (D2, verified: profiles, kinds and verbs are registry
entries built by `notation/runtime/ddn-profiles.js` `registry()` from
`standard/registry/profiles/catalogue.json`; `standard/grammar/ddn.ebnf` is
untouched). No new kinds or verbs; no new projection properties.

- New profile, bound to the existing projection `kind:graph`:
  - `pert.cpm@1` — tasks with declared day estimates and finish-before
    dependencies; computed forward/backward pass; zero-slack critical path
    accented.
- New registered extension property:
  - `x_estimate` on objects — `{ "type":"number" }`; task duration in days,
    finite, ≥ 0 (the range is enforced by the planner, not the schema
    subset).
- Tasks are `analysis.task` objects; dependencies are visible
  `analysis.precedes` relations ("Must finish before").

```ddn
data m {
    object design "Design" { kind: "analysis.task"; x_estimate: 3; }
    object build_ui "Build UI" { kind: "analysis.task"; x_estimate: 5; }
    relation d_b "before" @design -> @build_ui { kind: "analysis.precedes"; }
}
view plan "Release plan" {
    data: [@m];
    projection { kind: graph; profile: "pert.cpm@1"; }
}
```

## Semantic normalization and identity effects

The planner computes the schedule over shown `analysis.task` objects and
visible `analysis.precedes` edges (D3), deterministically, on plain numbers —
no dates, no calendars:

- Forward pass: `ES = max(EF` of predecessors, default 0),
  `EF = ES + x_estimate`; project duration = max `EF`.
- Backward pass: `LF = min(LS` of successors, default duration),
  `LS = LF - x_estimate`.
- `slack = LS - ES`; critical tasks have `slack === 0`.
- An `analysis.precedes` relation is critical when both endpoints are
  critical and `EF(source) === ES(target)`.
- Longest-path ordering via topological order (the active/seen DFS pattern
  used by `acyclic` in `ddn-profiles.js`).

Rejection behavior (D4):

- `DDN-PJ124` (error) — the task/dependency graph contains a cycle; the
  message names a task on the cycle.
- `DDN-PJ125` (error) — a shown `analysis.task` lacks `x_estimate`, or it is
  not a finite number ≥ 0; the message names the task.

The plan exposes
`{tasks:{id→{es,ef,ls,lf,slack,estimate}},criticalTasks:[ids],criticalRelations:[ids],duration}`
(tasks is a plain record keyed by task id so the plan survives the
JSON-cloned public API) so the same numbers drive the drawing and any
downstream inspection. No
source identity changes: the computation reads the resolved model and never
rewrites it.

## Visual encoding and routing effects

Ordinary graph rendering (D5). Before render, the engine clones the resolved
IR, marks each critical relation `properties.x_critical=true`, and suffixes
each task's display name with ` (<estimate>d, slack <n>d)`. The renderer
draws an accent-colour overlay (`t.accent`, width 3·s) on `x_critical`
routes, mirroring the `x_chen_total` total-participation overlay precedent in
`ddn-render.js`. Routing is unchanged; the overlay re-strokes the same route
pieces.

## Alternatives considered

- Computing in the renderer (D6) — rejected: plans are computed once, in the
  planner, like `lifecycle`; the renderer must stay a pure function of its
  input.
- Calendar/working-day scheduling (D6) — rejected: abstract day numbers
  only; calendar-aware scheduling stays on the profile's `unsupported` list.
- Editing the timeline profile (D6) — rejected: published profiles are
  immutable (`standard/governance/VERSIONING.md`).

## Compatibility and migration

Additive except one documented registry line (D7): no existing profile,
kind, verb or code changes meaning.

This change removes the clause 'critical-path scheduling' from
`standard/registry/capabilities.json` `unsupported[]` (the remainder of the
line — DMN-FEEL rule execution and engineering solvers — stays);
`timeline.basic@1.unsupported` is immutable and unchanged. It remains true
that the TIMELINE profile does not compute critical paths; the new
capability lives on the graph profile `pert.cpm@1`.

## Security, privacy and accessibility

The computation is bounded (one DFS per node set, linear edge scans) and
pure — no dynamic code, no loaders, no I/O. The critical-path accent is a
stroke overlay in addition to the ordinary relation stroke, not the sole
carrier of meaning: task names also carry the numeric estimate and slack, so
the information survives monochrome rendering, text extraction and screen
readers.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json` — one new `profiles[]` entry
  `pert.cpm@1` (projection `graph`).
- `standard/registry/extensions.json` — new `contracts{}` entry
  `x_estimate`: `{ "type":"number" }` on target `object`.
- `standard/registry/capabilities.json` — `unsupported[]` line edited per
  Compatibility above; `implemented[]` gains the PERT/CPM line;
  `installedProfiles` count +1.
- New diagnostics: `DDN-PJ124` (dependency cycle), `DDN-PJ125` (missing or
  invalid `x_estimate`). Verified free:
  `grep -rhoE "DDN-PJ12(4|5)" notation/ standard/ examples/` prints nothing.

## Positive and negative fixtures

- Positive: `examples/basics/52-pert-cpm.ddn` — six tasks; critical chain
  design→build_ui→integrate→test→ship (13d) accent-stroked; `build_api`
  shows 1d slack and its edges are not accented.
- Negative: dependency cycle `a→b→a` → `DDN-PJ124`; task without
  `x_estimate` → `DDN-PJ125`; task with `x_estimate:-1` → `DDN-PJ125`;
  `traces:[…]` on this profile → `DDN-Q005` (existing guard intact).

## Implementation/conformance impact

- `notation/runtime/ddn-quality-data.js` — new `Quality.cpm(ir,ErrorClass)`
  beside `lifecycle`.
- `notation/runtime/ddn-projection-data.js` — planner branch for
  `pert.cpm@1` beside the `state.flat@1` branch.
- `notation/runtime/ddn-engine.js` — `pert.cpm@1` branch that obtains the
  plan, clones the IR, sets `x_critical` and suffixes task names (D5).
- `notation/runtime/ddn-render.js` — accent overlay for `x_critical` routes
  beside the `x_chen_total` overlay.
- `notation/runtime/ddn-profiles.js` — `registry()` extension contract for
  `x_estimate`.
- Suite `notation/tests/pert-cpm.js` (`test:pert-cpm`) covers the fixtures
  above plus computed-value assertions, capabilities bookkeeping and
  determinism.

## Open questions and decision record

Fixed decisions (recorded, not open): D1 motivation and capabilities clause
removal; D2 vocabulary (profile `pert.cpm@1`, extension `x_estimate`, reuse
of `analysis.task`/`analysis.precedes`); D3 deterministic pass computation;
D4 rejection behavior (`DDN-PJ124`/`DDN-PJ125`); D5 visual encoding
(accent overlay + name suffix); D6 alternatives rejected; D7 compatibility
(additive except the single documented capabilities clause). Resource
leveling, calendar-aware scheduling and probabilistic (three-point)
estimation remain on the profile's `unsupported` list.
