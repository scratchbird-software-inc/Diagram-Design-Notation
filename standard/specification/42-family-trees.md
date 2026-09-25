# 42. Family tree / genealogy profile (`family.tree@1`)

Status: implemented in runtime 0.7.0, governed by RFC-116
(`standard/governance/rfcs/RFC-116-family-tree.md`). Source grammar
remains DDN 0.5; the profile, kinds and verbs are registry entries, so
this chapter is a semantic addition, not a grammar change.

Genealogy sketches — ancestors above, descendants below, partnerships
between parents — are a widely recognised tree idiom. The profile runs on
the existing `graph` projection. Users write
`projection { kind:graph; profile:"family.tree@1"; }`. This is
profile-level notation coverage, not a GEDCOM-compatible system or a
records-verification tool. All example data is fictional.

## Vocabulary

Two profile kinds (both family `concept`, fallback `object`):

- `family.person` (silhouette `round`, code `PERSON`, glyph `person`) — a
  person; the label is the name.
- `family.union` (silhouette `circle`, code `UNION`, glyph `object`) — a
  partnership join node, rendered as the small circle between partners.

Two profile verbs:

- `family.partner_of` ("partner of", family `structural`, code
  `PARTNEROF`, no arrowheads) — from a `family.person` to a
  `family.person` or a `family.union`.
- `family.parent_of` ("parent of", family `lineage`, code `PARENTOF`,
  filled end arrowhead) — from a `family.person` or `family.union` down
  to a `family.person`.

Two registered extension properties on the `object` target, both
`{ "type":"integer" }` optional year numbers (no range enforced):
`x_birth` and `x_death`. Declared years are shown in the person node
text — the engine appends them to the node name, the same
source-preserving dispatcher pattern `bpmn.basic@1` and `pert.cpm@1`
already use; the renderer is unchanged.

## Partnership and descent patterns

A partnership is either:

- a direct `family.partner_of` link between two persons (childless
  couples), or
- a `family.union` join node linked to each partner via
  `family.partner_of` — the pattern for couples with children, because
  the join node gives children a single declared origin edge set.

Children are `family.parent_of` edges from a person or a union down to a
person. With `layout { direction:down; }` the existing layered/tree
machinery places ancestors above descendants along the declared edges;
exact generation-row alignment is not claimed.

## Lineage rules

- `DDN-PJ129` (error, thrown) — a cycle in visible `family.parent_of`
  edges. A person cannot be their own ancestor; the message names a
  person on the cycle.
- `DDN-PJ130` (error, thrown — NOT a warning) — a `family.person` with
  more than two distinct visible `family.parent_of` sources. The fact
  pattern (at most two biological parents) is a hard domain rule; the
  generations layout places at most two parents above a child or union,
  so extra parents cannot be drawn faithfully; and silently dropping one
  would falsify lineage — the project's no-silent-data-loss principle.
  The remodelling path is to split the extra parentage into separate
  unions/partners.

Endpoint contracts are enforced by the existing machinery: a
`family.partner_of` edge sourced from a union, or a `family.parent_of`
edge targeting a union, fails with `DDN102`; a non-integer `x_birth` or
`x_death` value fails with `DDN105`.

## Visual encoding

Persons render as rounded nodes with their name (and years when
declared); a union renders as a small circle node on the partner links;
`partner_of` edges are plain (no arrowheads); `parent_of` edges carry
filled arrowheads pointing from the parent/union toward the child —
downward under `direction:down`. No renderer change: all marks come from
existing silhouettes, the registered `person`/`object` glyphs, and the
existing `none`/`filled` edge terminals.

## Out of scope

GEDCOM or other external interchange, adoption/step-family nuance beyond
the two-parent rule, and records verification remain on the profile's
`unsupported` list.

See `website/examples/basics/56-family-tree.ddn` for a fictional three-generation
family with two partnerships.
