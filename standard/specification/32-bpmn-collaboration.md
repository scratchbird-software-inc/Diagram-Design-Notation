# 32. BPMN-style process collaboration (profile `bpmn.basic@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-106
(`standard/governance/rfcs/RFC-106-bpmn.md`). Source grammar remains DDN 0.5;
the kind and verb are registry entries, pools/lanes are view frames with
pass-through `x_*` properties, and event/gateway typing uses registered `x_*`
extension properties, so this chapter is a semantic addition, not a grammar
change.

A BPMN-style collaboration view models two or more cooperating parties with
explicit message exchange between them on the existing `graph` projection:
pools and lanes as frames, typed start/end events, typed gateways, and dashed
cross-pool message flow. Users write
`projection { kind:graph; profile:"bpmn.basic@1"; }`.

This is profile-level coverage, not BPMN conformance.

## Metamodel

- **Pools** — ordinary view frames carrying `x_pool:true`. A pool's `members`
  list the nodes owned by that party.
- **Lanes** — ordinary view frames carrying `x_lane:true` whose `members` are
  also members of one pool frame. Lane nesting inside a pool is declared by
  membership, never inferred from geometry.
- **Nodes** — the flow vocabulary subset `flow.start`, `flow.end`,
  `flow.process`, `flow.subprocess`, plus the new profile kind
  `flow.gateway` (silhouette `diamond`, fallback `activity`, family
  `activity`, code `GATEWAY`).
- **Events** — `flow.start`/`flow.end` nodes carrying the registered extension
  `x_event:{type:…}` with `type` one of `none`, `message`, `timer`, `error`
  (schema: `{type:'object', required:['type'], properties:{type:{enum:
  ['none','message','timer','error']}}, additionalProperties:false}` on
  objects). Events keep the `flow.start`/`flow.end` silhouettes; the event
  type is shown in the node text.
- **Gateways** — `flow.gateway` nodes carrying the registered extension
  `x_gateway:{type:…}` with `type` one of `exclusive`, `parallel`, `inclusive`
  (schema: `{type:'object', required:['type'], properties:{type:{enum:
  ['exclusive','parallel','inclusive']}}, additionalProperties:false}` on
  objects). The engine prefixes the node name with a single-letter type
  marker: `X ` exclusive, `+ ` parallel, `O ` inclusive.
- **Sequence flow** — inside a pool, edges use the `uml.flow` verb (RFC-105);
  its endpoint contract additionally accepts `flow.gateway`. No new
  sequence-flow verb is registered.
- **Message flow** — the new profile verb `bpmn.messageflow` ("Message flow",
  family `control`, code `MSGFLOW`), rendered dashed via its registry
  `pattern:'6 4'` with an open arrowhead (`end:'open'`). Its endpoint contract
  covers `flow.start`, `flow.end`, `flow.process`, `flow.subprocess`,
  `flow.gateway`, `analysis.task`. Message flow is allowed only ACROSS pools.

## Declaration rules

1. A visible `bpmn.messageflow` whose endpoints are both members of the same
   `x_pool` frame fails with **`DDN-PJ116`** (error); the message names the
   relation and the pool. A message flow whose endpoints are both outside
   every pool also fails with **`DDN-PJ116`**. A message flow crossing two
   pools, or linking a pooled node to an unpooled external node, is valid.
2. A selected `flow.gateway` lacking a valid `x_gateway.type` fails with
   **`DDN-PJ117`** (error); the message names the gateway. Malformed
   `x_gateway`/`x_event` values (e.g. `x_gateway:{type:"complex"}`,
   `x_event:{type:"signal"}`) fail schema validation with **`DDN105`**, like
   every registered extension contract.
3. Pools and lanes render as ordinary frame boxes; no renderer change. Layout
   and routing are the graph renderer's existing deterministic behavior.

## Example

`website/examples/basics/46-bpmn.ddn` — a synthetic buyer/seller collaboration: two
pool frames, typed start/end events (`none`, `message`, `error`), an exclusive
gateway on the buyer side, `uml.flow` sequence edges within each pool, and one
dashed `bpmn.messageflow` from `request_quote` to `prepare_quote` across the
pools.

## Unsupported

BPMN XML interchange, choreography and conversation diagrams, executable
process semantics, and full BPMN conformance are out of scope for
`bpmn.basic@1`. The `capabilities.json` `unsupported[]` line "complete
UML/SysML/BPMN/DMN metamodels or external interchange" remains true and
untouched.
