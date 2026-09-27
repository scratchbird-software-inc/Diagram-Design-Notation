# RFC 0128 — SysML 1.6 notation compliance (nine-profile family)

Status: implemented  
Authors/reviewers: B1-065 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profiles `sysml.requirements@1`, `sysml.bdd@2`, `sysml.ibd@2`, `sysml.parametric@2`, `sysml.package@1`, `sysml.usecase@1`, `sysml.activity@1`, `sysml.sequence@1`, `sysml.statemachine@1`; existing `sysml.*@1` profiles immutable; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`sysml.bdd@1` covers blocks and generic associations, `sysml.ibd@1` border ports with typed item flows, `sysml.parametric@1` formula constraints bound to exactly two endpoints. SysML 1.6 additionally specifies: the requirements diagram (requirements with id/text compartments, test cases, «deriveReqt»/«satisfy»/«verify»/«refine»/«trace»/«copy»/«master» dependencies, containment), block definition compartments (values/parts/references/operations/constraints), composition and generalization on blocks, value types, interface blocks and flow specifications, port typing (proxy/full/conjugated) with flow properties, nested ports and port multiplicity, parametric diagrams with more than two bindings and parameter display, «allocate», value types with units and quantity kinds, the package diagram, and the four behavioral diagram families (use case, activity, sequence, state machine) in SysML form.

## Proposed syntax

No grammar change. Additive kinds/relations/contracts:

1. **Requirements diagram** (`sysml.requirements@1`) — reuses `req.requirement` (already renders «requirement» + id + text compartments); new kind `sysml.testcase` («testCase»). New dashed open-arrow dependency relations whose default label is the guillemet keyword: `sysml.derive` («deriveReqt»), `sysml.satisfy`, `sysml.verify`, `sysml.refine`, `sysml.trace`, `sysml.copy`, `sysml.master`. Containment via `sysml.composition` (filled diamond at the whole end).
2. **BDD upgrades** (`sysml.bdd@2`) — `sysml.block` gains the compartment machinery (field extension `x_block.compartment` ∈ values/parts/references/operations/constraints) and the «block» keyword header; `sysml.composition` and the existing `uml.generalization` between blocks; new kinds `sysml.valuetype` («valueType»), `sysml.interfaceblock` («interfaceBlock»), `sysml.flowspec` («flowSpecification», flow properties as `ports {}` members with direction).
3. **IBD upgrades** (`sysml.ibd@2`) — port member extension `x_port: { type: proxy|full, conjugated?: boolean, multiplicity?: string, nested?: [{name, direction?, type?}] }`; renderer variants on the existing port square (proxy hollow, full filled, `~` conjugation mark, `[mult]` label, nested sub-squares). Item flows keep `member_endpoints`.
4. **Parametric upgrades** (`sysml.parametric@2`) — constraints bind *at least one* endpoint (DDN-PJ122 stays the `@1` rule; `@2` allocates a new code), constraint parameters render as a compartment of the constraint block, nested constraint properties compose via composition.
5. **Allocation** — `sysml.allocate` («allocate», dashed open arrow) between any two distinct plan/model elements.
6. **Units registry** — `standard/registry/units.json` (small: ~40 SI/derived units with symbol, name, quantity kind), generated into `notation/runtime/assets/units.js`. Field extension `x_unit: { unit: "N", quantity?: "force" }` resolves against the registry and renders `power: W` on value rows.
7. **Package diagram** (`sysml.package@1`) — thin over `uml.package` + `uml.import`/`uml.access`/`uml.merge`.
8. **Behavioral rebadges** — `sysml.usecase@1`≈`uml.usecase@3`, `sysml.activity@1`≈`uml.activity@2` (plus `x_flow: { rate?, probability?, continuous? }` edge annotations), `sysml.sequence@1`≈`uml.sequence@2`, `sysml.statemachine@1`≈`uml.statemachine@1`. Implemented as a profile-alias map in the validators/renderer so the UML machinery fires for the SysML ids; an info diagnostic (DDN-PJW06) records the rebadge.

## Semantic normalization and identity effects

None — notation over existing element/relation identities. `@1` fixtures render byte-identically: every `@2` rendering feature is opt-in by property or gated on the `@2` profile id.

## Error codes (ceilings re-grepped: PJ184, PJW05)

- `DDN-PJ185` — SysML requirement-dependency endpoint rules (derive/copy/master between requirements; verify from test case; satisfy from block).
- `DDN-PJ186` — `x_block` compartment rules (block/interface-block fields only; closed compartment enum).
- `DDN-PJ187` — `x_port` rules (port members of blocks/interface blocks; proxy/full typing; nested port names unique).
- `DDN-PJ188` — `x_unit` must resolve to the units registry (and quantity kind when declared).
- `DDN-PJ189` — `sysml.parametric@2`: each constraint binds at least one endpoint.
- `DDN-PJ190` — `sysml.composition`/`uml.generalization` under `sysml.*` profiles connect block-family kinds.
- `DDN-PJ191` — `sysml.flow` under `sysml.ibd@2` attaches to blocks or their ports; `x_flow` (rate/probability/continuous) applies to activity edges under `sysml.activity@1`.
- `DDN-PJW06` — info: behavioral rebadge profile rendered with the UML machinery.

## Alternatives considered

1. **In-place upgrades of `sysml.*@1`**: rejected — registry immutability; `@1` fixtures must render byte-identically, so the upgrades land as `@2` profiles (uml.activity@2 precedent).
2. **New `sysml.requirement` kind**: rejected — `req.requirement` already renders the «requirement» id/text compartment form; reuse keeps the kind count honest. `sysml.testcase` is new because `req.test` renders a plain round node without the «testCase» keyword.
3. **Full SysML 1.6 behavioral metamodel**: rejected — the behavioral families are rebadges of the completed UML machinery with SysML-specific extensions (rate/probability/continuous on flows), per the work-item scope.
