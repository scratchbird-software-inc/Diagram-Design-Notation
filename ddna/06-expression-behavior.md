# Chapter 6 — Expression behavior requirements per family

**Status:** full draft, 2026-09-29. Synthesis of the three expression
inventories (expr-feel-xpath.md, expr-ocl-alf.md, expr-sdl-msc.md) with the
family analyses. This chapter specifies *behavior requirements* — the
semantic capabilities KEEL/DDNA must express or evaluate per family —
never dialects. DDNA never implements the dialects (chapter 5 §5.6);
capabilities are classed by the T0–T8 tiers of chapter 5 §5.2.

## 6.1 The capability matrix

| Family | Tiers | Required capabilities (behavior inventory) |
| --- | --- | --- |
| DMN | T2 core; T1; T6-adjacent | Typed value lattice (Any/Null); decimal128 tower; ternary logic; XML-Schema date/time arithmetic with offset-comparability rules; first-class ranges + unary tests (three `in` resolutions); immutable lists (null-on-out-of-range); partially-ordered contexts (acyclic, dependency-ordered evaluation); multi-domain quantification (vacuous-truth rules); lexically-closed functions with positional/named invocation; three lossless implicit coercions (to/from singleton list; date→date-time at UTC midnight; failed adaptation degrades to null, never raises); versioned host-injectable built-in library; `now()`/`today()` as injected values. Externally-defined (Java/PMML) functions: opaque references, flagged trace steps. |
| BPMN | T2/T3 | XPath-1.0-capability node-set navigation over a tree data model (axes, positional predicates, existential comparisons); host accessor functions (§10.4.3); IEEE-double tower; sequence-flow conditions, gateway activation expressions, loop/MI/ad-hoc conditions, **expression-valued timer attributes** (§10.5.5), conditional events, data associations/assignments. |
| CMMN | T2/T3, T4-adjacent | The same XPath-shaped surface, smaller and uniform: sentry IfPart — evaluated for ALL CaseFileItem events (T4-adjacent re-evaluation); four behavior rules (ManualActivation/Required/Repetition/Applicability); timerExpression anchored to runtime-captured `timerStart`; one tree-shaped data space (the CaseFile, §8.3.1). |
| UML state machines | T2, T3, T4 | Guards; change events (`when` — T4 re-evaluation); datamodel store + assignment; action bodies (entry/exit/do/effect) per the ALF effect inventory (§6.3); default dialect unspecified (SCXML profiles name null/ecmascript/xpath). |
| UML activity | T2 | Edge guards (decision-sourced only in fUML), weights, ParameterSet conditions, decisionInput (pure per 15.3.3.6); joinSpec/transformation/selection are reference-only by fUML's own exclusion (chapter 5 §5.5.3); imperative effects per ALF inventory. |
| UML interactions / MSC | T1, T2, T4, T6 | Full static-analysis suite (Wf/Tc/EqVar/Tc4); Eval against per-event per-instance stores; wildcards as independent don't-cares (T6); guarding-condition re-evaluation (T4); condition-name guards as trace-history lookup (DDNA data, not KEEL); loop-bound expressions; time-constraint expressions evaluated at the event's new state (Z.120 §6.2). |
| SDL | T2, T3, T4, T8 | The richest single-family surface: constant expressions (T2); pid context (self/sender/parent/offspring) and signal payload binding (T3); enabling conditions and continuous signals with **stateful guards legal** (T4, order recorded); open type environment with ASN.1-style module import and Pid sort with Make/freshness (T8); ordered literal sorts with succ/pred/position arithmetic; parameterized timer-instance identity as an evaluated data tuple; the nondeterministic-choice primitive (Any-decision). |
| SysML | T5 | Non-causal solving (relation networks, engine-chosen causality, fixpoint, state-conditioned equation sets); binding-connector structural equality decomposition (§8.3.2.3); dimensional-consistency *checking* in scope; unit *conversion* as a beyond-standard host service; objective functions/distributions optional tier. **[DD]: the default language label for untagged constraints — SysML offers none (sysml.md §10).** |
| SoaML | T7, T2 | Milestone value snapshots + progress channel (T7, removable instrumentation); OCL-capability constraints (pre/post, ownedRules) — evaluation *timing* is a variation point, so traces record when a rule was evaluated; isID correlation as structural (not KEEL). |
| UAF | T2 | OCL-capability graph traversal (the dominant use), measure-vs-actual comparison, date-interval filtering; the least KEEL of any family. |

## 6.2 The pure-evaluation inventories

**FEEL/XPath checklist** (expr-feel-xpath.md §D — what a T2 core must span
across the two dominant dialect families): the typed value lattice with
null as the universal degradation value (FEEL) alongside NaN/empty-set
(XPath); ternary logic alongside two-valued short-circuit logic;
**decimal128 alongside IEEE double** (§6.4); XML-Schema date/time/duration
arithmetic; ranges and unary tests; immutable lists with null-safe
indexing, filter, projection; acyclic dependency-ordered contexts;
quantification with vacuous-truth rules; lexically-closed functions;
node-set navigation for CMMN/BPMN data access; categorized, versioned,
host-injected built-in libraries plus host extension accessors; and purity
everywhere except sanctioned opaque references.

**OCL/ALF inventory** (expr-ocl-alf.md, applies wherever UML-family
constraints and action bodies appear):

- *(a) Pure constraint evaluation* — navigation with multiplicity-aware
  typing; four collection kinds and the iterator algebra including
  `closure` (cycle-safe transitive accumulation); three-valued logic with
  null/invalid and the normative exception table; `@pre` dual-snapshot
  reads; message expressions (`^`/`^^`, hasReturned/result) over the
  event/call log — these map directly onto DDNA recorded traces, so OCL
  postconditions become KEEL checks over a trace plus a pre/post state
  pair.
- *(b) A closed imperative-effect set* — about ten effect kinds:
  local/feature/sequence-element assignment, object/link create/destroy,
  operation call, asynchronous signal send ([0..0]), blocking `accept`
  inside active behaviors, reclassification, isolation markers (@isolated).
  KEEL needs these effect kinds, not a general language runtime.
- *(c) Strategy-pluggable variation* — the fUML/PSCS strategy-object
  pattern keeps UML-variant semantics (PSCS, PSSM) pluggable; KEEL adopts
  the same pattern (chapter 5's declared-policy slot). Alf conformance
  levels (§2.2 — minimum core vs full level) bound which tiers a given
  KEEL core declares.

## 6.3 Null/error regimes and numeric towers (cross-reference)

The four null/error regimes (FEEL null-propagation + ternary logic; XPath
empty-node-set/NaN + two-valued; OCL null+invalid with defined
three-valued logic; Alf null ≡ empty sequence) and the two numeric towers
(FEEL decimal128 vs XPath double) are specified normatively in chapter 5
§5.3–§5.4 and not repeated here. Two finer points this chapter adds from
the inventories: FEEL timezone comparability is only partially defined
(XML Schema "sometimes comparable") — mixed-offset time comparisons are a
[DD] risk to be marked as DDNA-defined; and `language` URIs in the wild
often name XPath 2.0+ or vendor dialects — DDNA treats the URI as an
opaque capability label and defines KEEL capability profiles per URI
rather than assuming XPath 1.0.

## 6.4 Guard purity per family

Family-dependent, specified in chapter 5 §5.4's table: pure for UML
activity/state machines, DMN/FEEL (externally-defined functions as the
flagged hole), OCL contexts, and BPMN/CMMN in practice; **stateful guards
legal in SDL** with order-dependent results recorded in traces (or a pure
subset declared DDNA-defined). KEEL must not hard-code purity; chapter 4's
choice records (N1) log guard results *and their order* precisely because
of this rule.
