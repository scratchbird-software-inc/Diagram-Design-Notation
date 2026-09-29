# Family chapter — UML activities (EM-1, token)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: activity.md.

## 1. Family scope & normative sources

UML 2.5.1 chapters 15–16 (token-and-offer operational semantics in
normative prose); fUML 1.5 (the precision companion: Clause 8 operational
execution model, Clause 2 conformance levels, Clause 7 subset,
§7.10/§7.4/§7.9 exclusions); ALF 1.1 (textual action language mapped to
the fUML subset); UML §2 conformance types. ALF's exact document number is
corroborated by secondary citation, not fetched (drafting note).

## 2. Execution semantics DDNA adopts

DDNA **mirrors the behavior**; it never executes an ALF/Java surface.
The behavior a DDN/DDNA activity diagram exhibits:

- **Token model** (15.2.3.2): object tokens carry values (null token =
  no value); control tokens carry no data; *each token is distinct from
  every other, even with the same value*. Tokens do not hold on edges
  (exceptions: InitialNodes, fork outgoing edges).
- **Offer protocol**: a node is enabled by conditions on tokens *offered*
  to it; an offer passes an edge only if the guard evaluates true; edge
  weight gates how many tokens must be offered before any traverse; one
  token is accepted at one target unless copied.
- **Control nodes**: InitialNodes start (multiple = concurrent flows);
  FlowFinal destroys only accepted tokens; ActivityFinal stops all flows
  and destroys tokens outside output parameter nodes; ForkNode copies to
  all outgoing edges (unaccepted offers pend FIFO); JoinNode defaults to
  implicit "and"; MergeNode passes through without synchronization;
  DecisionNode — each token traverses at most one outgoing edge, guard
  evaluation order undefined, decisionInput shall not have side effects.
- **Object nodes/pins**: buffering with ordering (FIFO/LIFO/ordered/
  priority), upper bounds, selection Behaviors; actions consume inputs up
  to pin upper multiplicity, execute, provide outputs.
- **Invocation/completion** (15.2.3.5): input parameter values become
  tokens; an execution completes when nothing is executing or enabled, or
  on explicit termination; streaming parameters gate termination by
  cumulative posted counts.
- **Interruptible regions** (15.6.3): interrupting-edge traversal
  terminates all contained nodes and removes their tokens; **exceptions**
  (15.5.3): handler match by type, "exactly one handler catches, but it is
  not defined which"; uncaught propagates to the caller or is lost if
  asynchronous.

For the fUML subset, the atomic step is the **offer/fire cycle**: a node
accepts, consumes, fires, offers (fUML §8.9). Any legal interleaving of
concurrent threads conforms (fUML §2.3) — interleaving is implementation
freedom.

## 3. Feature support

- **Core:** F-ACT-1 fUML-subset execution engine + static
  subset-membership check (static partial acceptance) [DT]; F-ACT-2
  interrupt/exception propagation overlay [VS from trace / DT simulation;
  region-abort ordering is DDNA-defined]; recorded-trace replay (F-X1)
  [VS]; virtual clock for wait-time actions (F-X4) [DT, DDNA-defined].
- **Optional:** F-ACT-3 event-pool simulation for signal acceptors
  (pluggable GetNextEventStrategy) [DT]; F-ACT-4 SysML rate/continuous
  annotations carried as data (never executed) [DT].
- **Excluded:** joinSpec, edge weight, selection/transformation Behaviors,
  TimeEvents/ChangeEvents, interruptible regions as *fUML* claims — fUML
  excludes them (§7.10/§7.4/§7.9), so they are reference-only or
  DDNA-defined, never fUML-backed; any claim that stepping is
  UML-mandated beyond the fUML subset.

## 4. Expression behavior

KEEL tiers: **T2** — edge guards (in fUML restricted to decision-sourced
edges), weights, ParameterSet conditions, decisionInput (pure per
15.3.3.6), local pre/postconditions (enforcement explicitly undefined).
joinSpec, transformation and selection Behaviors are **reference-only**
(fUML's own exclusions). Imperative effects follow the ALF closed set
(chapter 6 §6.2). fUML's Executor interface (evaluate/execute/start,
§2.2) is the ready-made normative shape of the host contract this family
assumes. Guard purity: pure — decisionInput "shall not have side
effects". Numeric tower and null/error regime: per language tag (OCL
regime for OCL constraints).

## 5. Trace & replay requirements

Nondeterminism classes: **N1** (guard selection — decision order is
undefined), **N2** (event-pool dispatch; pluggable strategy), **N4**
(interleaving of concurrent flows — fUML §2.3 makes any legal
interleaving conformant, so it must be *recorded*), **N6** (exception
routing — "not defined which" handler), **N8** (wait-time scheduling is
DDNA-defined). Stamping: semantic-profile + version, with the
partial-acceptance reaction in force (Rejection / Static Partial /
Dynamic Partial per fUML §2.2). Replay mode: **faithful replay**;
verified replay applies to deterministic sub-nets under a declared
profile only. Compensation-style data snapshots are copy-on-event
(chapter 4 §4.2.4).

## 6. Runtime-model bindings

TIME: **TIME-A** for wait-time actions — DDNA-defined scheduling, since
fUML excludes time entirely (§7.4/§7.9); there is no executable-semantics
companion for time in this family. DATA: **DATA-A or C** — token payloads
are identity-sensitive multisets (each token distinct), so the data model
must key tokens by identity, not value — the reason DATA-B (canonical
event-sourced store) was rejected (chapter 7 §7.2). CONC: **CONC-A** with
the fUML interleaving legality rule recorded as N4; structured-node
isolation (`mustIsolate`) is composition data (C1).

## 7. Conformance claim wording

**"Mirrors fUML 1.5 Clause 8"** for models inside the fUML subset, with
static-partial-acceptance handling for the rest — the strongest claim in
the corpus (S), and this family's near-conformance path (chapter 10
§10.4). Everything else — interruptible regions, partitions as execution
scopes, SysML rates — is **DDNA-defined semantics**, permitted by UML §2
but labeled as such wherever it substitutes for standard semantics.

## 8. Open items

- Region-abort ordering and wait-time scheduling rules (DDNA-defined
  register entries; to be pinned in the runtime chapter's next revision).
- ALF document-number verification (secondary citation only, drafting
  note).
