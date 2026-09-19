# 30. Hierarchical state machines (profile `state.composite@1` on projection `graph`)

Status: implemented in runtime 0.5.0-draft.2, governed by RFC-104
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

`examples/basics/44-hierarchical-state.ddn` — a synthetic order lifecycle with
top-level states `draft`/`closed`, a composite `fulfillment` containing two
parallel regions (`payment` with `awaiting`/`paid`, `packing` with
`open`/`packed`), per-region initial/final pairs, and a boundary-crossing
transition `paid → closed`.
