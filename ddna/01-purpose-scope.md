# Chapter 1 — Purpose, scope, and the architecture & file model

**Status:** full draft, 2026-09-29. Ratified owner decisions (DDNA-NOTES.md)
are stated as binding; derived implications remain marked where noted.

## 1.1 Purpose

DDNA specifies:

1. the **expansion-file format** that attaches automation data — traces,
   expression references, executable attributes, semantic-profile
   declarations — to DDN-defined identities;
2. the **KEEL reference interface** by which DDNA tools delegate evaluation
   to host engines (chapter 5);
3. **conformance and claims rules** per standards family (chapters 3, 10).

DDNA does not specify: notation (DDN owns it), host-engine internals (the
host owns its engines), or any execution claim beyond what the cited
standards support (chapter 3's claims table).

A standing warning frames the whole specification: the largest engineering
temptation is partial re-implementation of expression languages inside DDNA
tools. DMN §2.1 makes any partial interpreter inherit full clause-10
consistency obligations for what it interprets (dmn.md §10). The KEEL
boundary in chapter 5 is therefore a hard architectural rule, not a
preference.

## 1.2 Product and format architecture

Binding decisions (owner's words, DDNA-NOTES.md):

1. **Both standards open.** DDN and DDNA are open file-format
   standards. Anyone may implement DDNA from the open standard; product
   differentiation lives at the tool/product level, never in the
   specification.
2. **The open tool includes DDNA (2026-10-08 owner direction, superseding
   the 2026-09-29 capability split).** The open-source ddn-viewer and
   ddn-designer support DDN *and* DDNA: companion files, trace replay **and**
   trace generation, execution engines and KEEL evaluation are all in the
   open tool. The commercial product (ScratchWeaver) differentiates
   **quantitatively and collaboratively**, not by capability: it removes the
   open tool's per-view display limits (how many elements/traces/etc. one
   view may display) and adds concurrent editing, collaboration, history and
   extended functionality.
3. **DDNA expands DDN, never replaces it.** DDN remains complete and
   self-sufficient without DDNA.
4. **DDNA never silently redefines notation.** The automation layer must
   not change what a DDN diagram means or smuggle execution into the free
   tools.
5. **KEEL fully in scope.** The earlier "KEEL never in DDN" framing was
   about separation, not capability. The DDNA specification fully specifies
   KEEL integration and every automation feature that can legally be
   supported. The only standing restrictions are license holds (ArchiMate
   commercial license, the IEC 60617 full database, and the legal review
   queue).
6. **The `[viewer-safe]` mark** means only "technically pure playback of
   static file data" — a fact about a feature, not a scoping restriction.

## 1.3 The DDN↔DDNA file relationship

Binding decisions (owner's words, 2026-09-29):

- DDN and DDNA are both **on-disk file formats**.
- **DDN files declare their associated DDNA files** — the DDN file names
  the DDNA expansion file(s) that support it.
- **DDNA requires DDN files as identity bases** — every identity referenced
  in a DDNA file is defined in a DDN file. DDNA files never define base
  identities.
- **One DDNA file may support multiple DDN files.**

Derived implications, ratified at the D1–D13 decision round:

- **Reference direction.** DDN → declares → DDNA companions; DDNA →
  requires → one or more DDN identity bases. Both directions are explicit
  in-file declarations.
- **Graceful degradation.** A DDN file must fully parse and render when its
  DDNA associations are absent. The DDN-side association declaration is an
  **ignorable `x_`-style extension property** (ratified D10): DDN-only
  tools pass it through untouched; no new grammar breaks old parsers.
- **Versioning coupling.** A DDNA file records which DDN source version and
  which DDNA standard version it targets.

## 1.4 The association machinery (as specified by DDN)

The DDN proposed standard specifies the concrete cross-file mechanism DDNA
associations use (DDN specification §17.25, "Cross-file addressing and
architecture containers"). Three devices, all built on DDN's existing
module-scoped identity (`module::path`) and import machinery:

1. **Architecture containers** — a top-level
   `architecture id "Label" { files: ["a.ddn", …]; description: "…"; }`
   declaration groups the declaring file and the named base files into one
   described architecture (the ISO 42010 mapping: the container is the
   architecture description; each view inside stays governed by its
   profile). Base files join the shared symbol machinery; any duplicate
   module, declaration, or uid across bases fails `DDN-PJ216`.
2. **Module-qualified references** — `@module.id.path` addresses an element
   in a base file. Module ids are globally unique, so the reference is
   unambiguous; bare ids never resolve cross-file (`DDN031`). Traceability
   relations spanning bases require a covering container (`DDN-PJ217`), and
   an endpoint outside the current view renders as an off-page badge rather
   than failing or vanishing.
3. **`x_link` association metadata** — `x_link: { file, target }` on any
   relation is the lightweight cross-file association. It is *ignorable
   metadata to a DDN-only tool* (the ratified D10 mechanism): when the
   target file is present, the identity is validated (`DDN-PJ216` on
   failure); when it is absent — for example a DDN file opened alone in the
   viewer — the result is a `DDN-PJW07` warning and a muted *unresolved*
   note, never an error.

DDNA association declarations are expressed with these devices. A DDNA
implementation must accept the same diagnostics vocabulary; a DDN-only tool
encounters all of it as inert metadata.

## 1.5 Identity rules

Binding (owner's words, 2026-09-29, ratified):

1. **No identity collision across bases.** When a DDNA file serves multiple
   DDN files, the combined identity space of all bases must be unique.
   Loading a DDNA file with colliding base identities is a validation
   error. (This is the same rule DDN enforces for architecture bases as
   `DDN-PJ216`; the DDNA validation must produce an equivalent diagnostic.)
2. **Bare `@id` references suffice.** The collision ban makes bare
   identities unambiguous across the served bases; DDNA references do not
   need (base-file, identity) pairs, though module-qualified forms remain
   available for disambiguation by inspection.
3. **Features are many-to-many.** One DDNA feature (an automation, a rule,
   an animation) may be defined once and applied to or referenced by many
   identities across the served DDN files. DDNA feature definitions get
   their own **feature-id space**, separate from DDN element identities, so
   N-elements→1-feature references stay clean.
4. **Shared-feature rule.** Because a feature id is shared across bases, a
   feature definition must not embed base-specific identity assumptions:
   references inside a feature body resolve against the union identity
   space of the served bases under rule 1, and a feature that cannot apply
   to an identity it is referenced by is a validation error (the exact
   applicability predicates are per feature type — chapters 4–8).

## 1.6 Out of scope

- Notation: DDN owns it. DDNA attaches data to DDN identities; it does not
  draw.
- Host-engine internals: the host owns its engines; chapter 5 specifies
  only the seam.
- ML/inference capabilities: advisory and inference behaviors are out of
  scope (ratified D1).
- Interactive view state: out of DDNA v1 (renderer/host concern); revisit
  after trace replay ships (ratified D2).
- Native alien-format support: import-only, per chapter 11.
- Execution claims beyond the claims table (chapter 3) and the claims
  policy (chapter 10).

## 1.7 The separation rule (standing; amended 2026-10-08)

DDNA content must not leak into the open DDN repo's **dialect, runtime or
renderers** — engine purity is an architecture statement, not a licensing
boundary: the DDN render pipeline stays notation-only, and DDNA references
in DDN files stay inert metadata. DDNA files and examples live with the DDNA
specification work (this open standard). The open DDN repo needs at most a
documented file-format relationship — this chapter is that document.

~~DDNA content must not leak into the open DDN repo's dialect, tools,
examples, or galleries.~~ As of 2026-10-08 the **tool-side** wall is
repealed (§1.2 decision 2): the open viewer/designer implement DDNA.
What remains standing is only the engine/format separation above plus the
existing technical caps (per-view display limits) that the commercial
product removes.
