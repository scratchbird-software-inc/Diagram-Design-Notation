# Chapter 7 — Runtime models

**Status:** full draft, 2026-09-29. The design-space choices below are
**ratified** (D12): TIME-A+B, DATA-A-or-C, CONC-A + CONC-B-data, plus the
semantic-profile option set. Where the baseline still marks a sub-item
open, the chapter says so.

## 7.1 TIME

The corpus distinguishes five semantic roles for time (runtime-models.md
§1): **T1** ISO-8601 schedule values (BPMN §10.5.5, CMMN §5.4.2.1, UAF DMM
§9); **T2** a global monotonic clock with advance constraints (SDL Annex
F3 §F3.2.1.1.2 NODELAY blocking; Z.120 §6.1/§6.4 dense-or-discrete
parameter); **T3** timers as first-class stimuli (Z.101 §11.15
parameterized timers with reset-removes-pending-expiry; Z.120 §4.8); **T4**
quantified constraints and measurements (Z.120 §6.2–6.10; UML 8.6/17.11);
**T5** time as injected input (DMN §10.3.4; SysML §10.1). Only SDL and MSC
have a *semantic* clock; BPMN, CMMN, fUML, UML interactions and SoaML are
explicitly timeless (fUML §7.4/§7.9 excludes time entirely).

**Adopted (ratified D12):**

- **TIME-A — a virtual logical clock with next-event advance**
  (event-stepped; advance blocked by pending zero-delay work; the
  dense/discrete domain is a parameter). Covers T1–T3 and T5; T4 is
  interval checks over recorded timestamps.
- **TIME-B — a dense-time constraint layer on A** (rational timestamps;
  Z.120 §6.4). Adopted with A; without it, MSC/UML-timing features degrade
  to annotation-only.

**Excluded:**

- **TIME-C — multiple named clocks with offset/skew.** No family
  normatively requires it (UML §8.2 disclaims distributed local time;
  SysML §10.1 only allows user-modeled clocks). Future-proofing note only.
- **TIME-D — hybrid/continuous simulation.** Zero normative support (only
  SysML §11.3.2.1's informative Runge-Kutta sentence; «rate» is an
  expected value, §11.3.2.8). Explicitly excluded.

**Cross-cutting rules.** Timer *values* are expressions (BPMN §10.5.5, CMMN
§5.4.2.1, Z.101 §11.15, Z.120 §6.2), so timer instants need KEEL — CMMN
anchors them to runtime-captured `timerStart` timestamps. The clock must be
consultable by KEEL, and every evaluation is recorded (chapter 4): TIME and
DATA are not separable (runtime-models.md §6). The DDN SMIL animation clock
is presentational and stays separate (msc.md §10).

## 7.2 DATA

Six data shapes exist across families (runtime-models.md §2.1): D1 BPMN
process-instance stores + I/O sets; D2 the CMMN CaseFile (its mutations
*are* events — unique); D3 UML token payloads (identity-sensitive
multisets, ordering, multiplicity); D4 SDL/MSC agent variables with pattern
binding and Pid sorts; D5 state-machine/interaction evaluation contexts;
D6 declarative value graphs (DMN/SysML/UAF).

**Adopted (ratified D12): DATA-A or DATA-C** — the baseline records the
final selection between the two as a specification-authoring choice, with
B rejected:

- **DATA-A — layered value model.** Declared layer: typed
  item/signal/pin/parameter declarations. Runtime layer: per-instance
  stores keyed *(scope id, instance id)*. Trace layer: timestamped
  mutation events with before/after values. Minimal union; matches every
  family gap list.
- **DATA-B — single canonical event-sourced store.** **Rejected**: it
  collides with token identity (UML 15.2.3.2 — "each token is distinct").
- **DATA-C — per-family facets behind a common envelope.** Standardize only
  instance identity, the timestamped event envelope, and the KEEL
  request/response record; lowest modeling risk, highest spec-authoring
  cost (five facet definitions).

**Shared non-negotiables** (whichever of A/C the per-family chapters use):
instance identity; snapshot support (copy-on-event, chapter 4 §4.2.4); KEEL
indirection for every evaluation; a recorded "now". A units facet is
optional but not precluded (SysML definitionURI identity, §8.3.3.2.2).

## 7.3 REPLAY and nondeterminism

Fixed by chapter 4: one trace format, the eight nondeterminism classes
(N1–N8), the two replay modes, per-step `stepKind` granularity, semantic-
profile + version stamping. Seeded reproducibility: a full choice log
(REPLAY-A) is required for viewer-safe replay regardless; seeded hybrids
are allowed for tools (runtime-models.md §3.4). The semantic-profile
**option set** — the enumerated knobs a profile may declare (state-machine
mode, pool-order policy, conflict policy, scheduling hooks, numeric tower,
error regime) — is ratified as part of D12 and enumerated in chapter 4
§4.2.5.

## 7.4 CONCURRENCY

**Adopted (ratified D12): CONC-A + CONC-B-data.**

- **CONC-A — single global interleaving** (a recorded total order) is the
  runtime. Normatively justified (UML 17.1.1; fUML §2.3; Z.120 §4.1) and
  sufficient for replay and simulation.
- **CONC-B-data — a partial-order data model** is adopted for the
  trace-validation features (MSC/UML-interaction validation and
  interleaving inspection): sequentializations are materialized on demand.
  B's data is a superset of A's; A can be a view of B.
- **CONC-C — distributed local clocks** is excluded as over-engineering.

**Family-specific composition data the runtime must carry**
(runtime-models.md §4.1) — the hard concurrency content is this data, not
the scheduler:

- C1 token copy/join/scope-termination rules;
- C2 region atomicity — *two different machines*: UML synchronized regions
  (one run-to-completion step across all regions) vs SDL alternating
  composite states with a single input port (Z.102 §11.11.2) — the
  DDN-profile collision this creates (SDL process diagrams ride the UML
  state-machine machinery with a recorded rebadge note) must be resolved
  per profile (sdl.md §10; runtime-models.md §6);
- C4 scoped lifecycle-command propagation matrices (CMMN Table 8.9; fault
  MUST NOT propagate per CMMN Table 8.8; BPMN §13.5.3–13.5.4; UML 15.6.3);
- C5 declarative order-independence — the trace must not over-specify
  order where the family is declarative (chapter 2, EM-2/EM-4).

## 7.5 Claims vocabulary for runtime models

Consistent with the master claims rule (chapter 10): runtime behavior is
claimed as **"mirrors X"** or **"based on X"**, never "conformant to X",
with two named near-conformance exceptions the corpus treats with special
care:

1. **fUML Clause 8** — for models inside the fUML subset, a DDNA engine may
   claim *"mirrors fUML 1.5 Clause 8"* with static-partial-acceptance
   handling for the rest (the only family with a normative operational
   semantics *and* conformance levels for execution). Interruptible
   regions and time events are DDNA-defined semantics and must be labeled
   as such.
2. **SCXML Appendix D** — the default state-machine execution profile may
   claim *"mirrors W3C SCXML Appendix D microstep/macrostep"*, with the
   UML-strict (PSSM) semantics as a declared option; the chosen profile is
   part of every trace's semantic-profile stamp. "UML-conformant state
   machine execution" may never be claimed (pool order and corner cases
   are documented semantic variation points).

Every other runtime claim follows the per-family claims table (chapter 3):
BPMN token semantics ("an implementation of §13 token semantics" with
DDNA-defined step granularity), SDL ("mirrors Annex F3 phases" with a
capability statement), MSC trace semantics, and "DDNA-defined" wherever a
standard leaves the point open — the DDNA-defined register lives in
chapter 8.
