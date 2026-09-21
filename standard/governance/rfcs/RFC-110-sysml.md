# RFC 110 — SysML-style block profiles (`sysml.bdd@1`, `sysml.ibd@1`, `sysml.parametric@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profiles sysml.bdd@1/sysml.ibd@1/sysml.parametric@1; kinds sysml.block/sysml.constraint; verb sysml.flow

## Problem and motivating example

Structural block/ports/constraint views are the core of SysML-style systems
sketches (D1). The existing `graph` projection carries classes, components and
activities, but nothing models typed border ports with item flows between
them, and nothing models formula-bearing constraint nodes bound to exactly two
endpoints.

Motivating example: a synthetic pump station — two blocks (`pump`,
`controller`/`reservoir`), a `water` item flow between the typed ports
`pump.out` and `reservoir.in`, and a constraint `flow_balance` carrying the
formula text `{flow = pressure × area}` bound to the two blocks.

## Proposed syntax

No grammar change. `ports {}` groups and member endpoints are existing syntax
(verified: `standard/specification/01-language.md` line 35; example
`website/examples/basics/15-process-contracts.ddn`; `standard/grammar/ddn.ebnf`
untouched). Blocks and constraints are registry kinds; the item flow is a
registry verb (D2).

- New profiles, all bound to the existing projection `kind:graph`:
  - `sysml.bdd@1` — block definition-style view: blocks and their
    associations.
  - `sysml.ibd@1` — internal block-style view: blocks with declared border
    ports and typed item flows.
  - `sysml.parametric@1` — parametric constraint view: constraint blocks
    carrying formula text, each bound to exactly two endpoints.
- New profile kinds:
  - `sysml.block` — silhouette `rect`, fallback `application`, family
    `interface`, code `BLOCK`, glyph `object`, aliases `[]`.
  - `sysml.constraint` — silhouette `rect`, fallback `object`, family
    `concept`, code `CONSTRAINT`, glyph `object`, aliases `[]`.
- New profile verb:
  - `sysml.flow` — `name`/`verb` "Item flow", `family:'flow'`,
    `code:'ITEMFLOW'`, `start:'none'`, `end:'filled'`, `glyph:'link'`,
    `source:['*']`, `target:['*']`, `allow_self:false`,
    `member_endpoints:true` — flows may attach to port members.
- No extension properties; no grammar change.

**Verified correction — a registered VERB, not a property.** The brief's
"relations with property flow" would parse as an unregistered semantic
property and produce `DDN-W106` warnings (`validateKnown` in
`ddn-contracts.js`). The item flow is therefore expressed by the registered
verb `sysml.flow`, with the carried item named by the relation's label (the
built-in `name` property, no warning-prone custom property).

```ddn
object pump "Pump" { kind: "sysml.block";
    ports { port out { direction: out; } }
}
object reservoir "Reservoir" { kind: "sysml.block";
    ports { port in { direction: in; } }
}
relation water "water" @pump.out -> @reservoir.in { kind: "sysml.flow"; }
object flow_balance "{flow = pressure × area}" { kind: "sysml.constraint"; }
```

## Semantic normalization and identity effects

None beyond resolution (D3):

- A block is a `sysml.block` object; under `sysml.ibd@1` it may declare a
  `ports {}` group (existing core machinery — `portAssignments()` in
  `ddn-layout.js` already assigns port sides/slots for routing, and
  `context.members` in `ddn-render.js` already maps both field and port ids).
- A port is a declared port member of its block; a relation endpoint resolves
  to it via the existing member-endpoint syntax `@block.port`.
- A flow is a `sysml.flow` relation; its label names the flowed item.
- A constraint is a `sysml.constraint` object whose label or `description`
  (both core properties — no extension needed) carries the formula text
  (e.g. `{flow = pressure × area}`), connected to exactly two endpoints
  (blocks or their ports) via visible relations (`assoc` or `sysml.flow`).

Identities are untouched.

Rejection behavior (D4):

- `DDN-PJ121` (NEW, error) — under any `sysml.*` profile of this item, a
  selected element declares a `ports {}` group but its kind is not
  `sysml.block`. The message names the element and its kind.
- `DDN-PJ122` (NEW, error) — under `sysml.parametric@1`, a selected
  `sysml.constraint` is not touched by exactly two visible relations. The
  message names the constraint and the actual count.

Codes verified free: `grep -rhoE "DDN-PJ12(1|2)" notation/ standard/
examples/` prints nothing (RT-101…109 took PJ110–PJ120 + PJW03).

## Visual encoding and routing effects

Blocks render as rect nodes; constraint nodes render as rect nodes showing
their formula label (D5). When the view profile is one of this item's three
(`profile.startsWith('sysml.')`) and a relation endpoint resolves to a PORT
member (`ep.member` in the element's `ports`), the edge-drawing pass of
`ddn-render.js` draws a small square (10×10·s) centred at the attachment
point on the block border, using a
`portIds = new Set(ir.elements.flatMap(n=>n.ports.map(p=>p.id)))` lookup built
in `renderInner`. The guard keeps every non-`sysml.*` profile pixel-identical
(existing port routing in `15-process-contracts.ddn` is unchanged — D7).

## Alternatives considered

- **A separate port kind with free placement** — rejected (D6): ports are
  members of their block by construction; the core machinery already routes
  to them.
- **Executing/evaluating constraint formulas** — rejected (D6): formulas are
  text; DDN renders, never evaluates.
- **Item flow as a relation property** — rejected (verified correction
  above): unregistered semantic properties warn as `DDN-W106`; the registered
  verb `sysml.flow` carries the semantics and the built-in label carries the
  item name.

## Compatibility and migration

Purely additive (D7). No existing kind, verb, profile, or property is edited;
published profiles keep their contracts. Existing port/flow examples
(`website/examples/basics/15-process-contracts.ddn`) render identically — the port
squares are guarded on `sysml.*` profiles and a regression test asserts the
absence of port squares outside them. The capabilities `unsupported[]`
metamodel line ("complete UML/SysML/BPMN/DMN metamodels or external
interchange") stays.

## Security, privacy and accessibility

No new inputs: nodes, edges, ports and labels are already-declared model/view
data. Labels (including formula text) are escaped through the shared `esc()`
helper like every other label. The renderer addition is deterministic (no
`Math.random()`, no `Date.now()`). The diagram makes no conformance claim:
this is profile-level coverage, not SysML conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `kinds[]` entries
  `sysml.block`, `sysml.constraint`; new `relationships[]` entry `sysml.flow`;
  new `profiles[]` entries `sysml.bdd@1`, `sysml.ibd@1`,
  `sysml.parametric@1`. Additive only.
- `notation/runtime/ddn-profile-quality.js` `validate()`: new
  `if(profile.startsWith('sysml.'))` block implementing `DDN-PJ121` and new
  `if(profile==='sysml.parametric@1')` block implementing `DDN-PJ122`, using
  the existing `ns` map and `shown` set patterns.
- `notation/runtime/ddn-render.js` `renderInner()`: `portIds` lookup plus
  guarded port-square drawing in the edge-drawing pass.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the three entries (+3).
- New diagnostics: `DDN-PJ121`, `DDN-PJ122` (both errors).

## Positive and negative fixtures

- Positive example: `website/examples/basics/50-sysml.ddn` — a synthetic pump
  station: `sysml.block` objects `pump` (`port out`) and `reservoir`
  (`port in`); a `sysml.flow` relation `@m.pump.out -> @m.reservoir.in`
  labelled `water`; a `sysml.constraint` `flow_balance` labelled
  `{flow = pressure × area}` with two `assoc` relations to the blocks. Three
  views: `bdd` (`sysml.bdd@1`), `ibd` (`sysml.ibd@1`), `parametric`
  (`sysml.parametric@1`).
- Test suite: `notation/tests/sysml.js` — positive renders per view (block
  names in the bdd SVG; port squares at both flow attachment points plus the
  flow label in the ibd SVG; the formula text in the parametric SVG);
  `DDN-PJ121` for a non-`sysml.block` object declaring a `ports {}` group
  under a `sysml.*` profile; `DDN-PJ122` for a parametric constraint touched
  by one (or three) visible relations; `sysml.flow` targeting a FIELD member
  rejected by the member-side contract; regression that
  `15-process-contracts.ddn` renders without port squares; byte-identical
  determinism per view.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entries, `ddn-profile-quality.js`,
`ddn-render.js`, `capabilities.json`, example 50, test suite, spec chapter
`36-sysml-profiles.md`. The grammar (`standard/grammar/ddn.ebnf`) is
untouched; existing profiles' rendering and validation paths are untouched;
the renderer change is guarded to `sysml.*` profiles.

This is profile-level coverage, not SysML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (profiles `sysml.bdd@1`/`sysml.ibd@1`/
  `sysml.parametric@1`; kinds `sysml.block`/`sysml.constraint`; verb
  `sysml.flow`; no extension properties; no grammar change), D3 semantics
  (block/port/flow/constraint as above), D4 rejection behavior
  (`DDN-PJ121`/`DDN-PJ122`), D5 visual encoding (rect blocks; guarded border
  port squares; formula-label constraint rects), D6 alternatives, D7
  compatibility: recorded above as fixed decisions of this RFC, including the
  verified correction (`sysml.flow` as a registered VERB instead of a
  warning-prone property).
- Open: SysML XMI interchange, flow property propagation, compartment typing
  beyond field rows, and equation solving/evaluation remain unsupported; a
  later RFC may add them under new profile versions.
