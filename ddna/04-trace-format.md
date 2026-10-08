# Chapter 4 — The DDNA trace format

**Status:** full draft, 2026-09-29 (the keystone chapter). Requirements are
fully determined by the per-family gap lists in the analysis corpus
(runtime-models.md §5 finding 2); this chapter is the merged requirements
specification. Nothing here invents semantics beyond the baseline and the
ratified decisions.

## 4.1 Why a trace format

Every operational family in the corpus reduces replay and simulation to
**one recorded interleaving** — normatively sanctioned by UML 17.1.1 ("true
simultaneity is excluded"), fUML §2.3 (any legal interleaving conforms) and
Z.120 §4.1 (traces are sequentializations). The artifact every family
needs is therefore a single, stamped, replayable trace format. Trace
*generation* is an interactive-tool (`[DT]`) feature; trace *replay* is pure
playback of static file data (`[viewer-safe]`, §4.5) — both ship in the open
tool (chapter 1 §1.2, 2026-10-08).

## 4.2 Structure: the per-event record

All eight field groups are requirements; "mandatory" means a conforming
DDNA trace must carry the group on every event unless marked optional.

1. **Envelope (mandatory).** A monotonic sequence number; the virtual-clock
   value under the file's TIME model (chapter 7); the wall/"now" value if
   any KEEL evaluation consumed time (runtime-models.md T5 ← dmn.md §2);
   the producing scope/instance identity; and a `stepKind` discriminator.
   Step granularity is **per step, not global**: BPMN lifecycle-transition,
   CMMN standard-event + sentry-round, fUML node-firing, SCXML
   micro/macrostep, SDL abstract-machine phase, MSC single event occurrence
   (runtime-models.md §3.4).

2. **Instance identity (mandatory, universal).** Keys are
   *(DDN element id, instance discriminator)*. Every operational family
   requires it: BPMN process instances and multi-instance loops
   (BPMN §13.3.7), CMMN RepetitionRule instances (CMMN §8.6.4), SDL agent
   instance sets and pids (Z.101 §9.1), MSC/interaction per-lifeline and
   per-occurrence identity with loop-iteration indices, SoaML `isID`
   correlation keys (SoaML §6.4.8). Within one DDNA file, element ids are
   bare `@id` under the cross-base uniqueness ban (chapter 1 §1.5).

3. **Choice records (mandatory where applicable).** The alternative taken
   for each of the **eight normative nondeterminism classes**:

   | Class | What is recorded | Normative anchors |
   | --- | --- | --- |
   | N1 guard selection | which guard won | BPMN §13.4.3–5; UML 15.3.3.6; UML interactions 17.6.3.7 |
   | N2 event-pool/queue dispatch order | which event dispatched next | UML 13.3.4; fUML GetNextEventStrategy; Z.101 §9 ties |
   | N3 arrival vs internal-readiness races | which side won the race | BPMN §13.4.4 event gateway; Z.102 §11.9 spontaneous transitions |
   | N4 interleaving of concurrent flows | the recorded total order | fUML §2.3; UML 17.6.3; Z.120 §7.1–7.2 |
   | N5 human/environment input | the input and its provenance | CMMN human decisions with role identity (normative, load-bearing); SDL environment stimuli (Z.100 §5.2.2); SoaML message exchanges; injected "now"/random values |
   | N6 exception/fault routing | which handler took it | UML 15.5.3 ("undefined which handler"); Z.100 §5.2.3 |
   | N7 model under-specification | instantiation values chosen | MSC wildcards (Z.120 §5.7); lost/found pairing (§5.8); BPMN MI data mediation (§13.3.7) |
   | N8 timing nondeterminism | the recorded instants | SDL channel delay (Z.101 §10.1); equal-instant timer orderings |

   Fragment-level choices record the chosen operand id and the loop
   iteration index per alt/opt/break/loop. Guard-evaluation **results and
   their order** are recorded — SDL guards may be stateful
   (Annex F3 §F3.2.3.2.4), so a result can never be assumed reproducible
   (see chapter 5 §5.4).

4. **State references / snapshots (mandatory).** Copy-on-event snapshotting
   — not current-value overlays: token placements (BPMN §13.2–13.5; UML
   15.2.3.2); activity lifecycle states (BPMN Fig 13.2); CMMN's nine §8.4
   states — non-monotonic, semi-terminal states are revisitable
   (cmmn.md §10); state-machine configurations and history snapshots; SDL
   agent states, input-port contents, and in-transit signals
   (Annex F3 §F3.2.1.1.2); the partial-order cursor for MSC/interactions;
   data-mutation events with before/after values (chapter 7 DATA layer);
   BPMN compensation data snapshots at completion (§13.5.5).

5. **Semantic-profile and version stamping (mandatory).** Every trace and
   every DDNA file declares **which semantic option set is in force** —
   e.g. SCXML-mode vs UML-strict state-machine semantics, event-pool order
   policy, conflict policy, scheduling-policy hooks (fUML Strategy
   classes) — **plus the profile's version**, because engine-version drift
   invalidates recomputation (runtime-models.md §3.4 REPLAY-C). This is a
   declared-policy slot, never a baked-in policy. The stamp is also the
   claims device: where a DDNA-defined semantic substitutes for a standard
   one, the stamp must say so (chapter 10).

6. **Referential integrity (mandatory).** Records key to real DDN
   grammar-assigned element ids — explicitly **never** the presentational
   `flow` hop chains of the DDN animation feature (flagged identically
   across the corpus: bpmn.md, activity.md, interactions.md, sdl.md §10).
   A new DDNA block type is required for trace data; `flow` must not be
   overloaded. Cross-file: bare ids under the uniqueness ban; feature ids
   live in the separate DDNA feature-id space (chapter 1 §1.5).

7. **KEEL evaluation records.** Per evaluation: inputs, result, clock
   value, engine id **and engine version** (runtime-models.md §2.3;
   expr-sdl-msc.md §B.2.6 — per-event, per-instance stores). SysML solver
   traces must name the producing engine: two conforming solvers
   legitimately differ (sysml.md §10 ← SysML §10.1).

8. **Validation outcome storage (optional per family).** Trace-validity
   verdicts, including the normative third value **"not described"**
   (P ∪ I ≠ universe — UML 17.1.2, interactions.md §10).

## 4.3 The two replay modes

The corpus resolves the recompute-vs-replay tension with two modes; one
format supports both (runtime-models.md §3.2):

- **(a) Verified replay** — recompute under a declared deterministic
  semantic profile and check the trace. Applies where the family is
  deterministic: DDN `state.flat@1` (the existing recomputation model —
  DDN spec §23.5, exact-one-transition rule) and DMN decision tables
  (DMN §8.2.7 side-effect-freedom).
- **(b) Faithful replay** — replay recorded choices verbatim, no
  recomputation. Applies to everything else; "record, never re-derive" is
  unanimous across all eleven family analyses.

The **semantic-profile declaration determines which mode a trace is in.**
Seeded-RNG options are always hybrids: N3, N5 and N8 can never be
re-seeded, and SDL's stateful guards break naive purity — guard results
must be logged, not just seeds (runtime-models.md §3.4).

## 4.4 Stamping requirements (summary of mandatory declarations)

A DDNA file carrying traces must declare, in-file:

1. the DDN identity base(s) it serves (chapter 1);
2. the DDN source version and the DDNA standard version it targets
   (chapter 1);
3. the semantic-profile option set in force **and its version** (§4.2.5);
4. the replay mode per trace (§4.3);
5. the engine id and version for every KEEL evaluation record (§4.2.7).

## 4.5 Viewer-safety rule

A trace file is pure static data; replaying or stepping through a stored
trace is `[viewer-safe]` in every family (the corpus' flagship recurring
candidate). Trace *generation* is an interactive-tool (`[DT]`) feature.
~~This is the boundary the free/commercial split follows for traces:
reading is free, producing is not.~~ **2026-10-08 amendment:** both reading
and producing ship in the open tool (chapter 1 §1.2); [VS] stays meaningful
as the technical fact "a passive viewer can play this back without an
execution engine", and the commercial tier's trace differentiation is
quantitative (trace sizes/steps displayable) and collaborative, not a
generation lock.
