# RFC 113 — Fault tree and event tree profiles (`fault.tree@1`, `event.tree@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profiles fault.tree@1/event.tree@1; kinds tree.gate/tree.event; verb tree.input; extension x_gate

## Problem and motivating example

Safety and reliability reviews sketch fault decompositions (a top event
decomposed downward through AND/OR gates into basic events) and
event-sequence trees (an initiating event followed forward through gate
branches to outcomes) (D1). The existing `graph` projection can draw nodes
and links, but nothing expresses the gate/input discipline of these trees.

Motivating example: a synthetic "service outage" fault tree with an OR top
gate `outage` and one AND gate `power_cut` (power cut = UPS failed AND grid
failed), with basic events `ups_failed`, `grid_failed`, `switch_failed`,
`cable_cut`, `operator_error`. Users write
`projection { kind:graph; profile:"fault.tree@1"; }` (or `event.tree@1`).
This is profile-level notation coverage, not a reliability-engineering
certification.

## Proposed syntax

No grammar change (D2, verified: profiles, kinds and verbs are registry
entries; `standard/grammar/ddn.ebnf` is untouched).

- Two new profiles, both bound to the existing projection `kind:graph`:
  - `fault.tree@1` — AND/OR gate decomposition of a top event into basic
    events; tree layout.
  - `event.tree@1` — initiating event followed forward through gate branches
    to outcomes; tree layout.
- Two new profile kinds:
  - `tree.gate` (silhouette `diamond`, fallback `gateway`, family `activity`,
    code `GATE`, glyph `object`).
  - `tree.event` (silhouette `circle`, fallback `object`, family `concept`,
    code `EVENT`, glyph `object`).
- One new profile verb `tree.input` (`name`/`verb` "has input",
  family `control`, code `TREEINPUT`, `start:'none'`, `end:'none'`,
  glyph `link`, source `['tree.gate']`, target `['tree.gate','tree.event']`,
  `allow_self:false`, `member_endpoints:false`).
- One new registered extension property `x_gate` on objects:
  `{ "type":"object", "required":["type"], "properties":{ "type":{ "enum":["and","or"] } }, "additionalProperties":false }`.

Verified correction to the original workplan brief: the gate type is NOT a
plain `gate:` property — a literal plain property parses but produces
`DDN-W106` warnings / `DDN106` in strict mode
(`notation/runtime/ddn-contracts.js`). The gate type is registered as the
extension `x_gate:{type:"and"|"or"}`, using the extension mechanism (enum
supported — the `x_erp` precedent in `standard/registry/extensions.json`).

```ddn
data m {
    object outage "Outage" { kind: "tree.gate"; x_gate: { type: "or" }; }
    object ups_failed "UPS failed" { kind: "tree.event"; }
    relation in1 "has input" @outage -> @ups_failed { kind: "tree.input"; }
}
view fault "Fault tree" {
    data: [@m];
    projection { kind: graph; profile: "fault.tree@1"; }
    layout { algorithm: tree; direction: down; }
}
```

## Semantic normalization and identity effects

A `tree.input` relation points FROM a gate TO one of its inputs — a child
gate or a basic event (D3). A gate's input count is its number of visible
outgoing `tree.input` relations. Layout is the existing `tree` algorithm
with `direction:down` set in the view; both profiles share this machinery
and differ in documented intent only (decomposition vs sequence).

Rejection behavior (D4):

- `DDN-PJ126` (NEW, error) — under either profile, a selected `tree.gate`
  has fewer than 2 visible `tree.input` edges, or lacks a valid
  `x_gate.type`. Malformed `x_gate` values are caught by the schema contract
  (`DDN105`); `DDN-PJ126` covers the count and the missing-property cases.
  The message names the gate, its input count and its declared type.

Verified free before allocation:
`grep -rhoE "DDN-PJ126" notation/ standard/ examples/` prints nothing.

## Visual encoding and routing effects

Gates render as diamond nodes whose text shows the author-written label
(e.g. `AND`/`OR`); v1 keeps the declared type visible via the node name —
no engine relabel (D5). Events render as circle nodes. Edges are plain (no
arrowheads — `start:'none'`, `end:'none'`). No renderer change.

## Alternatives considered

- Encoding gate type in the kind (`tree.and_gate`/`tree.or_gate`) (D6) —
  rejected: the type is data on one concept; the extension contract
  validates it.
- Probability quantification at gates (D6) — rejected: numeric propagation
  is an engineering solver and is explicitly unsupported.

## Compatibility and migration

Additive only (D7): no existing profile, kind, verb, code or capability line
changes meaning. Published profiles are untouched.

## Security, privacy and accessibility

No computation beyond counting visible edges — bounded, pure, no I/O, no
dynamic code. The declared gate type is visible as node text chosen by the
author, so meaning survives monochrome rendering and text extraction; the
diamond/circle silhouettes are an additional, not sole, carrier.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json` — `kinds[]` gains
  `tree.gate`/`tree.event`; `relationships[]` gains `tree.input`;
  `profiles[]` gains `fault.tree@1` and `event.tree@1`.
- `notation/runtime/ddn-profiles.js` `registry()` — extension contract
  `x_gate`; mirrored in `standard/registry/extensions.json` `contracts{}`.
- `notation/runtime/ddn-profile-quality.js` `validate()` — the
  `DDN-PJ126` two-input/declared-type check, guarded by
  `['fault.tree@1','event.tree@1'].includes(profile)`.
- `standard/registry/capabilities.json` — `implemented[]` gains the
  fault/event tree line; `installedProfiles` +2.
- New diagnostic: `DDN-PJ126` (gate with fewer than two inputs or without a
  declared valid type).

## Positive and negative fixtures

- Positive: `examples/basics/53-fault-event-tree.ddn` — fault view renders
  the OR top gate, one AND gate and five event circles top-down, edges
  without arrowheads; event view renders the small second tree under
  `event.tree@1`.
- Negative: gate with exactly one `tree.input` → `DDN-PJ126`; gate with
  zero inputs → `DDN-PJ126`; gate without `x_gate` → `DDN-PJ126`;
  `x_gate:{type:"xor"}` → `DDN105`; `tree.input` with a `tree.event` source
  → endpoint contract failure `DDN102`.

## Implementation/conformance impact

- `notation/runtime/ddn-profiles.js` — `registry()` extension contract for
  `x_gate`.
- `notation/runtime/ddn-profile-quality.js` — `validate()` block for the two
  profiles.
- Suite `notation/tests/fault-event-tree.js` (`test:fault-event-tree`)
  covers the fixtures above plus determinism.
- `npm --prefix notation run build:sdk` rebuilds `notation/dist/`.

## Open questions and decision record

Fixed decisions (recorded, not open): D1 motivation; D2 vocabulary (two
profiles on `graph`, kinds `tree.gate`/`tree.event`, verb `tree.input`,
extension `x_gate`, no grammar change); D3 gate→input edge semantics with
shared tree-layout machinery; D4 rejection behavior (`DDN-PJ126`); D5 visual
encoding (diamond/circle, plain edges, no engine relabel); D6 alternatives
rejected; D7 compatibility (additive only). Probability quantification,
minimal cut-set computation, sequence branching fractions and reliability
certification remain on the profiles' `unsupported` lists.
