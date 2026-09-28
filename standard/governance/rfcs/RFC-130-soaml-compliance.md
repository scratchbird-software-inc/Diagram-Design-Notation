# RFC 0130 — SoaML 1.0.1 notation compliance (profile `soaml.services@1`)

Status: implemented  
Authors/reviewers: B1-072 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `soaml.services@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

SoaML 1.0.1 models service-oriented architectures: participants offering and consuming services through typed ports, service interfaces and contracts, capabilities, and choreography bindings. DDN already ships the machinery SoaML reuses: UML composite structure (ports, ball-and-socket assembly, delegation, `x_part`, `uml.collaboration`), SysML conjugated port glyphs, UML sequence/state-machine choreographies, message kinds, and the decorator/badge layer. Missing: the SoaML kind vocabulary, «Service»/«Request» port decorations, contract-typed assembly connectors with provider/consumer role conformance, and choreography binding validation.

## Proposed syntax

No grammar change. Additive kinds/relations/contracts:

1. **Kinds** — `soaml.participant` («participant» rect), `soaml.agent` («agent», actor glyph — an organizational participant), `soaml.serviceinterface` («ServiceInterface» rect with typed compartments via existing fields), `soaml.servicecontract` («ServiceContract», the dashed-ellipse collaboration silhouette reused), `soaml.capability` («capability» rounded node), `soaml.message` («message», document dog-ear reused), `soaml.milestone` («milestone», rounded — choreography progress markers).
2. **Port decorations** — port members carry `x_service: { kind: service|request }`: the renderer draws a «Service»/«Request» badge beside the port square (same layer as the SysML «proxy»/«full» labels). Conjugated service interfaces reuse `x_port.conjugated`. New closed extension contract `x_service` (port target).
3. **Service contracts** — a `soaml.servicecontract` carries role fields (`x_part`-style rows, e.g. `provider: Billing`, `consumer: Shop`) and `x_contract: { choreography?: @view }` binding a `uml.sequence@2` or `uml.statemachine@1` view (the view-ref badge pattern; validated, DDN-PJ197).
4. **Service architecture** — composite-structure wiring reusing `uml.assembly`/`uml.delegation`/`uml.connector`; assembly connectors between `x_service`-typed ports validate role conformance: a `service` port connects to a `request` port whose owning participant's typed interface matches (same service-interface type text on both sides, DDN-PJ196); the contract itself is shown with the collaboration glyph and role rows.
5. **Profiles** — one profile `soaml.services@1` (agent's call, recorded here): SoaML's diagram surface is a single composite family (services architectures + contracts share the same canvas), so one profile follows the uml.composite@1 precedent rather than splitting.
6. **Protocol state machines** (recorded decision) — INCLUDED additively at zero new machinery: a protocol/choreography state machine is a plain `uml.statemachine@1` view bound with `x_contract.choreography`; SoaML's protocol-SM restrictions (no actions/activities on transitions) are declaration-side guidance, documented in chapter 46, not new validators.

## Semantic normalization and identity effects

None — notation over existing element/relation identities.

## Error codes (ceilings re-grepped: PJ194, PJW06)

- `DDN-PJ195` — `x_service`/`x_contract` owner and shape rules (port decorations on block-family participants/interfaces; contract on servicecontract kinds).
- `DDN-PJ196` — assembly/delegation between service-typed ports: service↔request pairing and interface-type match; service-to-service and request-to-request are errors.
- `DDN-PJ197` — `x_contract.choreography` must reference an existing `uml.sequence@2` or `uml.statemachine@1` view.

## Alternatives considered

1. **Two profiles (soaml.services@1 + soaml.contracts@1)**: rejected — the contract glyph and the architecture wiring share one canvas in every SoaML example; one profile, one family.
2. **A dedicated `x_choreography` contract**: rejected — `x_contract.choreography` keeps all contract data in one closed contract (x_sentry precedent).
3. **Protocol-SM transition restrictions as validators**: rejected — SoaML allows the restriction but does not require tooling to enforce it; documented as guidance instead.
