# DDNA — DDN with Automation · proposed open standard (draft, pre-1.0)

**Status:** full draft skeleton, 2026-09-29. All twelve chapters and the
appendix are full drafts. Per-family chapters: the full program has landed under `ddna/families/` (twelve chapters covering all six execution-model classes plus the no-standard families; tier-3 gated families excepted, chapter 12 §1).

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
- **Both standards are open; the open tool implements both.** Anyone may
  implement DDNA from the open standard. The open-source ddn-viewer and
  ddn-designer implement DDN *and* DDNA — companion files, trace replay and
  generation, execution engines, KEEL evaluation (2026-10-08 owner
  direction). The commercial product (ScratchWeaver) differentiates
  quantitatively and collaboratively, not by capability: it removes the
  open tool's per-view display limits and adds concurrent editing,
  collaboration, history and extended functionality. Differentiation lives
  at the tool/product level, never in the specification.

## Relationship to `standard/`

Sibling documents. `standard/` holds the **DDN proposed standard** (the
notation/language, its registry, profiles and schemas). `ddna/` holds the
**DDNA proposed standard** (automation: traces, expression references,
runtime models, conformance claims). DDNA cites DDN; DDN never requires
DDNA. The separation rule stands for the engine and dialect: no DDNA
execution machinery in the DDN *runtime/renderers*, and DDN-side
association declarations are inert metadata to a DDN-only parser. The open
tool (viewer/designer) implements both formats (2026-10-08 policy); what
the commercial product adds is scale (display limits removed), concurrent
editing and collaboration — not capabilities withheld from the open tool.

## Document map

| File | Chapter | Status |
| --- | --- | --- |
| `01-purpose-scope.md` | Purpose, scope, product/format architecture (architecture & file model) | full draft |
| `02-execution-model-classes.md` | The six execution-model classes and family mapping | full draft |
| `03-normative-foundations.md` | Normative foundations inventory — the claims table | full draft |
| `04-trace-format.md` | The DDNA trace format | full draft |
| `05-keel-reference-interface.md` | The KEEL reference interface | full draft |
| `06-expression-behavior.md` | Expression behavior requirements per family | full draft |
| `07-runtime-models.md` | Runtime models (TIME / DATA / REPLAY / CONCURRENCY) | full draft |
| `08-feature-catalog.md` | Feature catalog | full draft |
| `09-decisions.md` | Decisions register (D1–D13, ratified) | full draft |
| `10-conformance-claims.md` | Conformance & claims policy | full draft |
| `11-alien-format-import.md` | Alien-format import policy | full draft |
| `12-what-remains.md` | What remains | full draft |
| `appendix-known-errata.md` | Known errata in upstream standards | appendix |
| `families/uml-state-machines.md` | Family chapter: UML state machines (EM-1, state) | full draft |
| `families/uml-activities.md` | Family chapter: UML activities (EM-1, token) | full draft |
| `families/bpmn.md` | Family chapter: BPMN 2.0.2 (EM-1, token) | full draft |
| `families/sdl.md` | Family chapter: SDL-2010 (special position) | full draft |
| `families/dmn.md` | Family chapter: DMN 1.4 (EM-2) | full draft |
| `families/cmmn.md` | Family chapter: CMMN 1.1 (EM-3) | full draft |
| `families/uml-interactions.md` | Family chapter: UML interactions (EM-4) | full draft |
| `families/msc.md` | Family chapter: MSC/HMSC, Z.120 (EM-4) | full draft |
| `families/sysml-parametrics.md` | Family chapter: SysML 1.6 parametrics (EM-5) | full draft |
| `families/soaml.md` | Family chapter: SoaML 1.0.1 (EM-6) | full draft |
| `families/uaf.md` | Family chapter: UAF 1.2 (EM-5) | full draft |
| `families/no-standard-families.md` | Combined chapter: ER, DFD, EPC, C4, mind maps, presentation families | full draft |

Citation convention: normative claims cite the analysis file in the DDNA
analysis corpus and, through it, the underlying standard's clause, e.g.
`(statemachines.md §1 ← UML 2.5.1 §14.2.3.9)`. Sources still marked
UNVERIFIED-PDF in the corpus are cited with a drafting note and never
normatively until the documents are acquired (chapter 12).
