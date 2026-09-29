# Chapter 10 — Conformance & claims policy

**Status:** full draft, 2026-09-29. What a conforming DDNA processor
must/should/may do, and the claims vocabulary every artifact uses.

## 10.1 The master rule

Claim **"mirrors X"**, **"based on X"**, or **"an implementation of X"** —
never **"conformant to X"** — unless a conformance tier of the cited
standard explicitly covers the claim. The per-family inventory of what may
and may not be claimed is chapter 3's claims table, which is normative.
This rule is the unanimous finding of every family analysis
(ANALYSIS-TEMPLATE v3 §5a and all family §5a sections).

## 10.2 Partial-interpretation inheritance

DMN §2.1, fUML §2.2, CMMN §2.1, and SoaML's additive tiers impose one
discipline, stated here once, globally: **whatever a tool interprets SHALL
match the normative clause for what it touches.** A DDNA processor that
evaluates one FEEL unary test owes clause-10 consistency for that test; a
processor that interprets one fUML construct owes the Clause-8 semantics
for that construct. There is no "small partial" exemption. This is the
normative hook for the hard KEEL boundary (chapter 5): DDNA references
dialects rather than embedding partial interpreters, because embedding one
inherits its full obligations.

## 10.3 Semantic-profile stamping is a claims device

Every trace and every DDNA file declares which semantic option set is in
force, plus its version (chapter 4 §4.2.5). Wherever a DDNA-defined
semantic substitutes for a standard one — every entry in chapter 8's
[DD] register — the artifact must label it as such. A consumer must be
able to tell, from the file alone, which claims are standard-backed and
which are DDNA-defined, and to reject or flag a file whose profile stamp
it does not implement.

## 10.4 Claim levels

Three levels, descending strength:

1. **Near-conformance (exactly two paths).**
   - *UML activity:* "mirrors fUML 1.5 Clause 8" for models inside the
     fUML subset, with static-partial-acceptance handling for the rest.
     Interruptible regions and time events are DDNA-defined and labeled.
   - *UML state machines:* "mirrors W3C SCXML Appendix D
     microstep/macrostep" as the default execution profile, with the
     UML-strict (PSSM) semantics as a declared option; "UML-conformant
     state machine execution" is never claimed (documented variation
     points).
2. **Mirrors/based-on/an-implementation-of** — the default level for
   everything else in the claims table (BPMN token semantics, SDL Annex
   F3 phases, MSC trace semantics, CMMN Clause 8, DMN clause 10 partial
   interpretation, interactions trace validation).
3. **DDNA-defined** — no standard claim at all; the point is explicitly
   ours (no-standard families, the virtual clock, every [DD] register
   entry). UAF analysis features need no claim at all — analysis is
   conformance-neutral.

## 10.5 Conformance of a DDNA processor

**A conforming DDNA processor MUST:**

1. honor the identity rules of chapter 1 (collision ban validation,
   feature-id space separation);
2. read and write the trace format of chapter 4 with all mandatory field
   groups, stamping included;
3. route every evaluation through the KEEL seam of chapter 5 — never an
   embedded dialect interpreter;
4. respect the replay mode declared by each trace's semantic-profile
   stamp (verified replay where declared, faithful replay otherwise);
5. label every DDNA-defined semantic it applies;
6. ship a capability statement (§10.6) naming the tiers and families it
   supports and the ones it does not.

**A conforming processor SHOULD:**

7. support the static-analysis overlays whose results are stored [VS]
   artifacts (chapter 8 F-X6);
8. canonicalize order-undefined evaluation results (OCL `iterate` over
   unordered collections, chapter 5 §5.5.2) before storing them in traces.

**A conforming processor MAY:**

9. implement any subset of the feature catalog (chapter 8), subject to
   the claims it makes about that subset;
10. plug host engines and analysis algorithms behind the KEEL seam and the
    D8 overlay rule.

**A processor MUST NOT:** claim certification of any kind (§10.7), execute
or display alien formats natively (chapter 11), or silently re-derive
recorded choices (chapter 4 — "record, never re-derive").

## 10.6 Capability statements

SDL Z.100 §6.2's "declare your subset" discipline is the template: a DDNA
tool ships a capability statement per family naming supported features,
unsupported features, the KEEL tiers implemented per language tag, and the
semantic profiles implemented. Statements are versioned with the tool;
chapter 4's stamps let a consumer check a file against the statement.

## 10.7 Trademark/certification posture

No compliance or certification claims without the relevant license or
certification — the standing exclusions in the DDN registry (77 catalogue
entries) are the baseline posture, unchanged. OMG marks (UML, BPMN, CMMN,
DMN, SysML, SoaML, UAF, fUML, OCL, ALF) are referenced nominatively
("mirrors clause X of OMG BPMN 2.0.2"), never as product endorsements.
ITU implementation rights are by convention, not grant — flagged for
governance (sdl.md §10).

## 10.8 Document-use posture

All OMG/W3C/ITU sources permit implementation royalty-free and forbid
document redistribution. DDNA spec text cites clauses; it never reproduces
spec text. Where a clause's wording matters (the Z.120 §5.3 spine), the
citation names document and clause and the analysis file records the
reading; the upstream PDFs are never bundled.
