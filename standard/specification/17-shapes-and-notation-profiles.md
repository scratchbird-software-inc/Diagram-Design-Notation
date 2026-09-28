# 17. Composable silhouettes and notation profiles

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


**DDN 0.4 draft — executable reference contracts.** The public model continues to use ordinary object/member/relation declarations. Registered namespaced kinds determine a trusted geometry recipe. Profiles determine how a recipe is used; style never supplies new semantics.

## 17.1 Geometry contract

`reference/ddn-shapes.js` separates measurement, drawing and attachment. Each recipe provides a visible contour, a conservative rectangular collision envelope, content/label space, measured minimum dimensions and permitted boundary anchors. Endpoint placement uses the actual contour for circles, ellipses, diamonds and sloped sides rather than the invisible rectangle. The existing router continues to avoid conservative obstacle envelopes.

The initial reusable recipes are rectangle, rounded rectangle, terminal, decision diamond, ellipse, circle, parallelogram, wavy document, predefined-process frame, data store, actor, package tab and component frame. Existing DDN note, frame, sample and card shapes remain available. This is a compositional implementation, not a source-level arbitrary SVG drawing language.

The drawing look can be classic, handDrawn or neo. Controlled pen variation changes outlines, not the nominal obstacle/attachment model. Quantitative data marks do not inherit rough coordinates. Registered line families and dark/night color variants remain fixed; shapes do not reuse the meaning of an unrelated badge position.

The native `tree` layout honours `direction`: with `down` (or `up`, mirrored) depth advances vertically and siblings stack along x using subtree widths, so a single-root hierarchy hangs as a top-down org chart; with the default `right` (or `left`) the original horizontal geometry is retained byte-identically. Mind maps ignore `direction` and remain horizontal.

The native `mindmap` layout has a single-root contract: with exactly one hierarchy root it centres that topic and alternates branches left and right in declaration order; with more than one root it silently falls back to ordinary tree stacking. The `mindmap.basic@1` profile enforces the contract up front — exactly one root (`DDN-PJ102`), an acyclic `assoc` hierarchy (`DDN-PF004`), and `layout.algorithm: mindmap` (`DDN-PF007`) — so a profiled mind map never degrades into a two-sided picture of a one-sided tree.

## 17.2 Basic flowcharts

`flow.basic@1` uses `flow.start`, `flow.end`, `flow.process`, `flow.decision`, `flow.io`, `flow.document` and `flow.subprocess`, connected by `flow.next`.

A closed flowchart requires at least one start and end. Starts have no incoming control; ends have no outgoing control. Every selected symbol is reachable from a start and can reach an end. A decision has at least two outgoing edges with distinct nonempty `x_diagram.branch` labels. These labels are declared alternatives, NOT machine-proved mutually exclusive conditions. Symbols do not accept data-field compartments. Loops may exist if a path to an end exists; no liveness or execution result is inferred.

The fixed solid control-arrow recipe is specific to this profile. It does not change the original DDN control-line conventions globally. Reference callout keys remain presentation identifiers.

## 17.3 DFD notation variants

`dfd.gane_sarson@1` and `dfd.yourdon@1` render the same `dfd.process`, `dfd.store`, `dfd.external` and `dfd.data` definitions. The former uses process compartments and open store symbols; the latter uses circular processes and parallel-line stores. Process numbers are nonempty and unique, and each process has input and output. Every flow involves a process; store-to-store, external-to-external and external-to-store shortcuts are rejected.

Payload names are relation labels. This subset does not prove transformation conservation, complete leveled-method rules, Gane–Sarson/Yourdon certification or executable behavior. Existing DDN boundary-contract checks remain a separate capability, not a fabricated formal-method approval.

## 17.4 Structural and use-case subsets

`uml.structure@1` supports explicit `uml.class`, `uml.interface`, `uml.package` and `uml.component` declarations. `x_member` controls attribute versus operation compartments, visibility, static underline and abstract italic treatment. Signature/type text is authored text; the library does not parse a complete programming-language or UML type system.

Implemented links are association, generalization, realization and dependency. Generalization connects compatible classifier kinds and must be acyclic. Realization uses its declared endpoint contract and a hollow triangular marker. Package tabs and component indicators are actual silhouettes, but full package import/merge and component assembly/delegation semantics are not implemented.

`uml.structure@2` (RFC-119) extends the same foundation to the UML 2.5.1 class-diagram surface:

- **Association ends** carry role names, multiplicity (`1`, `0..1`, `0..*`, `1..*`, `*`) and qualifiers via `x_endlabels: { source: {…}, target: {…} }`. Aggregation uses the `hollow_diamond` end mark at the whole; composition reuses the filled `diamond` mark; navigability uses the `open` arrowhead mark. Endpoint decorations apply to `uml.association` only (`DDN-PJ149`).
- **Association classes** attach a named `uml.class` to an association with a dashed connector from the path midpoint (`x_association_class: { class: @ref }`, `DDN-PJ150`).
- **N-ary associations** declare ends beyond the binary anchors in `x_nary.ends`; the renderer draws the UML diamond junction at the member centroid with one spoke per end, each carrying its role and multiplicity. Ends must be three or more distinct classifiers (`DDN-PJ151`). The data model stays a binary relation plus declared extra ends — see RFC-119 for the decision record.
- **Generalization sets** group `uml.generalization` relations by `x_genset.name` sharing one target and render the `{disjoint|overlapping, complete|incomplete}` constraint label at the shared target end (`DDN-PJ152`).
- **Templates** draw the dashed parameter signature box on the top-right corner of a `uml.class`/`uml.interface` (`x_template: { parameters: […] }`, `DDN-PJ153`).
- **Enumerations** use the `uml.enumeration` kind with a «enumeration» header and LITERALS compartment; members declare `x_member: { kind: literal }` (`DDN-PJ154`).
- **Provided/required interfaces** are the `uml.provided` (lollipop at the interface end) and `uml.required` (socket at the class end) relations between classes/components and interfaces. Assembly ball-and-socket connectors across ports are covered by `uml.composite@1` (§17.9).
- **Member adornments**: `x_member` grows `derived` (leading `/`), `multiplicity` (`[0..*]`) and `modifiers` (`{ordered}`, `{unique}`, `{readOnly}` property strings).

XMI/OCL exchange and the full UML type/parameter metamodel remain outside the profile, as declared in the registry.

`uml.usecase@1` uses actor and use-case contours with participation, include and extend links. Include cycles are rejected. Full extension-point conditions, actor generalization, UML interaction semantics and XMI exchange are outside this subset.

`requirements.basic@1` is a **DDN requirement-traceability profile**, not full SysML. Requirements have unique nonempty code and text, with satisfies/verifies/derives links to declared implementation/test records. The implementation rejects invalid endpoints and derivation cycles. A `verifies` relation is a statement of intended traceability, not proof a test ran or passed.

## 17.5 Chen projection

`chen.basic@1` maps existing `entity` objects, scalar fields and binary object-level `assoc`/`ref` relationships. Entities become rectangles, their fields become ovals, and relationships become diamonds. The visual occurrence IDs/source maps retain the original entity, field and relationship identity. The original model is unchanged and has the same semantic fingerprint as its ordinary ER view when both select the same data.

This initial Chen profile rejects nested/repeated fields and member-endpoint links instead of pretending to flatten them. Weak entities, identifying relationships, n-ary associations, multivalued/derived attribute notation and complete cardinality placement are not implemented. The generated scalar/binary illustration is not a complete Chen metamodel conversion. Unknown cases must remain errors or use the original DDN representation.

## 17.6 C4-style boundary profiles

The `c4.context@1`, `c4.container@1` and `c4.component@1` profiles render C4-style views on the existing graph projection using six registered kinds and one verb; boundaries reuse the view `frame` mechanism rather than a new shape category.

| Kind | Silhouette | Core fallback | Role in the profile set |
|---|---|---|---|
| `c4.person` | actor | `role` | External person in all three views |
| `c4.system` | round | `application` | System; boundary object of `c4.container@1` |
| `c4.container` | rect | `application` | App/service; boundary object of `c4.component@1` |
| `c4.store` | cylinder | `dataset` | Data store |
| `c4.queue` | rect | `queue` | Queue/topic |
| `c4.component` | component | `application` | Component |

All links use `c4.rel` ("Uses / interacts with", open arrow). C4 kinds carry labels only — attribute compartments are rejected (`DDN-PF003`). Context views accept only people and systems and reject field-level member endpoints (`DDN-PJ100`). Container and component views require exactly one view frame scoped to a selected boundary object — a `c4.system` for `c4.container@1`, a `c4.container` for `c4.component@1` — whose members cover every selected interior node; violations raise `DDN-PJ101`. Participants outside the whitelist raise `DDN-PF007`. These are DDN profiles with C4-style silhouettes, not C4 specification conformance.

## 17.6.1 EPC process chains

`epc.basic@1` renders an Event-driven Process Chain on the graph projection: events and functions strictly alternating through logical connectors, read left-to-right with the layered layout (`direction: right`).

The profile adds one silhouette, `hexagon`: a flat-topped six-point polygon whose points, for a measured box `(x, y, w, h)`, are `(x+0.25w, y)`, `(x+0.75w, y)`, `(x+w, y+0.5h)`, `(x+0.75w, y+h)`, `(x+0.25w, y+h)`, `(x, y+0.5h)`. It is a profile silhouette drawn by the generic polygon path, not a new primary form.

| Kind | Silhouette | Core fallback | Role |
|---|---|---|---|
| `epk.event` | hexagon | `object` | Something that happens; starts and follows functions |
| `epk.function` | round | `activity` | Work performed in response to events |
| `epk.connector` | circle | `gateway` | Logical join/split carrying an `and`/`or`/`xor` operator |

All links use `epk.next` ("Control passes to", filled arrow) between any two EPC symbols. Events and functions must alternate: an `epk.next` edge directly between two events or two functions raises `DDN-PJ105`; edges through connectors and connector chains are legal. Every `epk.connector` must carry `x_epc: { operator: "and"|"or"|"xor" }`; a missing, empty or unknown operator — or `x_epc.operator` on a non-connector node — raises `DDN-PJ106` (the extension contract deliberately carries no enum, so the value whitelist reports this code rather than a generic contract error). EPC kinds carry labels only; attribute compartments raise `DDN-PF003`, and participants or links outside the EPC vocabulary raise `DDN-PF007`. The published `flow.next` verb cannot be reused here: its registered endpoint contract accepts `flow.*` kinds only (`DDN102`), and widening it would be a language change requiring an RFC. This is a DDN profile with EPC conventions, not a claim of EPC specification conformance.

## 17.7 Authoring integration

The installed catalogue feeds Studio's kind and relation selectors. Namespaced kinds are quoted when inserted. Guided edits invoke the same decoder/validators as source editing. Field visibility and static/abstract flags remain editable in source; this release has no dedicated graphical inspector for every profile property.

## 17.8 Deployment diagrams (profile `uml.deployment@1`)

`uml.deployment@1` (RFC-122) is the UML 2.5.1 deployment surface on the graph projection. Four kinds: `uml.node` (plain node), `uml.device` («device») and `uml.executionenv` («execution environment») drawn as 3D boxes — front rect plus top and right depth faces at a fixed 10s × −8s offset — and `uml.artifact` («artifact» keyword above the name, dog-eared top-right corner). Three relations: `uml.deploy` and `uml.manifest` (dashed open-arrow dependencies; endpoint contracts require node-kind deploy targets and artifact manifest sources, DDN102) and `uml.commpath` (solid structural link between node kinds), which carries RFC-119 `x_endlabels` role/multiplicity — the PJ149 rule names association *or* communication path, and qualifiers remain association-only (`DDN-PJ164`). Node nesting reuses view frames scoped to a node kind (`DDN-PJ164`); deployed components come from the existing `uml.component` vocabulary. Middleware-specific deployment models, artifact content descriptors, topology discovery and formal UML conformance remain outside the profile.

Selecting a source-bound shape or matrix/chart mark navigates to its semantic source. Selecting a projected Chen connector maps to the underlying field or association. Graphical pins apply only to editable graph occurrences, not generated quantitative coordinates.

## Reference boundary

OMG UML 2.5.1 separately publishes its formal specification, abstract syntax and diagram interchange resources: https://www.omg.org/spec/UML/2.5.1/About-UML . This profile was designed to cover a declared structural subset; it does not claim to implement all those normative resources. The traditional DFD and Chen illustrations similarly identify their intentional exclusions rather than using familiar silhouettes as a conformance claim.

## 17.9 Component and composite-structure diagrams (profile `uml.composite@1`)

`uml.composite@1` (RFC-123) covers the UML 2.5.1 component and composite-structure families on the graph projection. Ports reuse the SysML port machinery (`ports { port x { direction: in|out|inout; } }` on `uml.component`/`uml.class`); the renderer's port-square attachment, previously sysml-only, also draws under this profile. Three relations: `uml.assembly` (socket at the requiring end, lollipop at the providing end — the RFC-119 marks; endpoints are components or their ports, field members are rejected as `DDN-PJ165`), `uml.delegation` (dashed open arrow from a boundary port inward, `DDN-PJ165` when it does not start at a port member) and `uml.connector` (plain connector with RFC-119 `x_endlabels` role names and multiplicity — the PJ149 rule now names association, communication path or connector). Internal parts are fields carrying `x_part: { classifier?, multiplicity? }`, rendered as `role: Classifier [mult]` rows; part owners are `uml.class`/`uml.component`/`uml.collaboration` and multiplicity uses the UML form (`DDN-PJ166`). `uml.collaboration` renders the dashed-ellipse collaboration symbol with «collaboration» keyword and its role bindings inside. Interface type-checking of assembly pairings, port protocol state machines and formal conformance remain outside the profile.

## 17.10 Activity diagrams at uml.activity@2 (RFC-124)

`uml.activity@2` extends the activity profile to the UML 2.5.1 surface; @1 is immutable. Additions: `flow.merge` (merge diamond, ≥2 incoming / exactly one outgoing — `DDN-PJ167`; decisions keep the named-branch rule DDN-PF009); pins as ports on action kinds with `x_pin: { set?, streaming? }` (attached pins draw at edge endpoints, unattached pins draw on the action border, streaming pins filled, set names beside — `DDN-PJ169` on non-action owners; `uml.flow` gained `member_endpoints: true` so edges attach to pins); `flow.sendsignal`/`flow.acceptsignal` pentagons and the `flow.timeevent` hourglass; `flow.flowfinal` (⊗), which counts as an end under @2 (DDN-PF008); interruptible regions as frames with `x_interruptible: true` (dashed roundrect) and interrupting/exception edges as `uml.flow` with `x_interrupt`/`x_exception: true` drawn as lightning zigzags (source must be inside an interruptible region, exception must target a handler action — `DDN-PJ168`); structured/expansion regions as frames with `x_structured: { mode: structured|iterative|parallel }` («mode» keyword). Connector circles are the existing `flow.connector` kind (admitted to `uml.flow` endpoints). Activity execution semantics, object-flow type checking and expansion-region collections remain outside the profile.

## 17.11 Package and profile diagrams (RFC-125)

Package dependencies land on the structure vocabulary: `uml.import`
(«import»), `uml.access` («access») and `uml.merge` («merge») are dashed
open-arrow dependencies with package endpoints (import/access may target
classifiers). Packaged-element visibility uses the closed contract
`x_pack: { visibility: public|private }`, rendered as a `+`/`−` name prefix;
visibility outside a package frame is meaningless and rejected
(`DDN-PJ171`).

The new profile `uml.profile@1` covers UML 2.5.1 profile diagrams:
`uml.metaclass` and `uml.stereotype` are classifiers with «metaclass» /
«stereotype» headers and class compartments; `uml.extension` (stereotype →
metaclass) carries the new filled-triangle end mark; `uml.application`
(«apply») is the dashed profile-application arrow between packages.

## 17.13 ISO 5807 flowcharts (flow.iso5807@1)

`flow.iso5807@1` ships the full ISO 5807 (1985) flowchart symbol set
(B1-075). The `flow.basic@1` vocabulary (terminator, process, decision, IO,
document, predefined process, connector, storage, annotation) is extended
with thirteen kinds: `flow.manualinput` (sloped-top quadrilateral),
`flow.manualop` (trapezoid), `flow.preparation` (hexagon, silhouette
existed), `flow.display` (right-curve flag), `flow.delay` (D-shape),
`flow.loopstart`/`flow.loopend` (hexagons), `flow.isomerge` (down triangle),
`flow.isoextract` (up triangle), `flow.card` (clipped-corner), `flow.collate`
(ellipse with X), `flow.sort` (ellipse with bar), `flow.parallelmode` (rect
with twin bars). The same closed flowchart structure rules as `flow.basic@1`
apply (start+end, `flow.next` links only, named decision branches,
`DDN-PF007`–`DDN-PF010`); endpoint contracts report as `DDN102`.
`flow.basic@1` and `flow.documented@2` are unchanged. Example:
`website/examples/basics/91-iso5807-flowchart.ddn`; tests
`notation/tests/iso5807-compliance.js` + `iso5807-showcase.js`. ISO
interchange formats, execution, and certification are out of scope.

## 17.14 C4 deployment and dynamic diagrams (c4.deployment@1, c4.dynamic@1)

`c4.deployment@1` rebadges the `uml.deployment@1` machinery for the C4
deployment view: nodes/devices/execution environments as 3D boxes, artifacts
as documents, «deploy»/«manifest» dependencies, communication paths with
multiplicity, and nesting frames (the rebadge is recorded at render time as
the informational `DDN-PJW06`). `c4.dynamic@1` rebadges
`uml.communication@2` for the C4 dynamic view: numbered messages
(`x_message.seq` — required and validated as `DDN-PJ111`, replies dotted
under their request) plus combined fragments and time/duration constraints.
Element tags (`x_c4tag: { tags: [ … ] }`, 1–8 strings) render as an italic
`[tag, …]` chip under any node — the C4 styling legend form. The three basic
profiles `c4.context/container/component@1` are unchanged.

## 17.15 Full EPC notation (epc.complete@1)

`epc.complete@1` extends `epc.basic@1` with the full EPC vocabulary:
organizational units (`epk.orgunit`) and roles (`epk.role`) — usable directly
or as lane frames — information objects/documents (`epk.infoobject`,
document silhouette, dashed `epk.infoflow` to and from functions),
process-link symbols (`epk.processlink` with dashed `epk.links` into an
event or function), and assignment lines (`epk.assigned`, plain lines from
units/roles to functions). Alternation (`DDN-PJ105`) and connector operators
(`DDN-PJ106`) apply as in the basic profile, and the new split/join
fan-balancing rule (`DDN-PJ199`) requires each connector operator's splits
(>1 outgoing `epk.next`) to be matched by the same count of joins (>1
incoming) of that operator. `epc.basic@1` stays installed and immutable.
Example: `website/examples/basics/92-c4-epc.ddn`; tests
`c4epc-compliance.js` + `c4epc-showcase.js`. Process simulation, BPMN
interchange, and formal conformance remain out of scope.
