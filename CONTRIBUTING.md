# Contributing to DDN

Start with the scope and invariants in
`standard/specification/00-status-and-scope.md`. The project lives in four
components (see the root `README.md`); identify which your change affects:
language, registry/vocabulary, runtime, projections, geometry/routing,
publishing/export, Studio, designer, or docs.

## How to propose changes

- **Bugs and minimal clarifications:** open an issue or PR with a concrete
  ambiguity report or a minimal source/expected-semantics fixture.
- **Language, registry, or visual-meaning changes:** write an RFC using
  `standard/governance/RFC-TEMPLATE.md`. Do not silently rewrite existing
  vocabulary (152 object kinds, 90 relation verbs, 118 facets are the
  0.6.0-beta.1 baseline).
- **Designer changes:** follow `designer/specification/00-charter.md` and its
  non-negotiables (VE-001…VE-008); record decisions as ADRs in
  `designer/decisions/`.

## Rules of the road

- Run `npm test` (notation suites) before proposing code changes, and
  `npm run build:sdk` after any runtime edit. Add explicit tests for
  rejection cases as well as successful diagrams. Preserve comments and
  existing fixtures.
- Keep model, format, and view declarations separate; never invent a business
  relationship from drawing geometry; stable IDs are not display labels.
- All contributions must be licensed GPL-2.0-or-later and be your original
  work (or clearly licensed compatibly). Do not add fonts, vendor logos, or
  copied artwork without a documented rights review. The reference runtime
  has no runtime dependencies; keep it that way.
- Hiding is not redaction: use the export/profile machinery for any public
  output, and never expose source text or semantic JSON through a public
  diagram action.
- Do not claim legal/accounting/security approval or conformance with
  external standards (UML/BPMN/DMN) from local fixture tests.

## Sign-off

By contributing you certify that you have the right to submit the work under
the GPL-2.0-or-later license (developer's certificate of origin, as in the
Linux kernel tradition). Add `Signed-off-by: Your Name <email>` to commits
where practical.
