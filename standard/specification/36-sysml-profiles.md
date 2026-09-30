# 36. SysML-style block profiles (`sysml.bdd@1`, `sysml.ibd@1`, `sysml.parametric@1` on projection `graph`)

Status: implemented in runtime 0.7.0. Source grammar remains DDN
0.5; blocks and constraints are registry kinds, the item flow is a registry
verb, and ports reuse the existing `ports {}` group and member-endpoint
syntax, so this chapter is a semantic addition, not a grammar change.

SysML-style structural views model blocks, their border ports, typed item
flows and formula-bearing constraints on the existing `graph` projection.
Three profiles divide the coverage (D3 of ):

- `sysml.bdd@1` — block definition-style view: blocks and their
 associations.
- `sysml.ibd@1` — internal block-style view: blocks with declared border
 ports and typed item flows.
- `sysml.parametric@1` — parametric constraint view: constraint blocks
 carrying formula text, each bound to exactly two endpoints.

Users write `projection { kind:graph; profile:"sysml.ibd@1"; }` (or one of
the other two profiles).

This is profile-level coverage, not SysML conformance.

## Metamodel

- **Blocks** — `sysml.block` objects (silhouette `rect`, fallback
 `application`, family `interface`, code `BLOCK`), rendered as rect nodes.
- **Ports** — declared members of a block's existing `ports {}` group (core
 syntax; see chapter 01). The core layout machinery (`portAssignments` in
 `ddn-layout.js`) already assigns port sides and slots, and relation
 endpoints already resolve to port members (`@pump.out`). Under any of this
 chapter's three profiles the renderer additionally draws a small square
 (10×10·s) centred at each route attachment point that resolves to a port
 member, making the border attachment visible. The square is guarded on
 `sysml.*` profiles; every other profile renders ports exactly as before.
- **Flows** — `sysml.flow` relations (verb "Item flow", family `flow`, code
 `ITEMFLOW`, `start:'none'`, `end:'filled'`, `member_endpoints:true`). The
 relation's label names the flowed item (built-in `name`, no extension
 property). Flows may attach to port members.
- **Constraints** — `sysml.constraint` objects (silhouette `rect`, fallback
 `object`, family `concept`, code `CONSTRAINT`), rendered as rect nodes
 whose label (or `description` — both core properties) carries the formula
 text, e.g. `{flow = pressure × area}`. DDN renders the formula text; it
 never evaluates it.

## Declaration rules

- Under any `sysml.*` profile of this chapter, a selected element that
 declares a `ports {}` group must be a `sysml.block`; otherwise the view is
 rejected with `DDN-PJ121` (error; the message names the element and its
 kind).
- Under `sysml.parametric@1`, every selected `sysml.constraint` must be
 touched by exactly two visible relations (`assoc` or `sysml.flow` — to
 blocks or their ports); otherwise the view is rejected with `DDN-PJ122`
 (error; the message names the constraint and the actual count).
- `sysml.flow` endpoints resolve through the existing member-endpoint
 machinery: an unknown member reference fails at resolution as `DDN031`; a
 declared field member is admitted by the verb contract
 (`member_endpoints:true`, `source/target:['*']`) but draws no port square,
 since it is not a port.

## Example

```ddn
data m {
 object pump "Pump" { kind: "sysml.block";
 ports { port out { direction: out; } }
 }
 object reservoir "Reservoir" { kind: "sysml.block";
 ports { port in { direction: in; } }
 }
 object flow_balance "{flow = pressure × area}" { kind: "sysml.constraint"; }

 relation water "water" @pump.out -> @reservoir.in { kind: "sysml.flow"; }
 relation bind_pump "binds pump" @flow_balance -> @pump { kind: "assoc"; }
 relation bind_reservoir "binds reservoir" @flow_balance -> @reservoir { kind: "assoc"; }
}

view ibd "Pump station internal block" {
 data: [@m];
 projection { kind: graph; profile: "sysml.ibd@1"; }
 exclude: [@m.flow_balance];
}
```

See `website/examples/basics/50-sysml.ddn` for the full runnable example with all
three views (`bdd`, `ibd`, `parametric`).

## Out of scope

SysML XMI interchange, full SysML conformance, compartment typing beyond
field rows, flow property propagation, and equation solving or evaluation
are unsupported (recorded in the profile catalogue and
`capabilities.json`).

# 36a. SysML 1.6 full notation (nine profiles)

Status: implemented in runtime 0.7.0. `sysml.bdd@1`,
`sysml.ibd@1` and `sysml.parametric@1` stay installed and immutable; their
fixtures render byte-identically.

- **Requirements diagram** (`sysml.requirements@1`) — `req.requirement` (the
 «requirement» id/text compartment rendering already shipped with
 `requirements.basic@1`) plus the new `sysml.testcase` kind («testCase») and
 seven dashed dependency relations whose labels are the guillemet keywords:
 `sysml.derive` («deriveReqt»), `sysml.satisfy`, `sysml.verify`,
 `sysml.refine`, `sysml.trace`, `sysml.copy`, `sysml.master`. Endpoint rules
 validate as `DDN-PJ185` (verify from a test case, satisfy from a block,
 derive/copy/master between requirements). Containment via
 `sysml.composition` (filled diamond at the whole); «allocate» is
 `sysml.allocate` between any two distinct elements.
- **BDD@2** — `sysml.block` gains a «block» keyword header and named
 compartments: fields carry `x_block: { compartment: values|parts|
 references|operations|constraints }` (`DDN-PJ186` on other owners). Value
 rows display units from `x_unit: { unit: "L/min" }`, resolved against the
 new units registry `standard/registry/units.json` (~40 SI/derived units
 with symbol, name, quantity kind; `DDN-PJ188` on unknown symbols or
 quantity mismatches). Composition (`sysml.composition`) and generalization
 (`uml.generalization`) connect block-family kinds (`DDN-PJ190`). New kinds:
 `sysml.valuetype` («valueType»), `sysml.interfaceblock` («interfaceBlock»),
 `sysml.flowspec` («flowSpecification»; flow properties are `ports {}`
 members with direction — the @2 profiles admit ports on interface blocks
 and flow specifications, `DDN-PJ121`).
- **IBD@2** — port members carry `x_port: { type: proxy|full, conjugated?,
 multiplicity?, nested? }`: the renderer draws the full port filled, the
 proxy port hollow, a `~` for conjugation, a `[1..2]` multiplicity label and
 nested ports as sub-squares on the port square (`DDN-PJ187`). Item flows
 keep the `sysml.flow` verb; endpoints are blocks or their ports
 (`DDN-PJ191`).
- **Parametric@2** — the exactly-two-bindings rule (`DDN-PJ122`) stays the
 `@1` contract; `@2` admits one or more bindings (`DDN-PJ189` on zero) and
 renders constraint parameters as a compartment with units.
- **Package diagram** (`sysml.package@1`) — thin over `uml.package` with
 `uml.import`/`uml.access`/`uml.merge`.
- **Behavioral rebadges** — `sysml.usecase@1`, `sysml.activity@1`,
 `sysml.sequence@1`, `sysml.statemachine@1` alias the completed
 `uml.usecase@3`/`uml.activity@2`/`uml.sequence@2`/`uml.statemachine@1`
 machinery (validators and renderer fire for the SysML ids; an info
 diagnostic `DDN-PJW06` records the rebadge). SysML-specific extension:
 `x_flow: { rate?, probability?, continuous? }` on `uml.flow` edges under
 `sysml.activity@1` renders `{rate = 10 L/min, continuous, probability =
 0.9}` on the edge label (`DDN-PJ191` elsewhere); streaming pins reuse
 `x_pin`.

Fixtures: `website/examples/basics/84-sysml-requirements.ddn`,
`85-sysml-blocks.ddn`, `86-sysml-behavioral.ddn`; tests
`notation/tests/sysml-compliance.js` + the `sysml-showcase.js` sweep (one
check+render per family). Out of scope, declared in the profiles: SysML XMI
interchange, SysML 2.0, constraint/flow-property evaluation, formal OMG
certification.
