# RFC 0124 — UML 2.5.1 activity-diagram completeness (profile `uml.activity@2`)

Status: implemented  
Authors/reviewers: B1-060 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.activity@2`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`uml.activity@1` covers start/end, actions, decisions, fork/join bars with a balance check, object nodes and swimlanes. UML 2.5.1 adds: the decision-vs-merge diamond distinction, input/output pins with parameter sets and streaming, signal send/accept pentagons and the time-event hourglass, flow final (⊗) vs activity final, interruptible activity regions with lightning-bolt edges, exception handlers, structured/expansion regions, and connector circles (already present as `flow.connector`).

Motivating example (excerpt; full fixture in `website/examples/basics/80-uml-activity.ddn`):

```
object verify "Verify card" { kind: "flow.process";
    ports { port card { direction: in; } port ok { direction: out; x_pin: { streaming: true; }; } } }
relation esc "" @verify -> @declined { kind: "uml.flow"; x_exception: true; }
frame danger "Interruptible" { scope: @r.region; members: [...]; x_interruptible: true; }
```

## Proposed syntax

No new grammar. Additive kinds + extension properties, one new profile version (`uml.activity@1` immutable):

1. **New kinds** (family `activity`): `flow.merge` (merge diamond), `flow.sendsignal` (convex pentagon), `flow.acceptsignal` (concave pentagon), `flow.timeevent` (hourglass), `flow.flowfinal` (⊗ circle-cross). `uml.flow`'s endpoint contract admits them additively.
2. **Pins** — ports on action kinds (`flow.process`/`flow.subprocess`/`flow.objectnode`); the port-square attachment renders under `uml.activity@2`. New closed contract `x_pin` (port target): `{ set?, streaming? }` — streaming pins render filled; a set name labels the pin group.
3. **Interruptible regions / exception handlers** — a view frame with `x_interruptible: true` renders as a dashed rounded region; a `uml.flow` edge with `x_interrupt: true` or `x_exception: true` renders as a lightning-bolt zigzag arrow (exception edges are the handler notation; the small exception pin is the zigzag's filled head).
4. **Structured/expansion regions** — a view frame with `x_structured: { mode: structured|iterative|parallel }` renders the «mode» keyword in its top-left corner.
5. **Decision vs merge** — `flow.merge` is validated as ≥2 incoming / exactly 1 outgoing; decisions keep the existing named-branch rule (DDN-PF009).
6. **New profile `uml.activity@2`** extending the @1 rule set (start/end presence, reachability, partitions, fork/join balance) with the above.

## Semantic normalization and identity effects

None. New kinds are ordinary elements; region/interrupt metadata is view/relation notation.

## Visual encoding and routing effects

- Signal pentagons: send = rectangle with pointed right side (convex), accept = rectangle with notched right side (concave); time event = hourglass (two triangles) with the `after(…)`/`at(…)` text inside.
- Flow final ⊗: ring with an ✕ inside, distinct from the activity-final ringed dot.
- Lightning edge: deterministic zigzag (perpendicular jog at each segment midpoint, alternating side) with a filled head.
- Interruptible region: dashed roundrect; structured region: existing frame box plus «mode» keyword.
- Streaming pin: filled square; parameter-set pins carry their set name beside the square.

## Alternatives considered

1. **Pins as fields with x_part**: rejected — pins are interaction points on the action boundary, exactly the port abstraction the SysML profile already proves (RFC-123 precedent).
2. **Merge as `flow.decision` with an x_ flag**: rejected — distinct vertices with opposite fan rules; kinds make DDN-PF009 vs PJ167 enforceable (RFC-121 precedent).
3. **Interrupt/exception as new relation kinds**: rejected — they are edge *styles* of the one control flow, marked per edge (the `x_interrupt` flag mirrors UML's InterruptingEdge marker on an ActivityEdge).

## Compatibility and migration

Fully additive. `uml.activity@1` is unchanged; its fixtures render byte-identically. The start/end presence rule accepts `flow.flowfinal` as an end under @2 only. One registry widening: `uml.flow` gains `member_endpoints: true` so edges can attach to pins (previously they were rejected as DDN102; no previously valid source changes meaning).

## Security, privacy and accessibility

No new input channels; standard contracts and escaped labels.

## Machine schema and diagnostic changes

- Registry: +5 kinds, widened `uml.flow` endpoints, +1 profile; regenerated assets.
- Contracts: new `x_pin` (port), `x_interrupt` (relation), `x_exception` (relation).
- New error codes (ceilings re-grepped: PJ166, PJW05): `DDN-PJ167` (merge fan rules), `DDN-PJ168` (interrupt source outside an interruptible region; exception target not an action), `DDN-PJ169` (x_pin on a non-action owner).

## Positive and negative fixtures

`notation/tests/activity-compliance.js`; gallery fixture `website/examples/basics/80-uml-activity.ddn`.

## Implementation/conformance impact

Touch points: registry, `ddn-profiles.js` (contracts + flow-block @2 wiring), `ddn-profile-quality.js` (PJ167–PJ169), `ddn-shapes.js` (pentagons/hourglass/flowfinal), `ddn-render.js` (pin squares/streaming/labels, region frames, lightning edges). Spec chapter 17 gains §17.10. Still outside scope: activity *execution* semantics, object-flow type checking, expansion-region input/output collections, formal OMG conformance.

## Open questions and decision record

- Flow final vs activity final: **decided** — distinct kind `flow.flowfinal`; `flow.end` remains the activity final.
- Parameter sets render as named pin groups (set label beside the square); full set boxing deferred as cosmetic.
