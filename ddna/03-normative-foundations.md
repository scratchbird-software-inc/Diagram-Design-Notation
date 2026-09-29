# Chapter 3 — Normative foundations inventory (the claims table)

**Status:** full draft, 2026-09-29. What a DDNA tool may claim per family,
with the normative source pinned by version. Master rule
(ANALYSIS-TEMPLATE v3 §5a): claim **"mirrors X" / "based on X" / "an
implementation of X"**, never **"conformant to X"**, unless a conformance
tier explicitly covers the claim. **S** marks the strongest available
claim in the set. UNVERIFIED-PDF items carry drafting notes and are never
cited normatively until acquired (chapter 12 §4).

## 3.1 The claims table

| Family | What the standard regulates | Claim a DDNA engine may make | Claim it must NOT make | Source pin |
| --- | --- | --- | --- | --- |
| UML activity | fUML §2: syntactic+semantic conformance levels with three partial-acceptance reactions (Rejection / Static Partial / Dynamic Partial); UML §2 type-5 semantic conformance is permissive ("a demonstrable way to interpret") | **"Mirrors fUML 1.5 Clause 8"** for models inside the fUML subset, with static-partial-acceptance handling for the rest (S — the only family with a normative operational semantics *and* conformance levels for execution); interruptible regions and time events are "DDNA-defined semantics" | fUML conformance for constructs fUML excludes (joinSpec, weight, selection, transformation, regions, TimeEvents — fUML §7.10/§7.4) | fUML 1.5 §2.1–2.2, §7.10; UML 2.5.1 §15.6.3 |
| UML state machines | UML ch.14 (RTC, event pool — informal, with named semantic variation points); PSSM 1.0 ships a normative RTC-step trace conformance suite (UNVERIFIED-PDF); SCXML Appendix D is a fully deterministic free-text algorithm with a W3C test suite | **"SCXML-mode default (mirrors W3C SCXML Appendix D microstep/macrostep), with UML-strict (PSSM) semantic option"**; per-file semantic-profile declaration | "UML-conformant state machine execution" — UML leaves pool order and corner cases as variation points; PSSM ambiguities documented (Elekes 2023, cited in statemachines.md §10) | SCXML §3.13/App.D (verified); UML 2.5.1 §14.2.3.9 (UNVERIFIED-PDF subsection); PSSM 1.0 (UNVERIFIED-PDF) |
| BPMN | §13.1: execution semantics informal-text, REQUIRED only for Process Execution Conformance; tokens "NOT REQUIRED" (§13.3.1); no step semantics, no simulation conformance class, no companion standard | **"An implementation of BPMN 2.0.2 §13 token semantics"** with DDNA-defined step granularity (lifecycle-transition per Fig 13.2) and DDNA-pinned interpretations of the inclusive join (Table 13.3) and complex gateway (Table 13.5) | Any conformance or simulation claim; any claim that stepping is BPMN-mandated | BPMN 2.0.2 §13.1–13.5, §10.5.5 |
| CMMN | §2.1–2.6 four compliance points; Case Modeling Conformance "SHALL comply with Clauses 5, 6, and 8" but nothing requires an executable engine; §2.1: partial compliance may only claim "based on this specification". Known erratum E1 (appendix): Clause-2 numbering is off by one | **"Based on CMMN 1.1 Clause 8 lifecycles and §8.5 sentry evaluation"**; a state overlay may be claimed as a direct spec-faithful materialization of §8 | CMMN conformance of any tier | CMMN 1.1 §8.4–8.7, §2.1–2.6 |
| DMN | §2.1: CL1 never required to interpret, but any interpretation SHALL be consistent with clause 10; §2.2.2 same for diagram semantics; §8.2.10: hit-policy subsetting allowed | **"Partial interpretation consistent with DMN clause 10 for what it touches"** — partial engines inherit full obligations for what they interpret (the normative hook for the hard KEEL boundary, chapter 5) | Full FEEL conformance unless the host engine actually implements all of clause 10 | DMN 1.4 §2.1–2.2, §8.2.7, §8.2.10 (1.4 pin; 1.5 is the drift item, chapter 12 §5) |
| UML interactions | UML §2 type-5 semantic conformance (permissive); semantics is the [P, I] trace-set; P∪I ≠ universe (17.1.2); Timing Diagrams optional (17.1.4) | **"Trace validation against the [P, I] semantics of UML 17.1.2/17.6.3"** with a three-valued verdict (valid / invalid / not-described); any step granularity declared DDNA-defined | "Executing a sequence diagram" — interactions are trace descriptions, not executable models | UML 2.5.1 §17.1.1–17.1.4, 17.4.3.5, 17.6.3 |
| MSC | Z.120 has NO conformance clause and no tool classes; informal semantics (Summary); Annex B process algebra is the formal companion (UNVERIFIED-PDF, not acquired) | **"An implementation of Z.120 (02/2011) trace semantics"**; subsetting legitimized by the standard itself (untimed = "comments/annotations only", §6.1) | "MSC execution conformance" — no such thing exists to claim | Z.120 (02/2011) Summary, §4.1, §6.1 |
| SDL | Z.100 §6.1.1–6.1.7 tool-compliance ladder — all notation/grammar classes, **no execution class**; §6.2: subset tools should ship a conformance statement, else assumed fully compliant; Annex F supremacy over informal text | **"Mirrors Annex F3 (06/2021) SDL Abstract Machine phases"** (F3.2.3.2) with a §6.2-style capability statement naming unsupported features; pin the 06/2021 edition (F3.1.4 concedes incomplete areas) | "Z.100-conformant" (the tiers don't cover execution); any claim inconsistent with Annex F | Z.100/Z.101/Z.102 + Annex F3, 06/2021 editions |
| SysML | §5.2 three conformance types, ALL syntactic/interchange — **no execution/simulation tier exists**; a tool that never solves a constraint is fully SysML-conformant | **"Beyond-SysML engine behavior"** — evaluation claims are explicitly outside SysML conformance | Any implication that constraint solving is SysML-mandated or SysML-conformance-relevant | SysML 1.6 §5.2, §10.1 |
| SoaML | §2: design tools owe concrete+abstract syntax; **runtime tools owe only XMI** — no runtime-behavior conformance; behavioral conformance is a semantic variation point ×4 | **"A DDNA-defined interpretation of SoaML behavioral conformance (documented per §6.4.17.1)"** — the spec requires conformance but refuses to define the algorithm | "SoaML conformance" for behavioral checking | SoaML 1.0.1 §2, §6.4.15, §6.4.17.1 |
| UAF | DMM §2 four conformance types, all syntax/interchange; grid note b delegates simulation to tool vendors | **No conformance claim needed for analysis features** — analysis is conformance-neutral; derivation rules are DDNA-defined | Any normative citation for *how* impact analysis resolves (none exists) | UAF 1.2 DMM §2, §7 |
| No-standard families (ER, EPC, C4, flowcharts, DFD, VSM…) | No governing standard | "DDNA-defined semantics" — the one-pager findings (chapter 12 §2) | Any standards-based claim | — |

## 3.2 Reading the table

1. **The near-conformance path is exactly two families wide.** Only UML
   activity (via fUML Clause 8) and UML state machines (via SCXML Appendix
   D) offer anything approaching execution conformance language. Every
   other row caps at "mirrors/based-on/an implementation of" or
   "DDNA-defined" (chapter 10 §10.4).
2. **Partial-interpretation inheritance is global.** DMN §2.1, fUML §2.2,
   CMMN §2.1 and SoaML's additive tiers all impose the same discipline:
   whatever a tool interprets SHALL match the normative clause for what it
   touches (chapter 10 §10.2).
3. **Version pins are claims.** Each row pins an edition; the drift items
   (DMN 1.4→1.5, UAF 1.2→1.3, the appendix errata) are tracked in
   chapter 12 §5.
