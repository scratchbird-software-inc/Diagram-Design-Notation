# Chapter 5 — The KEEL reference interface

**Status:** full draft, 2026-09-29. The spine (§5.1) is ratified (D13); the
tier model and collision rules are corpus synthesis presented here as the
normative draft.

## 5.1 The spine: the Z.120 §5.3 host-function seam, adopted verbatim

ITU-T Z.120 §5.3 normatively defines a typed host-function interface
between a trace semantics and an external data language: *"the semantics of
an MSC is parameterised by these data functions, and an MSC analysis tool
would have only to be provided with instances of these functions to compute
the MSC semantics."* This is the standards world's own KEEL. DDNA adopts it
verbatim as the interface spine (ratified D13). The nine functions, as
named in the 2011 text:

| Group | Function | Contract |
| --- | --- | --- |
| Parse | `Wf1`, `Wf2`, `Wf3`, `Wf4` | variable strings / data definitions / type references / expressions parse |
| TypeCheck | `Tc1`, `Tc2`, `Tc3` | expression and definition type-checking |
| NameEq | `EqVar` | variable-name equality |
| Conformance | `Tc4` | expression conforms to a required type (assignments, reference actual parameters) |
| FreeVars | `Vars` | free variables *with occurrence counts* — each wildcard occurrence is independent |
| Substitute | `Replace` | substitute the n-th occurrence |
| Fresh | `NewVar` | fresh variable generation |
| Eval | partial eval | *"only defined if all variables appearing in the expression have defined values in the state argument"*; the value universe includes structured values |

**Three other standards independently define the same seam**
(expr-sdl-msc.md §B.4), which is why the KEEL boundary is not an
interpretation DDNA imposes — it is the architecture these standards
already specify:

- SDL Z.100 §7.4 — alternative concrete data notations explicitly allowed
  ("such as the SDL-2000 data notation or C"); the dialect is replaceable
  if the semantic model binds to the abstract grammar.
- SysML §10.3.1.1.1 + §10.1 — a language name in braces on constraint
  strings; "the interpretation of a given constraint block … shall be
  provided" (by the tool).
- BPMN §8.4.6 / CMMN §5.4.7 — `FormalExpression`/`Expression` with a
  `language` URI and a per-Definitions default (XPath 1.0); UML 13.2
  OpaqueExpression/OpaqueBehavior language/body pairs; SCXML §5 pluggable
  datamodel profiles.

**Consequence (interface shape).** A DDNA expression reference is
`{id, language-URI/tag, body-ref (opaque text), evaluatesToTypeRef?}` with
hierarchical default inheritance. The evaluation contract is synchronous
`evaluate(exprRef, dataContext) → value | undefined`; **scheduling belongs
to the family runtime**, never to KEEL (expr-feel-xpath.md §C.5).

## 5.2 Capability tiers T0–T8

Every KEEL/DDNA capability is classed into one tier. A host engine declares
the tiers it implements per language tag; a DDNA file declares the tiers it
requires (chapter 1's capability-statement template, chapter 10).

| Tier | Capability | Normative anchor |
| --- | --- | --- |
| T0 Opaque reference | carry expression text + language tag + id | MSC §5.3 string interface; SysML §10.3.1.1.1; Z.100 §7.4 |
| T1 Static analysis | parse (Wf1–4), typecheck (Tc1–3), name-equality (EqVar), type conformance (Tc4), free-vars with counts (Vars) | MSC §5.3 (all five named) |
| T2 Pure evaluation | Eval closed expressions against a supplied store → structured value or undefined (partiality) | MSC §5.3 Eval; SDL constant expressions (Z.101 §11.15) |
| T3 Stateful evaluation | evaluation against agent/event state incl. self/sender/parent/offspring; write-before-read; per-event stores | SDL Z.101 §9/§12.3.4.2; MSC §5.6 |
| T4 Reactive re-evaluation | watch expressions fired on state/queue change with priority ordering (continuous signals); guards gating consumption (enabling conditions); **side effects legal, order recorded** | SDL Z.102 §11.5/§11.6; Annex F3 §F3.2.3.2.4 |
| T5 Non-causal solving | relation networks, engine-chosen causality, fixpoint, mode-conditioned sets | SysML §10.1, §8.3.2.3 |
| T6 Underspecification | wildcards as independent don't-cares: substitution + freshness + instantiation into recorded traces | MSC §5.3 Vars/Replace/NewVar, §5.7 |
| T7 Instrumentation | side-effect-free value snapshots + progress metrics at named points (removable without semantic change) | SoaML §6.4.9 |
| T8 Open type environment | external module/type-system import by notation tag (ASN.1-style); pid/identity domains with freshness | SDL Z.100 §7.5; Z.101 §12.1.5 |

## 5.3 Numeric towers

One numeric engine cannot serve every dialect. **The expression's language
tag selects the tower** (expr-feel-xpath.md §E — flagged as the corpus'
"highest surprise" collision):

- **FEEL mandates IEEE 754-2008 decimal128** — 34 digits, round-half-even,
  and *no* NaN, ±Infinity or negative zero (DMN §10.3.2.3.1).
- **XPath 1.0 mandates the IEEE 754 double tower** *with* NaN and
  ±Infinity (XPath §3.5).

A trace that records a numeric result must be interpretable under the tower
of the expression's tag; tower identity is part of the semantic-profile
stamp (chapter 4 §4.2.5).

## 5.4 Null/error regimes and guard purity

**Four null/error regimes exist; KEEL tags which one an expression lives
in, and traces record which regime produced a recorded "no value"**
(expr-feel-xpath.md §E; expr-ocl-alf.md Part D finding 1):

1. FEEL: null-propagation + ternary logic; null is mandatory on domain
   violation (DMN §10.3.2.16).
2. XPath: empty-node-set/NaN + two-valued short-circuit logic (BPMN
   §10.4.3: "an empty node set is returned in the event of an error").
3. OCL: `null` + `invalid` with a defined three-valued logic (OCL
   §7.4.13–14).
4. Alf: `null` ≡ empty sequence (Alf §8.3.15).

**Guard purity is family-dependent.** UML decisionInput "shall not have
side effects" (15.3.3.6); FEEL is pure, with externally-defined
(Java/PMML) functions as the only purity hole — carried as opaque
references, with trace steps through them flagged (DMN §10.3.2.13.3);
OCL is pure by definition; **SDL explicitly permits stateful guards with
order-dependent results** (Annex F3 §F3.2.3.2.4). Rule: KEEL must not
hard-code guard purity. The per-family purity profile is:

| Family | Guard purity | DDNA rule |
| --- | --- | --- |
| UML activity / state machines | pure (decisionInput "shall not have side effects") | enforce purity or flag |
| DMN / FEEL | pure except externally-defined functions | opaque references; flagged steps |
| OCL contexts | pure by definition | — |
| BPMN / CMMN (XPath) | pure in practice | host accessors documented as host functions (§5.5) |
| SDL | **stateful guards legal** | permit stateful evaluation with order recorded in traces, or declare a pure subset as DDNA-defined |

## 5.5 Remaining collision rules (normative)

1. **Existential node-set comparison preserved:** `$x="foo"` ≠
   `not($x!="foo")` (XPath §3.4) — semantics are preserved, never "fixed".
2. **Ordering guarantees differ:** OCL `iterate` over Set/Bag is
   order-undefined (§7.6.6) — traces containing iterate results need
   canonicalization or diffs are nondeterministic; Alf sequence expansions
   are parallel except `iterate` (§8.3.19). One operator table, two
   scheduling regimes.
3. **fUML exclusions shrink the KEEL surface:** joinSpec, weight,
   selection/transformation Behaviors and TimeEvents are excluded from
   fUML (§7.10/§7.4) — reference-only for DDNA; the UML-activity family
   needs *less* KEEL than BPMN.
4. **Evaluation-context obligations:** SDL `self/sender/parent/offspring`
   pid context (Z.101 §9); timer-instance identity is an *evaluated data
   tuple* (Z.101 §11.15) — parameter evaluation participates in control;
   BPMN §10.4.3 host accessor functions (`getDataObject` …) and CMMN
   §8.3.1 `getCaseFileItemInstance[Property]` are the injection ports
   between model state and evaluation — the KEEL scheme names them as host
   functions.

## 5.6 What KEEL is not

- Not an interpreter shipped inside DDNA. DDNA never implements the
  dialects; it references them (chapter 1 §1.1's hard rule).
- Not a scheduler. `evaluate` is synchronous; when to evaluate belongs to
  the family runtime (chapter 7).
- Not a claim device by itself: engine identity + version stamping
  (chapter 4) is what makes a KEEL-produced result replayable.
