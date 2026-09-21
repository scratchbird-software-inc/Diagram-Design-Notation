# RFC 116 — Family tree / genealogy profile (`family.tree@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile family.tree@1; kinds family.person/family.union; verbs family.partner_of/family.parent_of; extensions x_birth/x_death

## Problem and motivating example

Genealogy sketches — ancestors above, descendants below, partnerships
between parents — are a widely recognised tree idiom that the existing
`graph` projection cannot express as a validated vocabulary (D1). The
layered layout machinery already stacks generations along declared edges,
and the `person` glyph already exists in the glyph library, but nothing
expresses a person, a partnership, or a parent/child lineage rule.

Motivating example: a fictional three-generation family with two
partnerships — grandparents `alex` and `miriam`, their child `sam`, `sam`'s
partner `jo`, and grandchild `robin`. Users write
`projection { kind:graph; profile:"family.tree@1"; }`. This is
profile-level notation coverage, not a GEDCOM-compatible system or a
records-verification tool.

## Proposed syntax

No grammar change (D2, verified: profiles, kinds and verbs are registry
entries; `standard/grammar/ddn.ebnf` is untouched).

- One new profile `family.tree@1` bound to the existing projection
  `kind:graph`.
- Two new profile kinds (both family `concept`, fallback `object`):
  - `family.person` (silhouette `round`, code `PERSON`, glyph `person`),
  - `family.union` (silhouette `circle`, code `UNION`, glyph `object` —
    renders as the small join node between partners).
- Two new profile verbs:
  - `family.partner_of` — name/verb "partner of", family `structural`,
    code `PARTNEROF`, start `none`, end `none`, glyph `link`,
    source `['family.person']`, target `['family.person','family.union']`,
    `allow_self:false`, `member_endpoints:false`.
  - `family.parent_of` — name/verb "parent of", family `lineage`,
    code `PARENTOF`, start `none`, end `filled`, glyph `link`,
    source `['family.person','family.union']`, target `['family.person']`,
    `allow_self:false`, `member_endpoints:false`.
- Two new registered extension properties, both `{ "type":"integer" }`
  contracts on the `object` target, optional year numbers (no range
  enforced): `x_birth` and `x_death`.

```ddn
data m {
    object alex "Alex" { kind: "family.person"; x_birth: 1948; x_death: 2019; }
    object miriam "Miriam" { kind: "family.person"; x_birth: 1951; }
    object union_am { kind: "family.union"; }
    rel family.partner_of alex_to_union "partner of" { from: @m.alex; to: @m.union_am; }
    rel family.parent_of am_to_sam "parent of" { from: @m.union_am; to: @m.sam; }
}
view family "Family" {
    data: [@m];
    projection { kind: graph; profile: "family.tree@1"; }
    layout { direction: down; }
}
```

## Semantic normalization and identity effects

Semantics (D3): a person = a `family.person` object (label = name; the
optional `x_birth`/`x_death` years are shown in the node text — the engine
appends them to the node name, the same source-preserving dispatcher
pattern `bpmn.basic@1` and `pert.cpm@1` already use in
`notation/runtime/ddn-engine.js`; the renderer itself is unchanged). A
partnership = either a direct `family.partner_of` link between two persons
(childless couples) or a `family.union` join node linked to each partner
via `family.partner_of`. Children = `family.parent_of` edges from a person
or a union down to a person. Layout `direction:down` places ancestors above
descendants along the declared edges; v1 relies on the existing
layered/tree machinery and does not claim exact generation-row alignment.

Rejection behavior (D4):

- `DDN-PJ129` (NEW, **error**, thrown) — a cycle in visible
  `family.parent_of` edges (a person cannot be their own ancestor). The
  message names a person on the cycle.
- `DDN-PJ130` (NEW, **error** — NOT a warning, thrown) — a `family.person`
  with more than two distinct visible `family.parent_of` sources.

Severity rationale for `DDN-PJ130`: the fact pattern (at most two
biological parents) is a hard domain rule, not a style smell; the
generations layout places at most two parents above a child or union, so
extra parents cannot be drawn faithfully; and silently dropping one would
falsify lineage — violating the project's no-silent-data-loss principle.
The remodelling path is to split the extra parentage into separate
unions/partners. A warning was rejected for exactly these reasons (D6).

Verified free before allocation:
`grep -rhoE "DDN-PJ1(29|30)" notation/ standard/ website/examples/` prints nothing.

## Visual encoding and routing effects

Persons render as rounded nodes with their name (and years when declared);
a union renders as a small circle node sitting on the partner links;
`partner_of` edges are plain (no arrowheads); `parent_of` edges carry
filled arrowheads pointing from the parent/union toward the child, i.e.
downward under `direction:down` (D5). No renderer change: all marks come
from existing silhouettes (`round`, `circle`), the existing `person` and
`object` glyphs, and the existing `none`/`filled` edge terminals.

## Alternatives considered

- GEDCOM import/export (D6) — rejected: external interchange is out of
  scope for profile-level notation coverage.
- Representing partnerships without union nodes (D6) — rejected for
  couples with children: the join node gives children a single declared
  origin edge set.
- Warning severity for `DDN-PJ130` (D6) — rejected per the D4 rationale
  above.

## Compatibility and migration

Additive only (D7): no existing profile, kind, verb, code, glyph,
extension contract or capability line changes meaning. Published profiles
are untouched. The new engine block fires only when the view profile is
`family.tree@1`; all other profiles are byte-identical.

## Security, privacy and accessibility

The new checks are set membership and a bounded DFS over the selected
element/relation sets — pure, no I/O, no dynamic code. No artwork is
added: persons reuse the registered `person` glyph and `round` silhouette,
unions reuse the `object` glyph and `circle` silhouette. Genealogical data
is personal by nature; examples and fixtures use fictional persons only,
and the spec chapter says so. Names and years remain visible text, so
meaning survives monochrome rendering and text extraction.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json` — `kinds[]` gains
  `family.person` and `family.union`; `relationships[]` gains
  `family.partner_of` and `family.parent_of`; `profiles[]` gains
  `family.tree@1`.
- `notation/runtime/ddn-profiles.js` `registry()` — extension contracts
  `x_birth` and `x_death` (`{type:'integer'}` on the `object` target).
- `standard/registry/extensions.json` — `contracts{}` mirrors both.
- `notation/runtime/ddn-profile-quality.js` `validate()` — a
  `family.tree@1` block: DFS over visible `family.parent_of` edges
  (`DDN-PJ129`) and the two-parent rule (`DDN-PJ130`). The DFS is a local
  equivalent of the `acyclic()` pattern in `ddn-profiles.js`, written in
  the style of the `chen.binary@2` ownership-visit block in the same file;
  no shared code is moved.
- `notation/runtime/ddn-engine.js` — a `family.tree@1` block that appends
  declared `x_birth`/`x_death` years to person node names (display only).
- `standard/registry/capabilities.json` — `implemented[]` gains the family
  tree line; `installedProfiles` +1.
- New diagnostics: `DDN-PJ129` (error — parent_of cycle), `DDN-PJ130`
  (error — more than two parents). Endpoint contracts surface as the
  existing `DDN102`; malformed `x_birth`/`x_death` as the existing
  `DDN105`.

## Positive and negative fixtures

- Positive: `website/examples/basics/56-family-tree.ddn` — the `family` view
  renders three generations: the grandparents' union at the top, the child
  generation below, the grandchild at the bottom; union nodes are small
  circles; `partner_of` edges have no arrowheads; `parent_of` edges point
  downward; years appear in person node text.
- Positive: a direct person↔person `partner_of` link (childless couple)
  passes validation.
- Negative: a `parent_of` cycle (`a→b→a` via unions/persons) → thrown
  `DDN-PJ129`.
- Negative: a person with three distinct `parent_of` sources → thrown
  `DDN-PJ130` (error, not a warning diagnostic).
- Negative: `partner_of` sourced from a `family.union`, or `parent_of`
  targeting a `family.union` → endpoint contract failure `DDN102`.
- Negative: `x_birth:"unknown"` (non-integer) → contract failure `DDN105`.

## Implementation/conformance impact

- `notation/runtime/ddn-profiles.js` — two extension contracts.
- `notation/runtime/ddn-profile-quality.js` — the `family.tree@1`
  validation block.
- `notation/runtime/ddn-engine.js` — the year display transform.
- Suite `notation/tests/family-tree.js` (`test:family-tree`) covers the
  fixtures above plus determinism.
- `npm --prefix notation run build:sdk` rebuilds `notation/dist/`.

## Open questions and decision record

Fixed decisions (recorded, not open): D1 motivation; D2 vocabulary
(profile `family.tree@1` on `graph`; kinds `family.person`/`family.union`;
verbs `family.partner_of`/`family.parent_of`; extensions
`x_birth`/`x_death`; no grammar change); D3 semantics (persons,
partnerships via direct links or union join nodes, children via
`parent_of`, `direction:down`); D4 rejection behavior (`DDN-PJ129` cycle
error, `DDN-PJ130` two-parent hard error with the severity rationale); D5
visual encoding (rounded persons, small circle unions, plain partner
edges, filled downward parent edges, no renderer change); D6 alternatives
rejected; D7 compatibility (additive only). GEDCOM or other external
interchange, adoption/step-family nuance beyond the two-parent rule, and
records verification remain on the profile's `unsupported` list.
