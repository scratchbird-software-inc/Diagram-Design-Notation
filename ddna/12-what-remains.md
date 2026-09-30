# Chapter 12 — What remains

**Status:** full draft, 2026-09-29. The honest remainder: gated families,
open questions, document acquisition, version-drift items, and the roadmap
to 1.0.

## 12.1 Tier-3 gated families (awaiting documents)

The reading list's acquisition queue, with license status per the standing
legal review. Their exclusions stand until texts arrive; several are
covered *by transfer* (EPC/Petri/IDEF0 ≈ BPMN/activity subsets,
exclusion-sweep.md Part 1A) which is documentation, not acquisition.

| Family | Value for DDNA | Status |
| --- | --- | --- |
| IEC 61131-3 | high — strong execution semantics tradition (PLC scan cycle) | text not in hand |
| ISO 15909 (Petri nets) | medium — firing semantics textbook-public | text gated; transfer covers the core |
| ISO/IEC 19507 (ORM) | medium | text gated |
| ISO 5807 (flowcharts) | low (notation complete at DDN layer) | text gated |
| ArchiMate 4 (C260) | medium | **license hold — evaluation license under legal review** |
| ISA-5.1 | low (symbols shipped common-practice) | document review pending |
| IEC 60617 | low | **license hold — full database licensed** |
| ISO 42010 | framing only — the alignment annex already maps it (DDN spec ch.48) | not blocking |

## 12.2 No-standard one-pagers

In reading-list order: DFD, ER/Chen, EPC, C4, mind maps, org charts,
timelines, VSM, network. Each is a "no normative semantics — DDNA features
are ours to define [DD]" finding. ER/Chen's one-pager is ratified (D3:
declarative-constraint semantics + KEEL T1/T2) and carries the seven
uncovered inventory entries of that hole.

## 12.3 Open questions (as of this draft)

1. **DATA A-vs-C final selection** — the one deferred runtime choice
   (chapter 7 §7.2); to be settled as the per-family chapters show which
   facets are actually distinct.
2. **Per-family chapter authoring** — **complete**: twelve chapters under
   `ddna/families/` cover all six execution-model classes plus the
   no-standard families (tier-3 gated families excepted, §1). Remaining
   here: core/optional tags in chapter 8 get their final form.
3. **Interactive view state** — out of v1 (D2), with an explicit
   revisit-after-replay note.
4. **Shared converter core licensing** — open vs dual-licensed (D9 names
   the structure, not the license).

## 12.4 Document acquisition (UNVERIFIED-PDF carry-overs)

Before DDNA cites these normatively:

- UML 2.5.1 (ptc/17-12-05) §14.2.3.9 — subsection numbering unverified
  (content corroborated by ≥3 secondary sources; the 18 MB fetch limit
  blocked acquisition);
- PSSM 1.0 (ptc/19-04-03) — chapter numbers and the conformance-suite
  license;
- Z.120 Annex B (1998) — the process-algebra semantics, a separately
  published Recommendation;
- Z.103/Z.104/Z.105/Z.106/Z.107 — SDL shorthand, data language, ASN.1,
  CIF, OO data;
- full DMN 1.4 clause-10 fine print (10.3.2/10.4).

ALF 1.1 was acquired and inventoried — that hole is closed
(expr-ocl-alf.md). Until acquisition, these sources are cited with
drafting notes only (the README's citation convention).

## 12.5 Version-drift items

- **DMN 1.4 (profile) vs 1.5 (current)** — claims are pinned to 1.4
  (chapter 3); the FEEL inventory was read against 1.5 clause 10 where
  the family file says so (expr-feel-xpath.md Meta) — reconciliation is a
  per-family-chapter task.
- **UAF 1.2 (profile) vs 1.3 (current)** — future revision item.
- **Upstream errata** — the two verified errata (CMMN Clause-2
  off-by-one; SysML §11.3.2.7 probability constraint 4 copy-paste) live in
  the appendix with the rules they imply.

## 12.6 Repo-collision items the DDNA file format must honor

- The `flow` overloading ban for trace identity (chapter 4 §4.2.6) —
  trace data gets its own block type.
- The additive `coreg` fragment operator (landed for MSC) must not be
  repurposed by DDNA tooling.
- SDL↔MSC trace-schema coordination — MSC is the *rendering* of an SDL
  trace, not a second execution format (feature F-SDL-4).

## 12.7 Roadmap to 1.0

1. **Owner review of this skeleton** (12 chapters + appendix) — gate for
   per-family work.
2. **Feature finalization** — catalog core/optional tags finalized against
   the landed family chapters; DATA A-vs-C settled.
3. **The DDNA file format itself** — the expansion-file grammar (association
   declarations, feature definitions in the feature-id space, trace
   blocks, expression references), designed against chapters 1, 4, 5 and
   honoring §12.6.
4. **Reference implementations** — the scratch PoC harness exercises the
   trace format and KEEL seam as drafted; conformance vocabulary
   (chapter 10 §10.5) gets its first capability statements.
5. **Acquisition complete** (§12.4) — UNVERIFIED-PDF flags either resolved
   or converted to permanent drafting notes.
