# Family chapter — no-standard families (combined)

**Status:** full draft, 2026-09-29. Combined chapter for the analyzed
families with **no governing standard**: ER notations, DFD, EPC, C4, mind
maps/concept maps, and the presentation families (org charts, timelines,
VSM, network diagrams). Sources: the six one-pagers in the analysis
corpus (er.md, dfd.md, epc.md, c4.md, mindmaps.md,
presentation-families.md). The shared finding for every section: **no
normative semantics exists — all DDNA features are DDNA-defined [DD]**
(chapter 3, no-standard row). Sections follow the same 8-part discipline
in miniature; claims wording is uniform and stated once (§9).

## ER notations (Chen, Crow's Foot/IE)

1. **Scope/sources:** no governing standard (READING-LIST tier 3);
   ratified D3 — this family's semantics home is this section plus KEEL
   T1/T2.
2. **Behavior adopted:** declarative constraints only — weak entities
   require a distinct owner; identifying relationships bind the weak
   entity to its owner; n-ary association arity; multivalued/derived
   attributes; ORM-style uniqueness/mandatory markers. Nothing executes;
   these are checkable rules over the model.
3. **Features:** core — the seven uncovered inventory entries of hole D3
   as declarative-constraint checks (weak-entity/owner consistency,
   identifying-relationship wiring, partial-key presence, ORM constraint
   verification) [DT compute / VS results]; schema-mapping rule checks
   [DT]. Excluded — any standards-based claim.
4. **Expression behavior:** KEEL **T1/T2** — static analysis and pure
   evaluation of constraint predicates; no tower/regime of its own
   (inherits the tag's).
5. **Trace/replay:** validation results as stored [VS] artifacts; no
   nondeterminism classes exercised.
6. **Runtime bindings:** DATA-A/C declarative values; no TIME or CONC
   content.
7. **Claims:** "DDNA-defined semantics" (§9).
8. **Open:** none beyond D3's scope.

## DFD (Yourdon/DeMarco, Gane–Sarson)

1. **Scope/sources:** no normative semantics *and no execution
   tradition* — unlike EPC→ARIS, DFD simulation is not an established
   practice (dfd.md §1).
2. **Behavior adopted:** data-flow conservation and balancing rules —
   flows between processes/stores/externals must be named; diagram
   balancing (parent/child flow equivalence) is a checkable
   declarative rule. Nothing operational is canon.
3. **Features:** core — balancing/conservation checks [DT/VS];
   data-dictionary consistency (flows resolve to declared entries)
   [DT/VS]; flow highlighting from stored paths [VS]. Excluded —
   simulation claims (no tradition to mirror).
4. **Expression behavior:** KEEL T1 for flow/dictionary references;
   T2 for any computed dictionary derivations [DD].
5. **Trace/replay:** static overlays only; no operational trace.
6. **Runtime bindings:** DATA-A/C; none for TIME/CONC.
7. **Claims:** "DDNA-defined semantics" (§9).
8. **Open:** whether balancing gets its own check codes when the
   overlays land.

## EPC (Event-driven Process Chain)

1. **Scope/sources:** no normative semantics (epc.md) — but a real
   simulation tradition exists in the literature (ARIS-style token
   playout), unlike DFD.
2. **Behavior adopted:** connector semantics by transfer
   (exclusion-sweep Part 1A): XOR/OR/AND split-join behavior is a subset
   of the BPMN token model — token playout mirroring that subset, with
   the fan-balancing rules the DDN profile already validates.
3. **Features:** core — token playout over the connector subset
   [DT; replay VS], with step granularity DDNA-defined; event/function
   alternation checks [DT/VS]. Excluded — OR-join ambiguity resolutions
   beyond a declared pinned interpretation (labeled [DD]).
4. **Expression behavior:** KEEL T2 for rule/condition labels on
   connectors; tower/regime per tag; pure guards.
5. **Trace/replay:** faithful replay of recorded choices; N1 (connector
   selection) recorded.
6. **Runtime bindings:** TIME-A if timers are ever annotated [DD];
   DATA-A/C instance stores; CONC-A.
7. **Claims:** "DDNA-defined semantics" with the BPMN-subset transfer
   noted as [DD] (§9).
8. **Open:** the OR-join pinned interpretation belongs to the [DD]
   register (chapter 8 §8.11).

## C4 model

1. **Scope/sources:** no standard; Brown's method is a visualization
   convention ("maps of your code"), with Structurizr's dynamic diagram
   as a *rendering* convention, not an operational semantics (c4.md).
2. **Behavior adopted:** none normative — features are query/display
   over declared data: dependency closure, boundary/coverage audit,
   technology-diversity, recorded dynamic-diagram playback (numbered
   steps as a *recorded* order, not a runtime).
3. **Features:** core — recorded dynamic-diagram replay [VS];
   deployment placement data (environment nodes, container-instance
   assignments) [DD, structural — D7]; architecture analysis overlays
   (fan-in/out, boundary audit, orphan detection, single-host
   concentration) [DT compute / VS results]. Excluded — any execution
   semantics; "automatic model discovery" and C4 brand compliance
   (already standing DDN exclusions).
4. **Expression behavior:** least KEEL of any family here — T2 for
   filter/query predicates only.
5. **Trace/replay:** recorded dynamic-diagram traces replayed as pure
   playback; the step order is data, never derived.
6. **Runtime bindings:** DATA-A/C declarative; deployment data
   structural only (ratified D7).
7. **Claims:** "DDNA-defined semantics"; "based on C4" claims pin the
   visual vocabulary only, not semantics we invented (§9).
8. **Open:** none (the stale "no dynamic/deployment profiles" claim was
   corrected in the corpus — both profiles exist at the notation layer).

## Mind maps / concept maps

1. **Scope/sources:** no semantics of any kind (mindmaps.md) — pure
   presentation structure.
2. **Behavior adopted:** none — these are the least semantic families in
   the catalogue; hierarchy and association are layout facts.
3. **Features:** optional — concept-map linking-phrase checks as
   declarative annotations [DD, DT/VS]; coverage/outline overlays [VS].
   Excluded — any runtime or evaluation framing.
4. **Expression behavior:** none required; T0 opaque references only.
5. **Trace/replay:** none.
6. **Runtime bindings:** none.
7. **Claims:** "DDNA-defined semantics" for the annotation checks only
   (§9).
8. **Open:** none.

## Presentation families (org charts, timelines, VSM, network diagrams)

1. **Scope/sources:** no governing standard; convention sources only
   (presentation-families.md). The VSM timeline ladder and timeline
   projections are *presentation* machinery at the DDN layer.
2. **Behavior adopted:** date-ordered *data* projection (timelines:
   records onto a time axis; org charts: reporting structure; VSM:
   declared VA/NVA values into the ladder; network: attachment
   topology). Nothing executes.
3. **Features:** core — time-scrubber playback over dated records [VS];
   computed-ladder overlays for VSM (declared values only) [DT/VS];
   network reachability/coverage overlays from declared attachments
   [DT/VS]; org-chart span/level queries [VS]. Excluded — any
   operational network simulation; personnel evaluation.
4. **Expression behavior:** T2 for filter/aggregation predicates over
   records [DD]; the DDN live-data machinery stays presentational and
   separate (chapter 7 §7.1).
5. **Trace/replay:** time-scrub states are recomputed projections of
   declared data — deterministic, replayable as [VS].
6. **Runtime bindings:** TIME as ISO-8601 data (T1); DATA-A/C; CONC-A.
7. **Claims:** "DDNA-defined semantics" (§9).
8. **Open:** none.

## 9. Uniform claims wording for this chapter

Every feature in this chapter is claimed as **"DDNA-defined semantics"**
and labeled [DD] wherever it appears (chapter 10 §10.3). Where a
transfer rule is used (EPC ← BPMN token subset), the claim is still
DDNA-defined with the transfer *noted* — the transfer is corpus
evidence, not a standard to mirror. No feature in this chapter makes any
standards-based claim.
