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
  VE-AC-064); Playwright harnesses (optional).
- `src/` — future implementation home (empty).

## Status and boundaries

Research + proposed specification + bounded prototype — not a production
editor. The runtime audit baseline is 0.5.0-draft.2; known gaps (draft
validation API, occurrence addressing, safe kind conversion, full projection
editors) are listed in the specification. Source-preserving transactions and
keeping the Studio intact are hard requirements (ADR-02: DDN-native SVG/scene
as first host).
