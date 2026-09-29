# Chapter 2 — The six execution-model classes and family mapping

**Status:** full draft, 2026-09-29. Every family in the analysis corpus is
mapped to exactly one primary class; SDL holds a documented special
position. The classes determine step granularity (chapter 4 §4.2.1), replay
mode (chapter 4 §4.3), and which KEEL tiers a family needs (chapter 5).

## 2.1 The classes

### EM-1 — Token runtime

Operational semantics defined by token flow: BPMN 2.0.2 (§13.2–13.5 — the
token is a *definitional aid*; "tools are NOT REQUIRED to implement any
form of token" §13.3.1); UML activity (15.2.3.2 token-and-offer semantics,
operationalized by fUML Clause 8). By transfer: flowcharts, EPC and Petri
nets (EPC XOR/OR/AND ⊂ the BPMN token model; Petri firing ≈ the BPMN token
model with textbook-public semantics despite the gated ISO texts), and
IDEF0 ≈ an activity data-flow subset (exclusion-sweep.md Part 1A).

DDNA consequences: step granularity is a lifecycle-transition or node
firing; state snapshots are token placements (chapter 4 §4.2.4); the
family's DDNA-defined register entries are step granularity and, for BPMN,
pinned interpretations of the inclusive join (Table 13.3) and the complex
gateway (Table 13.5).

### EM-2 — Declarative DAG evaluation

Denotational evaluation over a requirement graph: DMN (§7.1 — evaluation
order derived from the requirement graph; §8.2.7 side-effect-freedom makes
steps commute), decision tables and DDN's own `decision.rules@1`.

DDNA consequences: stepping is a topological walk; the family is the
natural home of **verified replay** (recompute-and-check, chapter 4 §4.3)
because evaluation is deterministic under the declared hit-policy set.

### EM-3 — Lifecycle-FSM runtime

Operational semantics over a normative lifecycle state machine: CMMN (§8.4
nine lifecycle states, Table 8.4; §8.5 sentry rounds; GSM is lineage only,
not a normative companion). Two corpus findings shape the whole class
(runtime-models.md §5 finding 6): CaseFileItem mutations *are* the event
model (IfPart is evaluated "for all CaseFileItem events" §8.5), and human
decisions are normative runtime inputs — an engine without a
human-decision interface cannot instantiate the semantics (cmmn.md §10).

DDNA consequences: step granularity is standard-event + sentry-round;
states are non-monotonic (semi-terminal states are revisitable, cmmn.md
§10), which the snapshot rules of chapter 4 must honor.

### EM-4 — Trace-set observational semantics

The semantics *is* a set of traces: UML interactions (17.1.2 — the [P, I]
valid/invalid trace-set pair; 17.1.1 interleaving semantics) and MSC
(Z.120 §4.1 — partial ordering on events whose sequentializations are
traces; §7.5 operational composition for HMSC).

DDNA consequences: automation is **trace validation and replay, never
"execution"** — the three-valued verdict (valid / invalid / not-described,
since P ∪ I ≠ universe) is a chapter-4 validation outcome. Step
granularity is the single event occurrence; CONC-B's partial-order data
model exists primarily for this class (chapter 7 §7.4).

### EM-5 — Spec-delegated evaluation

The standard delegates evaluation to the tool: UAF (DMM §7 grid note b —
"tool vendors … capabilities native to their tools"; DMM §6 reuses
UML/BPMN semantics) and SysML parametrics partially (§10.1 — causality is
"left to the computational engine").

DDNA consequences: vendor-native by normative delegation. Claims are
"DDNA-defined" or "beyond-SysML engine behavior" (chapter 3); solver
traces must name the producing engine and version (chapter 4 §4.2.7)
because two conforming engines legitimately differ.

### EM-6 — Conformance-specification

The standard specifies *compatibility rules*, not a runtime: SoaML
(§6.4.15/§6.4.16 ServiceChannel and role-binding compatibility; behavioral
conformance is a declared semantic variation point ×4, §6.4.17.1).

DDNA consequences: static structural checking plus documented DDNA-defined
interpretations where the standard refuses to define the algorithm; the
interpretation id is recorded wherever such a check runs (chapter 10).

## 2.2 Special position — SDL

SDL-2010 is the only family whose operational semantics is formal,
normative, and in-family (sdl.md §1 ← Z.100 Introduction: Annex F supremacy
over the informal text; Annex F3 §F3.2's SDL Abstract Machine — a
distributed real-time ASM). It is an EM-1-adjacent class of its own:
*communicating extended finite state machines with a formal abstract
machine*. Its queue/schedule functions (F3.2.1.1.2) are essentially a
ready-made trace schema — the corpus' recommendation, adopted here, is
that the DDNA trace envelope (chapter 4) is drafted against F3 and
generalized (runtime-models.md §6 hole 1).

## 2.3 The family mapping

| Family | Class | Basis |
| --- | --- | --- |
| BPMN 2.0.2 | EM-1 | §13.2–13.5 token semantics; §13.3.1 token not required |
| UML activity | EM-1 | 15.2.3.2; fUML Clause 8 |
| Flowcharts / EPC / Petri nets / IDEF0 | EM-1 (transfer) | exclusion-sweep.md Part 1A |
| DMN 1.4 / decision tables | EM-2 | §7.1; §8.2.7 |
| CMMN 1.1 | EM-3 | §8.4–8.7 |
| UML interactions | EM-4 | 17.1.1–17.1.2 |
| MSC / HMSC | EM-4 | Z.120 §4.1, §7.5 |
| UAF 1.2 | EM-5 | DMM §7 note b; §6 |
| SysML parametrics | EM-5 (partial) | §10.1 |
| SoaML 1.0.1 | EM-6 | §6.4.15–17 |
| SDL-2010 | special (§2.2) | Z.100 Annex F3 |
| No-standard families (ER/Chen, DFD, C4, mind maps, org charts, VSM, network…) | unclassed | DDNA-defined semantics (chapter 8 register; chapter 12 §2) |

## 2.4 Cross-cutting consequence

For replay and simulation, **all operational classes reduce to a single
recorded interleaving** — normatively sanctioned by UML 17.1.1 ("true
simultaneity is excluded"), fUML §2.3 (any legal interleaving conforms),
and Z.120 §4.1 (traces are sequentializations). The genuinely hard
concurrency content is family-specific composition data — CMMN propagation
matrices, BPMN interrupt scopes, UML interruptible-region abort, SDL queue
ordering — not the scheduler (chapter 7 §7.4). This is why one trace
format (chapter 4) and one concurrency model (CONC-A, chapter 7) can serve
every class.
