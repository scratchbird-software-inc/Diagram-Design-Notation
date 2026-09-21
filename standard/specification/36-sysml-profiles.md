# 36. SysML-style block profiles (`sysml.bdd@1`, `sysml.ibd@1`, `sysml.parametric@1` on projection `graph`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-110
(`standard/governance/rfcs/RFC-110-sysml.md`). Source grammar remains DDN
0.5; blocks and constraints are registry kinds, the item flow is a registry
verb, and ports reuse the existing `ports {}` group and member-endpoint
syntax, so this chapter is a semantic addition, not a grammar change.

SysML-style structural views model blocks, their border ports, typed item
flows and formula-bearing constraints on the existing `graph` projection.
Three profiles divide the coverage (D3 of RFC-110):

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
  syntax; see chapter 01). The core layout machinery (`portAssignments()` in
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
