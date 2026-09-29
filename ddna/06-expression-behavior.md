# Chapter 6 — Expression behavior requirements per family

**Status:** stub (scope approved, prose pending the per-family work item).

## Outline

Semantic capabilities KEEL/DDNA must be able to express or evaluate per
family, organized by the T0–T8 tiers of chapter 5 (behavior, not dialect —
DDNA never implements the dialects):

- DMN: T2 pure evaluation core (typed value lattice, decimal128 tower,
  ternary logic, ranges/unary tests, immutable lists, ordered contexts,
  coercions, versioned built-ins, injected now()/today()); T6-adjacent
  opaque external functions.
- BPMN: T2/T3 over a tree data model (XPath node-set navigation, host
  accessor functions, double tower); expression-valued timer attributes.
- CMMN: the same XPath-shaped surface, smaller and uniform (sentry IfPart,
  four behavior rules, timerExpression, one CaseFile data space).
- UML state machines: T2 guards + change events, T3 store + assignment,
  imperative effects (ALF inventory); default dialect unspecified.
- UML activity: T2 edge guards, weights, ParameterSet conditions,
  decisionInput purity; fUML exclusions reference-only.
- UML interactions / MSC: T1 full static analysis, T2 per-event stores,
  T6 wildcards, T4 guarding conditions, condition-name guards as trace
  history.
- SDL: the richest surface — T2–T4 (stateful guards legal), T8 open type
  environment, ordered literal sorts, parameterized timer identity,
  Any-decision.
- SysML: T5 non-causal solving, binding-connector equality decomposition,
  dimensional checking; default constraint-language label is
  DDNA-defined.
- SoaML: T7 milestone instrumentation, T2 OCL-capability constraints
  (evaluation timing recorded), isID correlation as structural.
- UAF: OCL-capability traversal, measure-vs-actual comparison, date-
  interval filtering; least KEEL of any family.
- OCL/ALF inventory: pure constraint evaluation (navigation, collection
  algebra incl. `closure`, three-valued logic, `@pre`, message
  expressions); ~10 closed imperative effect kinds; strategy-pluggable
  variation points; Alf minimum-core vs full conformance levels.
