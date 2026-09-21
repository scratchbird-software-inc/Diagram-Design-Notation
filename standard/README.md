# DDN standard — proposed Diagram Design Notation standard

The normative core of the project: what the language is, what the vocabulary
means, and how the standard evolves. The runtime in `../notation/`
implements this directory; anything here outranks the implementation.

## Contents

- `specification/` — the standard itself, numbered chapters `00–26`
  (status/scope, language, data model, views/reuse, looks, routing,
  publication, security, governance, profiles/projections, quality, field
  guide). Start at `00-status-and-scope.md`.
- `grammar/ddn.ebnf` — formal EBNF grammar of the syntactic core.
- `schemas/` — JSON Schemas (draft 2020-12): resolved IR, scene, value,
  extension, publication manifest, layout state, workspace.
- `registry/` — the machine-readable vocabulary: `catalogue.json`
  (152 object kinds, 90 relation verbs, 118 facets at 0.6.0-beta.1),
  `capabilities.json`, `data-properties.json`, `relation-constraints.json`,
  `extensions.json`, `glyph-library.svg`, `text-metrics.json`, and
  `profiles/catalogue.json` (24 installed versioned profiles).
- `plates/` — SVG notation plates (kinds, facets, relationships, looks).
- `governance/` — RFC template and versioning policy; change process lives here.
- `decisions/` — (reserved) project-level ADRs; designer ADRs live in
  `../designer/decisions/`.

## Changing the standard

Language, vocabulary, or visual-meaning changes require an RFC
(`governance/RFC-TEMPLATE.md`) and update of spec chapters, grammar, schemas,
registry, capabilities, runtime, and tests **together**. See
`../CONTRIBUTING.md` and `governance/VERSIONING.md`.
