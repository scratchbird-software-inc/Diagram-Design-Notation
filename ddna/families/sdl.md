# Family chapter — SDL-2010 (special position: communicating extended FSM with a formal abstract machine)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.2
(the special position, EM-1-adjacent). Analysis source: sdl.md. The
documents acquired for this family include Z.100, Z.101, Z.102 and Annex
F1/F2/F3 (06/2021 edition); Z.103–Z.107 remain unacquired (chapter 12 §4).

## 1. Family scope & normative sources

ITU-T Z.100 (framework, §6 tool-compliance ladder — all notation/grammar
classes, **no execution class**), Z.101 (basic SDL: input port, signal
consumption/save, global system time `now`, timers §11.15, channels),
Z.102 (extended SDL: priority input §11.4, continuous signals §11.5,
enabling conditions §11.6, spontaneous transitions §11.9, composite
states §11.11), Annex F (formal semantics — **supremacy over the informal
text**, Z.100 Introduction), Annex F3 §F3.2 (the SDL Abstract Machine: a
distributed real-time ASM with an agent-execution phase machine). SDL is
the only family whose operational semantics is formal, normative, and
in-family.

## 2. Execution semantics DDNA adopts

DDNA **mirrors the behavior**; it never executes an SDL data dialect.
The behavior a DDN/DDNA SDL diagram exhibits:

- **Input port** (Z.101 §9): exactly one per agent instance; retains any
  number of signals, ordered by availability time; ties ordered
  arbitrarily, with lower priority values first. The complete valid input
  signal set is the union of channel/gate signals, agent/state-machine
  sets, implicit signals, and **timer signals**.
- **State-level selection** (Z.101 §11.2, steps a–d): priority inputs
  first; then input-port order testing enabled-ness; then up the
  composite-state hierarchy; then continuous signals (Z.102). The Annex
  F3 phase machine cycles `startPhase → selectingTransition ⇄
  firingTransition`, with sub-modes in normative order
  (`selectStartTransition`, `selectExitTransition`, `selectFreeAction`,
  `selectPriorityInput`, `selectInput`, `selectContinuous`).
- **Global system time `now`** (F3 §F3.2.1.1.2): monotonically
  increasing; **now values do not increase while a signal is in transit
  on a non-delaying (NODELAY) channel** — the constraint TIME-A's
  advance-blocking generalizes.
- **Timers** (Z.101 §11.15): `timer` definitions (optionally
  parameterized — one instance per distinct parameter value, an
  *evaluated data tuple*); `set`/`reset`; expiry puts a signal in the
  owning agent's input port; reset of an active timer removes a retained
  timer signal.
- **Channels**: delaying channels are per-direction FIFO queues with
  indeterminate, possibly non-constant delay (N8); NODELAY channels
  exempt (and freeze `now`).
- **Signal consumption/save**: signals are consumed only in states;
  save-sets retain them for later states.

## 3. Feature support

- **Core:** F-SDL-1 SAM-mirroring simulator/stepper (macro = one
  transition; micro = one SAM phase) [DT]; F-SDL-2 timer service with
  virtual clock (parameterized timer identity) [DT]; F-SDL-3 channel
  router / signal bus (FIFO delaying queues, NODELAY fast path, to/via
  resolution, priority/availability ordering) [DT]; recorded-trace replay
  (F-X1) [VS] — the SDL trace maps 1:1 onto SAM state
  (F3.2.1.1.2/F3.2.3.2.1).
- **Optional:** F-SDL-4 MSC trace export bridge [DT] — MSC is the
  rendering, not a second execution format.
- **Excluded:** "Z.100-conformant" as a claim (the §6 ladder has no
  execution tier); any claim inconsistent with Annex F; native CIF
  execution (import-only, chapter 11); shorthand-transformation surface
  semantics — semantics attach to the post-transformation abstract model
  (Z.103), not the shorthand.

## 4. Expression behavior

KEEL tiers: the richest single-family surface. **T2** constant
expressions; **T3** pid context (self/sender/parent/offspring, Z.101 §9)
and signal payload binding with write-before-read per-event stores;
**T4** enabling conditions and continuous signals — **stateful guards are
legal**: guard evaluation may alter agent state with order-dependent
results (Annex F3 §F3.2.3.2.4), so evaluation order is recorded in
traces, never assumed pure; **T8** open type environment (ASN.1-style
module import, Z.100 §7.5; Pid sort with Make/freshness, Z.101 §12.1.5).
Also: ordered literal sorts with succ/pred/position arithmetic;
parameterized timer-instance identity; the nondeterministic-choice
primitive (Any-decision). The data dialect itself is replaceable — Z.100
§7.4 allows alternative concrete data notations, the standard's own
KEEL-shaped escape hatch (chapter 5 §5.1).

## 5. Trace & replay requirements

Nondeterminism classes — SDL exercises the full taxonomy: **N2** (queue
dispatch ties, Z.101 §9), **N3** (spontaneous transitions vs signal
reception, Z.102 §11.9 — "no priority exists"), **N4** (arbitrary
receiver selection, Z.101 §11.13.4), **N5** (environment stimuli,
Z.100 §5.2.2 — the environment is explicitly nondeterministic), **N6**
(post-exception behavior underivable, Z.100 §5.2.3), **N8** (channel
delay; equal-instant timer orderings). Because nondeterminism is
normative at so many points, the pilot rule applies doubly: **record
actual choices in traces; never re-derive them**. Stamping:
semantic-profile + version, the 06/2021 edition pin, and a §6.2-style
capability statement naming unsupported features. Replay mode: faithful
replay; the trace envelope of chapter 4 is drafted against F3 and
generalized (runtime-models.md §6 hole 1).

## 6. Runtime-model bindings

TIME: **TIME-A** — F3's monotonicity and NODELAY advance-blocking are
literally its normative constraints; timer expiry is signal delivery into
one's own input port. DATA: **DATA-A or C** — agent variables, pattern
binding, Pid sorts (D4 shape); input-port contents and in-transit signals
are snapshot data (chapter 4 §4.2.4). CONC: **CONC-A** with the C2
composition rule: SDL composite states alternate with a *single input
port* (Z.102 §11.11.2) — a different machine from UML synchronized
regions, and the `sdl.process@1` UML-machinery rebadge collision must be
resolved per profile (sdl.md §10; runtime-models.md §6).

## 7. Conformance claim wording

**"Mirrors Annex F3 (06/2021) SDL Abstract Machine phases"** (F3.2.3.2)
with a §6.2-style capability statement naming unsupported features; the
edition is pinned because F3.1.4 concedes incomplete areas. **Never:**
"Z.100-conformant" (the compliance ladder does not cover execution) or
any claim inconsistent with Annex F supremacy.

## 8. Open items

- Z.103/Z.104/Z.105/Z.106/Z.107 acquisition (shorthand, data language,
  ASN.1, CIF, OO data) — chapter 12 §4.
- The rebadge collision (§6 CONC) needs an owner decision when the DDNA
  file format is drafted.
- ITU implementation rights are by convention, not grant — flagged for
  governance (chapter 10 §10.7).
