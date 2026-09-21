# RFC 106 — BPMN-style process collaboration profile (`bpmn.basic@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile bpmn.basic@1; kind flow.gateway; verb bpmn.messageflow; extensions x_event/x_gateway

## Problem and motivating example

Process documentation frequently needs two collaborating parties with explicit
message exchange between them (D1). Flowcharts (`flow.basic@1`) cover one
thread of control and activity views (`uml.activity@1`, RFC-105) add lanes and
fork/join, but neither models two independent pools exchanging messages.

Motivating example: a synthetic buyer pool and a synthetic seller pool. The
buyer starts, runs a `request_quote` process, reaches an exclusive gateway and
ends (possibly with an error event); the seller starts on a message, runs
`prepare_quote`, and ends with a message event. One dashed message flow links
`request_quote` to `prepare_quote` across the two pools.

## Proposed syntax

No grammar change. Kinds and verbs are registry entries, pools/lanes are
existing view frames with pass-through `x_*` properties, and event/gateway
typing is via registered `x_*` extensions, which `validateKnown` exempts from
the property allowlist (`ddn-core.js`). Verified: `standard/grammar/ddn.ebnf`
untouched (D2).

- New profile `bpmn.basic@1` bound to the existing projection `kind:graph`.
- New profile kind `flow.gateway` — silhouette `diamond`, fallback `activity`,
  family `activity`, code `GATEWAY`, glyph `object`, aliases `[]`.
- New profile verb `bpmn.messageflow` — name/verb "Message flow",
  family `control`, code `MSGFLOW`, `pattern:'6 4'`, start `none`, end `open`,
  glyph `link`,
  source/target `['flow.start','flow.end','flow.process','flow.subprocess','flow.gateway','analysis.task']`,
  `allow_self:false`, `member_endpoints:false`.
- New registered extension properties on objects:
  - `x_event` (applied to `flow.start`/`flow.end`):
    `{ "type":"object", "required":["type"], "properties":{ "type":{ "enum":["none","message","timer","error"] } }, "additionalProperties":false }`.
  - `x_gateway` (applied to `flow.gateway`):
    `{ "type":"object", "required":["type"], "properties":{ "type":{ "enum":["exclusive","parallel","inclusive"] } }, "additionalProperties":false }`.
- Pools and lanes: a pool is a view `frame` with `x_pool:true`; a lane is a
  view `frame` with `x_lane:true` whose members are also members of one pool
  frame. Frame declarations accept `x_*` properties, which survive into
  `ir.view.frames` (verified: `validateKnown` exempts `x_`, `ddn-core.js`;
  the frame build spreads `clean(n.props)` into the frame entry).

**Verified correction — `x_event`/`x_gateway`, not plain properties.** Plain
non-`x_` properties such as `event:…`/`gateway:…` parse but produce `DDN-W106`
warnings / `DDN106` in strict mode (`ddn-contracts.js`; `validateKnown` in
`ddn-core.js` exempts only `x_*`). Event and gateway typing are therefore
registered as the extensions `x_event` and `x_gateway` (same mechanism as
RT-101/103/105; contracts in `notation/runtime/ddn-profiles.js` `registry()`
plus the `standard/registry/extensions.json` mirror). A JSON-schema `enum` is
inside the supported contract subset (used by `x_erp` in
`standard/registry/extensions.json` — verified).

```ddn
view collaboration "Buyer / seller collaboration" {
    data: [@quote];
    projection { kind: graph; profile: "bpmn.basic@1"; }
    frame buyer "Buyer" { x_pool: true; members: [@quote.start, @quote.request_quote, @quote.decide, @quote.failed]; }
    frame seller "Seller" { x_pool: true; members: [@quote.receive, @quote.prepare_quote, @quote.sent]; }
}
```

## Semantic normalization and identity effects

None beyond resolution (D3). Sequence flow inside a pool is RFC-105's
`uml.flow` verb — no new sequence-flow verb is registered. Pools and lanes are
view frames compiled to `ir.view.frames` entries carrying `x_pool:true` /
`x_lane:true`; lane nesting is expressed by membership (the lane's members are
also members of one pool frame), not by a frame hierarchy. Events are
`flow.start`/`flow.end` nodes carrying `x_event`; gateways are `flow.gateway`
nodes carrying `x_gateway`; message flow is the `bpmn.messageflow` verb,
allowed only ACROSS pools. Identities are untouched.

Rejection behavior (D4):

- `DDN-PJ116` (NEW, error) — a visible `bpmn.messageflow` whose endpoints are
  both members of the same `x_pool` frame, or both outside every pool. The
  message names the relation and the pool.
- `DDN-PJ117` (NEW, error) — a selected `flow.gateway` lacks a valid
  `x_gateway.type` (malformed values are already caught by the schema contract
  `DDN105`; this code covers the missing-property case and any residual
  invalid value). The message names the gateway.

Codes verified free: `grep -rhoE "DDN-PJ11(6|7)" notation/ standard/ website/examples/`
prints nothing (RT-101…105 took PJ110–PJ115 + PJW03).

## Visual encoding and routing effects

Message flow renders dashed with an open arrow via the relationship registry
entry: registry relationships carry a `pattern` field which `ddn-render.js`
applies as `stroke-dasharray` (verified: `uml.realization` uses `'7 5'`);
`bpmn.messageflow` declares `pattern:'6 4'`, `end:'open'` — no renderer change
(D5). Gateways render as diamonds (existing `diamond` silhouette) with a
single-letter type marker prefixed to the node name by an engine relabel
branch in `ddn-engine.js` (the same mechanism `state.flat@1` uses to relabel
transitions): `X ` exclusive, `+ ` parallel, `O ` inclusive. Events keep the
`flow.start`/`flow.end` silhouettes with the event type shown in the node
text. Pools and lanes render as ordinary frame boxes. Layout and routing are
the graph renderer's existing, deterministic behavior.

## Alternatives considered

- **BPMN XML import/export** — rejected (D6): out of scope; external
  interchange is listed unsupported in `capabilities.json`.
- **Geometry-based pool membership** — rejected (D6): membership is declared
  (frame `members`), not inferred from coordinates.
- **A new projection kind** — rejected (D6): the view is graph-shaped; the
  existing `graph` projection carries it.

## Compatibility and migration

Purely additive (D7). No existing kind, verb, profile, or property is edited;
`uml.flow` and the `flow.*` kinds keep their published contracts. Sources that
do not use `bpmn.basic@1`, `flow.gateway`, `bpmn.messageflow`, `x_event`, or
`x_gateway` are unaffected. The capabilities `unsupported[]` line "complete
UML/SysML/BPMN/DMN metamodels or external interchange" remains TRUE and
untouched.

## Security, privacy and accessibility

No new inputs: nodes, edges, frames and metadata are already-declared
model/view data. Labels are escaped through the shared `esc()` helper like
every other label. The diagram makes no conformance claim: this is
profile-level coverage, not BPMN conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `kinds[]` entry
  `flow.gateway`, new `relationships[]` entry `bpmn.messageflow` (with
  `pattern:'6 4'`), new `profiles[]` entry `bpmn.basic@1`. Additive only.
- `notation/runtime/ddn-profiles.js` `registry()`: new
  `extension_contracts.x_event` and `extension_contracts.x_gateway` on objects;
  the relationship `pattern` derivation honors a declared catalogue `pattern`.
- `notation/runtime/ddn-engine.js`: new relabel branch for
  `bpmn.basic@1` prefixing selected `flow.gateway` names with the `x_gateway`
  type marker.
- `notation/runtime/ddn-profile-quality.js` `validate()`: new `bpmn.basic@1`
  block implementing `DDN-PJ116`/`DDN-PJ117` (mirroring the `uml.activity@1`
  block's style).
- `standard/registry/extensions.json` `contracts{}`: mirror of `x_event` and
  `x_gateway`.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `bpmn.basic@1` entry (list mirrors the
  profile catalogue); the `unsupported[]` metamodel line is untouched.
- New diagnostics: `DDN-PJ116`, `DDN-PJ117` (both errors).

## Positive and negative fixtures

- Positive example: `website/examples/basics/46-bpmn.ddn` — synthetic buyer/seller
  collaboration: two pool frames, typed start/end events (`none`, `message`,
  `timer`, `error`), an exclusive gateway, `uml.flow` sequence edges within
  each pool, and one dashed `bpmn.messageflow` from `request_quote` to
  `prepare_quote` across the pools.
- Test suite: `notation/tests/bpmn.js` — positive render with both pool
  frames, the dashed (`stroke-dasharray`) message-flow edge and the gateway
  name prefix; `uml.flow` sequence edges within a pool render without
  `DDN-PJ116`; `DDN-PJ116` for a message flow with both endpoints in the same
  pool and for both endpoints outside every pool; `DDN-PJ117` for a gateway
  without `x_gateway`; `DDN105` for `x_gateway:{type:"complex"}` and
  `x_event:{type:"signal"}`; byte-identical determinism; a multi-view file
  rendering the same model under `bpmn.basic@1` and a plain graph profile,
  each with its own profile asserted.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entries, `ddn-profiles.js`,
`extensions.json`, `ddn-engine.js`, `ddn-profile-quality.js`,
`capabilities.json`, example 46, test suite, spec chapter
`32-bpmn-collaboration.md`. The grammar (`standard/grammar/ddn.ebnf`) is
untouched; existing profiles' rendering and validation paths are untouched.

This is profile-level coverage, not BPMN conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (profile `bpmn.basic@1`; kind `flow.gateway`;
  verb `bpmn.messageflow`; extensions `x_event`/`x_gateway`), D3 semantics
  (`uml.flow` as sequence flow; pools/lanes as frames with `x_pool`/`x_lane`;
  typed events and gateways; cross-pool message flow), D4 rejection behavior
  (`DDN-PJ116`/`DDN-PJ117`), D5 visual encoding (registry `pattern` dash;
  engine name-prefix markers; frames for pools/lanes), D6 alternatives, D7
  compatibility: recorded above as fixed decisions of this RFC, including the
  verified correction (`x_event`/`x_gateway` registered extensions instead of
  plain properties).
- Open: choreography and conversation diagrams, BPMN XML interchange, and
  executable process semantics remain unsupported; a later RFC may add them
  under a new profile version.
