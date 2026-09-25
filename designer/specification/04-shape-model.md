# Shape recipes, semantic options and palette simplification

**DDN Designer specification 0.2.0 — proposed; baseline audited 0.7.0.**

## The simplifying rule
**One semantic kind plus applicable options; one profile-approved recipe; a small inspector.** Do not simplify by merging different kinds until their meaning disappears. A table and a SQL view can share the same card implementation but are not values of a decorative “shape” setting.

A visible element is composed from a body recipe, optional compartments, kind glyph/token, facet badges, content rows, ports, and text. The installed profile determines legal combinations. A view determines optional visibility and approved look. Geometry is derived from measured contents and the selected recipe.

## Layers of a shape definition
1. **Semantic type**: core/profile kind, exact source identifier, allowed fields/ports/relations and required properties.
2. **Content contract**: fields, parameters, operations, notes, requirement text, or structured records appropriate to that type.
3. **Facets**: workload, role, temporal behavior, distribution, evidence and handling. Each remains independent.
4. **Rendering recipe**: registered body form, compartments, contour anchors, symbol slots and minimum sizes.
5. **Editor descriptor**: labels, ordering, widgets, conditional relevance, scope, reset policy and source adapters.

Appearance-only settings must not write semantic properties. Changing a type calls a conversion planner. Selecting Gane–Sarson rather than Yourdon for the same DFD is a view/profile projection choice where supported; selecting table rather than view changes a definition and potentially its consumers.

## Proposed starter templates
| Starter | Fast choices | Details exposed only when applicable |
|---|---|---|
| Named object | Name, Kind, Meaning | Domain, identity, evidence |
| Data structure | Name, Kind, Fields | Keys, domains, types, constraints, versions |
| Process | Name, Operation/decision role, Inputs/outputs | Branches, conditions, responsibility, timing |
| System/interface | Name, Kind, Interfaces | Payloads, deployment, availability |
| Scope | Name, Scope meaning | Members, namespace/placement/ownership mapping |
| Person/team/control | Name, Kind, Responsibility | Permissions, evidence, contact references |
| Note/example | Text, Describes | Sample bindings, provenance, review state |
| Analysis/view | Projection, Source, Template | Measures, rules, series, scales, child views |

The selector is a fast access system, not another grammar. Its resulting source still uses existing exact kind IDs. All 188 kinds remain individually addressable and searchable in `contracts/kind-ui-map.json`.

> Implementation status (ED-001): the prototype palette now renders `contracts/kind-ui-map.json` directly (registry code plus map name per kind). Kind conversion remains the reviewed Change… dialog (the AUD-006 conversion path), not a dropdown.

## Compact-versus-expanded contract
Default to at most six expanded *top-level* controls, as a usability design target. A field-list control can contain many rows, but each row initially shows only name, role/domain shortcut and its connection affordance. Do not hide validation errors to satisfy a visual count. A complex required form opens a task-specific sheet with a completion summary; it does not grow the generic inspector indefinitely.

## Legal customization
Allow name, applicable facets, content, visibility, approved recipe variant, font role, scale/padding where supported, and registered style/palette. For precise notation, silhouette, endpoint family, semantic colours and indicator slots are constrained. An icon picker chooses only allowed registered variants. Generic decorative annotations may have more freedom but must not claim a standard semantic role.

## Kind conversion
Table → view, activity → decision, or ordinary entity → weak entity is a previewed semantic change. The planner lists retained fields, newly required properties, changed relationship compatibility, affected views and properties that would no longer apply. The user must map or explicitly preserve unsupported data in a declared extension; silently deleting it is forbidden. Cancel has no effect. One accepted conversion is one undo transaction.

## Palette creation examples
Choosing Table creates a table definition with an auto-generated stable ID, a name and optional empty field list; no datatype or database engine is required. Choosing a decision creates an incomplete decision plus visible tasks to add branches. Choosing Chart launches a source-binding wizard, not an ordinary box with adjustable height. Choosing Chen Attribute selects a field-creation workflow on its owning entity, not an unattached free-floating oval.
