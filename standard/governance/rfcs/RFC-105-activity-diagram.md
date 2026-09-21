# RFC 105 — Activity diagram profile with partitions (`uml.activity@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile uml.activity@1; kinds flow.forkjoin/flow.objectnode; verb uml.flow; extension x_partition

## Problem and motivating example

Flowcharts (`flow.basic@1`) express one thread of control: they lack parallel
flows and lane responsibility. Users need an activity-style flow view on the
existing `graph` projection with swimlane partitions, fork/join bars, and
object nodes alongside the familiar flow symbols (D1).

Motivating example: a synthetic order-fulfilment activity with `webshop` and
`warehouse` lanes. A `flow.forkjoin` fork splits the flow into `pick_items`,
`take_payment`, and an `order` object node; a matching join reunites them
before `end`. Each node declares its lane, and the lanes render as view frames.

## Proposed syntax

No grammar change. Kinds and verbs are registry entries, and `x_partition` is
an `x_*` property, which `validateKnown` exempts from the property allowlist
(`ddn-core.js`). Verified: `standard/grammar/ddn.ebnf` untouched (D2).

- New profile `uml.activity@1` bound to the existing projection `kind:graph`.
- New profile kinds:
  - `flow.forkjoin` — silhouette `rect`, fallback `activity`, family
    `activity`, code `FORKJOIN`, glyph `object`, aliases `[]`.
  - `flow.objectnode` — silhouette `rect`, fallback `record`, family `data`,
    code `OBJNODE`, glyph `object`, aliases `[]`.
- New profile verb `uml.flow` — name/verb "Activity edge", family `control`,
  code `FLOW`, start `none`, end `filled`, glyph `link`,
  source/target `['flow.start','flow.end','flow.process','flow.decision','flow.io','flow.forkjoin','flow.objectnode']`,
  `allow_self:false`, `member_endpoints:false`. `flow.next`'s published
  endpoint list is NOT edited (additive-only registry rule).
- New registered extension property `x_partition` on objects:
  `{ "type":"object", "required":["lane"], "properties":{ "lane":{ "type":"string", "minLength":1 } }, "additionalProperties":false }`.

**Verified correction 1 — lanes as frames.** There is NO general
lane/partition machinery in the graph renderer (`grep -n "lane\|partition"
notation/runtime/ddn-layout.js` finds only connector-routing lanes). The
`"separate parallel lanes"` line in `capabilities.json` `implemented[]`
belongs to the experimental `session-bootstrap@0.1` interaction profile
(`ddn-interaction.js`, fixed participant lanes). Partitions are therefore
implemented as VIEW FRAMES (verified machinery) plus a declared lane property
on nodes: one `frame` per partition, and a node joins a lane via
`x_partition:{lane:"<frame id or name>"}`.

**Verified correction 2 — `x_partition`, not `lane`.** A plain non-`x_`
property such as `lane:"warehouse"` parses but produces `DDN-W106` warnings /
`DDN106` in strict mode (`ddn-contracts.js`; `validateKnown` in `ddn-core.js`
exempts only `x_*`). The lane membership property is therefore registered as
the extension `x_partition`.

```ddn
view fulfilment "Order fulfilment activity" {
    data: [@order]; 
    projection { kind: graph; profile: "uml.activity@1"; }
    frame webshop "Webshop" { members: [@order.start, @order.take_payment, @order.end]; }
    frame warehouse "Warehouse" { members: [@order.fork, @order.pick_items, @order.order_obj, @order.join]; }
}
```

## Semantic normalization and identity effects

None beyond resolution (D3). Nodes are the listed `flow.*` kinds; edges are
`uml.flow`; partitions are view frames compiled to `ir.view.frames` entries
`{id, name, scope, members, …}` (`ddn-core.js`). A node joins a lane via
`x_partition:{lane:"<frame id or name>"}`; the lane name matches a frame's
`id` or `name`. Fork/join bars are `flow.forkjoin` nodes distinguished by
degree: ≥2 outgoing `uml.flow` edges = fork, ≥2 incoming = join. Identities
are untouched.

Rejection behavior (D4):

- `DDN-PJ114` (NEW, error) — a node carries `x_partition.lane` naming no frame
  of the view (matched against `ir.view.frames` `id` or `name`). The message
  names node and lane.
- `DDN-PJ115` (NEW, error) — fork/join imbalance: the count of `flow.forkjoin`
  nodes with ≥2 visible outgoing `uml.flow` edges differs from the count with
  ≥2 visible incoming edges (v1 structural check: counts must match). The
  message reports both counts.
- Kind-mixing (a selected node outside the `flow.*` activity set, or a visible
  relation that is not `uml.flow`) is rejected with the existing `DDN-PF007`
  code by extending that check's guard in `ddn-profiles.js` to include
  `uml.activity@1` with the allowed set updated accordingly (the flowchart
  block's start/end and reachability rules apply, with `uml.flow` as the
  control edge kind).

Codes verified free: `grep -rhoE "DDN-PJ11(4|5)" notation/ standard/ website/examples/`
prints nothing (RT-101…104 took PJ110–PJ113 + PJW03).

## Visual encoding and routing effects

Lanes render as ordinary frame boxes with their names (existing frame
rendering in `ddn-render.js`); fork/join bars render as thin rect nodes and
object nodes as plain rect nodes via the profile silhouettes. No renderer
change (D5). Layout and routing are the graph renderer's existing,
deterministic behavior.

## Alternatives considered

- **Editing `flow.next`'s endpoint contract** to accept the new kinds —
  rejected (D6): published profile entries are immutable; a new verb
  `uml.flow` is registered instead.
- **Reusing the interaction profile's lanes** — rejected (D6): those are
  fixed-lane protocol semantics of `session-bootstrap@0.1`, not a general
  partition mechanism (see Verified correction 1).
- **Geometry-derived partitions** — rejected (D6): lane membership is
  declared (`x_partition` + frame members), not inferred from coordinates.

## Compatibility and migration

Purely additive (D7). `flow.basic@1`/`flow.documented@2` are untouched; no
existing kind, verb, profile, or property is edited. Sources that do not use
`uml.activity@1`, the new kinds, `uml.flow`, or `x_partition` are unaffected.

## Security, privacy and accessibility

No new inputs: nodes, edges, frames and lane membership are already-declared
model/view data. Labels are escaped through the shared `esc()` helper like
every other label. The diagram makes no conformance claim: this is
profile-level coverage, not UML conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `kinds[]` entries
  `flow.forkjoin`/`flow.objectnode`, new `relationships[]` entry `uml.flow`,
  new `profiles[]` entry `uml.activity@1`. Additive only.
- `notation/runtime/ddn-profiles.js` `registry()`: new
  `extension_contracts.x_partition` on objects; `validate()`: the
  `DDN-PF007` flowchart vocabulary guard extended to `uml.activity@1`
  (allowed kinds `flow.*`, visible relations `uml.flow` only, `uml.flow` as
  the control edge for the start/end/reachability rules).
- `standard/registry/extensions.json` `contracts{}`: mirror of `x_partition`.
- `notation/runtime/ddn-profile-quality.js` `validate()`: new
  `uml.activity@1` block implementing `DDN-PJ114`/`DDN-PJ115` (mirroring the
  `flow.documented@2` block's style).
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.activity@1` entry (list mirrors the
  profile catalogue).

## Positive and negative fixtures

- Positive example: `website/examples/basics/45-activity-diagram.ddn` — synthetic
  order-fulfilment activity with `webshop`/`warehouse` lane frames, one
  fork/join pair around `pick_items`/`take_payment`, and an `order` object
  node.
- Test suite: `notation/tests/activity-diagram.js` — positive render with
  both lane frames and the fork/join bars; frame membership via
  `x_partition`; `DDN-PJ114` for an unknown lane; `DDN-PJ115` for an
  unbalanced fork/join (counts asserted in the message); `DDN-PF007` for a
  `flow.next` relation inside this profile; `DDN105` for malformed
  `x_partition`; byte-identical determinism.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entries, `ddn-profiles.js`,
`extensions.json`, `ddn-profile-quality.js`, `capabilities.json`, example 45,
test suite, spec chapter `31-activity-diagrams.md`. The grammar
(`standard/grammar/ddn.ebnf`) is untouched; existing profiles' rendering and
validation paths are untouched.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (profile `uml.activity@1`; kinds
  `flow.forkjoin`/`flow.objectnode`; verb `uml.flow`; extension
  `x_partition`), D3 semantics (partitions as view frames; fork/join by
  degree), D4 rejection behavior (`DDN-PJ114`/`DDN-PJ115`, `DDN-PF007`
  vocabulary), D5 visual encoding (frames + silhouettes, no renderer change),
  D6 alternatives, D7 compatibility: recorded above as fixed decisions of
  this RFC, including the two verified corrections (lanes-as-frames,
  `x_partition`).
- Open: interruptible regions, pins and parameter sets, and object-flow
  typing remain unsupported; a later RFC may add them under a new profile
  version.
