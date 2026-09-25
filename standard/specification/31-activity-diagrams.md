# 31. Activity diagrams (profile `uml.activity@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-105
(`standard/governance/rfcs/RFC-105-activity-diagram.md`). Source grammar
remains DDN 0.5; kinds and verbs are registry entries and `x_partition` is an
`x_*` extension property, so this chapter is a semantic addition, not a
grammar change.

An activity-style flow view extends the flowchart vocabulary
(`flow.basic@1`, chapter 4) with parallel flows and lane responsibility on the
existing `graph` projection: swimlane partitions, fork/join bars, and object
nodes alongside the familiar flow symbols. Users write
`projection { kind:graph; profile:"uml.activity@1"; }` and group nodes into
lanes.

This is profile-level coverage, not UML conformance.

## Metamodel

- **Nodes** — the flow vocabulary subset `flow.start`, `flow.end`,
  `flow.process`, `flow.decision`, `flow.io`, plus two new profile kinds:
  - `flow.forkjoin` (silhouette `rect`, family `activity`, code `FORKJOIN`) —
    a fork/join bar. A bar with ≥2 outgoing `uml.flow` edges is a fork; a bar
    with ≥2 incoming `uml.flow` edges is a join. The same node can be both.
  - `flow.objectnode` (silhouette `rect`, fallback `record`, family `data`,
    code `OBJNODE`) — an object node carrying data between actions.
- **Edges** — the new profile verb `uml.flow` ("Activity edge", family
  `control`, filled arrowhead). Its endpoint contract covers exactly the node
  kinds above. `flow.next`'s published endpoint list is unchanged; activity
  views use `uml.flow` only.
- **Partitions (swimlanes)** — ordinary view frames. One `frame` per lane;
  the frame's `id` or `name` is the lane name, and the frame's `members` list
  the lane's nodes. A node declares its lane with the registered extension
  property `x_partition:{lane:"<frame id or name>"}` (schema:
  `{type:'object', required:['lane'], properties:{lane:{type:'string',
  minLength:1}}, additionalProperties:false}` on objects). A lane name also
  matches the unqualified local segment of a frame's qualified id
  (`module::view.frame`).
- No new projection kind and no renderer change: lanes render as ordinary
  frame boxes with their names; fork/join bars and object nodes render as
  rect nodes via their profile silhouettes.

Note: swimlanes here are declared frame groups, not the interaction profile's
fixed lanes. The `"separate parallel lanes"` capability of the experimental
`session-bootstrap@0.1` profile (`ddn-interaction.js`) is a fixed-participant
protocol mechanism and is unrelated to `uml.activity@1` partitions.

## Declaration rules

1. Selected nodes must be `flow.*` kinds and visible relations must be
   `uml.flow`; violations fail with the existing vocabulary code
   **`DDN-PF007`** (the flowchart guard in `ddn-profiles.js` is extended to
   this profile, with `uml.flow` as the control edge for the start/end and
   reachability rules `DDN-PF008`/`DDN-PF010`).
2. A node carrying `x_partition.lane` that names no frame of the view
   (matched against `ir.view.frames` `id` or `name`) fails with
   **`DDN-PJ114`** (error). The message names node and lane.
3. Fork/join balance: the count of `flow.forkjoin` nodes with ≥2 visible
   outgoing `uml.flow` edges must equal the count with ≥2 visible incoming
   edges (v1 structural check). Imbalance fails with **`DDN-PJ115`** (error);
   the message reports both counts.
4. Malformed `x_partition` (e.g. missing `lane`) fails schema validation with
   **`DDN105`**, like every registered extension contract.

## Example

`website/examples/basics/45-activity-diagram.ddn` — a synthetic order-fulfilment
activity with `webshop` and `warehouse` lane frames, one fork/join pair
around `pick_items`/`take_payment`, and an `order` object node; every node
declares its lane via `x_partition`.

## Unsupported

Interruptible regions, pins and parameter sets, object-flow typing, and full
UML conformance are out of scope for `uml.activity@1`.
