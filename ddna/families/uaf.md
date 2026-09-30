# Family chapter — UAF 1.2 (EM-5, delegated; grouped here with EM-6 per batch plan)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3 —
**UAF is EM-5 (spec-delegated)**, not EM-6; the batch plan grouped it
with EM-6 for authoring convenience, and this chapter records the class
as ch.02 has it (deviation noted in the batch report). Analysis source:
uaf.md.

## 1. Family scope & normative sources

UAF 1.2 DMM (§1.3 — conforms to ISO/IEC/IEEE 42010 for architecture
description; §6 — reuses UML and BPMN metamodel concepts *with their
semantics*; §7 — the domain × viewpoint grid with note b; §8 view
definitions; §9 — the temporal data model: ISO8601DateTime,
ActualProjectMilestone, MilestoneDependency, StrategicPhase,
VersionedElement, Forecast); OCL 2.4 as a normative reference. **Grid
note b is the load-bearing clause**: "The expectation is that tool
vendors intending to implement the UAF have capabilities native to their
tools to enable behavioral simulation and the evaluation of measures and
constraints" — normative delegation to vendors.

## 2. Execution semantics DDNA adopts

**UAF defines none of its own — explicitly and by design.** Whatever
token/event semantics exist in a UAF model are *borrowed* from the UML
and BPMN families (DMM §6: the reuse "enables the UAF DMM to reuse UML
semantics instead of reinventing its own semantics"), and those families'
chapters own them. What UAF defines instead is a **query/analysis
contract over a typed, dated instance graph**, and DDNA mirrors that:

- **Traceability aspect** (DMM §7.1, Table 7:2): mappings between
  elements across viewpoints and domains — the primary analysis question
  the grid is designed to answer; cross-domain traceability runs through
  the cross-file addressing machinery (architecture chapter; the DDN
  layer validates it through architecture containers).
- **Roadmap aspect**: how elements change over time — milestones ordered
  by MilestoneDependency, `versionReleased`/`versionWithdrawn` applied
  at milestones, Forecast transitions bound to an ActualStrategicPhase
  with `forecastPeriod`.
- **Derived step granularity** (denotational, data-driven): **one step =
  one milestone or phase boundary** — recompute the visible
  configuration at date D from the declared data. Not an operational
  token step, appropriate for a declarative family.
- **Measures aspect**: MeasurableElement / MeasurementSet /
  ActualMeasurementSet — measures set performance requirements
  constraining capabilities, evaluated per grid note b (KEEL, §4 below).

### 2.1 The temporal data substrate (what replay actually replays)

UAF's time content is entirely a *declared-data* substrate, and it is
rich enough to drive the roadmap features without any clock:

- **ActualProjectMilestone** — an event with a start date from which
  progress is measured; **MilestoneDependency** orders milestones into a
  partial order the scrubber walks.
- **VersionedElement + versionReleased / versionWithdrawn** — capability
  and configuration versions are released and withdrawn *at milestones*;
  the visible configuration at any date is a pure function of this data.
- **StrategicPhase / ActualStrategicPhase** — typed current-or-future
  states of the enterprise giving **Forecast** its temporal context
  (with `forecastPeriod`); standards carry `date` published/retired.
- **ActualPropertySet** — start/end times applying to whole element sets
  at once.

The roadmap scrubber (F-UAF-2) is therefore a deterministic projection:
advance to the next milestone in dependency order, apply the bound
release/withdraw/forecast transitions, re-render. The what-if comparator
(F-UAF-6) forks that projection at a chosen milestone and compares
outcomes — still pure data, but every comparison rule it applies is
DDNA-defined and labeled (chapter 10 §10.3).

## 3. Feature support

- **Core:** F-UAF-1 capability dependency impact analysis (transitive
  closure) [DT/VS results]; F-UAF-2 roadmap time-scrubber playback
  (milestones, versionReleased/Withdrawn) [VS]; F-UAF-3 traceability
  matrix query (cross-domain) [DT/VS].
- **Optional:** F-UAF-4 standards forecast / phase projection [DT/VS];
  F-UAF-5 constraint & measure evaluation via KEEL [DT]; F-UAF-6
  what-if / trade-off comparator [DT].
- **Excluded:** any normative citation for *how* impact analysis
  resolves (none exists — derivations are DDNA-defined); native UAF XMI
  execution (import-only, chapter 11); any UAF-specific event machinery
  (§2 — events belong to the reused UML/BPMN fragments).

## 4. Expression behavior

KEEL tiers: **T2** — OCL-capability constraints on capabilities,
resources and services; measure-vs-actual comparison; date-interval
predicates ("which capabilities are exhibited in phase P", "which
standards are current at milestone M"). Graph traversal dominates —
UAF needs the *least* KEEL of any family. Default language label: OCL.
Numeric tower and error regime: the OCL regime (null + invalid,
three-valued). Guard purity: pure. UAFML's structured-English
constraints are the spec's own indirection — DDNA carries them as
language-tagged references, mirroring it.

## 5. Trace & replay requirements

Nondeterminism classes: essentially **N5** only (as-built actuals are
injected data); derivations (impact closure, forecasts) are deterministic
over declared data and must not fabricate order. Stamping:
semantic-profile + version with the derivation rule ids used (derivation
rules are DDNA-defined and labeled). Replay mode: **faithful replay** of
recorded roadmap/what-if projections; analysis *results* are stored
[VS] artifacts, their computation [DT].

## 6. Runtime-model bindings

TIME: **T1** — all temporal constructs are ISO-8601 *data* (milestones,
phases, forecasts, standard dates); no clock or scheduling exists. DATA:
**DATA-A or C** — declarative value graphs (D6): the typed, dated
instance graph is the substrate; cross-file identity uses the
architecture container rules (chapter 1 §1.4). CONC: **CONC-A** —
nothing concurrent to schedule; the roadmap scrubber is a deterministic
data projection.

## 7. Conformance claim wording

**No conformance claim needed for analysis features** — analysis is
conformance-neutral (DMM §2's four conformance types are all
syntax/interchange; grid note b delegates simulation to vendors).
Derivation rules are **DDNA-defined** and labeled. **Never:** any
normative citation for how impact analysis resolves.

## 8. Open items

- Derivation-rule registry (impact closure, phase projection) — [DD]
  entries to be pinned when F-UAF-1/4 land.
- UAF 1.2 (profile) vs 1.3 (current) — version-drift item
  (chapter 12 §5).
