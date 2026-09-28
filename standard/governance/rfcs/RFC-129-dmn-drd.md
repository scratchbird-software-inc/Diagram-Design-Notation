# RFC 0129 — DMN 1.4 DRD notation + decision-table integration (no expression language)

Status: implemented  
Authors/reviewers: B1-066 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `dmn.drd@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

DDN ships `decision.rules@1` (typed predicates, unique/first/collect hit policies, bounded coverage/shadowing proofs, `evaluateDecision()`), but has no DMN diagram surface: no decision requirements diagram (DRD), no DRD↔decision-table wiring, and only three of the DMN hit-policy labels. DMN 1.4 additionally specifies the DRD node/connector vocabulary, boxed-expression presentation forms, and the wider hit-policy label set.

**Fixed boundary (user decision):** FEEL and expression evaluation are backend capabilities (KEEL) owned by ScratchRobin — never part of DDN, the viewer, or the designer. DMN scope here is notation + the existing bounded decision-table engine only.

## Proposed syntax

No grammar change. Additive kinds/relations/contracts:

1. **DRD profile `dmn.drd@1`** (graph projection) — kinds: `dmn.decision` (rect), `dmn.bkm` (business knowledge model; new clipped-corner silhouette), `dmn.inputdata` (rounded), `dmn.knowledgesource` (document/dog-ear), `dmn.decisionservice` (rect with a divider band — the cheap form). Relations: `dmn.inforeq` (solid, filled arrowhead), `dmn.knowledgereq` (dashed, open arrowhead), `dmn.authorityreq` (dashed, open circle at the authority end — new `circle` end mark).
2. **DRD↔table binding** — a `dmn.decision` node may carry `x_subdiagram: { view }` referencing a `decision`-projection view; the existing ref badge (`↗ ref`) renders (interaction-overview pattern). The binding validates: target view exists and is a decision projection (DDN-PJ192).
3. **Hit-policy labels** — `hit_policy` accepts `priority`, `any`, `output_order`, `rule_order`, `aggregation` (with `x_aggregation` ∈ sum/min/max/count on collect-family tables) in addition to unique/first/collect. These are *table annotations*: the bounded analyzer keeps running (overlaps/coverage reported, never evaluated as FEEL); `evaluateDecision()` answers `matched` in table order for the annotation policies and documents that final ordering/aggregation is the host application's job. `any`/`priority`/`output_order`/`rule_order` fail overlap proofs only where the policy claims disjointness (none of them do).
4. **Completeness indicator** — the decision-table header shows the DMN completeness cell: `C+` when `coverage: "complete"` is declared and proved, `C−` otherwise (report/none).
5. **Multi-output presentation** — `outputs` already renders one column per output; unchanged, now exercised in the DMN examples.
6. **Boxed expressions (presentation only)** — `x_boxed: { form: literal|context|invocation|relation, text?, entries? }` on `dmn.decision`/`dmn.bkm`: rendered as a compartment of text rows under the node label. Display only — the text is never parsed or evaluated (DDN-PJ193 shapes the contract).

## Semantic normalization and identity effects

None — notation over existing element/relation identities. `decision.rules@1` fixtures render byte-identically (the header gains the completeness cell only when new policies/coverage annotations appear — no, see D2 below: the completeness cell is gated on the DMN-labelled policies and an opt-in property, so existing fixtures are untouched).

D2 (recorded decision): the completeness cell renders only when the view opts in via the new hit-policy labels or `coverage` is explicitly declared *and* the view uses profile `decision.rules@1` with `hit_policy` — to keep goldens byte-identical the cell prints only for the new DMN labels or when `x_completeness: true` is set on the view projection properties. Existing three-policy tables without the flag keep the old header byte-for-byte.

## Error codes (ceilings re-grepped: PJ191, PJW06)

- `DDN-PJ192` — `x_subdiagram` on a DMN node must reference an existing view with a decision projection.
- `DDN-PJ193` — `x_boxed` contract shape (closed enum/form, entries ≤ 10 rows of text).
- `DDN-PJ194` — DRD connector endpoint rules (information/knowledge/authority requirement source/target kinds).

## Alternatives considered

1. **Full hit-policy semantics in the engine** (priority ordering, aggregation evaluation): rejected — that is expression/output evaluation, KEEL territory (ScratchRobin). Labels are notation; bounded analysis stays bounded.
2. **Boxed expressions as a new projection kind**: rejected — presentation forms map onto text rows; a projection would invite evaluation scope creep.
3. **`dmn.decisionservice` expanded/collapsed divider forms**: only the collapsed band form ships (cheap); the expanded form is a future item.
