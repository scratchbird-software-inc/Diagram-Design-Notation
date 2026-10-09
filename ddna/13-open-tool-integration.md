# Chapter 13 — Open-tool integration (DDNA in the open viewer/designer)

**Status:** full draft, 2026-10-08. Specifies how the open tool (the unified
ddn-viewer/ddn-designer, `notation/tool`) hosts DDNA under the 2026-10-08
boundary (chapter 1 §1.2 decision 2): the open tool includes DDNA —
companion files, trace replay **and** generation, execution engines, KEEL
evaluation — and the commercial product differentiates quantitatively and
collaboratively only. This chapter is a *tool-integration* specification: it
fixes host behavior, file conventions and diagnostics. It defines no new
format semantics — the trace format (chapter 4), the KEEL seam (chapter 5),
the runtime models (chapter 7) and the per-family behavior (chapters 6, 8,
`families/`) are normative where written, and are referenced, not repeated.

> **Implementation status (2026-10-08, Phases A, B and C landed):** §13.2 is shipped in
> the live unified tool, tool-layer only (OT-003: `notation/dist` is
> byte-identical — the checks live in `notation/tool/src/files.js`:
> `isCompanionFile` / `companionFacts` / `architectureContainers` /
> `servedBases` / `ddnaDiagnostics`). OT-010: the Files outline nests
> companions under each serving base with the `ddna companion · automation`
> label and automation-fact role summaries (profiles/traces/keel refs from
> parse facts). OT-011: `pickEntryView` skips companions explicitly, and
> opening one renders a read-only declaration summary in the Inspector (never
> a canvas). OT-012: companion delete confirms name the served base files.
> OT-013: `ddnaDiagnostics` emits DDN-A001 (missing container target, orphan
> companion, cross-base identity collision per §1.5, unresolved x_link target
> — absent files note the graceful DDN-PJW07 path) and DDN-A008 (version
> coupling) through the diagnostics drawer at load; `load()` refreshes the
> drawer even when the render gates with DDN-PJ216. Phase A note: a missing
> architecture-container file still blocks the canvas render with DDN-PJ216
> (runtime is unchanged in Phase A); the DDN-A001 diagnostic names the broken
> association at load as specified.
>
> **Phase B (§13.3) shipped 2026-10-08:** `notation/tool/src/ddna-trace.js`
> (registered in `TOOL_MODULES`) hosts the shared trace validator —
> sidecar `*.ddnatrace.json` shape checks (DDN-A002: format/version stamp,
> workspace-relative paths, replay_mode, time_model, ch.4 §4.2 envelope
> monotonicity), identity coverage against the served bases (DDN-A003), and
> the inline `x_trace` fixture spelling through the same validator (OT-022).
> Sidecars live in a tool-level store (the runtime workspace accepts `.ddn`
> sources only): folder/file open captures them, hosts inject them with
> `DDNTool.addTraceFile`. The animation drawer carries the replay mode
> (OT-030/031/033): trace picker with event counts and the declared mode
> (never silently switched), start/stop/step/reset with speed, virtual-clock
> readout, the PoC render model (active glow, done dim, EM-1 token badges,
> verdict colours, live value overlays, not-taken branch flash), and the
> trace table. §13.6 limits are enforced display-side with DDN-A004
> truncation marks (10,000 events per trace; 500 table rows; 64 value
> overlays). Replay is read-only — it never writes to source. Verified-mode
> divergence recomputation (DDN-A007) needs the Phase C engines; Phase B
> enforces the envelope checks at load (A002) and displays the declared mode.
> Phase C is implemented as recorded immediately below.
>
> **Phase C (§13.4–§13.5) shipped 2026-10-08:** `notation/tool/src/ddna-keel.js`
> is the open KEEL host — the nine seam functions (Wf1–4, Tc1–3, EqVar, Tc4,
> Vars, Replace, NewVar, Eval) over keel-l0@1 (decimals, strings, booleans,
> null, lists, records, field/index access, integer-safe arithmetic,
> comparison/boolean operators, if-then-else; no recursion/loops/effects/
> time), tiers T0–T2 with partial Eval exactly as the seam requires; the PoC
> scratch tag `poc-expr` is accepted as L0-compatible. Above-ceiling languages
> degrade to DDN-A005 at load. `notation/tool/src/ddna-engine.js` carries the
> EM-1 token engine (plus the order-saga flagship), EM-3 lifecycle FSM and
> EM-4 trace-set/verdict engines, deterministic under the declared profile
> (OT-041 — the Phase B player replays generated traces step-identically),
> under §13.6 budgets (10,000 steps / 64 instances → DDN-A004, partial trace
> marked complete:false); generic EM-2 and EM-5/EM-6 report DDN-A006, never a silent
> stub. Verified replay now recomputes through the engine and names the first
> divergent event (DDN-A007). The animation drawer's Execution section runs
> an engine into the replay picker and downloads the generated sidecar.

Requirement ids are `DDNA-OT-###`; acceptance criteria are
`DDNA-OT-AC-###` and name the demonstrating artifact. "The tool" means the
open unified viewer/designer built on the open DDN runtime. "Commercial
tier" means ScratchWeaver (referenced, never specified here).

## 13.1 Ground rules (binding)

- **DDNA-OT-001.** The DDN grammar, registry and dialect are unchanged by
  DDNA integration. A companion file is a plain DDN source file whose DDNA
  payload rides registered `x_` extension keys (`x_profile`, `x_keel`,
  `x_trace`, family keys per chapters 6–8). No DDNA construct may require a
  DDN grammar change.
  *DDNA-OT-AC-001:* the DDN conformance vector corpus (DDN spec ch. 58)
  passes unmodified with DDNA support loaded.
- **DDNA-OT-002.** Graceful degradation is unchanged: a DDN-only
  third-party tool parses every companion as inert metadata (`x_` pass-
  through; `DDN-PJW07` for an absent association target — never an error).
  *DDNA-OT-AC-002:* a DDN file plus companions renders identically in the
  open tool with DDNA support disabled and in a DDN-only third-party parser.
- **DDNA-OT-003.** The DDN *runtime/renderers* stay notation-pure: no trace,
  execution or KEEL code enters `ddn-core`/`ddn-graph` render paths. DDNA
  integration is a tool-layer module set consuming the runtime's public IR
  and its `data-id="module::path"` element stamps.
  *DDNA-OT-AC-003:* `notation/dist` builds byte-identically with and without
  the DDNA tool modules present (they are not part of the runtime bundles).
- **DDNA-OT-004.** The only product gating in the open tool is the
  quantitative display-limit set of §13.6 plus the KEEL tier ceiling of
  §13.5.3. No capability class is withheld.
  *DDNA-OT-AC-004:* every feature tagged `[VS]` or `[DT]` in chapter 8 is
  reachable in the open tool, subject only to §13.6 limits.

## 13.2 Phase A — workspace integration (companions as first-class citizens)

Companion files already arrive through the workspace import closure and
architecture containers (chapter 1 §1.4; designer spec ch. 20 WW-001).
Phase A makes them visible and safe.

- **DDNA-OT-010.** The Files outline groups each companion file under the
  identity-base file(s) it serves, labelled `ddna companion`, with the
  one-line role summary extended to automation facts — e.g.
  `2 profiles · 14 traces · keel refs · data only`.
  *DDNA-OT-AC-010:* given a base + companion fixture, the outline shows the
  companion nested under its base with the label and the role summary.
- **DDNA-OT-011.** A companion that declares no view is excluded from entry
  detection and view picking (it is not a diagram source) and renders
  read-only structured content (profile/KEEL/trace declarations) in the
  inspector, never as a canvas.
  *DDNA-OT-AC-011:* the companion never appears in the view switcher; its
  inspector view shows the declarations read-only.
- **DDNA-OT-012.** Companion edits follow the same multi-file write-target
  rules as any workspace file (designer spec ch. 20 WW-006): the blast-
  radius preview names the served bases.
  *DDNA-OT-AC-012:* deleting a companion lists its served base files in the
  confirm dialog.
- **DDNA-OT-013.** Companion association validity (base identities present,
  no cross-base collision per chapter 1 §1.5, version coupling per §1.3) is
  checked at workspace load and on companion save, with the §13.7
  diagnostics.
  *DDNA-OT-AC-013:* a companion referencing a missing base element reports
  DDN-A001 at load, not at replay time.

## 13.3 Phase B — trace convention and replay

### 13.3.1 The stored trace convention (decided)

**Decision (this chapter, ratified for the tool):** the canonical stored
trace is a **sidecar JSON file** `*.ddnatrace.json`, referenced from the
companion. The companion declares the association; the sidecar carries the
events. (Traces are generated artifacts and can be large; a sidecar keeps
companions small, streams, and diffs cleanly. Inline `x_trace` blocks in the
companion are a fixture/debugging convenience only — same record model.)

- **DDNA-OT-020.** A stored trace file is one JSON document:
  `{ "format": "ddna-trace@1", "ddna": "<standard version>",
     "companion": "<workspace-relative companion path>",
     "base": "<workspace-relative DDN base path>",
     "semantic_profile": "<profile id per chapter 4 §4.2.5>",
     "replay_mode": "verified" | "faithful" (chapter 4 §4.3),
     "time_model": {…} per chapter 7, "events": [ … ] }`,
  where every event carries the eight field groups of chapter 4 §4.2
  (envelope with monotonic sequence + virtual-clock value + `stepKind`;
  instance identity; choice records for N1–N8 where applicable; stamps per
  §4.4). Paths follow the DDN workspace path rules (DDN spec §53.3 —
  relative, inside the workspace, no absolute paths or URLs).
  *DDNA-OT-AC-020:* the PoC's six per-class fixtures serialize to this
  document shape and reload byte-identically.
- **DDNA-OT-021.** The companion references a trace sidecar with
  `x_trace: { file: "<path>.ddnatrace.json", applies_to: [@id …] }` on a
  data block or element; `applies_to` names the DDN identities the trace
  covers. A trace event's element key MUST resolve to a base identity
  covered by `applies_to` (`DDN-A003` otherwise).
  *DDNA-OT-AC-021:* a trace event naming an undeclared element id fails
  load with DDN-A003 naming the id and the trace file.
- **DDNA-OT-022.** The PoC's `x_trace` inline form is accepted as the
  inline spelling of the same record model (small fixtures, debugging);
  both forms share one validator. There is no third trace serialization.
  *DDNA-OT-AC-022:* the same trace, inline and sidecar, produces identical
  replay state.

### 13.3.2 The replay player

The tool's animation drawer (the SMIL display-animation surface, B1-033) is
the host: DDNA replay is a second mode of that drawer, driven by the
runtime's `data-id="module::path"` stamps for the trace-event → element
mapping.

- **DDNA-OT-030.** The drawer gains a trace-source picker (traces declared
  by the workspace's companions for the current view), start/stop/step/
  reset controls, and a virtual-clock readout (chapter 7 TIME-A).
  *DDNA-OT-AC-030:* picking a trace and stepping advances the virtual clock
  and the active-element highlight in lockstep with the event sequence.
- **DDNA-OT-031.** Replay renders per the PoC-proven model: active-element
  glow, completed-step dimming, token badges, verdict colours, live value
  overlays, and the trace table (event list with stepKind and choice
  records). Choice consumption follows the N1–N8 records verbatim; nothing
  is recomputed in faithful mode.
  *DDNA-OT-AC-031:* the six PoC fixtures replay in the drawer with the same
  state sequence the PoC's node harness reports.
- **DDNA-OT-032.** Replay mode follows the trace's declared
  `semantic_profile` (chapter 4 §4.3): `verified` re-runs the deterministic
  profile and reports any divergence as `DDN-A007`; `faithful` replays the
  recorded choices verbatim. Mode is displayed, never silently switched.
  *DDNA-OT-AC-032:* a trace edited to contradict its verified profile
  reports DDN-A007 naming the first divergent event.
- **DDNA-OT-033.** Verdict display is per family (chapter 8): overlays
  render stored verdicts (three-valued where the family defines them) and
  never invent a verdict.
  *DDNA-OT-AC-033:* an interaction-family trace with a recorded `fail`
  verdict paints it; a trace with no verdicts shows none.

## 13.4 Phase C — execution engines

**2026-10-09 addition:** the exact `ddna.em2.dag-l0@1` profile now supports
bounded dependency-graph evaluation with recorded inputs and full-event
verified recomputation. [Chapter 14](14-bounded-declarative-evaluation.md)
defines its limits and DDN-A009 validation diagnostic. The additional exact
`ddna.em2.tables-l0@1` profile supports unique, first and collect tables. This does not implement
full DMN/FEEL, EM-5 solving or EM-6 protocols.

The open tool hosts execution engines per execution-model class (chapter 2),
starting with the classes the PoC proves. Engines consume the companion's
declared profiles and KEEL references; they never evaluate expressions
themselves (chapter 1's standing KEEL warning).

- **DDNA-OT-040.** Phase C ships engines for EM-1 (token runtime), EM-3
  (lifecycle FSM) and EM-4 (trace-set) — the PoC-proven classes — plus the
  no-standard-family declarative-constraint semantics (ratified D3). EM-2,
  EM-5 and EM-6 follow as family work items; an unavailable class is
  `DDN-A006`, never a silent stub.
  *DDNA-OT-AC-040:* an unsupported EM-2 profile in the open tool reports DDN-A006
  naming the class until its engine lands.
- **DDNA-OT-041.** Engines produce traces conforming to §13.3.1 (trace
  *generation* writes the sidecar). Generation is deterministic under the
  declared semantic profile; every N1–N8 choice is recorded, never
  re-derived on replay (chapter 4 §4.3(b)).
  *DDNA-OT-AC-041:* run → record → replay round-trips state-identically for
  each Phase C engine.
- **DDNA-OT-042.** Execution is sandboxed and budgeted in the tool: step
  count, wall time and instance count are capped per §13.6; an exceeded
  budget stops the run with `DDN-A004` and a partial trace marked as such.
  *DDNA-OT-AC-042:* a runaway fixture stops at the step cap with DDN-A004
  and the partial trace is flagged `complete: false`.

## 13.5 KEEL in the open tool

- **DDNA-OT-050.** The open tool ships a **KEEL host** implementing the nine
  seam functions verbatim (`Wf1–4`, `Tc1–3`, `EqVar`, `Tc4`, `Vars`,
  `Replace`, `NewVar`, `Eval` — chapter 5 §5.1), covering tiers T0–T2
  (opaque reference, static analysis, pure evaluation — chapter 5 §5.2).
  *DDNA-OT-AC-050:* the seam conformance fixtures exercise all nine
  functions; `Eval` is partial exactly as the seam requires (undefined
  unless every variable is defined in the state argument).
- **DDNA-OT-051.** The minimal conformant expression language for the open
  tool is the **KEEL-L0 subset** (fixed by this chapter): decimal numbers,
  strings, booleans, null; lists and records; field/index access;
  arithmetic (`+ − × ÷`, integer-safe), comparison and boolean operators;
  `if-then-else`; no recursion, no loops, no effects, no time access. KEEL-L0
  is a *host language*, not a DDNA dialect — companions reference it by the
  language tag `keel-l0@1` (chapter 5's reference scheme). The PoC's scratch
  subset is its proof, not its definition.
  *DDNA-OT-AC-051:* every `keel-l0@1` expression in the conformance fixtures
  evaluates identically in the open tool and the reference harness.
- **DDNA-OT-052.** Tiers T3+ (stateful, reactive, solving, underspecification,
  instrumentation, open type environments) and any fuller expression
  language are host-supplied or commercial: ScratchRobin/Weaver's fuller
  KEEL supersedes the open host. A companion requiring a tier above the
  host's ceiling degrades to `DDN-A005` (tier unavailable) — the rest of the
  workspace still loads.
  *DDNA-OT-AC-052:* a T3-requiring companion loads, reports DDN-A005 naming
  the tier, and its KEEL-dependent features mark themselves unavailable.

## 13.6 Open-tool display limits (the quantitative tier)

These are the **only** gating knobs, all named constants, all display-side;
the commercial tier removes or raises them (chapter 1 §1.2):

| Constant | Open-tool limit | Rationale |
| --- | --- | --- |
| `DDNA_VIEW_ELEMENTS_MAX` | 128 elements / 384 relations per view | the existing interactive-render caps (DDN-QP003 family), unchanged |
| `DDNA_TRACE_EVENTS_MAX` | 10,000 events per trace file | memory/display bound; larger traces are commercial-tier |
| `DDNA_TRACE_TABLE_ROWS_MAX` | 500 rows in the replay table | DOM honesty; the trace itself still replays fully |
| `DDNA_REPLAY_VALUE_OVERLAY_MAX` | 64 simultaneous value overlays | readability bound |
| `DDNA_EXECUTION_STEPS_MAX` | 10,000 engine steps per run | runaway guard (DDN-A004) |
| `DDNA_EXECUTION_INSTANCES_MAX` | 64 concurrent instances | instance-explosion guard |

- **DDNA-OT-060.** Exceeding a display limit is `DDN-A004` with the constant
  named; the tool renders up to the limit and marks the truncation, never
  silently drops.
  *DDNA-OT-AC-060:* an 11,000-event trace loads with DDN-A004, replays the
  first 10,000 events, and marks the truncation in the drawer.

## 13.7 Diagnostics vocabulary (decided)

A new coded family **`DDN-A###`** for DDNA open-tool integration (distinct
from `DDN-I###`, the experimental fixed-lane interaction profile — that
family is a different surface and is untouched):

| Id | Severity | Meaning |
| --- | --- | --- |
| `DDN-A001` | error | Companion declares an association target that does not resolve (base identity missing; version coupling mismatch). |
| `DDN-A002` | error | Trace file fails the §13.3.1 shape/version checks (`format`, `ddna` version, semantic profile stamp). |
| `DDN-A003` | error | Trace event references an identity not covered by the trace's `applies_to`. |
| `DDN-A004` | warning | An open-tool display/execution limit (§13.6) was exceeded; truncation point named. |
| `DDN-A005` | warning | Companion requires a KEEL tier above the host ceiling (§13.5.2); feature marked unavailable. |
| `DDN-A006` | warning | No engine for the companion's execution-model class is installed in the open tool. |
| `DDN-A007` | error | Verified replay diverged from recomputation; first divergent event named. |
| `DDN-A008` | error | Companion's recorded DDN/DDNA version targets are incompatible with the served base. |
| `DDN-A009` | error | Invalid bounded declarative graph, input or result (chapter 14). |

- **DDNA-OT-070.** DDNA diagnostics use this family only; DDN core codes are
  unchanged, and a DDN-only third-party tool sees companions exactly as
  before (DDNA-OT-002).
  *DDNA-OT-AC-070:* the diagnostics table above is registered in the shared
  registry tooling; no id collides with an existing code.

## 13.8 Phasing and proof

Phase A (§13.2) lands first and is independently shippable. Phase B (§13.3)
proves against the PoC fixtures before the drawer UI lands (node harness
first, per the PoC's own discipline). Phase C (§13.4–13.5) follows per
engine class. The disposable PoC (`kimi-DDN-workarea/ddna-poc`) is the
reference harness for every AC above until the conformance fixtures move
into the repo — the PoC itself is then deleted as its README directs.

## Composable DDN content

DDN source dialect 0.7 adds independently visible element sections and inline or DDNN text documents; see [DDN chapter 59](../standard/specification/59-composable-elements.md). Notes can contain authoritative procedure/function source, but remain inert for DDNA replay. Replay addresses semantic element identities and applies overlays to every visible appearance. Appearance section choices and scroll positions do not create runtime instances. A `.ddna` companion is accepted alongside `.ddna.ddn`; existing version coupling still applies. This amendment supplies no database execution or migration engine.
