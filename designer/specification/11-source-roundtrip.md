# Source identity, imports, view occurrences and round trips

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Canonical files
Continue to use UTF-8 `.ddn` with shared data, format and view declarations. A new visual project uses separate `model.ddn`, `formats.ddn` and `views.ddn` by default; a single-file project remains valid. Do not force existing users through a reformatter on opening. Preserve comments, literal values, ordering, unknown fields and line endings outside the changed spans.

Stable labels are not IDs. A display-name edit never changes references. Existing inferred IDs may depend on declaration paths; moving a definition or field therefore requires a semantic refactor plan. Introduce explicit `uid` only as an intentional identity-preserving migration, not a mass rewrite triggered by opening Designer. New definitions receive stable generated IDs from the start.

## Occurrence layer
The current graph scene keys ordinary placement by model ID. The proposed editor needs a versioned occurrence contract: `viewId`, `occurrenceId`, `definitionId`, approved recipe/visibility overrides and optional layout hints. Relation appearances identify which occurrence represents each existing endpoint. An occurrence cannot change the underlying field, port, kind or direction.

This is a core/grammar change requiring an RFC. Initial implementation may forbid duplicate appearances within one view while allowing reuse across views. It must not generate fake replicas to get around the missing capability. The palette's Add existing focuses an existing occurrence until the RFC is implemented.

**Implementation status (ED-009, 2026-09-20).** An editor-side occurrence
addressing layer landed in the prototype (`Commands.occurrences` in
`prototype/commands.js`, consumed by the inspector header and the Model
shelf's "Add to view…" action). The charter Terms apply verbatim:
"**Definition**: a model object, field, relation, rule, record, or domain.
**Occurrence**: one visual appearance of a definition in a named view.
**Instance**: a distinct modeled/deployed instance; not a synonym for
occurrence." Occurrence ids are deterministic and reversible:
`occurrenceId = 'occ:' + viewId + ':' + definitionId` (e.g.
`occ:designer.sample::overview:designer.sample::model.customer`; parse via
`Commands.occurrences.parse`). Ids are unique because the
**one-appearance-per-view** restriction holds: a same-view alias request
always answers `already-present · one-appearance-per-view` with the existing
occurrence id and focuses it — never a clone disguised as an alias
(VE-AC-036; VE-004: "A repeated appearance is not a replica."). The layer adds
no source syntax (VE-008) and keeps the runtime's stable source mapping
(VE-003). Element/relation asymmetry: in 0.5 relation occurrences are derived
from endpoint visibility (`visibleRelations` shows a relation exactly while
both endpoints are selected; there is no independent relation-hide), so hiding
an element removes its incident relation appearances transitively, and
relation-occurrence removal answers with an explicit unsupported response
instead of a source change. Pin-by-occurrence maps to pin-by-definition
(`place @ref`) under the same restriction. The versioned occurrence contract
and duplicate appearances within one view remain RFC work.

## Imports and write destinations
Create definitions in the selected data block. Before writing a cross-file reference, calculate the shortest existing import chain or prepare an explicit import addition that does not introduce a cycle. Resolve names by stable identity and lexical scope; do not search-and-replace display strings. Name conflicts require a user decision. File rename updates import paths transactionally; definition move updates affected references, not unrelated comments or quoted text.

## Serializer requirements
Use concrete syntax/source-span editing or an equivalent lossless syntax tree. Core property order for newly generated blocks should be deterministic. Unknown properties and explicit source values survive even when the visual editor has no specialized control. Only properties touched by the command are normalized. Deleted blocks and their attached comments need a documented ownership rule and a preview.

## Sidecars
Pure session details such as pan/zoom, selected object, open panels, recent templates and provisional drag positions may live in a versioned optional editor state file or workspace JSON envelope. The DDN model must be sufficient for rendering without that state. Deliberate positional pins, routing constraints and reviewed format choices belong in view source. Paused free layout positions may be retained in workspace state without pretending they are pins.

A source workspace ZIP contains every required imported DDN file and its relative paths. A single script export warns when dependencies are excluded and offers the complete bundle. Inlining imports is a separate explicit export transformation with provenance, not default saving.

## Round-trip guarantees
Required cases: open/save unchanged is byte-identical; edit one label preserves unrelated spans; visual create round-trips through Studio; raw field edits reappear correctly in Designer; matrix source changes reflect graph views; kind conversion preserves retained data; delete with dependencies is blocked or explicitly mapped; undo restores exact prior text; multiple occurrences never duplicate definitions; filenames and aliases can change without silently changing explicit semantic IDs.

## Unsupported input
An older/newer or unknown profile is shown as unsupported, not coerced to a nearby kind. Preserve its raw source and reference identity. Unrelated supported content may be edited if the dependency boundary can be proven; otherwise use read-only plus Studio handoff. Never save a partial projection over the complete source workspace.
