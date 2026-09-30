# Family chapter — SysML 1.6 parametrics (EM-5, delegated/constraint)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3
(EM-5 partial — the parametrics fragment; activities inherit the UML
activity family chapter). Analysis source: sysml.md. Known upstream
erratum E2 (§11.3.2.7 probability constraint 4) is recorded in the
appendix.

## 1. Family scope & normative sources

SysML 1.6 §10 (constraint blocks, parametric diagrams — non-causality is
explicit; §10.1: "the specific dependent and independent variables are
often defined by the initial conditions, and left to the computational
engine"); §8.3.2.3 (binding connector = equality); §8.3.2.11/§8.3.3
(ValueTypes, units, PrimitiveValueTypes); §11.3.2 (activity stereotypes:
rate, NoBuffer, Overwrite, probability, control operators); §5.2 (three
conformance types, all syntactic/interchange). SysML specifies **no
interpretable constraint language** (§10.1 — OCL or MathML named as
candidates; language in braces, §10.3.1.1.1).

## 2. Execution semantics DDNA adopts

**There is no token/event runtime for constraint blocks** — the
evaluation model is a non-causal constraint network, deliberately
without solver semantics. DDNA mirrors:

- **Non-causal relations** (§10.1): constraint blocks name relations;
  solving direction and the solver itself are delegated ("shall be
  provided" by the tool).
- **Binding connectors** (§8.3.2.3): equality between bound ends,
  recursively through nested properties for ValueType-typed ends;
  Block-typed ends must refer to the same instance; end types must be
  conforming "so that equality of their values can be defined."
- **Parametric diagram restriction** (§10.3.1.2/§10.4.2): only binding
  connectors shown; every non-constraint property is bound to a
  constraint parameter (directly or through containment).
- **State-conditioned constraint sets** (§10.1): a system state may
  select a different equation set — a normatively described mode switch.
- **Induced solver-trace granularity** (DDNA-defined): (a) one value
  assignment to a bound variable, (b) firing of one constraint (all
  parameters determined → propagate equalities along bindings),
  (c) fixpoint; a mode switch is an additional step kind. The trace
  must record solver choices — the standard deliberately leaves them to
  the engine.
- **Activity stereotypes** are token-modifying data, not new semantics:
  NoBuffer discards refused tokens; Overwrite evicts the oldest;
  «rate» is an *expected value* with a normative time-denominator unit
  constraint (§11.3.2.8); control-as-data (enable/disable) is an
  interrupt-like semantics carried by data flow. The Runge-Kutta
  sentence (§11.3.2.1) is informative — no continuous simulation
  semantics exists (chapter 7 TIME-D exclusion).

## 3. Feature support

- **Core:** F-SYS-1 recorded solver-trace replay (assignments,
  constraint fires, fixpoint, mode switches; engine stamped) [VS];
  F-SYS-2 KEEL-delegated constraint solving [DT]; F-SYS-4
  binding-connector first-class data (nested-end property paths)
  [DT file format].
- **Optional:** F-SYS-3 static dimensional-consistency checker [DT];
  F-SYS-5 activity stream replay with rates/buffer occupancy [VS];
  F-SYS-6 unit conversion service interface (beyond-SysML, host) [DT];
  F-SYS-7 trade-study results overlay [VS]; F-SYS-8 state-conditioned
  equation-set mode display [VS].
- **Excluded:** any implication that constraint solving is
  SysML-mandated or SysML-conformance-relevant (a tool that never solves
  a constraint is fully SysML-conformant); continuous/hybrid simulation;
  SysML 2.0 (named standing exclusion, ratified D6).

## 4. Expression behavior

KEEL tiers: **T5** non-causal solving (relation networks, engine-chosen
causality, fixpoint, state-conditioned equation sets); binding-connector
structural equality decomposition (§8.3.2.3); dimensional-consistency
*checking* (units are identity via definitionURI, §8.3.3.2.2 — static);
unit *conversion* beyond-standard host service (no conversion arithmetic
exists in the standard; QUDV factors are non-normative). Rate/probability
values may be computed expressions (§11.3.2.7–8) → KEEL evaluation at
"use" time; probability constraints are read by intent (erratum E2).
**[DD]: the default language label for untagged constraints** — SysML
offers none (sysml.md §10); DDNA defines one per semantic profile.
Objective functions/distributions are an optional tier.

## 5. Trace & replay requirements

Nondeterminism classes: **N5-adjacent** (initial conditions select the
solving direction) and **N2/N4** (constraint-firing order and fixpoint
interleavings — engine-chosen, recorded); mode switches recorded as
choice events. Stamping: **engine id and version are mandatory** on
solver traces (two conforming solvers legitimately differ, chapter 4
§4.2.7); semantic-profile + version with the default-language label.
Replay mode: **faithful replay** of recorded solver traces.

## 6. Runtime-model bindings

TIME: **T1/T5** — time is an ordinary bindable property (§10.1); rates
are time-indexed but not timed. No virtual clock is required by
parametrics; solver-trace timestamps suffice. DATA: **DATA-A or C** —
declarative value graphs (D6) with binding-connector paths as
first-class data (F-SYS-4). CONC: **CONC-A** — C5 order-independence:
the trace must not over-specify solving order beyond what the engine
recorded.

## 7. Conformance claim wording

**"Beyond-SysML engine behavior"** — evaluation claims are explicitly
outside SysML conformance (§5.2's three types are all
syntactic/interchange). **Never:** any implication that constraint
solving is SysML-mandated or SysML-conformance-relevant.

## 8. Open items

- Default constraint-language label ([DD] register, chapter 8 §8.11).
- Rate simulation semantics ([DD] register).
- Probability-library references cite erratum E2's intent (appendix).
