# 38. PERT/CPM critical-path profile (`pert.cpm@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-112
(`standard/governance/rfcs/RFC-112-pert-cpm.md`). Source grammar remains DDN
0.5; the profile, the reused vocabulary and the extension property are
registry entries, so this chapter is a semantic addition, not a grammar
change.

A PERT/CPM view models a project plan as tasks with declared day estimates
and finish-before dependencies on the existing `graph` projection; the
planner computes the forward pass (ES/EF) and backward pass (LS/LF) on the
dependency DAG, and the zero-slack critical path is drawn with the theme
accent stroke. Users write
`projection { kind:graph; profile:"pert.cpm@1"; }`.

## Metamodel

- Tasks are shown `analysis.task` objects (existing kind; silhouette
  `round`, family `activity`). No new kinds.
- Dependencies are visible `analysis.precedes` relations ("Must finish
  before"). No new verbs.
- New registered extension property `x_estimate` on objects:
  `{ "type":"number" }` — task duration in days; finite and ≥ 0. The schema
  subset declares only the number type; the finite/nonnegative range is
  enforced by the planner (`DDN-PJ125`), not the schema.
- No new projection properties; the graph `supported` list is unchanged and
  the `DDN-Q005` guard still rejects `inputs`/`analysis_budget`/`traces` for
  non-`state.flat@1` graph profiles.

## Pass and slack computation

The planner (`Quality.cpm` in `notation/runtime/ddn-quality-data.js`, reached
through the `pert.cpm@1` branch of `ddn-projection-data.js` `plan()`)
computes, deterministically and on plain numbers (no dates, no calendars):

- Forward pass in topological order: `ES = max(EF` of predecessors, default
  0), `EF = ES + x_estimate`; project duration = max `EF`.
- Backward pass in reverse topological order: `LF = min(LS` of successors,
  default duration), `LS = LF - x_estimate`.
- `slack = LS - ES`; critical tasks have `slack === 0`.
- An `analysis.precedes` relation is critical when both endpoints are
  critical and `EF(source) === ES(target)`.
- Topological order uses the active/seen DFS pattern of `acyclic` in
  `ddn-profiles.js`; iteration follows declaration order, so results are
  deterministic.

The plan returns
`{tasks:{id→{es,ef,ls,lf,slack,estimate}},criticalTasks:[ids],criticalRelations:[ids],duration}`
— `tasks` is a plain record keyed by task id so the plan survives the
JSON-cloned public API (`workspace.projectionPlan`).

## Diagnostics

- `DDN-PJ124` (error) — the task/dependency graph contains a cycle; the
  message names a task on the cycle.
- `DDN-PJ125` (error) — a shown `analysis.task` lacks `x_estimate`, or it is
  not a finite number ≥ 0; the message names the task.

## Visual encoding

Ordinary graph rendering. Before render, the engine (`ddn-engine.js`) clones
the resolved IR, sets `properties.x_critical=true` on each critical relation
and suffixes each task's display name with ` (<estimate>d, slack <n>d)`. The
renderer (`ddn-render.js`, beside the `x_chen_total` overlay) re-strokes
`x_critical` route pieces with `stroke:t.accent` and `stroke-width:3·s`
(s = font-size scale), so the critical chain reads as an accent-coloured
overlay on top of the ordinary relation stroke. Task names carry the numeric
estimate and slack, so the information does not depend on colour alone.

## Capabilities clause change

This profile removes one clause from
`standard/registry/capabilities.json` `unsupported[]`:

- before: `"critical-path scheduling, arbitrary/DMN-FEEL rule execution and
  engineering solvers"`
- after: `"arbitrary/DMN-FEEL rule execution and engineering solvers"`

Only the `"critical-path scheduling, "` clause is removed; the DMN-FEEL and
solver limitations remain true. The array length is unchanged (the line is
edited, not removed). Separately, `timeline.basic@1`'s own profile
`unsupported` list contains `"critical-path computation"` — that entry is
immutable and unchanged (published profiles are never edited,
`standard/governance/VERSIONING.md`); it remains true that the TIMELINE
profile does not compute critical paths. The new capability lives on the
graph profile `pert.cpm@1`.

The profile's own `unsupported` list keeps resource leveling,
calendar-aware scheduling and probabilistic (three-point) estimation out of
scope.
