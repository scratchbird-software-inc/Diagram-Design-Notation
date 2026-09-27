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

# 32a. BPMN 2.0.2 full notation (bpmn.process@1 / bpmn.choreography@1 / bpmn.conversation@1)

Status: implemented in runtime 0.7.0, governed by RFC-126
(`standard/governance/rfcs/RFC-126-bpmn-compliance.md`). `bpmn.basic@1` stays
installed and immutable; its fixtures render byte-identically.

A shared **decorator layer** in `ddn-shapes.js` (event rings + trigger icons,
gateway inner glyphs, activity border modes and marker badges, boundary
attachment) is driven by the extension contracts, not profile ids, so other
notations can reuse it.

## Events — `x_event` extended

`type`: `none, message, timer, signal, error, escalation, compensation,
conditional, link, terminate, cancel, multiple, parallel_multiple`; plus
`position: start|intermediate|end|boundary`, `interrupting: boolean`,
`on: @ref`. New kind `flow.intermediate`. Under the new profiles, event kinds
render as rings (start thin, intermediate double, end thick) with trigger
icons; boundary events attach to the host task's border (dashed ring when
non-interrupting). Trigger/position semantics: `DDN-PJ175` (x_event owner
kind; terminate/cancel/compensation placement; boundary host must be a
task/subprocess).

## Gateways — `x_gateway` extended

`exclusive` (X), `parallel` (+), `inclusive` (O), `complex` (star), `event`
(pentagon), `event_exclusive` (pentagon + X) render as true inner glyphs.
Event-based gateways need at least two outgoing sequence flows
(`DDN-PJ176`); the extended types outside BPMN profiles are `DDN-PJ176`.

## Activities — `x_activity` (new)

`{ call?, transaction?, adhoc?, event_subprocess?, collapsed?, markers?:
[loop, parallel, sequential, compensation] }` on task kinds
(`DDN-PJ177`): thick border (call), double border (transaction), dashed
border (event subprocess), badge row at bottom-left (loop, |||, ≡,
compensation triangles, ~ ad-hoc).

## Data, flows, pools

`flow.dataobject` / `flow.datainput` / `flow.dataoutput` (folded documents;
`x_io: { set: true }` collection badge) and `flow.datastore` (cylinder);
`bpmn.association` is the dashed data association (data node on one side,
activity on the other — `DDN-PJ180`). Sequence-flow variants use
`source_mark`: `slash` (default flow) and `diamond` (conditional flow).
Pools/lanes use frames (`x_pool`); a collapsed pool adds `x_collapsed: true`
(black-box band — authors select the pool scope only). `flow.group` renders
the dashed rounded group artifact; `flow.annotation` is the existing bracket.

## Choreography and conversation

`bpmn.choreography@1`: `flow.choreotask` with `x_bands: [participants]`
renders participant bands (top/bottom); a band name ending in ` *` draws the
multi-instance marker; gateways and sequence flows are shared; a choreography
task needs at least two bands (`DDN-PJ178`). `bpmn.conversation@1`:
`flow.conversation` / `flow.subconversation` / `flow.callconversation`
hexagon nodes linked to participants by `bpmn.conversationlink`
(`DDN-PJ179`); participant bands reuse the pool frame machinery.

Fixtures: `website/examples/basics/82-bpmn-complete.ddn` (four views, one per
BPMN diagram family), tests `notation/tests/bpmn-compliance.js` and the
`bpmn-showcase.js` sweep. Out of scope, declared in the profiles: BPMN XML/DI
interchange, execution semantics, formal OMG certification.
