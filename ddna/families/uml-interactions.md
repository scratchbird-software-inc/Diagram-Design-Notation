# Family chapter — UML interactions (EM-4, trace/partial-order)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: interactions.md.

## 1. Family scope & normative sources

UML 2.5.1 chapter 17 (interactions: the [P, I] trace-set semantics,
interleaving, partial ordering, fragments, state invariants, timing
diagrams); §8.6 time/duration constraints and observations; Clause 13
event vocabulary. **No companion executable-semantics standard covers
this family** — fUML excludes it by scope, PSSM covers state machines,
PSCS composite structures (discovered, not assumed).

## 2. Execution semantics DDNA adopts

UML interactions have **no token or firing semantics at all** — the
semantics is a **trace-set (denotational) model**, and DDNA adopts
exactly that:

- **Trace model** (17.1.2): semantics is a pair [P, I] — valid and
  invalid trace sets; **P ∪ I need not be the universe of traces** (the
  normative third verdict "not described").
- **Interleaving** (17.1.1): traces merge preserving within-trace order;
  true simultaneity is excluded.
- **Partial ordering** (17.1.3, 17.4.3.5): only lifeline order and
  send-before-receive (or matched gate pairs) constrain traces; messages
  themselves are not ordered.
- **Message semantics** (17.4.3.1): complete = ⟨send, receive⟩; lost =
  ⟨send⟩; found = ⟨receive⟩; arguments are ValueSpecifications evaluated
  at the send event; wildcard arguments allowed.
- **Fragments** (17.6.3.7–17.6.3.17) are trace-set transformers: alt =
  union of guarded operands; opt = alt with empty second; break =
  operand instead of remainder; par = arbitrary interleaving; seq =
  **weak sequencing** (ordering only on shared lifelines); strict =
  total order; neg = invalid set; critical = atomic region; ignore/
  consider = filters; assert = only these continuations valid; loop =
  recursive seq with minint/maxint bounds.
- **StateInvariant** (17.2.3.5): the constraint is evaluated immediately
  prior to the next occurrence; if false, the trace is invalid.

The normative automation use the standard itself names (17.1.1) is
**conformance-checking observed traces against the interaction
specification** — this family's flagship is trace replay *plus trace
validation*, never simulation. The "state" of a replay is the cursor in
the partial order.

## 3. Feature support

- **Core:** F-INT-1 trace validation against the [P, I] semantics
  (three-valued verdict) [DT] — the family's distinctive feature;
  F-INT-2 event-occurrence step-through on stored traces [VS / DT
  generation]; F-INT-4 neg/assert/consider/ignore verdict overlays [VS];
  recorded-trace replay (F-X1) [VS].
- **Optional:** F-INT-3 timing-diagram cursor replay + constraint
  checking [VS/DT]; F-INT-5 interaction-overview cross-view trace
  linking [VS/DT]; F-INT-6 partial-trace (lost/found) replay/validation
  [DT/VS].
- **Excluded:** "executing a sequence diagram" — interactions are trace
  descriptions, not executable models; Timing Diagrams as an obligation
  ("Conformant UML 2.5 tools are not required to implement Timing
  Diagrams", 17.1.4); communication-diagram recurrence formats
  (unprescribed — reference-only).

## 4. Expression behavior

KEEL tiers: **T1** full static-analysis suite (the Z.120 §5.3 functions
apply: parse, typecheck, name-equality, conformance, free-vars);
**T2** evaluation against per-event per-instance stores (operand guards,
loop bounds, state invariants, message arguments, InteractionUse
argument/return substitution); **T4** guarding-condition re-evaluation;
condition-name guards as trace-history lookup (DDNA data, not KEEL);
time/duration constraint arithmetic evaluated at the event's new state.
Numeric tower and error regime: per language tag; OCL is the referenced
(but not mandated) language — the OCL regime (null + invalid,
three-valued). Guard purity: pure. Wildcards (`-` argument, `else`
guard) are syntactic and handled inside DDNA itself.

## 5. Trace & replay requirements

Nondeterminism classes: **N1** (alt guard selection), **N2** (event-pool
dispatch order — deliberately unspecified, Clause 13), **N4** (par
interleaving, weak-sequencing freedom, asynch overtaking — explicitly
legitimate, so FIFO must never be assumed), **N6-adjacent** (unguarded
break choice), fragment-level choices with operand ids and loop
iteration indices. Stamping: semantic-profile + version; step
granularity is DDNA-defined (**one step = one event occurrence**:
send, receive, execution start/finish, destruction) and must be
declared as such. Replay mode: **faithful replay**; validation (F-INT-1)
runs against the [P, I] semantics over the recorded trace with the
three-valued verdict stored (chapter 4 §4.2.8).

## 6. Runtime-model bindings

TIME: **TIME-B** — timing diagrams carry a linear metric axis and
time/duration constraints reference named observations; no global clock
is assumed (17.1.3) and vertical distance is non-metric, so TIME-B is
constraint-checking over recorded timestamps, not scheduling. DATA:
**DATA-A or C** — per-lifeline evaluation contexts (D5 shape). CONC:
**CONC-A + CONC-B-data** — the signature case: partial-order data is
required for trace *validation* and interleaving inspection, while the
runtime remains one recorded interleaving.

## 7. Conformance claim wording

**"Trace validation against the [P, I] semantics of UML 17.1.2/17.6.3"**
with a three-valued verdict; any step granularity declared DDNA-defined.
**Never:** "executing a sequence diagram".

## 8. Open items

- UML 2.5.1 acquisition for subsection-level citations (chapter 12 §4).
- Cross-view trace linking (F-INT-5) depends on the cross-file
  addressing machinery of the architecture chapter; tagging rules for
  stitched traces are open.
