# DDN — Diagram Design Notation · standards-body submission draft

**Status: DRAFT proposal (2026 draft).** No standard number has been
assigned; a standards body assigns numbers. Nothing here claims adoption,
acceptance, or prior submission. This document was generated from the
project's machine-readable sources by `tools/build-submission.mjs`; every
count is traceable to `standard/submission/facts.json`.

## 1. Scope and purpose

DDN is an open dialect for describing diagrams as plain text. One semantic
model — the data — projects into many diagram types through independent
view declarations: **data, format, and view are separate, composable
sections**, so the model is edited once and every view follows. Identity
is stable: every declaration carries a module-scoped identity
(`module::path`), unique across the workspace, and references are
explicit `@id` forms, never positional. Provenance is explicit: source
files are the truth, every rendered artifact is deterministic from them
(same source → identical bytes), and generation tooling is
freshness-checked so committed artifacts provably match their sources.

The project and the standard are **open**: the specification, the
machine-readable registry, and the reference implementation are published
together; anyone may implement DDN from the documents alone.

## 2. Normative core (mapped to specification chapters)

The normative core lives in `standard/specification/` — **63**
chapters covering: status and conformance scope (ch. 00); the language and
decoding rules (ch. 01); the data model and executable contracts (ch. 02);
views, selection and reuse definitions; routing and layout; publication;
security; notation profiles and diagram families (ch. 17, with per-family
sections); quality projections and validation; cross-file addressing and
architecture containers (§17.25); and the icon pack format (ch. 49) with
its JSON Schema. The syntactic core has a formal EBNF grammar
(`standard/grammar/ddn.ebnf`), and **10** JSON Schemas
(draft 2020-12) cover the resolved IR, scene, values, extensions,
publication manifest, layout state, workspace, and icon packs.

## 3. The machine-readable vocabulary (registry)

The vocabulary is data, not prose: `standard/registry/` is the
machine-readable catalogue that the specification and the runtime share.

| Measure | Count | Source |
| --- | --- | --- |
| Core object kinds | 153 | registry catalogue |
| Core relation verbs | 91 | registry catalogue |
| Profile object kinds | 222 | profiles catalogue |
| Profile relation verbs | 94 | profiles catalogue |
| **Total element kinds** | **375** | computed |
| **Total relation verbs** | **185** | computed |
| Registered silhouette identifiers | 55 | profiles catalogue |
| Installed profiles | 151 | profiles catalogue |
| Projection kinds | 12 | language choices |
| Documented diagnostics | 161 | diagnostic fix guide |

## 4. Extension mechanism, profiles, and icon packs

Three additive mechanisms keep the core small and everything else a
versioned layer:

- **Extension contracts** — **71** `x_*`-prefixed
  contracts declared in the registry of extension contracts. Unknown
  extensions are carried (never silently dropped); known ones are
  schema-validated. Old processors pass new extensions through untouched.
- **Profiles and projections** — a view's `projection.profile` names its
  model kind. **151** versioned profiles are installed
  across **12** projection kinds (per-projection
  distribution: {"graph":85,"chen":3,"matrix":8,"panels":12,"table":1,"chart":30,"timeline":1,"fishbone":1,"decision":1,"sequence":4,"timing":2,"geo":3}). Profiles are vocabulary +
  validation layers over the same machinery — no profile redefines core
  semantics.
- **Icon packs** (`ddn-icon-pack@1`, spec ch. 49) — symbols ship as
  single self-contained JSON documents with a manifest (id, name, version,
  license, attribution, source) and inline stroke-SVG icons. **8**
  packs ship with **328** icons total, of which **3**
  are curated MIT-licensed third-party selections with license texts in
  their manifests. Every icon — shipped or host-supplied — is sanitized
  before rendering (no scripts, embedded documents, event handlers, or
  external references; 20 KiB cap per icon). Host applications may
  register their own packs at runtime; they are validated and sanitized
  identically.

## 5. Governance and versioning

The standard evolves through a documented change process: language,
vocabulary, or visual-meaning changes require a change record and the
coordinated update of specification chapters, grammar, schemas, registry,
capabilities, runtime, and tests together. Source versions are explicit
in every file (`ddn "x.y";`); processors must reject unknown source
versions rather than guess. Registry identities are never removed or
repurposed — incompatible changes are new identities, so existing
documents keep rendering exactly as written. **Processor conformance**
for DDN means: parse and render the documented dialect, honor the
registry's endpoint contracts and profile validators, surface every
diagnostic with its code, and never silently reinterpret unknown content.

## 6. Intellectual property and licensing

The project is GPL-2.0-or-later; the DDN standard itself is an **open
file-format standard** — the closure is at the tool/product level, never
the specification. Third-party marks (UML, BPMN, CMMN, DMN, SysML, SoaML,
UAF, fUML, OCL, ALF, ArchiMate, SDL, MSC and others) are referenced
nominatively to describe which well-known diagram families DDN provides
profiles for — never as endorsements, and with no certification claims
(the project's standing exclusions: no metamodel interchange execution,
no execution semantics, no formal certification). Bundled third-party
icon artwork (two MIT-licensed curated selections) is attributed in
`NOTICE.md` with license texts included in the pack manifests.

---
*Generated draft. Numbers: standard/submission/facts.json. Regenerate:
`node tools/build-submission.mjs`; drift-check: `--check`.*
