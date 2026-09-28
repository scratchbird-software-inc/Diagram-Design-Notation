# 46. SoaML service architectures (`soaml.services@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-130
(`standard/governance/rfcs/RFC-130-soaml-compliance.md`). Source grammar
remains DDN 0.5; SoaML kinds and contracts are registry entries over the UML
composite-structure machinery — no grammar change.

SoaML 1.0.1 models service-oriented architectures: participants that offer
and consume services through typed ports, service interfaces and contracts,
capabilities, and choreography bindings. One profile covers the family
(agent's call, recorded in RFC-130): the contract glyph and the architecture
wiring share one canvas.

## Metamodel

- **Participants** — `soaml.participant` («participant» rect),
  `soaml.agent` («agent», actor glyph for organizational participants).
- **Service interfaces** — `soaml.serviceinterface` («ServiceInterface»
  rect; operation rows are ordinary fields).
- **Service contracts** — `soaml.servicecontract` («ServiceContract», the
  dashed-ellipse collaboration silhouette reused) with provider/consumer
  role rows (`x_part` fields) and an optional `x_contract: { choreography:
  @view }` binding.
- **Capabilities / messages / milestones** — `soaml.capability` (rounded),
  `soaml.message` (document dog-ear), `soaml.milestone` (rounded).
- **Port decorations** — port members carry
  `x_service: { kind: service|request }`: the renderer draws a
  «Service»/«Request» badge beside the port square (same layer as the SysML
  port labels). Conjugated service interfaces reuse `x_port.conjugated`.
  Owner kinds are participants/interfaces/agents (`DDN-PJ195`).

## Assembly and conformance

Wiring reuses `uml.assembly`, `uml.delegation` and `uml.connector` (their
endpoint contracts now admit the SoaML participant/interface kinds, DDN102).
Under `soaml.services@1`, a connector between two `x_service`-typed ports
must pair «Service» with «Request» and both ports must declare the same
interface type (`datatype` text); service-to-service, request-to-request,
and mismatched types fail with `DDN-PJ196`.

## Choreography binding

A service contract binds its choreography with
`x_contract: { choreography: @view }` referencing a sibling
`uml.sequence@2` or `uml.statemachine@1` view (unknown views, self-binding
and other view kinds fail with `DDN-PJ197`). Recorded decision: protocol
state machines ship at zero new machinery — a state-based choreography is a
plain `uml.statemachine@1` view bound the same way; SoaML's transition
restrictions are declaration-side guidance, not new validators.

## Example

See `website/examples/basics/88-soaml.ddn` (architecture view plus the bound
sequence choreography). Tests: `notation/tests/soaml-compliance.js` and the
`soaml-showcase.js` sweep.

## Out of scope

SoaML XMI interchange, service execution/runtime semantics, and formal OMG
certification are unsupported (recorded in the profile catalogue and
`capabilities.json`).
