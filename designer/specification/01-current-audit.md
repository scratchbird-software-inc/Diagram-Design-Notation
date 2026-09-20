# Current DDN audit and implementation gaps

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## What was inspected
The complete field-guide archive was extracted into an analysis copy and overlaid with the supplied routing patch. The resulting runtime identifies as 0.6.0-beta.1 and matches the patch's published hash. We read the registry, profile catalogue, shape code, source editor/authoring code, declaration files, capabilities, and representative examples. `tools/audit-runtime.cjs` reproduces the read-only public-API probes. Their observed results are not a full regression rerun.

## Inventory
The audited core has **152 kinds**, **90 relation verbs**, **118 facet entries**, and **179 registered glyph recipes**. The profile catalogue adds **36 kinds** and **19 relationships** across **24 versioned profiles**. That is **188 kind definitions** and **109 relationship definitions**, not 188 necessary palette buttons. The core uses five registered body forms: 108 cards, 26 frames, 10 activities, six notes, and two sample forms. Ports are an independent interaction form. Profile kinds use 18 distinct silhouettes. There are 99 semantic-property and 118 format-property catalogue records; record count is not proof of complete enforcement.

`contracts/kind-ui-map.json` maps every kind to a proposed starter group, inspector template, and creation behavior. `contracts/relation-ui-map.json` indexes every registered relation for context filtering. Neither file changes the semantic vocabulary.

## Existing facilities to reuse
The public API supplies workspaces, revision checks, source-span edits, undo/redo, labels, generic properties, add-field/element/relation helpers, pin/unpin/hide, guarded definition deletion, record and matrix edits, file rename/import adjustment, render/inspect, snapshots and ZIP/JSON I/O. Scenes expose measured node rectangles and field rows. Rendering remains synchronous behind an async-shaped API. The patched router preserves endpoint identity and distinguishes routing attachment freedom from field binding.

## Gaps with evidence
**AUD-001 — Eager profile validation obstructs construction.** A source containing only a flowchart start is rejected by the current profile builder. A visual user must be able to place the start before the rest exists. Add a draft inspection/rendering path; do not remove the completed-flow validator. *Status (ED-010, 2026-09-20): the editor-level draft inspection/presentation path landed — tolerant draft commits, `incomplete` typing under policy design, the INCOMPLETE badge and Problems drawer; the completed-flow validator and strict render/export are untouched. The core draft resolver in the runtime remains open; AUD-001 is not closed.*

**AUD-002 — Generic creation has a fixed write target.** `addElement` and `addRelation` use a local `editor_data` block. The audit confirms a newly created object is not automatically shared with the second view. The new editor needs an explicit creation destination and an atomic create-plus-occurrence transaction.

**AUD-003 — Public commands are incomplete.** There are no dedicated public operations for reconnecting a relation, safe kind conversion, deep field reorder/reparent, multiple occurrences of one object in one view, or arbitrary typed scope membership changes. A generic property setter is not sufficient for their multi-file effects. **Status (ED-008, 2026-09-20):** relation reconnection now has a prototype command (`reconnectRelation` in `prototype/commands.js`, with drag + inspector paths and the five-part impact preview; covers VE-AC-023). The remaining AUD-003 operations — kind conversion, deep field reorder/reparent, multi-occurrence and scope membership — stay open; ED-009 covers multi-occurrence addressing.

**AUD-004 — No independent occurrence address.** Ordinary graph placements are keyed by model ID. Before supporting two appearances in one view, add an explicit occurrence layer; do not create duplicate model records as a workaround. **Status (ED-009, 2026-09-20):** an editor-level occurrence addressing layer landed in the prototype (`Commands.occurrences` in `prototype/commands.js`): deterministic `occ:<viewId>:<definitionId>` ids under a one-appearance-per-view restriction, add-existing/remove/move/override commands with explicit restriction responses, and inspector/Model-shelf surfacing (covers VE-AC-036). The core/grammar occurrence contract — versioned occurrence records and duplicate appearances within one view — remains RFC work; AUD-004 stays open.

**AUD-005 — Descriptor catalogue drift.** Five used silhouettes (`initial`, `final`, `offpage`, `bracket`, `cylinder`) are absent from the profile catalogue's top-level `shapes` list. The renderer does support those shapes. Generate that list from recipe registration before using it as the palette's authority.

**AUD-006 — Kind conversion is not a visual operation.** The current generic setter can change table to view while retaining fields. This is a semantic change and needs review of constraints, incoming references and implementation properties; a “shape” dropdown must not silently invoke it.

**AUD-007 — Inspection data is not yet a complete UI schema.** Current catalogues mix targets, prose applicability and registry defaults. Add typed editor descriptors, supported-enum checks and exact serialization adapters. Do not scrape labels or invent source keys at runtime.

**AUD-008 — Draft/publication/view validation are insufficiently separated for visual construction.** Raw source drafts can be retained; guided commands build the current view before commit. Dependent-view impact is not an authoritative all-workspace transaction. The specification adds scoped validation and impact previews. *Status (ED-010, 2026-09-20): scoped validation landed in the prototype — current-view and workspace-review scopes with per-view ch.12 statuses and session-scope pending-view bookkeeping. The authoritative all-workspace transaction remains open; AUD-008 is not closed.*

**AUD-009 — Performance boundary.** The public live API limits a visible view to 128 elements and 384 relations and runs layout synchronously. A full editor needs coalesced drag previews and a worker execution seam. Performance targets below are proposed, not measured against a completed editor.

**AUD-010 — Sensitive and unknown projections.** Redacted projected export remains fail-closed. Public source snapshots contain supplied source. Keep those restrictions and disclose unsupported visual edits while preserving their data.

## Audit disposition
These are design blockers or integration gaps, not all new renderer defects. Existing Studio is not modified. The specification distinguishes reuse, wrapper work, new core APIs, new grammar/IR work and external assurance. The routing witness, current file hashes and previous review caveats are preserved.
