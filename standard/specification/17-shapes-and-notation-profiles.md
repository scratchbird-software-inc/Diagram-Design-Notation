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

`uml.structure@2` extends the same foundation to the UML 2.5.1 class-diagram surface:

- **Association ends** carry role names, multiplicity (`1`, `0..1`, `0..*`, `1..*`, `*`) and qualifiers via `x_endlabels: { source: {…}, target: {…} }`. Aggregation uses the `hollow_diamond` end mark at the whole; composition reuses the filled `diamond` mark; navigability uses the `open` arrowhead mark. Endpoint decorations apply to `uml.association` only (`DDN-PJ149`).
- **Association classes** attach a named `uml.class` to an association with a dashed connector from the path midpoint (`x_association_class: { class: @ref }`, `DDN-PJ150`).
- **N-ary associations** declare ends beyond the binary anchors in `x_nary.ends`; the renderer draws the UML diamond junction at the member centroid with one spoke per end, each carrying its role and multiplicity. Ends must be three or more distinct classifiers (`DDN-PJ151`). The data model stays a binary relation plus declared extra ends — see for the decision record.
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

`uml.deployment@1` is the UML 2.5.1 deployment surface on the graph projection. Four kinds: `uml.node` (plain node), `uml.device` («device») and `uml.executionenv` («execution environment») drawn as 3D boxes — front rect plus top and right depth faces at a fixed 10s × −8s offset — and `uml.artifact` («artifact» keyword above the name, dog-eared top-right corner). Three relations: `uml.deploy` and `uml.manifest` (dashed open-arrow dependencies; endpoint contracts require node-kind deploy targets and artifact manifest sources, DDN102) and `uml.commpath` (solid structural link between node kinds), which carries `x_endlabels` role/multiplicity — the PJ149 rule names association *or* communication path, and qualifiers remain association-only (`DDN-PJ164`). Node nesting reuses view frames scoped to a node kind (`DDN-PJ164`); deployed components come from the existing `uml.component` vocabulary. Middleware-specific deployment models, artifact content descriptors, topology discovery and formal UML conformance remain outside the profile.

Selecting a source-bound shape or matrix/chart mark navigates to its semantic source. Selecting a projected Chen connector maps to the underlying field or association. Graphical pins apply only to editable graph occurrences, not generated quantitative coordinates.

## Reference boundary

OMG UML 2.5.1 separately publishes its formal specification, abstract syntax and diagram interchange resources: https://www.omg.org/spec/UML/2.5.1/About-UML . This profile was designed to cover a declared structural subset; it does not claim to implement all those normative resources. The traditional DFD and Chen illustrations similarly identify their intentional exclusions rather than using familiar silhouettes as a conformance claim.

## 17.9 Component and composite-structure diagrams (profile `uml.composite@1`)

`uml.composite@1` covers the UML 2.5.1 component and composite-structure families on the graph projection. Ports reuse the SysML port machinery (`ports { port x { direction: in|out|inout; } }` on `uml.component`/`uml.class`); the renderer's port-square attachment, previously sysml-only, also draws under this profile. Three relations: `uml.assembly` (socket at the requiring end, lollipop at the providing end — the marks; endpoints are components or their ports, field members are rejected as `DDN-PJ165`), `uml.delegation` (dashed open arrow from a boundary port inward, `DDN-PJ165` when it does not start at a port member) and `uml.connector` (plain connector with `x_endlabels` role names and multiplicity — the PJ149 rule now names association, communication path or connector). Internal parts are fields carrying `x_part: { classifier?, multiplicity? }`, rendered as `role: Classifier [mult]` rows; part owners are `uml.class`/`uml.component`/`uml.collaboration` and multiplicity uses the UML form (`DDN-PJ166`). `uml.collaboration` renders the dashed-ellipse collaboration symbol with «collaboration» keyword and its role bindings inside. Interface type-checking of assembly pairings, port protocol state machines and formal conformance remain outside the profile.

## 17.10 Activity diagrams at uml.activity@2

`uml.activity@2` extends the activity profile to the UML 2.5.1 surface; @1 is immutable. Additions: `flow.merge` (merge diamond, ≥2 incoming / exactly one outgoing — `DDN-PJ167`; decisions keep the named-branch rule DDN-PF009); pins as ports on action kinds with `x_pin: { set?, streaming? }` (attached pins draw at edge endpoints, unattached pins draw on the action border, streaming pins filled, set names beside — `DDN-PJ169` on non-action owners; `uml.flow` gained `member_endpoints: true` so edges attach to pins); `flow.sendsignal`/`flow.acceptsignal` pentagons and the `flow.timeevent` hourglass; `flow.flowfinal` (⊗), which counts as an end under @2 (DDN-PF008); interruptible regions as frames with `x_interruptible: true` (dashed roundrect) and interrupting/exception edges as `uml.flow` with `x_interrupt`/`x_exception: true` drawn as lightning zigzags (source must be inside an interruptible region, exception must target a handler action — `DDN-PJ168`); structured/expansion regions as frames with `x_structured: { mode: structured|iterative|parallel }` («mode» keyword). Connector circles are the existing `flow.connector` kind (admitted to `uml.flow` endpoints). Activity execution semantics, object-flow type checking and expansion-region collections remain outside the profile.

## 17.11 Package and profile diagrams

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

## 17.16 MSC — message sequence charts (msc.basic@1)

`msc.basic@1` covers ITU-T Z.120 message sequence charts as a rebadge of the
`uml.sequence@2` machinery (recorded at render time as `DDN-PJW06`):
lifelines, message sorts, combined fragments, gates and time/duration
constraints. Where Z.120 differs, the mappings are: **HMSC references** —
the `msc.hmscref` participant kind draws a `«ref»` box and binds a detail
view with `x_subdiagram` (unknown views fail `DDN-PJ119`), with
`x_hmscref: { params: […] }` carrying the reference's actual parameter list
(Z.120 §7.3); **inline expressions** — state invariants (`x_invariant`
stadium boxes on a lifeline), where each entry may declare the Z.120
setting-vs-guarding split with `role: setting|guarding`;
**instance creation / stop** — the `create` and `delete` message sorts;
**coregions** — the `coreg` combined-fragment operator (added additively to
the fragment operator enum); **message loss** — the `lost`/`found` sorts
(self-anchored with a free end, `DDN-PJ156`). MSC document interchange and
execution semantics/simulation and formal ITU conformance are out of
scope. Example: `website/examples/basics/93-msc.ddn`; tests
`msc-compliance.js` + `msc-showcase.js`.

## 17.17 IDEF0 function modeling (idef0.basic@1)

`idef0.basic@1` covers IEEE 1320.1 (IDEF0) function modeling. Activity boxes
(`idef0.activity`) declare **ICOM ports** — every port carries
`x_icom: { type: input|control|output|mechanism }` plus the existing port
`side` property, and the type must match the side: Inputs west, Controls
north, Outputs east, Mechanisms south (`DDN-PJ200`). Activities number with
`x_idef0: { node: "A1" }` (closed pattern `A\d+`; required, unique,
`DDN-PJ201`). A decomposition binds with `x_subdiagram`; the child view must
be `idef0.basic@1` and its activities must number *under* the decomposed node
(A1 → A11, A12, …). Arrows are `idef0.flow` (labeled; fork/join by fanning
relations in and out) and `idef0.call` (dashed call arrow). **Tunneled
arrows** carry `x_tunnel: { start|end: true }` and render an open parenthesis
at the tunneled end instead of an arrowhead. Interchange formats, model
execution, and formal IEEE certification are out of scope. Example:
`website/examples/basics/94-idef0.ddn`; tests `idef0-compliance.js` +
`idef0-showcase.js`.

## 17.18 Petri nets (petri.basic@1)

`petri.basic@1` covers ISO/IEC 15909 Petri net notation. Places are circles
with markings — `x_petri: { tokens: n }` draws up to five token dots inside
the circle and a count text above five; transitions are bars. Arcs
(`petri.arc`) carry `x_petri: { weight: n }` (n ≥ 1, printed near the target
end when n > 1); `petri.inhibitor` runs from a place to a transition and ends
with an open circle; `petri.testarc` (read/test arc) draws dashed. The graph
is bipartite: arcs run only between a place and a transition (`DDN-PJ202`;
the inhibitor's source must be a place). Weight and token shapes are
contract-enforced nonnegative integers (tokens on places only, weights on
arcs only — `DDN-PJ203`; the numeric bounds are the contract's `DDN105`).
Reachability/coverability analysis, PNML interchange, and net execution are
out of scope. Example: `website/examples/basics/95-petrinet.ddn`; tests
`petri-compliance.js` + `petri-showcase.js`.

## 17.19 ORM 2 object-role modeling (orm.basic@1)

`orm.basic@1` covers ISO/IEC 19507 (ORM 2) notation. Entity types are solid
ellipses; value types are dashed ellipses with optional value constraints
(`x_values: { values: [ … ] }`, printed as `{a, b}` under the node). A fact
type (`orm.facttype`) draws its fields as a **role-box predicate row** — a
horizontal row of boxes, one per role (the new small rendering element on the
field machinery): a uniqueness bar over a box (`x_role.uniqueness`), a
mandatory dot at the row's outer edge (`x_role.mandatory`). Roles play to
entity/value types with `orm.plays` (member endpoints); n-ary predicates are
fact types with three or more roles. Constraint arcs are `orm.subset`,
`orm.equality` (dashed «keyword» arcs) and `orm.exclusion` (circled-X end
mark). Objectification frames (`x_objectified: { name }`) draw the dashed
nesting frame; derivation text (`x_derive: { text }`) prints italic `* text`
under the node. Role ownership and fact-type shape validate as `DDN-PJ204`.
ORM2 XMI interchange, constraint formal verification, and model-to-schema
mapping are out of scope. Example: `website/examples/basics/96-orm.ddn`;
tests `orm-compliance.js` + `orm-showcase.js`.

## 17.20 Value stream mapping (vsm.basic@1)

`vsm.basic@1` covers value stream mapping *machinery* with simple generic
glyphs (detailed industry icon artwork is a separate, excluded task).
Process boxes (`vsm.process`) carry data rows (ordinary fields) and
`x_vsm: { va?, nva?, unit? }` values. The **VA/NVA timeline ladder strip**
(the item's one new layout element) draws under the content: a zigzag strip
in process x-order with VA values above the high segments, NVA below the low
segments, and Σ totals at the right end. Inventory is a triangle with an `I`
(`vsm.inventory`), supermarket a box with inner lines, kaizen a burst star
(`burst` silhouette, new — a simple 16-point star polygon), and the operator
reuses the actor glyph. Flow arrows: `vsm.material` (solid), `vsm.push`
(solid), `vsm.pull` (dashed); information arrows: `vsm.einfo` (electronic —
a zigzag over the route, `ddn-vsm-einfo`) and `vsm.minfo` (manual — dashed).
Ladder owner/shape rules validate as `DDN-PJ205`; numeric bounds are the
contract's `DDN105`. Icon libraries, cycle-time simulation and interchange
formats are out of scope. Example: `website/examples/basics/97-vsm.ddn`;
tests `vsm-compliance.js` + `vsm-showcase.js`.

## 17.21 Icon-library mechanism (x_icon, generic-demo@1)

Named SVG icon asset sets bind to kinds: `standard/registry/icon-libraries.json`
declares libraries; an icon entry names an SVG asset and may list kinds it
binds to by default. Any node can also carry
`x_icon: { library: "<id>", icon: "<id>" }` explicitly. The renderer draws the
referenced icon inside the node's top area, ids namespaced per node
(`ddn-icon` group). Because libraries are user-supplied SVG rendered into the
page, every asset is **sanitized at load time** (`DDN-PJ207`): scripts,
`foreignObject`, iframes/embeds/objects, images, event handlers
(`on*=`/`onload`), `href`/`xlink:href` (including local `<use>` references —
icons must inline everything), `javascript:` and CSS `url` are all
rejected, non-SVG payloads are rejected, and each icon is capped at 20 KiB.
Unknown references fail as `DDN-PJ206`. The built-in `generic-demo@1` set
(cloud, server, database, user — agent-drawn simple glyphs) proves the
mechanism and binds to `network.bus`/`network.server`/`network.rack`.
**Vendor packs (Cisco/AWS/Azure/GCP) are explicitly excluded** — their
licensing diligence is a separate task. Example:
`website/examples/basics/98-icons.ddn`; tests `icons-compliance.js` +
`icons-showcase.js`.

## 17.22 SDL — system and process diagrams (sdl.basic@1, sdl.process@1)

`sdl.basic@1` covers the ITU-T Z.100 structural level: `sdl.block` and
`sdl.agent` («block»/«agent» headers) with gates as block ports (port squares
render under this profile), `sdl.channel` relations whose label carries the
signal list in brackets — or as resolved references via
`x_sdl: { signals: [ @signal… ], nodelay: true }` (references must resolve to
`sdl.signal` objects, `DDN-PJ215`) — and the `sdl.signal` (send-flag) /
`sdl.signalset` vocabulary linked with `sdl.links`. `sdl.process@1` rebadges
the `uml.statemachine@1` machinery (`DDN-PJW06` at render time) with the SDL
process symbols: start (state.initial), state (state.state), input (accept
flag `sdl.input`), output (send flag `sdl.output`), decision (junction),
task (`sdl.task`), save (tag `sdl.save`), create (`sdl.create`, dashed
border) and procedure references (`sdl.procedure`, subprocess silhouette).
Timer constructs (Z.101 §11.15) ship as `sdl.timer` declarations (hourglass
silhouette) with `sdl.set`/`sdl.reset` nodes bound by
`x_sdl: { timer: @t, duration: "…" }`; priority input, spontaneous
transitions, continuous signals and the `active` query are `x_sdl`
markers on `sdl.input` (`DDN-PJ215` owner and reference rules). Exactly one
start symbol and at least one outgoing transition per process symbol
validate as `DDN-PJ208`. SDL interchange formats, simulation and formal ITU
conformance are out of scope. Example:
`website/examples/basics/99-sdl.ddn`; tests `sdl-compliance.js` +
`sdl-showcase.js`.

## 17.23 IEC 61131-3 FBD (fbd.basic@1)

`fbd.basic@1` covers IEC 61131-3 function block diagrams. A `fbd.block` is a
rect with a name/type header (`datatype` prints above the instance name —
`T1 / TON`); `fbd.variable` holds the inputs/outputs. Pins are block ports
with `x_fbd: { type: BOOL|INT|DINT|REAL|TIME|STRING|WORD, negated? }` — the
type prints at the pin, and a negated BOOL pin draws an open negation bubble
at the endpoint. Wires (`fbd.wire`) connect pins; endpoints must share a type
(`DDN-PJ210`). Negation applies to BOOL pins only (`DDN-PJ209`). Feedback
wires between blocks are allowed. Unwired pins do not draw endpoints
(documented). Ladder (LD) hosting for fbd blocks follows in a later item —
the kind and contract are designed for it. PLC execution/compilation, IEC XML
interchange and formal certification are out of scope. Example:
`website/examples/basics/100-fbd.ddn`; tests `fbd-compliance.js` +
`fbd-showcase.js`.

## 17.24 IEC 61131-3 ladder diagrams (ladder.basic@1)

`ladder.basic@1` covers IEC 61131-3 ladder diagrams (LD). The profile is a
contained addition: it keeps `projection { kind: graph }` and adds a
dedicated rung layout algorithm (`layout { algorithm: ladder }`, required —
`DDN-PJ214`) plus profile rendering. One `data` block is one rung; rungs
stack top to bottom in declaration order, and power rails flank the rung
area. Elements on a rung wire left to right with `ladder.series` (member
endpoints allowed, so FBD pins connect directly). Contacts
(`ladder.contact`, `x_contact: { form: no|nc }`) draw the `—| |—` bars with
the name above, NC adds the slash. Exactly one output coil per rung
(`ladder.coil`, `x_coil: { mode: normal|set|reset|negated }` — S/R letter
inside the parentheses, slash for negated) validates as `DDN-PJ211`;
`x_contact`/`x_coil` on other kinds fail the same code. Parallel OR branches
are inferred from the series topology — contacts sharing the same junctions
stack as parallel tracks; there is no branch relation to author.
`fbd.block`/`fbd.variable` (17.23) host on rungs unchanged. `ladder.label`
(tag), `ladder.jump` (`x_jump: { target: @label }`, must resolve to a
selected `ladder.label` — `DDN-PJ213`) and `ladder.return` cover program
flow. Series wiring may not cross rungs (`DDN-PJ212`); a series cycle is
reported (`DDN-LW02`) and column assignment degrades gracefully.

Layout: per rung, columns are longest-path distances over the series DAG;
the coil/jump/return hug the rightmost column at the rail, a label takes the
leftmost column, and branch contacts fan out into sub-tracks ordered by
predecessor barycentre. PLC execution/compilation, IEC XML interchange and
formal certification are out of scope. Example:
`website/examples/basics/101-ladder.ddn`; tests `ladder-compliance.js` +
`ladder-showcase.js`.

## 17.25 Cross-file addressing and architecture containers

DDN's identity machinery is module-scoped (`module::path`, unique across the
workspace, DDN023–DDN026) with `import "…" as alias` for cross-file
references. Cross-file addressing builds on exactly that machinery — it adds
no parallel mechanism:

- **Architecture containers** — a top-level declaration
 `architecture id "Label" { files: ["a.ddn", …]; description: "…"; }`
 groups the declaring file and the named base files into one described
 architecture (the ISO 42010 mapping of chapter 48: the container is the
 description, each view inside remains governed by its profile). Base
 files join the shared symbol machinery; the
 no-identity-collision-across-bases rule fails any duplicate module,
 declaration or uid with `DDN-PJ216`, so **module-qualified references**
 (`@module.id.path`) into bases stay unambiguous. Bare ids never resolve
 cross-file (`DDN031` as before).
- **Traceability relations** — a relation endpoint may address an element
 in a base file by module-qualified identity. Every base named by an
 endpoint must be covered by a declared container (`DDN-PJ217`); the host
 workspace file is implicitly covered. An endpoint outside the current
 view renders as an off-page badge naming the module-qualified identity,
 joined by a dashed muted edge.
- **Associations as metadata** — `x_link: { file, target }` on any relation
 is the lightweight cross-file association (ignorable to DDN-only tools).
 The file loads as a base when present, so unknown target identities fail
 `DDN-PJ216`; when the file is absent from the workspace the reference is
 a `DDN-PJW07` warning and renders as an unresolved external note — never
 an error, matching the drill-down semantics of showing rather than
 failing.

Example: `website/examples/basics/108-uaf-traceability.ddn` (multi-file UAF
cross-domain traceability); tests `xref-compliance.js` + `xref-showcase.js`.
