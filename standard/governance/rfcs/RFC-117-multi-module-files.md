# RFC 117 — Self-contained multi-module files and bundling

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive grammar change (document structure);
no registry changes; new diagnostic DDN015; new public surface
`DDNLive.io.bundle(files, entry)` and CLI `bundle` command.

## Problem and motivating example

DDN aims to be a self-contained, mermaid-class notation: a full design should be
able to live in ONE file. Today a `.ddn` file holds exactly one module — a
second `module "…";` header is a parse error (DDN010) — so even the smallest
self-contained example must be split across at least two files (one for the
model, one for shared formats) plus an import line. That is friction for
paste-into-viewer workflows, documentation snippets, and single-file sharing.

Motivating example: one file carrying model, data and views as three marked
sections:

```ddn
ddn "0.5";

module "shop.model";
data model {
 object customer "Customer" { kind: table; fields { field id; field name; } }
}

module "shop.views";
view overview { data: [@shop.model.model]; }
```

A workspace of several files must also be mergeable ("bundled") into one such
file and behave identically: checking the bundled file passes, and rendering
every view produces byte-identical SVG to rendering the original workspace.

## Proposed syntax

Grammar change to the document rule (D1):

```
document  = "ddn", string, ";", { import }, section, { section } ;
section   = "module", string, ";", { top } ;
```

- A file contains one or more `module "id";` sections. Each header starts a
  section; all following top-level declarations belong to that module until the
  next header or end of file.
- Imports stay FILE-level. The canonical position for file-level imports is
  before the first module header (immediately after the `ddn "…";` line). For
  backward compatibility, imports may also appear in the legacy position —
  immediately after the FIRST module header, before that section's first
  declaration. Both sets merge into one file-level import list; alias
  uniqueness (DDN014) applies across the merged list.
- An `import` anywhere else — after a declaration has started, or inside a
  second or later section — is rejected with the new diagnostic DDN015
  ("Import must precede the first module header or follow it in the legacy
  position"). Older runtimes reject multi-module files cleanly with DDN010,
  because the second header parses as a declaration whose name is missing.

## Semantic normalization and identity effects

- Loader (D2): a file registers ALL its modules. Module identity stays unique
  across the whole workspace: a duplicate section id within one file, or two
  files declaring the same module id, keeps the existing DDN023. Symbol
  collisions across sections keep DDN024 (symbol keys remain
  `module::path`).
- Sibling sections in the SAME file are implicitly visible to each other via
  module-qualified ids (`@otherModule.path.to.id`) — no import needed between
  them; they are, by construction, in the same file.
- Imports of a multi-module file by OTHER files import the file (all its
  modules), exactly as today: `@alias.path` resolves against every section of
  the imported file in section order.
- Bundling (D4): new public surface `api.io.bundle(files, entry)` plus CLI
  `node notation/cli/cli.js bundle <entry.ddn> --workspace . --out out.ddn`:
  - Output: a `ddn "…";` header carrying the maximum language version in use,
    then sections in deterministic order — the entry file's module(s) first
    (in file order), then remaining modules sorted by module id.
  - Section bodies are the files' ORIGINAL source text minus their header
    lines (version/module/import) — comments and formatting preserved, no
    re-serialization.
  - Import lines BETWEEN bundled files are dropped (they become siblings);
    references written through the dropped aliases are canonicalized to
    module-qualified sibling references (token-precise; see Alternatives).
    Imports to files NOT in the bundle set are kept verbatim at the top of the
    output, and the bundle emits a warning diagnostic listing them — a
    workspace is only fully self-contained when closed.
  - Deterministic: same workspace → identical bytes.

## Visual encoding and routing effects

None. Section membership affects namespacing only; the resolved IR and every
rendered byte are unchanged (this is the D5 acceptance core: byte-identical
render round-trip between a workspace and its bundle).

## Alternatives considered

- **Import elision rewrites**: rewriting `@alias::` references when bundling.
  Rejected as a GENERAL rewrite (D7): section bodies are never re-serialized
  and comments/formatting survive byte-for-byte. One token-precise exception
  proved necessary: references written through an alias whose import is being
  dropped (`@alias.path`) are canonicalized to the module-qualified sibling
  form (`@moduleId.path`) at the alias token only — strings and comments are
  untouched — because a dropped alias no longer resolves once the sections
  are siblings. The item's premise that "references stay valid by D2" holds
  only when alias == module id; the existing example corpus uses distinct
  aliases (`import "customer-data.ddn" as customer`), so D5 (byte-identical
  renders) forces the canonicalization. It is deterministic and documented.
- **Cross-file symbol renaming on bundle**: rejected (D7); collisions were
  already impossible in a valid workspace (DDN023/DDN024).
- **Bumping the source version to "0.6"**: rejected (D3, see below).

## Compatibility and migration

- Source version stays `"0.5"` (D3). The change is additive: every existing
  single-module file — including the legacy import position after the module
  header — parses, loads and renders exactly as before. No migration burden.
- Multi-section files are invalid in older runtimes with a clean DDN010, so
  old tooling fails loudly rather than misreading content.
- No registry changes; no published profile is touched.

## Security, privacy and accessibility

No new I/O surface: bundling operates on an in-memory file map the caller
already trusts. The CLI `bundle` command inherits the CLI's existing workspace
confinement (symlink/traversal checks). Output size is bounded by the input
workspace size. No accessibility impact.

## Machine schema and diagnostic changes

- New diagnostic: **DDN015** — import placed after the first module header in
  a non-legacy position (after declarations began, or in a later section).
- New bundle warnings: **DDN-W013** — external imports kept at the top of the
  bundle; **DDN-W014** — conflicting external alias (first kept) or a
  reference that could not be canonicalized.
- Preserved codes: DDN010 (older runtimes on multi-module files), DDN013
  (module identity syntax, per section), DDN014 (alias uniqueness across the
  merged file-level import list), DDN023 (duplicate module identity across
  sections/files), DDN024 (duplicate declaration across sections).
- `parse` results gain a `sections` array (`{module, declarations}` per
  section); `module` and `declarations` keep their legacy meaning (first
  section's id; all declarations in file order) so existing consumers are
  unchanged.

## Positive and negative fixtures

- Positive: two-section file parses/checks; sibling cross-reference by
  module-qualified id renders; other-file importing a multi-module file gets
  all modules; `61-self-contained.ddn` (three sections: model, data, views).
- Negative: duplicate section id in one file → DDN023; import after a
  section's declarations → DDN015; symbol collision across sections → DDN024.
- Round-trip: for every example workspace (a fixed list including projections
  and quality suites), `check` on the bundle passes and every view renders
  byte-identical SVG; bundle output is deterministic; comments survive
  bundling; external imports produce the warning diagnostic and are kept at
  the top.

## Implementation/conformance impact

- `notation/runtime/ddn-core.js`: parser (sections, DDN015), loader
  (per-section module records, sibling resolution), `bundle` source helper.
- `standard/grammar/ddn.ebnf` and `standard/specification/01-language.md`
  document the new document rule; `16-workspace-and-editing.md` notes the
  workspace model change.
- Studio/viewer load multi-module files through the same `parse`/`build`
  path; the one navigation site that matched `doc.module` against a target
  view now scans sections.
- CLI gains the `bundle` command. No new npm dependencies.

## Open questions and decision record

- D1 grammar/section model — fixed (this RFC).
- D2 loader identity + sibling visibility — fixed.
- D3 version stays `"0.5"`; older runtimes reject with DDN010 — fixed.
- D4 bundle surface and determinism — fixed.
- D5 byte-identical render round-trip as acceptance — fixed.
- D6 minimal studio/viewer adaptation — fixed.
- D7 non-goals: no cross-file renaming, no general import-elision rewrites — fixed, with the recorded exception: dropped-alias reference canonicalization to module-qualified ids (forced by D5 on alias-based corpora; token-precise, deterministic).
