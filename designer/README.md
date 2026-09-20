# @ddn/designer — DDN visual designer (proposal)

The **visual-first designer** for DDN: a specification (0.1), proposed
contracts, and a bounded working prototype for an editor where the diagram
is the primary interface — distinct from the source-first Studio in
`../notation/studio/`. Built against the DDN 0.5.0-draft.2 runtime.

## Contents

- `specification/` — 20 chapters: charter and non-negotiables (VE-001…VE-008),
  audit of the current runtime (AUD-001…010), research synthesis, IA/screens,
  shape model, property system, creation/clipboard, connections, layout/pins,
  projections, commands/transactions/drafts, source round-trip, validation,
  architecture, accessibility, security, performance, delivery, proposed API
  changes, guidelines.
- `contracts/` — proposed JSON Schemas (command, editor-descriptor,
  shape-recipe, session, change-plan), `kind-ui-map.json` and
  `relation-ui-map.json` (all 188 kinds / 109 relation verbs),
  `ui-tokens.json`, `designer-api.d.ts`. **Proposals**, not implemented APIs.
- `prototype/` — bounded working prototype (31/31 browser checks passed in
  the source package). The Add shelf renders the full 188-kind mapped palette
  from `contracts/kind-ui-map.json` (eight palette groups, search, per-kind
  `creation_action` dispatch); the inspector is descriptor-driven from the same
  map. `commands.js` is the separable command layer; `build-ui-maps.mjs` and
  `build-standalone.mjs` regenerate the loadable maps and both HTML pages
  deterministically. `index.html` is the multi-file version loading the
  runtime from `../../notation/dist/`; `standalone.html` is the single-file
  version with everything inlined (works from `file://` anywhere).
- `research/` — license-screened primary sources for interaction hosts.
- `design/` — screen catalogue (`screens.json`), annotated screenshots.
- `decisions/` — 10 ADRs (`DECISIONS.md`), verification record, sign-off template.
- `tests/` — 84-case production acceptance plan and artifact-validation
  checks; the Node-based designer suite (`npm --prefix designer test`, started
  by ED-001's `ed-001-full-kind-palette.js`, which covers VE-AC-002 and
  VE-AC-064, and extended by ED-002's `ed-002-matrix-editor.js`, which covers
  VE-AC-049 and VE-AC-050, and by ED-003's `ed-003-chart-editor.js`, which
  covers VE-AC-051, VE-AC-052 and VE-AC-053, and by ED-004's
  `ed-004-timeline-editor.js`, which covers VE-AC-054); Playwright harnesses
  (optional).
- `src/` — future implementation home (empty).

## Status and boundaries

Research + proposed specification + bounded prototype — not a production
editor. The runtime audit baseline is 0.5.0-draft.2; known gaps (draft
validation API, occurrence addressing, safe kind conversion, full projection
editors) are listed in the specification. Source-preserving transactions and
keeping the Studio intact are hard requirements (ADR-02: DDN-native SVG/scene
as first host). Beyond the graph canvas, the prototype now includes a matrix
editor (ED-002): RACI/CRUD/relations cells are editable by keyboard and click
through a structured sheet under the diagram, staged changes commit as one
atomic batch transaction, and a filled cell's contributors can be selected in
the companion graph view. ED-003 adds the chart editor: a Source sheet under
chart views edits bound records (shared model), switches the mark within the
profile's legal `capabilities.marks` set, and rebinds `x`/`y`/`unit` (view
scope); clicking a mark lists its contributing records, and drag gestures stay
disabled (values set geometry). ED-004 adds the timeline editor: a Timeline
sheet under gantt views edits task start/end dates with validated date
controls (shared model), links and unlinks `analysis.precedes` dependencies
(view-scope list edits; relations stay shared), adds task records, and turns a
horizontal bar drag into a whole-day date edit with a live interval preview —
never a free geometric move. ED-005 adds the
fishbone editor: a Fishbone sheet under fishbone views edits the effect
statement (shared definition), adds category bones and nested causes under a
chosen parent, attaches an existing cause to a second branch (relation only —
one identity, distinct occurrence paths), and removes single ribs; the
prototype fixture now includes a fishbone view. ED-006 adds the panels
editor: a Panels sheet under panels views mirrors the declared grid and edits
panel titles, spans and item lists (view-scope `projection.panels` writes),
moves items between item-panels, adds notes (shared definitions, one
transaction), adds/removes panels, and binds child-view slots as named-view
references with the one-level/12-children limits enforced at the command
layer; fixed-grid canvas profiles keep their required blocks locked
(DDN-PJ080/081/083), and the prototype now wires SWOT, SIPOC and journey
views. ED-007 adds the decision table editor: a Decision sheet under
decision views lists `rule.row` rules in records order with reorder
controls (semantic for first-match policies), typed condition controls
driven by the declared input domains and typed outcome cells (shared
model), hit policy and coverage badges with view-scope select edits, the
bounded analysis (witnesses, overlaps, shadowed rules, budget) beside the
table, and a read-only fixture evaluator; an overlapping unique-hit rule
commits as a draft with the DDN-QD004 witness displayed and export
blocked (VE-007), and the prototype fixture now includes a decision view.
ED-008 adds edge reconnection: a selected edge's endpoint can be dragged onto
another object or field, or re-picked in the relation inspector's From/To
selects (the keyboard/click equivalent); both paths open the five-part
shared-impact preview (source owner, exact before/after endpoints, affected
views, scratch re-render diagnostics, retained identity and route overrides)
and commit one atomic, revision-checked transaction that preserves the
relation's id, label and properties, closing the AUD-003 reconnection gap
(covers VE-AC-023). Direction reversal and attachment-policy editing remain
proposed. ED-009 adds the occurrence addressing layer: every visual appearance
of a definition in a named view gets a deterministic, verifiable
`occ:<viewId>:<definitionId>` id (`Commands.occurrences` in
`prototype/commands.js`); add-existing/remove/move/override commands run
against those ids with explicit responses — same-view alias requests answer
`already-present · one-appearance-per-view` and focus, never clone (covers
VE-AC-036) — the inspector header shows the selection's occurrence id and the
Model shelf gains a per-item "Add to view…" action. This layer is the
foundation for ED-010 (draft validation addresses issues to occurrence ids)
and ED-012 (sequence lifelines/messages as occurrences). ED-010 adds the
draft validation UX (spec ch.12): a Problems strip left of the status bar
reports error/incomplete/warning counts separately and expands into a
navigable, occurrence-addressed issue list; `Commands.validate` classifies
profile-completeness codes (`DDN-PF*`, `DDN-PJ016`, `DDN-QD0*`, `DDN-QL*`) as
`incomplete` under policy design and `error` under review, with hard failures
always `error` and renderer diagnostics passed through; a committed draft
whose re-render fails a completeness check gains an amber INCOMPLETE badge
over the dimmed last good render while export stays blocked; a workspace
review scope revalidates every view and clears the session-only pending set
(covers VE-AC-006/007). ED-011 adds lane editing on view frames (spec ch.08
"Scope versus visual grouping"): a Lanes section in the This-view inspector
creates, renames, resizes (X/Y/W/H plus fit-to-members) and populates the
view's `frame` declarations, and dropping a node fully inside a lane
rectangle offers the same assignment preview — the exact member changes plus
the sentence that no semantic containment, ownership, or placement
relationship is created (covers VE-AC-040), with pin + assign composing in
one transaction. Assignment follows a one-lane-per-element policy; under the
RT-105 `uml.activity@1` profile the same commands additionally maintain the
registered `x_partition:{lane:"…"}` property with DDN-PJ114 re-checked on
commit (UML-activity partitions stayed blocked until RT-105 landed).
ED-012 adds the sequence diagram editor for RT-101's `uml.sequence@1`
projection: a Sequence sheet lists lifelines (add existing/new, remove,
up/down) and messages (label, from→to badges, dashed-return checkbox,
up/down, delete) straight from `ws.projectionPlan(entry,view)`, and a
two-click connect gesture on lifeline header marks creates `uml.message`
relations through the same command layer. Order is declaration order —
every reorder is a `Commands.moveDeclaration` span move of the declaration
itself, provably leaving endpoints and `x_return` byte-identical (covers
VE-AC-062) — and no placement/Arrange control is offered while the runtime
rejects layout overrides LIVE021 (covers VE-AC-063); a silent participant
surfaces the runtime's own DDN-PJW03 text in the sheet (VE-007).
