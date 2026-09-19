# 17. Composable silhouettes and notation profiles

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


**DDN 0.4 draft — executable reference contracts.** The public model continues to use ordinary object/member/relation declarations. Registered namespaced kinds determine a trusted geometry recipe. Profiles determine how a recipe is used; style never supplies new semantics.

## 17.1 Geometry contract

`reference/ddn-shapes.js` separates measurement, drawing and attachment. Each recipe provides a visible contour, a conservative rectangular collision envelope, content/label space, measured minimum dimensions and permitted boundary anchors. Endpoint placement uses the actual contour for circles, ellipses, diamonds and sloped sides rather than the invisible rectangle. The existing router continues to avoid conservative obstacle envelopes.

The initial reusable recipes are rectangle, rounded rectangle, terminal, decision diamond, ellipse, circle, parallelogram, wavy document, predefined-process frame, data store, actor, package tab and component frame. Existing DDN note, frame, sample and card shapes remain available. This is a compositional implementation, not a source-level arbitrary SVG drawing language.

The drawing look can be classic, handDrawn or neo. Controlled pen variation changes outlines, not the nominal obstacle/attachment model. Quantitative data marks do not inherit rough coordinates. Registered line families and dark/night color variants remain fixed; shapes do not reuse the meaning of an unrelated badge position.

The native `tree` layout honours `direction`: with `down` (or `up`, mirrored) depth advances vertically and siblings stack along x using subtree widths, so a single-root hierarchy hangs as a top-down org chart; with the default `right` (or `left`) the original horizontal geometry is retained byte-identically. Mind maps ignore `direction` and remain horizontal.

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

## 17.7 Authoring integration

The installed catalogue feeds Studio's kind and relation selectors. Namespaced kinds are quoted when inserted. Guided edits invoke the same decoder/validators as source editing. Field visibility and static/abstract flags remain editable in source; this release has no dedicated graphical inspector for every profile property.

Selecting a source-bound shape or matrix/chart mark navigates to its semantic source. Selecting a projected Chen connector maps to the underlying field or association. Graphical pins apply only to editable graph occurrences, not generated quantitative coordinates.

## Reference boundary

OMG UML 2.5.1 separately publishes its formal specification, abstract syntax and diagram interchange resources: https://www.omg.org/spec/UML/2.5.1/About-UML . This profile was designed to cover a declared structural subset; it does not claim to implement all those normative resources. The traditional DFD and Chen illustrations similarly identify their intentional exclusions rather than using familiar silhouettes as a conformance claim.
