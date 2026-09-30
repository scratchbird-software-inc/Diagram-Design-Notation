# 45. DMN decision requirements diagrams (`dmn.drd@1` on projection `graph`)

Status: implemented in runtime 0.7.0. Source grammar remains DDN
0.5; the DRD kinds and requirement connectors are registry entries, the
decision-table integration reuses `x_subdiagram`, and the hit-policy labels
extend the existing decision engine — no grammar change.

**Fixed boundary.** DDN is a description dialect; the viewer and designer are
free simple tools. Expression languages and evaluation (FEEL, KEEL) are
backend capabilities of host applications — ScratchRobin owns KEEL — and are
never part of DDN, the viewer, or the designer. This chapter is therefore
notation plus the existing bounded decision-table engine only.

## Metamodel

- **Decision** — `dmn.decision` (rect).
- **Business knowledge model** — `dmn.bkm` (clipped-corner rect, new
 `clippedcorner` silhouette).
- **Input data** — `dmn.inputdata` (rounded rect).
- **Knowledge source** — `dmn.knowledgesource` (document/dog-ear).
- **Decision service** — `dmn.decisionservice` (rect with a divider band
 under the name; the collapsed band form).
- **Information requirement** — `dmn.inforeq`: solid line, filled arrowhead;
 from input data or a decision into a decision or decision service
 (`DDN-PJ194`).
- **Knowledge requirement** — `dmn.knowledgereq`: dashed line, open
 arrowhead; from a BKM into a decision, BKM or service (`DDN-PJ194`).
- **Authority requirement** — `dmn.authorityreq`: dashed line, open circle at
 the authority end (new `circle` end mark); from a knowledge source or
 decision (`DDN-PJ194`).

## Decision-table binding

A `dmn.decision` node may declare `x_subdiagram: { view: "…" }` naming a
sibling view whose projection kind is `decision` (typically
`decision.rules@1`). The node renders the `↗ ref` badge (the
interaction-overview pattern). An unknown view, a non-`dmn.*` owner, or a
non-decision target view fails with `DDN-PJ192`.

## Hit-policy labels and the completeness cell

`decision.rules@1` projections additionally accept the DMN hit-policy labels
`priority`, `any`, `output_order`, `rule_order` and `aggregation`. These are
table annotations: the bounded partition analyzer still runs (coverage and
overlap proofs are unchanged — `rule_order` is analyzed like `first`, the
rest like `collect`), and `evaluateDecision` returns matches in table order
with an explicit note that final ordering/aggregation belongs to the host
evaluation engine. Ordering by output-value priority lists and aggregation
computation are not implemented — that is evaluation, not notation.

The table header shows the DMN completeness cell — `C+` when
`coverage: "complete"` is declared and the bounded analyzer proved no
uncovered witnesses, `C−` otherwise. The cell renders when a DMN-labelled hit
policy is used or the projection sets `x_completeness: true`; legacy
unique/first/collect tables without the flag render byte-identically to
before. Multi-output tables render one column per declared output (unchanged
machinery, exercised by the DMN examples).

## Boxed expressions (presentation only)

`dmn.decision`, `dmn.bkm` and `dmn.decisionservice` accept
`x_boxed: { form: literal|context|invocation|relation, text?, entries? }`,
rendered as a compartment of text rows. The text is displayed, never parsed
or evaluated (`DDN-PJ193` on other owners; the closed form is enforced by the
extension contract).

## Example

See `website/examples/basics/87-dmn-drd.ddn` (DRD view plus two
decision-table views). Tests: `notation/tests/dmn-compliance.js` and the
`dmn-showcase.js` sweep.

## Out of scope

FEEL and any expression evaluation (a backend capability of host
applications, e.g. ScratchRobin KEEL), DMN XML interchange, and formal OMG
certification are unsupported (recorded in the profile catalogue and
`capabilities.json`).
