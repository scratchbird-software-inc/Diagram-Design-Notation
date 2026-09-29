# Family chapter — CMMN 1.1 (EM-3, lifecycle/event)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: cmmn.md. Known upstream erratum E1 (Clause-2 numbering
off by one) is recorded in the appendix.

## 1. Family scope & normative sources

CMMN 1.1 Clause 8 (execution semantics: lifecycle state machines + sentry
evaluation, §8.1–8.8), Clause 5 (metamodel incl. the uniform standard-
event model §5.4.2, behavior rules §8.6 as referenced), Clause 2
(compliance points — with the numbering erratum noted). GSM is declared
lineage, **not** a normative companion. No step semantics, no simulation
conformance class, no fUML/PSSM/SCXML analogue exists for CMMN.

## 2. Execution semantics DDNA adopts

CMMN has **no token semantics**; its normative runtime *is* the state
machines. DDNA mirrors that behavior directly — a DDNA state overlay
(per plan-item-instance lifecycle state + satisfied-sentry set) is a
spec-faithful materialization of §8 with no definitional gap to bridge
(cmmn.md §1 finding):

- **Nine lifecycle states** (§8.4, Table 8.4): Active, Available, Closed,
  Completed, Disabled, Enabled, Failed, Suspended, Terminated; terminal
  and semi-terminal (Disabled/Failed) states feed parent-Stage completion.
- **Case lifecycle** (§8.4.1): the outermost Stage skips Available, MUST
  transition directly to Active, MUST NOT have entry criteria;
  suspend/terminate propagate down to all contained instances.
- **Stage/Task lifecycle** (§8.4.2, Tables 8.7–8.9): Available → Enabled
  (sentry TRUE + ManualActivationRule TRUE) or → Active (sentry TRUE +
  rule FALSE); Disabled by human decision; the **exit** transition
  terminates from almost any state when exit criteria become TRUE;
  propagation matrices apply, and **fault MUST NOT propagate** (Table 8.8).
- **EventListener/Milestone lifecycle** (§8.4.3): the **occur** transition
  (Available→Completed).
- **Sentry satisfaction** (§8.5): an OnPart is satisfied by its
  standardEvent (or chained sentry, where standardEvent MUST be "exit");
  a Sentry is satisfied when all OnParts are satisfied AND the IfPart
  evaluates TRUE (or an IfPart alone); multiple criteria on one plan item
  are **OR-ed**; "a single event may satisfy multiple sentries";
  IfPart-only sentries are evaluated for **all CaseFileItem events**.
- **Behavior Property Rules** (§8.6): Stage.autoComplete (Table 8.12,
  incl. Manual Completion), ManualActivationRule, RequiredRule (blocks
  parent completion; "value SHOULD be maintained for the rest of the life
  of the instance"), RepetitionRule (first evaluation discarded;
  re-evaluated per criterion satisfaction or on complete/terminate),
  ApplicabilityRule (planning-time filtering).
- **Planning** (§8.7, Table 8.13): allowed only in lifecycle-constrained
  states; planned items instantiate immediately if the Stage is Active.
- **Connectors have NO semantics** (§8.8) — a CMMN-specific trap:
  animating connectors as control flow would be wrong; the sentry is the
  semantic carrier.
- **Induced step granularity** (DDNA-defined): one **standard event + its
  sentry-evaluation round** — event occurs, all ready sentries
  re-evaluate, resulting transitions fire and possibly cascade via Stage
  propagation and RepetitionRule instantiation (a GSM-style step).

## 3. Feature support

- **Core:** F-CMMN-1 case engine / sentry evaluation runtime [DT];
  F-CMMN-2 human-decision interaction surface (role-checked work items)
  [DT] — **normative and load-bearing: an engine without it cannot
  instantiate CMMN semantics** (cmmn.md §10); F-CMMN-4 CaseFileItem event
  instrumentation [DT; replay VS]; recorded-trace replay (F-X1) [VS].
- **Optional:** F-CMMN-3 planning simulation (discretionary items,
  ApplicabilityRules) [DT].
- **Excluded:** CMMN conformance of any tier; execution of Manual-activation
  *bypasses* — human decisions are inputs (N5), never synthesized; any
  connector-as-control-flow semantics (§8.8).

## 4. Expression behavior

KEEL tiers: **T2/T3** over a single tree-shaped data space (the CaseFile,
§8.3.1), with the `getCaseFileItemInstance[Property]` accessor functions
(Table 8.3) named as host functions (chapter 5 §5.5.4). The central
consumer: **sentry IfPart conditions** (§5.4.6, §8.5) — booleans over
CaseFileItem properties, re-evaluated per CaseFileItem event
(T4-adjacent). Plus the four behavior rules, `timerExpression` (ISO-8601
value anchored to a runtime-captured `timerStart` timestamp). Default
language label: XPath 1.0 (the Definitions default, §5.1.2/§5.4.7).
Numeric tower: IEEE double (XPath). Null/error regime: XPath
empty-node-set/NaN. Guard purity: pure in practice. CMMN's KEEL surface
is the *smallest and most uniform* in the corpus — four behavior rules +
IfPart + timerExpression over one data space.

## 5. Trace & replay requirements

Nondeterminism classes: **N5** is normative and load-bearing — human
decisions (manual start/disable/suspend/terminate/close, UserEventListener
raise with Role authorization), recorded with role identity, **not
stub-able**; **N3** (event-arrival races into sentry rounds); **N8**
(timer instants — time elapse is deliberately *not* a standard event;
TimerEventListener folds time into the uniform model). States are
**non-monotonic** (semi-terminal states are revisitable) — the snapshot
rules of chapter 4 honor copy-on-event lifecycle references. Stamping:
semantic-profile + version with the DDNA-defined step granularity and
RequiredRule re-evaluation points labeled. Replay mode: faithful replay
of recorded events and decisions.

## 6. Runtime-model bindings

TIME: **TIME-A** — `timerExpression` values are expressions (KEEL),
anchored to runtime-captured `timerStart` timestamps; the clock must be
consultable by evaluation and every evaluation recorded (chapter 7 §7.1).
DATA: **DATA-A or C** — the CaseFile (D2 shape): **mutations ARE events**,
unique among families — CaseFileItem transitions drive IfPart evaluation
for all events. CONC: **CONC-A** with C4 propagation matrices (Table 8.9
suspend/resume/terminate/fault/complete/exit; fault MUST NOT propagate)
recorded as composition data.

## 7. Conformance claim wording

**"Based on CMMN 1.1 Clause 8 lifecycles and §8.5 sentry evaluation"** —
the §2.1 partial-compliance phrasing the standard itself mandates for
partial claims. **Never:** CMMN conformance of any tier. Clause-2
citations check the text, not the printed number (erratum E1, appendix).

## 8. Open items

- Step granularity and RequiredRule re-evaluation points are [DD]
  register entries (chapter 8 §8.11); pinned at the register, referenced
  here.
- Stage-completion edge cases of autoComplete with Manual Completion
  (Table 8.12) — corpus-flagged; kept as analysis-overlay scope, not
  runtime, until the per-family features land.
