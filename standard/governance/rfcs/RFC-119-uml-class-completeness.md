# RFC 0119 — UML 2.5.1 class-diagram completeness

Status: implemented  
Authors/reviewers: B1-055 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.structure@2`; no grammar or language-source-version change (`ddn "0.2"–"0.5"` unchanged); runtime/specification 0.7 line.

## Problem and motivating example

`uml.structure@1` drew classes, interfaces, packages and components with attribute/operation compartments, but could not express most of the UML 2.5.1 class-diagram surface: association-end multiplicity and role names, aggregation/composition diamonds, navigability, association classes, n-ary associations, generalization sets, templates, enumerations, provided/required interfaces, qualifiers, derived properties and property strings. Authors had to fake these in labels, which broke fixed-semantics tooling.

Motivating example (excerpt; full fixture in `website/examples/basics/75-uml-class-complete.ddn`):

```
relation owns "owns" @company -> @person {
    kind: "uml.association"; target_mark: hollow_diamond;
    x_endlabels: { source: { role: "employer", multiplicity: "1" },
                   target: { role: "employee", multiplicity: "0..*" } };
}
```

## Proposed syntax

No new grammar. Everything lands through the existing additive channels:

1. **New registered kinds** (registry addition, allowed within a draft per VERSIONING rule 1): `uml.enumeration`.
2. **New registered relations**: `uml.provided`, `uml.required` (structural family, endpoint contracts class/component → interface).
3. **New endpoint marks**: `hollow_diamond` (UML aggregation; existing `diamond` is UML composition), `lollipop`, `socket`. Navigability reuses the existing `open` arrowhead via `source_mark`/`target_mark`.
4. **New extension properties** (same `x_message` precedent):
   - `x_endlabels` on relations — `{ source: { role, multiplicity, qualifier }, target: { … } }`, all members optional.
   - `x_association_class` on `uml.association` — `{ class: @ref }` naming the `uml.class` to attach at the path midpoint with a dashed connector.
   - `x_nary` on `uml.association` — `{ ends: [ { element: @ref, role?, multiplicity? }, … ] }`, additional ends beyond the binary `from`/`to` anchors.
   - `x_genset` on `uml.generalization` — `{ name, disjoint?, complete? }`.
   - `x_template` on `uml.class` — `{ parameters: [ "T", "K: class", … ] }`, rendered as the dashed signature box at the top-right corner.
   - `x_member` growth: `kind: "literal"` (enumeration literals), `derived: boolean` (leading `/`), `multiplicity: string` (`[0..*]`), `modifiers: [ "ordered", "unique", "readOnly" ]` (trailing `{ordered}` property strings).

## Semantic normalization and identity effects

None. All constructs are presentation/annotation layers on existing element and relation identities. A diagram's semantic fingerprint is unchanged by adding or removing `x_endlabels`, `x_nary`, `x_genset`, `x_template`, `x_association_class`, or the new `x_member` facets — they are view-relevant notation, like `x_message.seq` before them.

### N-ary associations: the binary-relation decision

The data model is a binary relation (`from`/`to`). Three candidate designs were considered (see Alternatives). The adopted one keeps the binary anchors and adds the remaining ends in `x_nary.ends`:

- `relation r @a -> @b { kind: "uml.association"; x_nary: { ends: [ { element: @c, role: "…" } ] }; }` declares a 3-ary association over `a`, `b`, `c`.
- The relation's identity is the single relation id; ends are not separate declarations and carry no independent identity. Ordering of `ends` is documentary (declaration order is preserved in rendering).
- The renderer draws the UML diamond junction at the centroid of the member classifiers with a spoke per end; the normal binary route is suppressed for that relation. Role/multiplicity labels attach at each spoke's classifier end (from `x_endlabels` for the binary anchors, from the `x_nary` entries for extra ends).
- Validators reject fewer than three total ends, duplicate end elements, non-classifier ends, and `x_nary` on a non-association kind (`DDN-PJ151`).

This is a deliberate modelling choice, not a stub: every end is a first-class validated endpoint with role and multiplicity, and the diamond-junction rendering is the normative UML 2.5.1 figure. What it does *not* attempt is a variadic relation grammar (`@a -> @b -> @c`), which would be a language change requiring a source-version bump.

## Visual encoding and routing effects

- `endMark()` gains `hollow_diamond` (surface-filled diamond), `lollipop` (small circle at the endpoint) and `socket` (semicircular arc opening toward the line). All three remain deterministic SVG paths.
- Endpoint label slots: role text above the line near the endpoint, multiplicity below it, qualifier as a small rectangle at the endpoint. Labels are placed along the first/last route segment direction; no routing changes.
- Association class: dashed line from the association path midpoint to the named class box border.
- N-ary junction spokes are straight lines from the centroid diamond to each classifier's border anchor; junction/spokes are excluded from crossing-gap bookkeeping (they are a single composite glyph).
- Generalization set: one `{disjoint|overlapping, complete|incomplete}` label per set name, placed at the shared target end.
- Template: dashed rectangle centred on the class box's top-right corner, parameter names listed inside.
- Enumeration: «enumeration» stereotype header, literals in a LITERALS compartment (same compartment machinery as attributes/operations).
- Provided/required: `uml.provided` draws the lollipop at the interface end; `uml.required` draws the socket at the class end. Assembly ball-and-socket pairing across ports is B1-059's scope; this RFC lands the decorations and relations.

## Alternatives considered

1. **Variadic relation grammar** (`@a -> @b -> @c`): rejected — changes the language, the AST, `semanticJSON` identity, and every projection; out of proportion to the feature and barred by VERSIONING rule 1 without a source-version bump.
2. **Junction element kind** (`uml.nary_junction` node with spokes as separate relations): rejected — gives the diamond a fake semantic identity, pollutes matrices and fingerprints, and lets the junction drift from its association (no single owner).
3. **Adopted: binary anchors + `x_nary.ends`** — additive, single relation identity, fully validated, and renders the normative figure.
4. **Marks vs. extension property for aggregation**: aggregation/composition/navigability are per-end decorations, exactly what `source_mark`/`target_mark` already model, so they extend the mark enumeration rather than a new property.

## Compatibility and migration

Fully additive. `uml.structure@1` remains installed and immutable; the new validation scope ships as `uml.structure@2`. Existing diagrams render byte-identically unless they opt into the new marks/properties. `hollow_diamond`/`lollipop`/`socket` in `source_mark`/`target_mark` previously failed as unknown marks (`DDN114`), so no previously valid source changes meaning. Structural-family gating for the new marks matches the existing `diamond`/`triangle` rule.

## Security, privacy and accessibility

No new input channels; extension values pass the same schema contract validator (`DDN105`) and bounded-string rules. Rendered decorations carry `data-*` hooks and are pure SVG; role/multiplicity text is escaped like every other label. No network, storage, or credential impact.

## Machine schema and diagnostic changes

- Registry: +1 kind (`uml.enumeration`), +2 relations (`uml.provided`, `uml.required`), +1 profile (`uml.structure@2`), regenerated `notation/runtime/assets/profiles-catalogue.js`.
- Extension contracts: new `x_endlabels`, `x_association_class`, `x_nary`, `x_genset`, `x_template`; `x_member` extended (`literal`, `derived`, `multiplicity`, `modifiers`).
- New error codes (ceilings checked: E018, W016, PJ148 in use): `DDN-PJ149` (x_endlabels misuse), `DDN-PJ150` (association class), `DDN-PJ151` (n-ary), `DDN-PJ152` (generalization set), `DDN-PJ153` (template), `DDN-PJ154` (enumeration literal misuse). `DDN114` now also covers the three new mark names.

## Positive and negative fixtures

Runtime tests in `notation/tests/uml-class-compliance.js` cover every feature positively plus each rejection code. Gallery/example fixture: `website/examples/basics/75-uml-class-complete.ddn` exercises all features in two views and renders through the CLI in the gallery build.

## Implementation/conformance impact

Touch points: `notation/runtime/ddn-contracts.js` (mark list), `ddn-profiles.js` (contracts + PJ validators), `ddn-render.js` (marks, endpoint labels, association class, n-ary junction, genset labels), `ddn-shapes.js` (enumeration compartments, template box, member adornments). Spec chapters 17 (profile subset) and 16 (projections) updated; designer contracts (`kind-ui-map.json`, `relation-ui-map.json`) and designer spec ch. 04/05 updated so the new kinds/properties are placeable/editable per the palette contract. Still outside scope, declared in the profile: XMI/OCL exchange, the full UML type/parameter metamodel, assembly/delegation connectors (B1-059), and formal OMG conformance claims.

## Open questions and decision record

- N-ary data model: **decided** — binary anchors + `x_nary.ends` (see above). A future variadic-grammar RFC could normalize `x_nary` into first-class syntax without changing semantics.
- Lollipop/socket assembly pairing semantics: deferred to B1-059 (component/composite-structure item); decorations are landed now per this RFC.
