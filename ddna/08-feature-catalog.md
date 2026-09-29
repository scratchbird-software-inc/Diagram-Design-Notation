# Chapter 8 — Feature catalog

**Status:** full draft, 2026-09-29. The deduplicated catalog across all
analyzed families (11 standards-backed + 6 no-standard, per the corpus),
organized by execution-model class (chapter 2). Marks: **[VS]** viewer-safe
(pure playback of static file data), **[DT]** ddna-tool, **[DD]**
ddna-defined semantics. Tagging per feature: **core** (v1 scope),
**optional** (licensed/valuable, deferrable), **excluded** (with reason).
Tags in this draft are the corpus' recommendations; final v1 scoping is
owner's.

## 8.1 Cross-cutting features (all families)

| Id | Feature | Mark | Tag |
| --- | --- | --- | --- |
| F-X1 | Recorded-trace replay — step/highlight from a stored trace (the flagship) | [VS] | core |
| F-X2 | Trace recorder / stepping debugger — step/run/pause, breakpoints, watches; granularity per chapter 4 §4.2.1 | [DT] | core |
| F-X3 | KEEL expression-reference scheme — `{id, language, body-ref, typeRef?}` with hierarchical defaults (file format is DDNA; evaluation is host) | [DT] | core |
| F-X4 | Virtual clock for timers/time events (chapter 7 TIME-A) | [DT]; replay [VS] | core |
| F-X5 | Coverage/heat overlays from stored traces | [VS] | core |
| F-X6 | Static-analysis overlays with stored results (bounded proofs, subset linters, reachability, guard consistency, compatibility checks) | [DT compute / VS display] | core |
| F-X7 | Alien-format import bridges (chapter 11) | [DT] | core (per-format scope per chapter 11) |

## 8.2 EM-1 — token-runtime families

*Normative family chapters for this class: `families/uml-state-machines.md`, `families/uml-activities.md`, `families/bpmn.md`; SDL's special position is `families/sdl.md`.*

**BPMN:** F-BPMN-1 token simulation engine (§13.2–13.5) [DT] core ·
F-BPMN-2 message/correlation bus for collaborations (key-based routing)
[DT] core · F-BPMN-3 compensation/transaction scope analysis [DT] optional ·
F-BPMN-4 non-operational element stubs as external work-item prompts
(§13.1-sanctioned) [DT] core.

**UML activity:** F-ACT-1 fUML-subset execution engine + static
subset-membership check (static partial acceptance) [DT] core ·
F-ACT-2 interrupt/exception propagation overlay [VS from trace / DT
simulation; region-abort ordering DD] core · F-ACT-3 event-pool simulation
for signal acceptors (pluggable GetNextEventStrategy) [DT] optional ·
F-ACT-4 SysML rate/continuous annotations carried as data (never executed)
[DT] core.

**State machines (UML):** F-SM-1 SCXML Appendix-D stepper as the default
execution profile + UML-strict (PSSM) option — the profile declaration is
the semantic-profile stamp [DT] core · F-SM-2 breakpoint/watch metadata
(`x_debug`) [DT] core · F-SM-3 flat-trace fixtures extended to UML machines
under a declared profile [DT] core.

## 8.3 EM-2 — declarative families (DMN)

*Normative family chapter: `families/dmn.md`.*

F-DMN-1 live decision evaluation hook (host engine incl. full-FEEL tables)
[DT] core · F-DMN-2 hit-policy completion (all 7 DMN policies; priority
lists + Collect operators as declared data) [DT] core · F-DMN-3
decision-service invocation harness (§10.4 partitions declared) [DT]
optional · F-DMN-4 BPMN↔DMN call-site linkage (cross-family trace
stitching) [DT; display VS once recorded] core.

## 8.4 EM-3 — lifecycle-FSM family (CMMN)

*Normative family chapter: `families/cmmn.md`.*

F-CMMN-1 case engine / sentry evaluation runtime [DT] core · F-CMMN-2
human-decision interaction surface (role-checked work items) [DT] core —
**normative and load-bearing: an engine without it cannot instantiate CMMN
semantics** · F-CMMN-3 planning simulation (discretionary items,
ApplicabilityRules) [DT] optional · F-CMMN-4 CaseFileItem event
instrumentation [DT; replay VS] core.

## 8.5 EM-4 — trace-set families (interactions, MSC)

**UML interactions:** F-INT-1 trace validation against the [P, I]
semantics (three-valued verdict) [DT] core — **the family's distinctive
feature, possible only because interactions are trace-set
specifications** · F-INT-2 event-occurrence step-through on stored traces
[VS / DT generation] core · F-INT-3 timing-diagram cursor replay +
constraint checking [VS/DT] optional · F-INT-4 neg/assert/consider/ignore
verdict overlays [VS] core · F-INT-5 interaction-overview cross-view trace
linking [VS/DT] optional · F-INT-6 partial-trace (lost/found)
replay/validation [DT/VS] optional.

**MSC:** F-MSC-1 partial-order / interleaving inspector (stored
connectivity graph; Z.120 §4.1) [VS] core — family-distinctive · F-MSC-2
trace generator / stepping engine (single-instance-event granularity)
[DT] core · F-MSC-3 HMSC navigator/executor (§7.5 operational semantics;
"no legal traces" detection) [DT] core — family-distinctive (two-level
graph-over-traces) · F-MSC-4 timer/time-constraint checker over the
virtual clock [DT] core.

## 8.6 EM-5 — spec-delegated families (SysML, UAF)

**SysML:** F-SYS-1 recorded solver-trace replay (value assignments,
constraint fires, fixpoint, mode switches; engine stamped) [VS] core ·
F-SYS-2 KEEL-delegated constraint solving [DT] core · F-SYS-3 static
dimensional-consistency checker [DT] optional · F-SYS-4 binding-connector
first-class data (nested-end property paths) [DT file format] core ·
F-SYS-5 activity stream replay with rates/buffer occupancy [VS] optional ·
F-SYS-6 unit conversion service interface (beyond-SysML, host) [DT]
optional · F-SYS-7 trade-study results overlay [VS] optional · F-SYS-8
state-conditioned equation-set mode display [VS] optional.

**UAF:** F-UAF-1 capability dependency impact analysis (transitive
closure) [DT/VS results] core · F-UAF-2 roadmap time-scrubber playback
(milestones, versionReleased/Withdrawn) [VS] core · F-UAF-3 traceability
matrix query (cross-domain) [DT/VS] core · F-UAF-4 standards forecast /
phase projection [DT/VS] optional · F-UAF-5 constraint & measure
evaluation via KEEL [DT] optional · F-UAF-6 what-if / trade-off comparator
[DT] optional.

## 8.7 EM-6 — conformance-specification family (SoaML)

F-SOA-1 recorded service-enactment replay over bound choreography views
[VS] core · F-SOA-2 milestone-instrumented recorder + progress overlay
[DT/VS] core · F-SOA-3 full §6.4.15 ServiceChannel compatibility checker
(4 modes + isStrict) [DT/VS results] core · F-SOA-4 choreography
conformance validator (documented DDNA interpretation per §6.4.17.1;
interpretation id recorded) [DT] core · F-SOA-5 correlated multi-instance
conversation simulation (isID keys) [DT] optional.

## 8.8 Special position — SDL

F-SDL-1 SAM-mirroring simulator/stepper (macro = one transition; micro =
one SAM phase) [DT] core · F-SDL-2 timer service with virtual clock
(parameterized timer identity) [DT] core · F-SDL-3 channel router /
signal bus (FIFO delaying queues, NODELAY fast path, to/via resolution,
priority/availability ordering) [DT] core · F-SDL-4 MSC trace export
bridge (SDL consume/output events rendered as MSC) [DT] core —
**coordinate with F-MSC-\*: MSC is the rendering, not a second execution
format.**

## 8.9 No-standard families

ER/Chen, DFD, EPC, C4, mind maps, org charts, timelines, VSM, network:
every feature is **[DD] DDNA-defined** — no normative semantics exists to
mirror (chapter 12 §2 one-pagers; ER/Chen's is ratified D3:
declarative-constraint semantics + KEEL T1/T2). Tag: core for the
one-pagers themselves; family features optional until assigned a work
item.

## 8.10 Excluded (with reason)

- **Continuous/hybrid simulation** — zero normative support anywhere
  (only SysML §11.3.2.1's informative Runge-Kutta sentence) — excluded
  (chapter 7 TIME-D).
- **Multiple named clocks / distributed local clocks** — no family
  requires them — excluded (TIME-C, CONC-C).
- **ML/inference capabilities** — ratified out of scope (D1).
- **Interactive view state in the runtime model** — renderer/host concern,
  out of DDNA v1 (ratified D2).
- **Deployment execution semantics** — none exists to honor; structural
  note only (ratified D7).
- **Native alien-format display/execution** — import-only, chapter 11.
- **License-held surfaces** — ArchiMate commercial license and the IEC
  60617 full database are excluded until the legal review queue clears
  (the only standing capability restrictions; chapter 12 §1).

## 8.11 The ddna-defined semantics register

Every point where DDNA must invent semantics, corpus-tagged: BPMN step
granularity + inclusive-join/complex-gateway pinned interpretations; CMMN
step granularity + RequiredRule re-evaluation points; UML-activity
region-abort ordering, wait-time scheduling, partition execution
semantics; interactions/MSC event-occurrence stepping; state-machine
pool-order/conflict policy declarations; SysML default constraint-language
label and rate simulation semantics; SoaML behavioral-conformance
interpretation + milestone-expression validation; UAF derivation rules;
all no-standard-family semantics; the DDNA virtual clock itself (no
standard supplies one except the SDL/MSC per-family clocks). Every [DD]
artifact must be labeled as such wherever it substitutes for standard
semantics (chapter 10 §10.3).
