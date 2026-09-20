# RFC 111 — ArchiMate-style layered profile (`archimate.basic@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile archimate.basic@1; kinds archi.* (9); verb archi.rel

## Problem and motivating example

Architecture overviews commonly use a layered business/application/technology
vocabulary with serving links upward (D1). The existing `graph` projection
carries classes, components, blocks and flows, but nothing models a fixed
layered enterprise-architecture vocabulary with layer colours and an enforced
serving direction.

Motivating example: a synthetic order platform — a customer-service actor and
order-desk role run an order-handling business process, served by an order
application component/service, served in turn by a database node and its
technology service.

## Proposed syntax

No grammar change. Kinds and verbs are registry entries; `ddn.ebnf` is
untouched (verified: `notation/runtime/ddn-profiles.js` `registry()` builds
profile kinds/verbs from `standard/registry/profiles/catalogue.json`). Authors
write `projection { kind:graph; profile:"archimate.basic@1"; }` (D2).

- New profile, bound to the existing projection `kind:graph`:
  - `archimate.basic@1` — fixed nine-kind business/application/technology
    vocabulary; family-palette layer colours; viewpoints as named views;
    serving links upward only.
- New profile kinds (nine, fixed — D2):
  - `archi.business_actor` — silhouette `actor`, family `governance`,
    fallback `team`, code `BIZ_ACTOR`, glyph `object`, aliases `[]`.
  - `archi.business_role` — silhouette `round`, family `governance`,
    fallback `team`, code `BIZ_ROLE`, glyph `object`, aliases `[]`.
  - `archi.business_process` — silhouette `round`, family `governance`,
    fallback `activity`, code `BIZ_PROCESS`, glyph `object`, aliases `[]`.
  - `archi.business_service` — silhouette `round`, family `governance`,
    fallback `application`, code `BIZ_SERVICE`, glyph `object`, aliases `[]`.
  - `archi.business_interface` — silhouette `ellipse`, family `governance`,
    fallback `application`, code `BIZ_INTERFACE`, glyph `object`, aliases `[]`
    (interfaces pair with the service kinds; `ellipse` is a registered
    silhouette).
  - `archi.application_component` — silhouette `component`, family
    `interface`, fallback `application`, code `APP_COMPONENT`, glyph
    `object`, aliases `[]`.
  - `archi.application_service` — silhouette `round`, family `interface`,
    fallback `application`, code `APP_SERVICE`, glyph `object`, aliases `[]`.
  - `archi.technology_node` — silhouette `rect`, family `deployment`,
    fallback `host`, code `TECH_NODE`, glyph `object`, aliases `[]`.
  - `archi.technology_service` — silhouette `round`, family `deployment`,
    fallback `application`, code `TECH_SERVICE`, glyph `object`, aliases `[]`.
- New profile verb:
  - `archi.rel` — `name`/`verb` "serves / relates to",
    `family:'structural'`, `code:'ARCHIREL'`, `start:'none'`, `end:'open'`,
    `glyph:'link'`, `source`/`target`: the nine kinds, `allow_self:false`,
    `member_endpoints:false`.
- No extension properties; no grammar change.

```ddn
data m {
    object order_handling "Order handling" { kind: "archi.business_process"; }
    object order_service "Order service" { kind: "archi.application_service"; }
    relation serve "serves" @order_service -> @order_handling { kind: "archi.rel"; }
}
view landscape "Order platform landscape" {
    data: [@m];
    projection { kind: graph; profile: "archimate.basic@1"; }
}
```

## Semantic normalization and identity effects

None beyond resolution (D3):

- A layer is derived from the kind keyword prefix: `archi.business_` →
  business, `archi.application_` → application, `archi.technology_` →
  technology. No layer property exists.
- An `archi.rel` relation expresses a serving/relating link between two of the
  nine kinds; serving points upward (technology → application → business).

Identities are untouched.

Rejection behavior (D4) — the fixed layer-pair legality table for `archi.rel`
(source row → target column):

| source ↓ / target → | business | application | technology |
|---|---|---|---|
| business | allowed | `DDN-PJ123` | `DDN-PJ123` |
| application | allowed | allowed | `DDN-PJ123` |
| technology | allowed | allowed | allowed |

Same-layer and upward links (technology→application→business, the "serving"
direction) are allowed; downward links are rejected.

- `DDN-PJ123` (NEW, error) — an `archi.rel` visible in the view connects a
  downward layer pair, or an endpoint kind is outside the nine registered
  kinds. The message names the relation and both endpoint layers.

Code verified free: `grep -rhoE "DDN-PJ123" notation/ standard/ examples/`
prints nothing (RT-101…110 took PJ110–PJ122 + PJW03).

**Verified correction — validation order.** `Contracts.validate()` (which
enforces the verb endpoint contract as `DDN102`) runs before
`Profiles.validate()` in `ddn-core.js` `build()`. With the nine-kind
`source`/`target` contract of D2 kept verbatim, a non-`archi` endpoint would
be rejected as `DDN102` before the profile-quality pass could raise
`DDN-PJ123`. The endpoint-kind rejection in `ddn-contracts.js` therefore
defers to the profile-quality pass for `archi.rel` under
`archimate.basic@1` only (guarded, additive); the legality judgment itself —
non-`archi` endpoints and downward pairs — lives in
`ddn-profile-quality.js` `validate()` as `DDN-PJ123`, exactly as D4 requires.

## Visual encoding and routing effects

Layer colours derive from the registered catalogue family (D3): business kinds
use family `governance` (`#526525` / fill `#F2F5E9`), application kinds use
family `interface` (`#6D4C91` / fill `#F3EFF8`), technology kinds use family
`deployment` (`#7A5535` / fill `#F6F0E9`). `ddn-profiles.js` `registry()`
stamps each profile kind with `colour`/`fill` from its family, and
`ddn-palette.js` `node()` renders those registered values across every theme
preset, lightening hues deterministically for low-light themes. No per-kind
colour fields are set; no new colour machinery. `archi.rel` renders as a plain
link with an open arrowhead (`end:'open'`).

Viewpoints (D5): a viewpoint is a named `view` with an explicit `select:[…]`
list (e.g. a "business viewpoint" view selecting only `archi.business_*`
objects) — existing built-in machinery (`ddn-core.js` `build()`;
`standard/specification/03-views-and-reuse.md`). No code.

## Alternatives considered

- **Per-kind colour fields in the registry** — rejected (D6): family
  registration already supplies theme-aware layer colours.
- **The full ArchiMate metamodel (~60 elements, relationship derivation
  rules)** — rejected (D6): fixed minimal set, no external-standard
  conformance claims.
- **One verb per relationship type (serving/access/assignment/…)** — rejected
  for v1 (D6): one verb plus the legality table.

## Compatibility and migration

Purely additive (D7). No existing kind, verb, profile, or property is edited;
published profiles keep their contracts. The capabilities `unsupported[]`
metamodel line ("complete UML/SysML/BPMN/DMN metamodels or external
interchange") stays untouched.

## Security, privacy and accessibility

No new inputs: nodes, edges and labels are already-declared model/view data.
Labels are escaped through the shared `esc()` helper like every other label.
No renderer change at all in this item, so determinism is trivially preserved.
The diagram makes no conformance claim: this is profile-level coverage, not
ArchiMate conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: nine new `kinds[]` entries
  `archi.*`; new `relationships[]` entry `archi.rel`; new `profiles[]` entry
  `archimate.basic@1`. Additive only.
- `notation/runtime/ddn-profile-quality.js` `validate()`: new
  `if(profile==='archimate.basic@1'){ … }` block implementing `DDN-PJ123`,
  using the existing `ns` map and view-relation patterns.
- `notation/runtime/ddn-contracts.js`: the `DDN102` endpoint-kind rejection
  defers to the profile-quality pass for `archi.rel` under
  `archimate.basic@1` (guarded, additive — see the verified correction
  above).
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains one entry (+1).
- New diagnostic: `DDN-PJ123` (error).

## Positive and negative fixtures

- Positive example: `examples/basics/51-archimate.ddn` — the synthetic order
  platform above: `archi.business_actor` `service_agent`,
  `archi.business_role` `order_desk`, `archi.business_process`
  `order_handling`, `archi.application_component` `order_api`,
  `archi.application_service` `order_service`, `archi.technology_node`
  `db_node`, `archi.technology_service` `db_service`; upward `archi.rel`
  links. Two views: `landscape` (all layers) and `business_viewpoint`
  (selecting the business-layer objects only).
- Test suite: `notation/tests/archimate.js` — positive render with the three
  distinct family colours present in the node SVG and open-arrowhead
  `archi.rel` links; positive table cases (same-layer, technology→application,
  application→business); `DDN-PJ123` for each downward pair
  (business→application, business→technology, application→technology) and for
  a non-archi endpoint kind; business-viewpoint multi-view render;
  byte-identical determinism.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entries, `ddn-profile-quality.js`,
the guarded deferral in `ddn-contracts.js`, `capabilities.json`, example 51,
test suite, spec chapter `37-archimate-layers.md`. The grammar
(`standard/grammar/ddn.ebnf`) is untouched; the renderer is untouched;
existing profiles' rendering and validation paths are untouched.

This is profile-level coverage, not ArchiMate conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (profile `archimate.basic@1`; nine kinds
  `archi.*`; verb `archi.rel`; no extension properties; no grammar change),
  D3 layer colours from the registered family palette, D4 the fixed 3×3
  layer-pair legality table and `DDN-PJ123` (quoted verbatim above), D5
  viewpoints as named views, D6 alternatives, D7 compatibility: recorded above
  as fixed decisions of this RFC.
- Open: the ArchiMate exchange format, relationship derivation machinery and
  full ArchiMate conformance remain unsupported; a later RFC may add them
  under new profile versions.
