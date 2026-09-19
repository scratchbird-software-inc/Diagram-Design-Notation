# RFC 104 — Hierarchical state machine profile (`state.composite@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile state.composite@1; no new kinds/verbs

## Problem and motivating example

Flat lifecycle diagrams (`state.flat@1`) show one level of states with a single
initial state. They cannot express "an order is in fulfilment, which itself
contains payment and packing tracks that proceed in parallel." Users need a
composite state drawn as a frame containing substates, and parallel regions
drawn as dashed boxes inside the composite, with transitions allowed to cross
composite boundaries (D1).

Motivating example: a synthetic order lifecycle with top-level states `draft`
and `closed`, plus a composite state `fulfillment` (an ordinary `state.state`
referenced by a view frame's `scope`) whose members are the substates of two
parallel regions — `payment` (with `awaiting`/`paid`) and `packing` (with
`open`/`packed`). Each region has its own `state.initial` and `state.final`;
one transition crosses the composite boundary from `paid` to top-level
`closed`.

## Proposed syntax

No grammar change. Frames are existing view-level declarations
(`frame id "LABEL" { members:[@…]; scope:@ref; }`, compiled into
`ir.view.frames` by `ddn-core.js`), and `x_region` is an `x_*` property, which
`validateKnown` exempts from the frame property allowlist
(`ddn-core.js`). Verified: `standard/grammar/ddn.ebnf` untouched (D2).

- New profile `state.composite@1` bound to the existing projection
  `kind:graph`. No new projection kind: a hierarchical state view is a
  graph-shaped view.
- **Composite state** = an ordinary `state.state` object referenced by a view
  `frame`'s `scope`; the frame's `members` are its substates.
- **Region** = a view `frame` carrying the pass-through flag `x_region: true`
  whose members are states of one composite.
- **Transitions** = ordinary `state.transition` relations with
  `x_transition: { event: "…", guard: {…} }`, reusing the existing extension
  contract registered in `ddn-profiles.js` / `extensions.json`. No new kinds,
  verbs, or extension properties.

```ddn
view lifecycle "Order lifecycle" {
    data: [@m.order];
    projection { kind: graph; profile: "state.composite@1"; }
    frame fulfillment "Fulfillment" { scope: @m.order.fulfillment;
        members: [@m.order.awaiting, @m.order.paid, @m.order.open, @m.order.packed]; }
    frame payment "PAYMENT" { x_region: true;
        members: [@m.order.payment_initial, @m.order.awaiting, @m.order.paid, @m.order.payment_final]; }
    frame packing "PACKING" { x_region: true;
        members: [@m.order.packing_initial, @m.order.open, @m.order.packed, @m.order.packing_final]; }
}
```

## Semantic normalization and identity effects

None beyond resolution. Composites, regions, states and transitions are
ordinary elements/relations plus view frames; identities are untouched. Frames
compile to `ir.view.frames` entries `{id, name, scope, members, …}` with extra
properties (including `x_region`) passed through `clean()`
(`ddn-core.js`).

Transition semantics (D3): transitions are ordinary `state.transition`
relations and MAY cross composite/region boundaries — no restriction is added.
Each region contains at most one `state.initial` (enforced as a diagnostic,
below). Trace evaluation (`traces` projection property) remains
`state.flat@1`-only: for `state.composite@1` it is rejected automatically by
the existing `DDN-Q005` guard in `ddn-projection-data.js`
(`if(kind==='graph'&&['inputs','analysis_budget','traces'].some(k=>p[k]!==undefined))fail('DDN-Q005',…)`
— verified: the lifecycle branch matches `state.flat@1` exactly, so
`state.composite@1` falls through to the plain graph plan and never routes
into `Quality.lifecycle`, whose single-initial rule would contradict regions).

Rejection behavior (D4): new error `DDN-PJ113` — two or more `state.initial`
objects are members of the same region frame (`x_region: true`), or of the
same composite frame when it has no region frames. The message names the frame
and the colliding initials.

## Visual encoding and routing effects

- Composite: existing frame rendering (rect + name) — no change.
- Region: the same frame box with a DASHED border overlay
  (`<rect … fill="none" stroke="<theme rule>" stroke-dasharray="6 4"/>`),
  added in the frame loop of `ddn-render.js` when `f.x_region === true`.
- Transition labels show `event [guard]` via the existing engine relabel
  branch in `ddn-engine.js`, extended from `state.flat@1` only to also match
  `state.composite@1` (D5).

Layout and routing are otherwise the graph renderer's existing behavior.

## Alternatives considered

- **Dedicated composite/region kinds** (`state.composite`, `state.region`) —
  rejected (D6): frames already provide grouping and rendering; new kinds
  would duplicate view machinery.
- **Routing `state.composite@1` through `Quality.lifecycle`** — rejected (D6):
  its single-initial rule contradicts parallel regions, each of which carries
  its own initial state.
- **A new projection kind `state`** — rejected: the view is graph-shaped; the
  graph projection and its layouts already express it.

## Compatibility and migration

Purely additive (D7). `state.flat@1` behavior is byte-identical: its catalogue
entry (including the `unsupported: ["hierarchical/parallel states"]` line) is
untouched — published profiles are immutable. No existing kind, verb, profile,
or property is edited. Sources that do not use `state.composite@1` or
`x_region` are unaffected.

## Security, privacy and accessibility

No new inputs: composites, regions, states, transitions and frames are
already-declared model/view data. Region overlay rects carry no text; labels
are escaped through the shared `esc()` helper like every other label. The
diagram makes no conformance claim: this is profile-level coverage, not
UML/SCXML conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `profiles[]` entry
  `state.composite@1` (projection `graph`). Additive only.
- `notation/runtime/ddn-engine.js`: the `x_transition` relabel branch matches
  `['state.flat@1','state.composite@1']`.
- `notation/runtime/ddn-render.js`: dashed region overlay in the frame loop.
- `notation/runtime/ddn-profile-quality.js`: new `state.composite@1` block
  implementing `DDN-PJ113` (two or more `state.initial` members in one region
  frame, or in one region-less composite frame). Message names the frame and
  the colliding initials.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `state.composite@1` entry (list mirrors the
  profile catalogue).
- Existing codes unchanged: `DDN-Q005` still rejects `traces`/`inputs`/
  `analysis_budget` on non-`state.flat@1` profiles; `DDN-QL001`…`QL005` remain
  `state.flat@1`-only.
- New error code verified free: `DDN-PJ113` appears nowhere in `notation/`,
  `standard/`, or `examples/` (highest pre-existing: PJ112, PJW03).

## Positive and negative fixtures

- Positive example: `examples/basics/44-hierarchical-state.ddn` — synthetic
  order lifecycle with composite `fulfillment`, two dashed regions
  (`payment`, `packing`), per-region initial/final states, and a
  boundary-crossing transition `paid → closed`.
- Test suite: `notation/tests/hierarchical-state.js` — positive render with
  composite frame, two `stroke-dasharray` region overlays and event labels;
  boundary-crossing transition; `DDN-PJ113` for two initials in one region and
  in a region-less composite; `DDN-Q005` on `traces`; `state.flat@1`
  regression; byte-identical determinism.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entry, `ddn-engine.js`,
`ddn-render.js`, `ddn-profile-quality.js`, `capabilities.json`, example 44,
test suite, spec chapter `30-hierarchical-state-machines.md`. The grammar
(`standard/grammar/ddn.ebnf`) is untouched; `state.flat@1` rendering and
validation paths are untouched.

This is profile-level coverage, not UML/SCXML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (frames + `x_region`, no new kinds/verbs), D3
  semantics (boundary-crossing transitions; flat-only traces), D4 rejection
  behavior (`DDN-PJ113`), D5 visual encoding (dashed region overlay, extended
  relabel branch), D6 alternatives, D7 compatibility: recorded above as fixed
  decisions of this RFC.
- Open: history pseudostates, timers, and executable actions remain
  unsupported; a later RFC may add them under a new profile version.
