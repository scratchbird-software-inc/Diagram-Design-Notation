# Family chapter — UML state machines (EM-1, state)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3 as
amended (UML state machines were added to the mapping table as EM-1
state-runtime when this chapter was drafted). Analysis source:
statemachines.md.

## 1. Family scope & normative sources

UML 2.5.1 chapter 14 (state machines — run-to-completion, event pool,
transition firing order); SCXML (W3C) §3.13 and Appendix D "Algorithm for
SCXML Interpretation" — verified; PSSM 1.0 (extends the fUML execution
model with state-machine semantics and a normative RTC-step conformance
suite) — **UNVERIFIED-PDF** for chapter numbers; PSCS 1.2 (ports/connectors
on composite structures) where state machines are classifier behaviors.
fUML 1.5 does **not** include state machines in its subset. UML
§14.2.3.9's exact subsection numbering is **UNVERIFIED-PDF** (wording
corroborated by secondary sources) and is cited with this drafting note
only.

## 2. Execution semantics DDNA adopts

DDNA **mirrors the behavior**; it never executes a UML/SCXML dialect. The
behavior a DDN/DDNA state-machine diagram exhibits:

- **Run-to-completion**: event occurrences are processed one at a time; a
  single RTC step applies to the whole state machine (orthogonal regions
  execute within one step).
- **Event pool**: recognized events are stored; at a stable configuration
  the pool is examined. Dequeue order is a declared semantic option (the
  standard leaves it open).
- **Firing order**: exit behaviors innermost-first up to but not including
  the LCA, then the transition effect, then entry behaviors
  outermost-first. Guards are evaluated before selection, once per
  dispatch.
- **Completion events and do-activities**: eventless transitions fire when
  a state's do-activity completes; do-activities run concurrently and may
  be interrupted by outgoing transitions. Deferred events remain pooled
  until they match.
- **SCXML-mode (the default profile)**: the fully deterministic Appendix-D
  algorithm — microstep (the optimal enabled transition set for one
  event), macrostep (microsteps until no internal event remains and no
  NULL-event transition is enabled), child-over-parent priority, document
  order, `<final>` completion events. Unmatched events are *dropped* in
  SCXML — a named divergence from UML deferral.

The semantic-profile declaration (chapter 4 §4.2.5) chooses **SCXML-mode
(default) or UML-strict (PSSM)**, plus the pool-order and conflict
policies. Every trace stamps the profile and its version.

## 3. Feature support

- **Core:** F-SM-1 SCXML-Appendix-D stepper as the default execution
  profile + UML-strict (PSSM) option [DT]; F-SM-2 breakpoint/watch
  metadata (`x_debug`) [DT]; F-SM-3 flat-trace fixtures extended to UML
  machines under a declared profile [DT]; recorded-trace replay (F-X1)
  [VS]; the virtual clock for `after(…)`/`at(…)` timers (F-X4) [DT].
- **Optional:** event-pool simulation policies beyond FIFO (pluggable
  strategies, mirroring fUML's GetNextEventStrategy pattern); deferred-event
  inspection overlays [VS].
- **Excluded:** "UML-conformant state machine execution" as a claim (pool
  order and corner cases are variation points; see §7); any scheduling
  model for time events beyond the DDNA virtual clock (no normative clock
  exists — UNVERIFIED-PDF-consistent across secondary sources); native
  SCXML/XMI execution (import-only, chapter 11).

## 4. Expression behavior

KEEL tiers: **T2** guards (Constraint/`cond` booleans evaluated at
dispatch), **T3** datamodel store + assignment (`<assign>`, entry/exit/do
bodies — the ALF closed effect set, chapter 6 §6.2), **T4** change events
`when(<expr>)` as re-evaluation triggers. Numeric tower: per language tag
— SCXML datamodel profiles name `null`/`ecmascript`/`xpath`; the XPath
tower (IEEE double, with NaN) applies where XPath is the tag. Null/error
regime: per tag; the OCL regime (null + invalid, three-valued) where OCL
is the constraint language. Guard purity: **pure** — decisionInput-style
guards must not have side effects (UML 15.3.3.6 discipline); a guard is
evaluated once per dispatch, which the trace records. The grandfathered
`state.flat@1` bounded evaluator (ratified D11) is the in-repo precedent
of the T2 tier — documented, side-effect-free, never a precedent for
further embedding.

## 5. Trace & replay requirements

Nondeterminism classes exercised: **N2** (event-pool dispatch order),
**N3** (event-arrival vs internal-readiness races, incl. completion-event
priority), **N5** (injected "now" for timers and external stimuli),
**N1** (guard selection), and fragment-level loop indices where machine
histories re-enter states. Stamping: the semantic-profile declaration is
the stamp (SCXML-mode vs UML-strict, pool-order policy, conflict policy,
profile version). Replay mode: **faithful replay** of recorded choices;
**verified replay** applies only to the `state.flat@1` deterministic
subset under its existing recomputation model. History/deep-history
snapshots are configuration bookkeeping — recorded, never re-derived.

## 6. Runtime-model bindings

TIME: **TIME-A** — the virtual clock owns `after`/`at` scheduling
(TimeEvent occurrences land in the pool at expiry); no TIME-B need
(durations are ISO-8601 values). DATA: **DATA-A or C** — per-instance
stores keyed (machine id, instance discriminator); history snapshots are
copy-on-event state references (chapter 4 §4.2.4). CONC: **CONC-A** — one
global interleaving; orthogonal regions interleave within a single RTC
step by definition; the C2 composition rule distinguishes UML
synchronized regions from SDL's alternating composite states (chapter 7
§7.4) and must be applied per profile.

## 7. Conformance claim wording

Default: **"SCXML-mode default (mirrors W3C SCXML Appendix D
microstep/macrostep), with UML-strict (PSSM) semantic option"** — the
near-conformance path of chapter 10 §10.4, always with the per-file
semantic-profile declaration. **Never:** "UML-conformant state machine
execution" — UML leaves pool order and corner cases as variation points,
and PSSM ambiguities are documented (Elekes 2023, cited in
statemachines.md §10). PSSM suite conformance is a drafting note until the
document is acquired (chapter 12 §4).

## 8. Open items

- PSSM 1.0 acquisition (chapter numbers, conformance-suite license) —
  UNVERIFIED-PDF.
- Pool-order policy vocabulary beyond FIFO/priority-named (declared
  policy slot — no normative list exists).
- The `sdl.process@1` rebadge collision (UML-style parallel regions vs
  SDL alternating composite states) is owned by the SDL family chapter;
  this chapter only pins the UML side of the C2 rule.
