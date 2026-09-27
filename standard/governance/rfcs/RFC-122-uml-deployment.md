# RFC 0122 — UML 2.5.1 deployment diagrams (profile `uml.deployment@1`)

Status: implemented  
Authors/reviewers: B1-058 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.deployment@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

DDN had no deployment profile at all (gap analysis: "MISSING profile"). UML 2.5.1 deployment diagrams model nodes (devices/execution environments), artifacts, deployed components, deployment and manifestation dependencies, and communication paths.

Motivating example (excerpt; full fixture in `website/examples/basics/78-uml-deployment.ddn`):

```
object server "App server" { kind: "uml.device"; }
object jvm "Tomcat" { kind: "uml.executionenv"; }
object war "shop.war" { kind: "uml.artifact"; }
relation d "" @war -> @jvm { kind: "uml.deploy"; }
relation lan "" @server -> @db { kind: "uml.commpath";
    x_endlabels: { source: { multiplicity: "1" }; target: { multiplicity: "1..*" }; }; }
```

## Proposed syntax

No new grammar. Additive kinds/relations (VERSIONING rule 1), one new profile, existing extension machinery:

1. **New kinds** (family `concept`, fallback `application`):
   - `uml.node` — plain processing node, 3D-box silhouette.
   - `uml.device` — node with «device» stereotype.
   - `uml.executionenv` — node with «execution environment» stereotype.
   - `uml.artifact` — «artifact» stereotype with the dog-eared document icon.
   Deployed content reuses existing `uml.component` / `uml.class` instances (RFC-119 vocabulary).
2. **New relations**:
   - `uml.deploy` («deploy»): dashed open-arrow dependency, artifact/component → node/device/execution environment (also node→node for nested deployment).
   - `uml.manifest` («manifest»): dashed open-arrow dependency, artifact → artifact/component.
   - `uml.commpath`: solid structural link node↔node/device/execution environment; carries RFC-119 `x_endlabels` multiplicity (the PJ149 rule now names association *or* communication path; qualifiers stay association-only).
3. **Nesting**: nodes inside nodes reuse the view `frame` mechanism scoped to the enclosing node kind (the composite-state precedent), validated structurally.
4. **New profile `uml.deployment@1`** (graph projection) declaring the vocabulary, validation and exclusions.

## Semantic normalization and identity effects

None. New kinds are ordinary elements; stereotypes are registered-kind rendering, not free text.

## Visual encoding and routing effects

- Node 3D box: front rect plus top and right depth faces (fixed 10s × −8s offset), deterministic SVG, default box anchors.
- Artifact: rectangle with a folded top-right corner and the «artifact» keyword above the name.
- `uml.deploy` / `uml.manifest`: dashed arrows with «deploy» / «manifest» keywords as the relation names' rendering (authors name the relation; the keyword is the registered verb).
- Communication paths: plain solid lines with RFC-119 multiplicity end labels.

## Alternatives considered

1. **Reuse `uml.component` with an `x_state`-style flag for nodes**: rejected — nodes are a distinct UML metaclass with distinct containment semantics and a dedicated silhouette; kinds keep endpoint contracts enforceable (RFC-121 precedent).
2. **New containment relation for nesting**: rejected — view frames already model visual containment (composite states, C4 boundaries); a second mechanism would drift.
3. **`uml.deploy` as `uml.dependency` with a stereotype string**: rejected — registered verbs keep legend, validation and rendering deterministic.

## Compatibility and migration

Fully additive. No existing profile, kind or relation changes except the PJ149 message/rule now also admitting `uml.commpath` for `x_endlabels` (multiplicity only; qualifiers remain association-only).

## Security, privacy and accessibility

No new input channels; standard schema contracts, escaped labels, source-bound marks.

## Machine schema and diagnostic changes

- Registry: +4 kinds, +3 relations, +1 profile; regenerated assets.
- New error codes (ceilings re-grepped: PJ162, PJW05): `DDN-PJ164` (deployment nesting frame scoped to a non-node kind; `x_endlabels` qualifier on a communication path).

Deploy targets and manifest sources are enforced by the registered endpoint contracts (DDN102), so PJ163 was deliberately left unallocated (like PJ139/PJ140).

## Positive and negative fixtures

`notation/tests/deployment-compliance.js`; gallery fixture `website/examples/basics/78-uml-deployment.ddn`.

## Implementation/conformance impact

Touch points: registry/catalogue, `ddn-profiles.js` (PJ149 rule text), `ddn-profile-quality.js` (PJ164), `ddn-shapes.js` (node3d + artifact silhouettes, stereotype headers). Spec chapter 17 gains §17.8; designer contracts (+4 kinds, +3 relations). Still outside scope: deployment to specific middleware models, artifact content descriptors, network topology discovery, formal UML conformance.

## Open questions and decision record

- Communication-path multiplicity reuses RFC-119 end labels (decided); path *protocol* annotations stay free relation names (documented).
- Node nesting via frames (decided); a containment relation remains available as `uml.deploy` for the UML deploy-between-nodes case.
