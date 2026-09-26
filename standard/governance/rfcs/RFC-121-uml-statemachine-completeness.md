# RFC 0121 — UML 2.5.1 state-machine completeness

Status: implemented  
Authors/reviewers: B1-057 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.statemachine@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`state.flat@1` (RFC-104 family, chapter 23) and `state.composite@1` (chapter 30) cover initial/final markers, simple states, composite frames and parallel regions with `event [guard]` labels. They cannot express the UML 2.5.1 state-machine surface: entry/exit/do activities, shallow/deep history, junction/choice/entry-point/exit-point/fork/join/terminate pseudostates, transition effects (`trigger [guard] / effect`), submachine states with entry/exit-point binding, time events (`after`/`at`/`when`), and internal transitions.

Motivating example (excerpt; full fixture in `website/examples/basics/77-uml-statemachine-complete.ddn`):

```
object running "Running" { kind: "state.state"; x_state: {
    entry: "startWatch()"; exit: "stopWatch()"; do: "tick()";
    internal: [ "help [guarded] / showHelp()" ]; }; }
relation timeout "" @running -> @history { kind: "state.transition";
    x_transition: { event: "after(30s)"; effect: "log()" }; }
```

## Proposed syntax

No new grammar. New registered kinds (additive per VERSIONING rule 1), one new profile, extension-property growth (RFC-119/120 pattern):

1. **New kinds**: `state.history_shallow` (H), `state.history_deep` (H*), `state.junction` (filled dot), `state.choice` (diamond), `state.entrypoint` (ring on a state border), `state.exitpoint` (ring with ✕), `state.forkjoin` (synchronization bar), `state.terminate` (✕).
2. **`x_state` extended** (now a closed contract): `{ terminal?, entry?, exit?, do?, internal?: [string], submachine?: @ref }`. Entry/exit/do and internal-transition lines render in a state compartment; `submachine` references the `state.state` that is the invoked machine's top state.
3. **`x_transition` extended** (closed contract): `{ event?, guard?: object|string, effect?, actions? }`. String guards render verbatim; object guards keep the lifecycle predicate rendering. The label is `trigger [guard] / effect`. Time events are ordinary trigger strings matching `after(…)`, `at(…)` or `when(…)`; anything that *starts* like one but is malformed is rejected (`DDN-PJ162`).
4. **`state.transition` endpoint contract widened** to admit the pseudostate kinds (additive).
5. **New profile `uml.statemachine@1`** (graph projection) covering the full surface, including the composite-frame/region machinery from `state.composite@1`. Trace evaluation (`traces`/`inputs`/`analysis_budget`) stays `state.flat@1`-only (`DDN-Q005`): lifecycle simulation semantics (`DDN-QL001…`) are incompatible with pseudostates and parallel regions.

## Semantic normalization and identity effects

None. Pseudostates are ordinary elements with registered kinds; activities/effects are annotation text; fingerprints unaffected.

## Visual encoding and routing effects

- States with activities/internal transitions/submachine render as rounded rectangles with a name header and compartment lines (`entry / …`, `exit / …`, `do / …`, internal transitions verbatim, `«submachine»` marker); plain states keep the existing compact rounded form.
- Pseudostate glyphs: H / H* circles; small filled junction dot; choice diamond; encircled entry-point; encircled-✕ exit-point; thick fork/join bar; ✕ terminate. All deterministic SVG with source-bound marks, contour anchors default to the bounding box.
- Transition labels: `event [guard] / effect` via the engine relabel branch (now matching `uml.statemachine@1` too).

## Alternatives considered

1. **`state.flat@2` / `state.composite@2`**: rejected — the new surface spans both, and two parallel version bumps would duplicate every validator and doc section; a single `uml.statemachine@1` follows the registry's named-profile convention (`uml.sequence@2` covers one diagram family, but here the family is "UML state machines" as a whole).
2. **Internal transitions as flagged self-relations**: rejected in favor of compartment lines (`x_state.internal`), which is the normative UML rendering and avoids arrow-compartment ambiguity.
3. **Pseudostates as `x_state` flags on `state.state`**: rejected — pseudostates are distinct vertices with distinct endpoint rules; kinds keep the endpoint contract enforceable through DDN102.

## Compatibility and migration

Fully additive. `state.flat@1` and `state.composite@1` remain installed and immutable; their fixtures render byte-identically. `x_state`/`x_transition` become closed contracts: previously they accepted arbitrary keys under the generic object contract. Every key used by shipped examples and tests (`terminal`, `event`, `guard`, `actions`) remains legal; any previously-tolerated unknown key now fails `DDN105`, which is the intended tightening (VERSIONING rule 2: new error coverage with fixtures).

## Security, privacy and accessibility

No new input channels; schema contracts and bounded strings as before. Effects/activities are display text, never executed (trace evaluation explicitly rejects this profile). Glyphs carry `data-*` hooks and escaped labels.

## Machine schema and diagnostic changes

- Registry: +8 kinds, +1 profile, `state.transition` endpoint widening; regenerated assets.
- Contracts: `x_state` and `x_transition` now closed schemas.
- New error codes (ceilings checked: PJ159, PJW05 after B1-056): `DDN-PJ160` (x_state misuse: wrong owner kind, submachine self/foreign reference), `DDN-PJ161` (pseudostate endpoint rules: terminate/final outgoing, choice fan-out, entry/exit-point and history frame membership), `DDN-PJ162` (transition label/time-trigger form). Engine relabel extended with `/ effect` and string guards.

## Positive and negative fixtures

`notation/tests/statemachine-compliance.js` covers every feature positively plus each rejection code and byte-compatibility of the existing state profiles. Gallery fixture: `website/examples/basics/77-uml-statemachine-complete.ddn`.

## Implementation/conformance impact

Touch points: `ddn-profiles.js` (contracts), `ddn-profile-quality.js` (PJ160–PJ162), `ddn-engine.js` (relabel), `ddn-shapes.js` (compartments + pseudostate silhouettes). Spec chapter 30 gains §30a; designer contracts (+8 kinds) and docs updated. Still outside scope: executable actions/behaviors, trace evaluation on this profile, SCXML exchange, formal OMG conformance.

## Open questions and decision record

- Profile shape: **decided** — one `uml.statemachine@1` (see Alternatives).
- Fork/join vs. the existing `flow.forkjoin` (activity profile): state-machine fork/join gets its own kind (`state.forkjoin`) so the `uml.activity@1` flow.reachability rules never leak into state machines.
