# 28. Communication diagrams (profile `uml.communication@1` on projection `graph`)

Status: implemented in runtime 0.5.0-draft.2, governed by RFC-102
(`standard/governance/rfcs/RFC-102-communication-diagram.md`). Source grammar
remains DDN 0.5; profiles and extension properties are atom/record property
values, so this chapter is a semantic addition, not a grammar change.

A communication (collaboration-style) view renders the same interaction model
as a sequence view — participants and `uml.message` relations — but emphasizes
structure over time: participants are graph nodes, and every message is drawn
as a numbered label on its relation edge. There is no new projection kind; the
view is an ordinary graph layout (`layout { algorithm: layered; }` is a good
default).

This is profile-level coverage, not UML conformance.

## Metamodel

Reuses the RFC-101 interaction metamodel unchanged:

- **Participants** are the view's selected `object`-type elements, laid out by
  the graph layout algorithm.
- **Messages** are the view's visible relations of kind `uml.message` (the
  RFC-101 verb: `family:'control'`, `start:'none'`, `end:'open'`,
  `source:['*']`, `target:['*']`, `allow_self:true`,
  `member_endpoints:false`).
- A **reply** is a `uml.message` carrying `x_return:true` (RFC-101 extension).
- **Message numbers** are author-declared via the new registered extension
  property `x_message` (relation target):
  `{ "type":"object", "required":["seq"], "properties":{ "seq":{ "type":"string", "minLength":1 } }, "additionalProperties":false }`.

## Declared numbering rule

The sequence number is declared, never derived: `x_message: { seq: "2.1" }`.
Numbers are data. Convention:

- Top-level messages are numbered `1`, `2`, `3`, …
- A reply is dotted under its request: request `2`, reply `2.1`.

Derived numbering was rejected (RFC-102 D3): it would make the missing-number
error unreachable and would silently renumber messages when declarations are
reordered.

## Visual encoding

Ordinary graph rendering. Before render, the engine relabels each visible
`uml.message` relation to `"<seq> · <name>"` (mirroring the `state.flat@1`
relabel branch); edge labels come from the relation name, so the number rides
the existing edge-label path with no renderer change. Relations of other kinds
in the same view keep their labels unchanged.

## Source example

```ddn
view communication "Synthetic order flow / communication" {
    data: [@flow];
    projection { kind: graph; profile: "uml.communication@1"; }
    layout { algorithm: layered; }
}
```

with `data flow` declaring three objects (`customer_app`, `checkout`,
`inventory`) and five `uml.message` relations numbered `1`, `2`, `2.1` (reply),
`3`, `4` — see `examples/basics/42-communication-diagram.ddn`, which reuses the
RT-101 order flow.

## Validation and diagnostics

- `DDN-PJ111` (error) — under `uml.communication@1`, a visible `uml.message`
  relation:
  1. lacks `x_message.seq`, or
  2. carries a `seq` that does not match `/^\d+(\.\d+)*$/`, or
  3. breaks the reply convention — a reply (`x_return:true`) with an undotted
     `seq`, or a non-reply with a dotted `seq`.

  The message names the relation and the rule broken.
- Unchanged existing guards apply as to every graph view (unknown properties,
  page/extent guards, and so on). The sequence-only rules of chapter 27 do not
  apply here, and a communication view does not require place/route geometry.

## Unsupported

Combined fragments; timing constraints; full UML conformance. Cross-message
consistency (gap-free numbering, replies matching an existing request number)
is deliberately not checked in `uml.communication@1` — numbers are validated
for shape only.
