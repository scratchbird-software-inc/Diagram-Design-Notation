# Full visual editing across all projections

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Graphs are not the only canvas
The editor advertises full coverage of supported DDN definitions through visual structured tools, not drag behavior for every mark. The projection capability manifest determines insertion tools, selection mappings, properties, and legal coordinate edits. Render support, guided editing and external conformance remain separate claims.

| Projection | Primary visual editing action | Coordinates that must remain data-bound |
|---|---|---|
| Graph | Insert/reuse kind, fields, semantic connections, groups and view layout. | Explicit pinned and named-field constraints. |
| Chen | Create/edit entity, field, association ends, keys/weak/derived/multivalued settings. | An attribute oval represents the original field; moving it cannot change ownership. |
| Matrix | Choose row/column sources, edit/create assignments, inspect contributors. | Row/column identity cannot be changed by dragging a coloured cell. |
| Table | Add/edit source records, columns and typed values. | A cell's source path and unit. |
| Panels | Add/reorder panels and spans; bind content or a child view. | Child quantitative encodings and declared memberships. |
| Chart | Bind records/series, measures, scales, missing/aggregate policy, labels and targets. | Values determine mark coordinates, lengths, areas and angles. |
| Timeline | Edit dates/intervals via controls or an explicit data-edit gesture with a change preview. | A bar cannot be freely moved as view geometry. |
| Fishbone | Add category/cause under selected parent; attach an existing cause. | Cause hierarchy/provenance and repeated occurrence semantics. |
| Decision | Add/edit typed inputs, predicates, rule priority and outcomes; evaluate fixtures. | Rule order is meaningful for first-match policies. |

The experimental interaction renderer is a separate mode of graph-family display. Its inspector edits participant/step/payload/causal data, not vertical pixels as time. Adding steps must generate actual occurrence and predecessor records. Full combined fragments are not claimed by this specification.

## Structured sheets
A chart Source sheet has source records, category/value/series bindings, units and missing-data policy in a guided order. Only then offer marks and approved transforms. A rule sheet has declared inputs/domains, conditions, outcomes, hit policy, and analysis result. A matrix sheet has row/column selectors, relation/value binding, duplicate policy and write target. Each sheet writes the shared definitions or view policies explicitly.

## Derived selection
Every selected mark exposes its contributors. A single source record may be edited through a field control; an aggregate opens its inputs, not an arbitrary editable total. A formula/target definition is distinct from measured input. A heatmap colour changes only through its value or scale policy. A hidden value remains in the source until an authorized export policy removes it.

## Composition
Panel child views reference named views rather than copying records. Selection offers “Open child view” or inspect a mapped contributor. Do not write a child plot's coordinates into the parent's graph placements. Preserve current limits: one child level and 12 children until a separate engine expansion is approved. Unknown compositions remain viewable/read-only when possible and retain source otherwise.

## Profile-aware creation
Blank precise diagrams may be incomplete: a RACI row needs assignments, a decision table needs coverage, a flowchart needs a path to an end. Structured task sheets can build complete atomic objects where convenient, but users may save drafts. Review-time obligations remain visible. The inspector must not encourage false default semantics to make an incomplete object pass.

## Full-editor acceptance
For each installed profile version, provide a supported creation template, required-property editor, one positive fixture, one invalid fixture, source round-trip fixture, selection/provenance test, keyboard path and an explicit list of unsupported constructs. A profile can be visually editable while not claiming complete external-standard compliance. The 24 audited profile versions, not marketing names, are the coverage denominator.
