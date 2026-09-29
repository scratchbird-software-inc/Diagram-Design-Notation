# Chapter 2 — The six execution-model classes and family mapping

**Status:** stub (scope approved, prose pending the per-family work item).

## Outline

1. **EM-1 Token runtime** — BPMN 2.0.2 (token as definitional aid, "tools
   are NOT REQUIRED to implement any form of token" §13.3.1); UML activity
   (token-and-offer semantics, fUML Clause 8 operationalizes);
   flowcharts/EPC/Petri nets by transfer; IDEF0 ≈ activity data-flow
   subset.
2. **EM-2 Declarative DAG evaluation** — DMN (evaluation order derived from
   the requirement graph; side-effect-freedom makes steps commute);
   decision tables / DDN `decision.rules@1`.
3. **EM-3 Lifecycle-FSM runtime** — CMMN (nine lifecycle states, sentry
   rounds; GSM is lineage-only).
4. **EM-4 Trace-set observational semantics** — UML interactions ([P, I]
   trace-set pair, interleaving semantics); MSC (partial ordering on
   events; HMSC operational composition). Automation = trace
   validation/replay, never "execution".
5. **EM-5 Spec-delegated evaluation** — UAF (vendor-native by normative
   delegation); SysML parametrics partially (causality "left to the
   computational engine").
6. **EM-6 Conformance-specification** — SoaML (compatibility rules;
   behavioral conformance a declared semantic variation point).
7. **Special position — SDL**: the only family whose operational semantics
   is formal, normative, and in-family (Annex F3 abstract machine);
   EM-1-adjacent class of its own.
8. **Cross-cutting consequence**: all operational classes reduce to a
   single recorded interleaving (UML 17.1.1; fUML §2.3; Z.120 §4.1) — the
   trace format of chapter 4 rests on this.
