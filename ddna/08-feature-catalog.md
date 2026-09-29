# Chapter 8 — Feature catalog

**Status:** stub (scope approved, prose pending the per-family work item).

## Outline

Marks: **[VS]** viewer-safe (pure playback of static file data), **[DT]**
ddna-tool, **[DD]** ddna-defined semantics (the standard leaves the point
undefined).

1. **Cross-cutting features** — recorded-trace replay [VS] (the flagship);
   trace recorder / stepping debugger [DT]; the KEEL
   expression-reference scheme [DT]; virtual clock for timers [DT];
   coverage/heat overlays [VS]; static-analysis overlays with stored
   results [DT compute / VS display]; alien-format import bridges [DT].
2. **Family-specific features** — DMN (live evaluation hook, hit-policy
   completion, decision-service harness, BPMN↔DMN linkage); state machines
   (SCXML-D stepper default + UML-strict option, debug metadata, flat-trace
   fixtures); BPMN (token simulation, correlation bus, compensation
   analysis, non-operational stubs as work-item prompts); CMMN (case
   engine, normative human-decision surface, planning simulation,
   CaseFileItem instrumentation); UML activity (fUML-subset engine +
   static membership check, interrupt overlay, event-pool simulation,
   SysML rate annotations as data); interactions (three-valued trace
   validation — family-distinctive, step-through, timing cursor, verdict
   overlays, cross-view linking, partial traces); SysML (recorded
   solver-trace replay, KEEL-delegated solving, dimensional checker,
   binding-connector data, stream replay, unit-conversion service,
   trade-study overlay, mode display); SoaML (enactment replay, milestone
   recorder, full §6.4.15 compatibility checker, choreography conformance
   validator, correlated conversations); UAF (impact analysis, roadmap
   scrubber, traceability matrix, standards forecast, KEEL measures,
   what-if comparator); SDL (SAM-mirroring stepper, timer service,
   channel router, MSC export bridge); MSC (partial-order inspector —
   family-distinctive, trace generator, HMSC navigator, timer checker).
3. **The ddna-defined semantics register** — every point where DDNA must
   invent semantics, corpus-tagged: BPMN step granularity + inclusive-join
   and complex-gateway pinned interpretations; CMMN step granularity +
   RequiredRule re-evaluation points; UML-activity region-abort ordering,
   wait-time scheduling, partition semantics; interactions/MSC
   event-occurrence stepping; SM pool-order/conflict policies; SysML
   default constraint-language label and rate simulation; SoaML
   behavioral-conformance interpretation + milestone-expression
   validation; UAF derivation rules; all no-standard-family semantics; the
   DDNA virtual clock itself.
