# Research synthesis and implementation choice

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Method
Review primary project documentation and license texts, not visual popularity rankings. The research examines drawing UX, property models, connection semantics, command history, model/view reuse and integration constraints. No proprietary source is copied; no installed competitor usability benchmark was performed. See `research/PRIMARY-SOURCES.md` and its dated machine-readable source records.

| Project | Pattern to adopt | Pattern not to copy blindly |
|---|---|---|
| draw.io | Context-sensitive palette/inspector, quick append, keyboard alternatives, fixed/floating attachment distinction. | A vast arbitrary style-property bag is unsuitable as the primary DDN semantic editor. Metadata and visible style must remain separate. [R01–R05] |
| yEd | Explicit partial-layout scope and arrangement near unchanged neighbors. | Do not claim its optimization quality or reuse yFiles algorithms. Existing pins and DDN field identities remain hard constraints. [R20] |
| React Flow | Clear handles, connection validation hooks, viewport behavior, keyboard operation, custom nodes. | Its node/edge store must not become a second source of truth or replace the DDN router/exporter. [R06–R08] |
| diagram-js / bpmn-js | Palette, context pad, command stack, rules and domain model separated. | A generic visual connection is not a semantic relationship. Do not infer that generic diagram-js and BPMN toolkits have the same license. [R09–R11] |
| JointJS | Port groups, descriptor-driven inspectors, conditional property groups and batched history. | Some documented UI modules are JointJS+; community licensing does not include every demonstrated component. [R12–R15] |
| tldraw | Typed shape props, geometry utilities, migrations, compact contextual tools. | The SDK is not a default permissively licensed production dependency; do not make freehand shape props the model. [R16–R17] |
| Excalidraw | Reduced visual clutter, small style vocabulary, embeddable callbacks. | Optional customData is not a validated domain schema; roughness cannot alter notation meaning. [R18–R19] |
| Penpot | Visible shared-definition/instance relationship, explicit overrides and reset. | DDN occurrence, modeled instance and physical replica are three different things. [R21] |

## License-aware technology decision
Use a **DDN-native SVG interaction host** as the reference architecture. It consumes the existing renderer's scene, source mappings and contour anchors, adding editor overlays and HTML property panels. This avoids replacing a routing engine we have already refined and also works with non-graph projections. It does not mean rebuilding parsing, layout, SVG export or command history.

A short adapter spike may compare this host with generic diagram-js. Its inspected license is MIT, and its modular command/rules architecture is particularly relevant. Adoption requires the spike to preserve DDN source commands as the only commit path and reproduce renderer geometry/export without a competing model. The benchmark must include fields, parallel edges, pins, a curve, a chart and a matrix, not just a three-node flowchart. [R09–R10]

React Flow is a reasonable React-oriented alternative; its inspected repository is MIT. It introduces a node-host abstraction and coordinate adapters, and it must not be selected only because a starter diagram is fast to build. tldraw's production licensing and JointJS+'s commercial UI modules make them references rather than default dependencies for this project's intended open distribution. [R15–R17,R27]

The bpmn.io domain toolkit license has a watermark condition; diagram-js itself uses MIT. JointJS community uses MPL-2.0 and its Inspector/CommandManager examples are imported from `@joint/plus`. No bundling decision is approved by this prose: pin actual versions and dependency licenses before any package inclusion. [R10–R15]

## Selection criteria for an interaction host
Require: one source command path; custom field/port identity; geometry/output parity; non-graph projection support; no silent layout substitution; accessible input; a worker seam; recoverable draft models; bounded memory; supportable license; small editor-only distribution. Performance and accessibility must be measured in the integration, not inferred from a library's marketing or API list.

## UI lessons applied
The resulting interface is not a collage of competitors. It has three stable working regions: a context-filtered insertion/model shelf, a canvas, and an inspector. The inspector distinguishes **Meaning**, **This view**, and **Details**. A small context pad offers Connect, Add related, Fields and More. Major changes show their shared impact. Advanced geometry and serialization never occupy the default property surface.
