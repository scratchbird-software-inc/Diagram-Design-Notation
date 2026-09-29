# DDNA — DDN with Automation · proposed open standard (draft, pre-1.0)

**Status:** draft skeleton, 2026-09-29. Chapters 01, 04, 05 and 07 are full
drafts; the remaining chapters are stubs whose outlines are approved scope
but not yet prose. Per-family chapters are a follow-on work item.

## Scope

DDNA (DDN with Automation) is an **open file-format standard** that expands
DDN — it never replaces it. DDN remains complete and self-sufficient
without DDNA.

- **The DDN file is the identity basis.** Every identity referenced in a
  DDNA file is defined in a DDN file; DDNA files do not define base
  identities. One DDNA file may serve multiple DDN files.
- **Declaration direction.** DDN files declare their associated DDNA
  expansion file(s); DDNA files declare the DDN identity base(s) they
  require. Both directions are explicit in-file declarations.
- **No identity collision across bases.** When a DDNA file serves multiple
  DDN files, the combined identity space of all served bases must be
  unique; loading a DDNA file with colliding base identities is a
  validation error. This makes bare `@id` references unambiguous.
- **Alien formats are import-only.** DDN and DDNA are the only formats
  tools display, render, or execute. Alien formats (BPMN XML/DI, XMI, DMN
  XML, CMMN XML, SysML XMI, PNML, FEEL/OCL/ALF text, MSC/Z.120 PR forms,
  vendor stencils…) may be imported — read and converted into DDN/DDNA —
  but are never displayed or executed natively.
- **Both standards are open; the tools are closed.** Anyone may implement
  DDNA from the open standard. The open-source ddn-viewer and ddn-designer
  implement DDN only; DDNA tool support is commercial and closed source.
  Closure lives at the tool/product level, never in the specification.

## Relationship to `standard/`

Sibling documents. `standard/` holds the **DDN proposed standard** (the
notation/language, its registry, profiles and schemas). `ddna/` holds the
**DDNA proposed standard** (automation: traces, expression references,
runtime models, conformance claims). DDNA cites DDN; DDN never requires
DDNA. The separation rule stands for everything else: no DDNA execution
machinery, examples, or DDNA references appear in the DDN runtime, viewer,
designer, galleries, or examples — DDN-side association declarations are
inert metadata to a DDN-only tool.

## Document map

| File | Chapter | Status |
| --- | --- | --- |
| `01-purpose-scope.md` | Purpose, scope, product/format architecture (architecture & file model) | full draft |
| `02-execution-model-classes.md` | The six execution-model classes and family mapping | stub |
| `03-normative-foundations.md` | Normative foundations inventory — the claims table | stub |
| `04-trace-format.md` | The DDNA trace format | full draft |
| `05-keel-reference-interface.md` | The KEEL reference interface | full draft |
| `06-expression-behavior.md` | Expression behavior requirements per family | stub |
| `07-runtime-models.md` | Runtime models (TIME / DATA / REPLAY / CONCURRENCY) | full draft |
| `08-feature-catalog.md` | Feature catalog | stub |
| `09-decisions.md` | Decisions register (D1–D13, ratified) | stub |
| `10-conformance-claims.md` | Conformance & claims policy | stub |
| `11-alien-format-import.md` | Alien-format import policy | stub |
| `12-what-remains.md` | What remains | stub |
| `appendix-known-errata.md` | Known errata in upstream standards | appendix |

Citation convention: normative claims cite the analysis file in the DDNA
analysis corpus and, through it, the underlying standard's clause, e.g.
`(statemachines.md §1 ← UML 2.5.1 §14.2.3.9)`. Sources still marked
UNVERIFIED-PDF in the corpus are cited with a drafting note and never
normatively until the documents are acquired (chapter 12).
