# DDN known gaps and deferrals

This file records scope decisions that were consciously deferred, with the
reason and the revisiting hook. Entries are dated and reference the work item.

## Parameterized model fragments (B1-041, 2026-09-24) — CLOSED 2026-10-06

**CLOSED:** implemented as a 0.8 amendment (spec ch. 01 "0.8 draft amendment
(parameterized reuse)"), gated on `ddn "0.6";`: `fragment name(p1, …) {…}` +
`use: @name(a1, …)` with the documented token-level substitution rule
(declaration ids, whole `@reference` targets, whole property values, `${name}`
string interpolation; `$${` escape), nested `use:` in definition bodies with
DDN-FG04 cycle / DDN-FG05 depth-cap(8) guards, coded family DDN-FG01–FG06,
and equivalence-gate fixtures in `notation/tests/fragment-params.js`
(expanded IR identical to the handwritten model). Inspector edit scope
follows the existing D8 rule (expansions are derived/read-only; edits target
the declaration site or the fragment definition), documented in the
amendment; no tool changes were needed. The nested-use deferral closed with
it: below `ddn "0.6";` a nested `use:` remains DDN-E017.

---

Original deferral record (2026-09-24):

Phase 5 of compact authoring ships UNPARAMETERIZED include-by-reference
fragments (`fragment name { … }` + `use: @name;`) plus the full preset family
(named field/port groups, relation property sets, generic/motion property
presets). Parameterized fragments — `fragment staged_process(name, stages)
{…}` with substitution into identifiers and labels — were judged
disproportionate for this phase: identifier substitution interacts with
source-span authoring edits (D8 edit scope), identity predictability, and the
token-precise normalizer in ways a textual-substitution rule cannot settle
cheaply.

Chosen scope (per the B1-041 D6 scope rule): minimum viable = unparameterized
fragments + all other preset types, implemented and equivalence-gated.

Revisiting: a parameterization proposal needs (a) one documented substitution
rule covering identifiers and strings, (b) an answer for inspector edit scope
on substituted instances, and (c) equivalence-gate fixtures against the
handwritten expansion. Related deferral inside phase 5: definitions are
closed templates (`use:` inside a definition body is DDN-E017); nested
presets/fragments can be reconsidered together with parameterization.

## DDN 0.8 deferrals to 0.9 (2026-10-04)

The 0.8 standard (spec chapters 51–58, source version `ddn "0.6";`)
consciously deferred three items; none is a gap in what shipped, each has a
named hook:

- **Diff views** (`diff: [@viewA, @viewB]`, ch. 55 §55.6) — ~~deferred so the
  uid move/duplicate semantics (§55.5) could settle first. 0.8 processors
  reject `diff` as DDN-V04 rather than half-implementing it. Revisiting: 0.9,
  building on the uid contract without amendment.~~ **CLOSED 2026-10-06:**
  implemented as a 0.8 amendment (ch. 55 §55.6), gated on `ddn "0.6";`.
  Matching is by local source id within the data block (workspace uids cannot
  correlate two revisions — DDN026); states added/removed/changed/unchanged
  ride the §55.1 marking paint conventions (colour + dash/strike/token, mono
  distinguishable) with an automatic diff key; the union lays out fresh under
  the diff view's own profiles. Coded family DDN-DF01–DF04; conformance
  vectors `diff-basic` + `reject-ddn-df03`; suite
  `notation/tests/diff-views.js`.
- **Assertion evaluation** (ch. 55 §55.2) — **CLOSED for the conservative 0.8 amendment:** structured assertion elements perform read-only property lookup and equality (DDN-AS01–03; `notation/tests/assertion-eval.js`). String assertions remain inert. This does not provide arbitrary expression execution.
- **Mermaid import** (ch. 57 §57.4) — ~~the 0.8 surface only fixes where it
  will live (a designer "Import…" command producing ordinary 0.6 source).~~
  **CLOSED 0.9:** the designer's Files-drawer **Import…** command converts
  the practical Mermaid subset (flowchart, sequenceDiagram, classDiagram,
  erDiagram, stateDiagram) to ordinary DDN source with an explicit loss
  report; it is a reference-tool feature only — the spec and the conformant
  runtime stay Mermaid-free (see `notation/tool/src/mermaid-import.js` and
  tool.md "Import from Mermaid").

## Known 0.8 tooling gaps (2026-10-04)

Behavior verified against the frozen runtime; documented as-is in
`website/download/DDN-AI-REFERENCE.md` §14 until fixed:

- **`font_pin` is not CLI-loadable.** ~~The CLI side-loads background
  images/patterns into the workspace file map but not `font_pin` metrics
  files~~ **CLOSED 2026-10-04:** `notation/cli/cli.js`'s asset walker now
  side-loads `font_pin` JSON (UTF-8 text) under the same containment rules
  as background assets; covered by `notation/tests/cli-tooling.js`.
- **DDN-W106 noise on 0.8 element/relation properties.** ~~`numeral`,
  `marks` and `assertion` are absent from the legacy reserved-property list
  in `notation/runtime/ddn-contracts.js`, so default logical validation also
  warns DDN-W106 for each~~ **CLOSED 2026-10-04:** the three keys are now
  registered in the reserved-property list; their dedicated codes
  (DDN-VP05/06, DDN-MK01/02) remain the only diagnostics.
- **Spec-vs-runtime code drift in ch. 51.** ~~Chapter 51 says an unsupported
  version header is DDN010; the runtime raises DDN012~~ **CLOSED
  2026-10-04:** chapter 51 amended to document DDN012 (the pre-existing,
  correct runtime code); behavior unchanged.
