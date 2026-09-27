# RFC 0125 — UML 2.5.1 remainder + full-diagram-family sweep

Status: implemented  
Authors/reviewers: B1-061 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile versions `uml.object@2`, `uml.communication@2`, `uml.timing@2`, `uml.interaction_overview@2`, `uml.usecase@3`, and new profile `uml.profile@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

After B1-055…060 the remaining UML 2.5.1 gaps are: (a) object-diagram instance styling/slot checking/link multiplicity; (b) package import/access/merge and packaged-element visibility; (c) communication-diagram fragments and timing constraints; (d) interaction-overview inline expansion and interaction-use gates/arguments; (e) timing-diagram annotations, constraints, state compaction and lifeline messages; (f) the missing profile-diagram family; (g) use-case extension-point conditions. This RFC closes them and declares the 14-family coverage sweep.

## Proposed syntax (per family, all additive)

1. **Object (`uml.object@2`)** — instance titles (`name : Classifier`) render underlined; slot values are datatype-checked against the classifier's declared field datatypes (`DDN-PJ170`: number/boolean mismatches); new relation `uml.link` (structural, record/classifier endpoints) carrying RFC-119 `x_endlabels` multiplicity (PJ149 rule extended).
2. **Package** — new relations `uml.import` («import»), `uml.access` («access»), `uml.merge` («merge»), dashed open-arrow dependencies; packaged-element visibility via closed contract `x_pack: { visibility: public|private }` rendered as `+`/`−` name prefix; meaningless visibility outside a package frame is `DDN-PJ171`.
3. **Communication (`uml.communication@2`)** — `x_fragment` (RFC-120 contract) on messages renders a dashed fragment frame with operator pentagon over the covered message routes; fragment references must resolve to visible `uml.message` relations (`DDN-PJ172`); `x_message.time`/`duration` (`{…}` constraints) render beside the message label.
4. **Interaction overview (`uml.interaction_overview@2`)** — nodes with `x_subdiagram.view` expand the referenced view inline inside the node (one recursion level, child view limits shared with panels); new closed contract `x_use: { arguments?: [string], gates?: [string] }` renders arguments under the interaction-use label and gate squares with names on the node border; duplicate gate names are `DDN-PJ174`.
5. **Timing (`uml.timing@2`)** — `x_states` entries may carry `duration`/`slew` annotations rendered beside the plateau; new contract `x_timeconstraint: ["{…}", …]` renders time/duration constraints under the lifeline; consecutive equal states compact (no transition line); `uml.message` relations between participants render as arrows at `x_message.at` time; malformed entries/constraints are `DDN-PJ173`.
6. **Profile diagram (`uml.profile@1`)** — new kinds `uml.metaclass` («metaclass»), `uml.stereotype` («stereotype») with class-style compartments; new relations `uml.extension` (stereotype → metaclass, new filled-triangle `filled_triangle` end mark) and `uml.application` (dashed «apply» between packages).
7. **Use case (`uml.usecase@3`)** — `x_usecase.condition` on `uml.extend` renders as `{condition}` on the edge label; extension-point existence checks (DDN-PX004) already enforced.

## Semantic normalization and identity effects

None. All are view notation over existing element/relation identities. Child-view inline expansion is rendering-only; the semantic fingerprint keeps the reference, not the expansion.

## Alternatives considered

1. **One `uml.remainder@1` profile**: rejected — each family already has its own profile lineage; version bumps follow registry conventions.
2. **Package visibility reusing `x_member`**: rejected — packaged elements are objects, not classifier members; a dedicated `x_pack` keeps targets clean.
3. **IO inline expansion as subdiagram conversion**: partially adopted — implemented as profile-scoped child-IR attachment (`ir.view.ioChildren`), sharing the panels recursion guard instead of inventing a third embedding path.

## Compatibility and migration

Fully additive; every @1/@2 predecessor stays installed and immutable. `filled_triangle` is a new endpoint mark (previously DDN114). `uml.link` admits record/classifier endpoints that `uml.association` deliberately rejects (instances are not classifiers).

## Machine schema and diagnostic changes

- Registry: +2 kinds, +6 relations, +6 profile versions; regenerated assets.
- Contracts: `x_pack`, `x_use`, `x_timeconstraint`; `x_message` gains `at`.
- New error codes (ceilings re-grepped: PJ169, PJW05): `DDN-PJ170` (slot datatype), `DDN-PJ171` (x_pack visibility), `DDN-PJ172` (communication fragment refs), `DDN-PJ173` (timing entries/constraints), `DDN-PJ174` (IO gates/arguments).

## Sweep: the 14 UML 2.5.1 diagram families

Class (structure@2), object (object@2), package (structure@2 + import/access/merge), deployment (deployment@1), composite structure (composite@1), component (composite@1), use case (usecase@3), activity (activity@2), state machine (statemachine@1), sequence (sequence@2), communication (communication@2), timing (timing@2), interaction overview (interaction_overview@2), profile (profile@1). The sweep test renders one example per family end-to-end. Remaining honest exclusions (in capabilities.json): XMI/OCL exchange, executable behavior, protocol verification, region-local par lifelines, formal OMG certification.

## Positive and negative fixtures

`notation/tests/uml-remainder-compliance.js` (per-family) and `notation/tests/uml-showcase.js` (the 14-family sweep). Gallery fixture: `website/examples/basics/81-uml-remainder.ddn`.

## Open questions and decision record

- Profile-diagram «profile» package marking: rendered via the package name; a dedicated profile-package kind was rejected as redundant with `uml.package` + «apply» edges.
- Slot datatype checking covers the scalar cases (number/boolean) deterministically; richer datatypes pass through (documented, not silently wrong).
