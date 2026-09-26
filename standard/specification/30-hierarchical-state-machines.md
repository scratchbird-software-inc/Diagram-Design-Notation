# 30. Hierarchical state machines (profile `state.composite@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-104
(`standard/governance/rfcs/RFC-104-hierarchical-state.md`). Source grammar
remains DDN 0.5; frames and `x_*` properties are existing syntax, so this
chapter is a semantic addition, not a grammar change.

A hierarchical state view extends the flat lifecycle notation
(`state.flat@1`, chapter 23) with composite states and parallel regions on the
existing `graph` projection. A composite state is drawn as a frame containing
substates; a region is a dashed box inside a composite; transitions may cross
composite and region boundaries. Users write
`projection { kind:graph; profile:"state.composite@1"; }`.

This is profile-level coverage, not UML/SCXML conformance.

## Metamodel

- **Composite state** — an ordinary `state.state` object referenced by a view
  `frame`'s `scope`; the frame's `members` are its substates. The composite
  renders as the existing frame box (rect + name).
- **Region** — a view `frame` carrying the pass-through flag `x_region: true`
  whose members are states of one composite. Regions render as the same frame
  box with a dashed border overlay (`stroke-dasharray="6 4"` in the theme rule
  colour).
- **States and transitions** — the existing vocabulary
  (`state.initial`, `state.state`, `state.final`, verb `state.transition`)
  with the existing `x_transition` extension (`event`, optional `guard`).
  Transition labels show `event [guard]` via the engine relabel branch, which
  now also matches this profile.
- No new kinds, verbs, extension properties, or projection kinds.

## Declaration rules

1. Frames are ordinary view declarations; `x_region: true` is an `x_*`
   property and needs no registration (`validateKnown` exempts `x_` keys).
2. Transitions are ordinary `state.transition` relations and MAY cross
   composite/region boundaries — no restriction is added.
3. Each region contains at most one `state.initial`. Violations fail with
   **`DDN-PJ113`** (error): two or more `state.initial` objects are members of
   the same region frame, or of the same composite frame when it has no region
   frames (a composite frame is one whose `scope` resolves to a `state.state`;
   it is exempt when a region frame's members are all among its own). The
   message names the frame and the colliding initials.
4. Trace evaluation (`traces`, and likewise `inputs`/`analysis_budget`)
   remains `state.flat@1`-only: on this profile it is rejected by the existing
   **`DDN-Q005`** guard. This profile does not route into `Quality.lifecycle`,
   whose single-initial and reachability rules (`DDN-QL001`…`QL005`) would
   contradict parallel regions.

## Out of scope

History pseudostates, timers, executable actions, and trace evaluation are
unsupported (recorded in the profile's `unsupported[]`). `state.flat@1` is
unchanged, including its own `unsupported: ["hierarchical/parallel states"]`
entry — published profiles are immutable.

## Example

`website/examples/basics/44-hierarchical-state.ddn` — a synthetic order lifecycle with
top-level states `draft`/`closed`, a composite `fulfillment` containing two
parallel regions (`payment` with `awaiting`/`paid`, `packing` with
`open`/`packed`), per-region initial/final pairs, and a boundary-crossing
transition `paid → closed`.

# 30a. UML state machines (profile `uml.statemachine@1`)

Status: implemented in runtime 0.7.0, governed by RFC-121
(`standard/governance/rfcs/RFC-121-uml-statemachine-completeness.md`).
`state.flat@1` and `state.composite@1` stay installed and immutable; their
fixtures render byte-identically. `uml.statemachine@1` is the full UML 2.5.1
state-machine surface on the same graph projection, composite frames and
region machinery (the per-region initial check DDN-PJ113 applies).

## Activities and internal transitions — `x_state`

`x_state` is now a closed contract: `{ terminal?, entry?, exit?, do?,
internal?: [string], submachine?: @ref }` (`DDN105` on unknown keys). A
`state.state` carrying activities, internal transitions or a submachine
binding renders as a rounded rectangle with a name header and compartment
lines (`entry / …`, `exit / …`, `do / …`, internal transitions verbatim,
`«submachine» name`). Owner and reference rules are `DDN-PJ160`: `x_state`
applies to state kinds only; `submachine` must reference a distinct
`state.state`. Activity text is display text, never executed.

## Pseudostates

Eight new kinds with dedicated glyphs: `state.history_shallow` (H),
`state.history_deep` (H*), `state.junction` (filled dot), `state.choice`
(diamond), `state.entrypoint` (border ring), `state.exitpoint` (ring with ✕),
`state.forkjoin` (synchronization bar), `state.terminate` (✕). The
`state.transition` endpoint contract admits them (widened additively; other
kinds still fail `DDN102`). On the state profiles the endpoint rules are
`DDN-PJ161`: terminate has no outgoing transitions (also caught by DDN102),
choice fans out to at least two, junction is a pass-through, and history /
entry / exit points must be members of a composite-state frame.

## Transition syntax — `x_transition`

Closed contract `{ event?, guard?: object|string, effect?, actions? }`. The
label is `trigger [guard] / effect`: string guards render verbatim, object
guards keep the lifecycle predicate rendering, and the effect follows the
slash. Time and change events are ordinary triggers in `after(…)`, `at(…)`,
`when(…)` form; a malformed lookalike is `DDN-PJ162`. Trace evaluation
(`traces`, `inputs`, `analysis_budget`) remains `state.flat@1`-only
(`DDN-Q005`): the lifecycle simulation rules cannot model pseudostates or
parallel regions.

Fixture: `website/examples/basics/77-uml-statemachine-complete.ddn` (two
views), tests in `notation/tests/statemachine-compliance.js`. Out of scope,
declared in the profile: executable actions/behaviors, SCXML exchange, formal
OMG conformance.
