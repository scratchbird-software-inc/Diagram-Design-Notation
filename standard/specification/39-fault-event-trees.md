# 39. Fault tree and event tree profiles (`fault.tree@1`, `event.tree@1`)

Status: implemented in runtime 0.5.0-draft.2, governed by RFC-113
(`standard/governance/rfcs/RFC-113-fault-event-tree.md`). Source grammar
remains DDN 0.5; the profiles, kinds, verb and extension property are
registry entries, so this chapter is a semantic addition, not a grammar
change.

Fault trees decompose a top event downward through AND/OR gates into basic
events; event trees follow an initiating event forward through gate branches
to outcomes. Both profiles run on the existing `graph` projection with the
tree layout. Users write
`projection { kind:graph; profile:"fault.tree@1"; }` (or `"event.tree@1"`)
with `layout { algorithm:tree; direction:down; }`. This is profile-level
notation coverage, not a reliability-engineering certification.

## Metamodel

- Gates are `tree.gate` objects (silhouette `diamond`, fallback `gateway`,
  family `activity`, code `GATE`). Every gate declares its type via the
  registered extension `x_gate` on objects:
  `{ "type":"object", "required":["type"], "properties":{ "type":{ "enum":["and","or"] } }, "additionalProperties":false }`.
  Malformed `x_gate` values are rejected by the schema contract (`DDN105`).
- Basic events are `tree.event` objects (silhouette `circle`, fallback
  `object`, family `concept`, code `EVENT`).
- Inputs are `tree.input` relations ("has input", family `control`,
  `start:'none'`, `end:'none'`), source `tree.gate`, target `tree.gate` or
  `tree.event`. The endpoint contract is enforced as `DDN102`.

## Semantics

A `tree.input` relation points FROM a gate TO one of its inputs — a child
gate or a basic event. A gate's input count is its number of visible
outgoing `tree.input` relations. Both profiles share this machinery and
differ in documented intent only: `fault.tree@1` decomposes a top event
downward; `event.tree@1` follows an initiating event forward.

## The two-input rule

Under either profile, every selected `tree.gate` must declare a valid
`x_gate.type` (`and` or `or`) and have at least two visible `tree.input`
edges. Violations are rejected as `DDN-PJ126` (error); the message names the
gate, its input count and its declared type. A gate with one input is a
notation error because a one-input gate adds no decomposition information;
a gate without a declared type is ambiguous.

## Visual encoding

Gates render as diamond nodes whose text shows the author-written label —
authors write `AND`/`OR` into the gate name; v1 keeps the declared type
visible via the node name with no engine relabel. Events render as circle
nodes. Edges are plain (no arrowheads). No renderer change.

## Non-goals

Probability quantification at gates, minimal cut-set computation, sequence
branching fractions and reliability certification are intentionally
unsupported: numeric propagation is an engineering solver, outside notation
coverage. See the profiles' `unsupported` lists in
`standard/registry/profiles/catalogue.json`.
