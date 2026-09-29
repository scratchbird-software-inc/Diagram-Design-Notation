# Family chapter — BPMN 2.0.2 (EM-1, token)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: bpmn.md.

## 1. Family scope & normative sources

BPMN 2.0.2 chapter 13 (token-based operational semantics, informal text —
REQUIRED only for Process Execution Conformance; "tools are NOT REQUIRED
to implement any form of token", §13.3.1); §10.5 events and timers;
§8.4.6 FormalExpression model; §10.4.3 XPath 1.0 reference binding with
host accessor functions. No step semantics, no simulation conformance
class, no companion executable-semantics standard.

## 2. Execution semantics DDNA adopts

DDNA **mirrors the behavior**; it never executes a BPMN engine dialect.
The behavior a DDN/DDNA process diagram exhibits:

- **Token model** (§13.3.1): tokens traverse sequence flows as a
  theoretical concept; multiple incoming flows = implicit exclusive
  ("uncontrolled flow"); multiple outgoing flows = implicit parallel
  split (conditions make it inclusive).
- **Instantiation/termination** (§13.2): a Start Event occurrence creates
  tokens; an instance completes iff no token remains and no Activity is
  active; Terminate End abnormally ends the instance; correlated starts
  route to the existing instance.
- **Activity lifecycle** (Fig 13.2): Ready → Active → Completing →
  Completed, plus Withdrawn (event-gateway race), Failing/Failed,
  Terminating/Terminated, Compensating/Compensated. Entry needs
  `StartQuantity` tokens and an available data InputSet; completion
  selects an OutputSet (runtime exception if none).
- **Gateways** (§13.4): Parallel consumes/produces per flow; Exclusive —
  first true condition wins, else default, else exception; Inclusive —
  wait-until-no-more-tokens-can-arrive join, then all-true split;
  Event-based — deferred choice, first trigger wins, others withdrawn
  (the N3 race); Complex — two-phase activation with `activationCount`,
  can deadlock by design.
- **Multi-instance / loop / ad-hoc** (§13.3.5–13.3.7): instance counts
  from `loopCardinality` or collection cardinality; `completionCondition`
  cancels the rest; data mediation is "left under-specified" — recorded,
  never derived (N7).
- **Compensation/transactions** (§13.5.5, §10.3.5): only Completed
  activities are compensable, with snapshot data taken at completion;
  transaction outcomes success/Cancel/Hazard with defined propagation.
- **Message flow**: tokens never cross Pools; key-based correlation
  matches at most one instance.

### 2.1 Transfer note — Petri nets, EPC, flowcharts, IDEF0

The token families without full texts in hand map *by transfer*
(exclusion-sweep.md Part 1A): EPC XOR/OR/AND connector semantics are a
subset of the BPMN token model; Petri-net firing ≈ the same model with
textbook-public semantics despite the gated ISO texts; IDEF0 ≈ an
activity data-flow subset. DDNA features for those families reuse this
chapter's machinery with claims of "DDNA-defined" only (chapter 3,
no-standard row) — nothing here claims Petri/ISO 15909 semantics, which
remain gated tier-3 documents (chapter 12 §1).

## 3. Feature support

- **Core:** F-BPMN-1 token simulation engine (§13.2–13.5) [DT]; F-BPMN-2
  message/correlation bus (key-based routing) [DT]; F-BPMN-4
  non-operational element stubs as external work-item prompts
  (§13.1-sanctioned) [DT]; recorded-trace replay (F-X1) [VS]; virtual
  clock for timer events (F-X4) [DT] — timer attributes are
  expression-valued (§10.5.5), so timer instants may need KEEL.
- **Optional:** F-BPMN-3 compensation/transaction scope analysis [DT];
  choreography initiator-order checks (§11.5.6) as overlays [VS].
- **Excluded:** any conformance or simulation claim; any claim that
  stepping is BPMN-mandated; Manual/Abstract task execution ("never
  actually executed by an IT system", §13.1); IORules and the rest of the
  §13.1 non-operational list (reference-only).

## 4. Expression behavior

KEEL tiers: **T2/T3** over a tree data model — XPath-1.0-capability
node-set navigation (axes, positional predicates, existential
comparisons), host accessor functions (`getDataObject`, `getDataInput`,
`getDataOutput`, `getDataProperty` and the loop/MI accessors, §10.4.3).
Constructs: sequence-flow `conditionExpression`, complex-gateway
`activationExpression`, loop/MI/ad-hoc conditions, **expression-valued
timer attributes** (`timeDate`/`timeDuration`/`timeCycle`), conditional
events, data associations/assignments. Numeric tower: **IEEE double with
NaN** (XPath). Null/error regime: XPath empty-node-set/NaN with
two-valued short-circuit logic — "an empty node set is returned in the
event of an error" (§10.4.3). Guard purity: pure in practice; host
accessors are documented as host functions (chapter 5 §5.5.4). Default
language label: XPath 1.0 + the §10.4.3 extension functions when an
expression reference carries no URI.

## 5. Trace & replay requirements

Nondeterminism classes: **N1** (gateway guard selection), **N3**
(event-gateway races — first trigger wins), **N4** (interleaving of
parallel paths), **N5** (message arrivals, injected "now", human tasks),
**N6** (error/escalation routing), **N7** (MI data mediation),
**N8** (timer scheduling — expression-valued). Stamping:
semantic-profile + version with the DDNA-pinned interpretations of the
inclusive join (Table 13.3) and complex gateway (Table 13.5) — those are
DDNA-defined and must be labeled. Replay mode: **faithful replay** of
recorded choices; compensation snapshots are copy-on-event at activity
completion.

## 6. Runtime-model bindings

TIME: **TIME-A** — timers are implicit direct-resolution triggers against
the virtual clock; "token movement across a Sequence Flow does not have
any timing constraints" (§13.3.1), so no other clock exists. DATA:
**DATA-A or C** — process-instance stores with I/O sets (D1 shape);
instance identity is mandatory (process instances and MI loops). CONC:
**CONC-A** — interrupt scopes and boundary-event cancellation are
composition data (C4: scoped lifecycle-command propagation; fault does
not propagate), recorded with each event.

## 7. Conformance claim wording

**"An implementation of BPMN 2.0.2 §13 token semantics"** with
DDNA-defined step granularity (lifecycle-transition per Fig 13.2) and the
two DDNA-pinned gateway interpretations labeled as such. **Never:** any
conformance or simulation claim, or any claim that stepping is
BPMN-mandated (no such machinery exists in the standard).

## 8. Open items

- The inclusive-join and complex-gateway pinned interpretations live in
  the [DD] register (chapter 8 §8.11); this chapter references, not
  defines, them.
- Choreography conformance (initiator order) is an overlay only —
  choreography has no token semantics here.
