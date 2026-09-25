# 24. Child-view panels and bounded notation completion

**DDN 0.7.0.** This chapter completes the fourth implementation stage: real child-view composition, box-plot integration (chapter 22), and selected local notation gaps. A useful supported profile is not blanket external-standard conformance.

## 24.1 Composed panels

`projection.kind: panels`, `profile: "panels.composed@1"` accepts named slots containing either item references or a child `view`, never both. A child is another actual named DDN view. Its source model is not copied into the parent.

```ddn
projection {
    kind: panels; profile: "panels.composed@1";
    columns: 2;
    panels: [
        {id: pareto, title:"Defect priorities", row:0, column:0, view:@pareto},
        {id: spread, title:"Measurement distribution", row:0, column:1, view:@histogram},
        {id: score, title:"Review scores", row:1, column:0, view:@heat_bands},
        {id: state, title:"Corrective action", row:1, column:1, view:@lifecycle}
    ];
}
```

The existing row/column/span validation still applies: positive bounded dimensions, no overlapping slots, unique slot IDs, legal spans and measured headings. Up to twelve child-view slots and one level of view composition are supported. A child may contain ordinary item panels, but it may not itself contain child views. Cycles are detected through the core view compilation stack before recursive rendering. A missing view cannot become a successful blank panel.

The parent controls placement, column width, row height and its own publication. Each child retains its data selection, projection, metadata validation, graph constraints, chart scales, calendar coordinates and source identities. Parent look/theme are inherited for a coherent review page; other child policies are not silently overwritten. Children render at native content dimensions with no fit-to-small-slot scaling. The parent expands its grid as necessary. Its own page and minimum-text rules then evaluate the complete composed result. Consequently a dashboard may be larger than a small print sheet; split it or select a larger publication target instead of ignoring a rejection.

A child view with more than the declared resource limit fails rather than being partially omitted. Composite dimensions are bounded at 50,000 units. This release does not include asynchronous worker rendering, arbitrarily deep recursive view layouts, responsive browser breakpoints, or a general dashboard application.

## 24.2 Identity, selection and source mapping

Each embedded SVG's internal IDs, `href`, `url(#...)`, accessibility ID references and projection-mark IDs receive a deterministic slot prefix. Repeating one child view twice therefore yields distinct **appearance IDs** but the same **semantic IDs**. Font styling is contained so one nested chart's stylesheet cannot globally style the whole parent. Child SVGs are produced by the installed renderer, not loaded from arbitrary untrusted URLs.

The parent semantic fingerprint includes source objects and relationships reachable through its child views. Changing a child-only measurement changes that fingerprint and the rendered output. Source maps are recursively collected for internal editing. Aggregated marks retain contributor IDs; selecting an aggregate does not create an independently editable total.

Scene output includes `subdiagrams` and source-bound child marks. SVG interactions include `data-child-view`, enabling the host to navigate to that original view. The laboratory's **Open selected child view** action opens the full child example. Specialized matrix-cell mutation from a child dashboard is deliberately not inferred in the parent: open the child view or edit its source so the correct data/write-back contract is validated. Full source navigation remains available.

Parent and child validation are performed before output. Profile/projection **redacted export remains fail-closed**; nesting cannot bypass that gate. The editor workspace may contain confidential source, and hiding a child/field is not access control. Supply only authorized source to a public browser. No external assets or network privileges are conferred by a child-view reference.

## 24.3 Binary Chen profile completion

`chen.basic@1` remains the earlier scalar/binary profile. `chen.binary@2` adds:

| Definition | Metadata and visual meaning |
|---|---|
| Weak entity | `x_chen:{weak:true,owner:@entity}`; double entity border. |
| Identifying relationship | `x_chen:{identifying:true,owner:@entity,weak:@weak,...}`; double diamond and doubled total-participation connection to the weak entity. |
| Key field | `x_chen:{key:true}`; underlined label. |
| Partial key | `x_chen:{partial_key:true}` on weak-entity field; dashed underline. |
| Composite attribute | Actual nested fields plus `x_chen:{composite:true}` on their parent. Child ovals attach to the parent attribute identity. |
| Multivalued attribute | `x_chen:{multivalued:true}`; double oval. |
| Derived attribute | `x_chen:{derived:true}`; dashed oval. |
| Binary participation | Relationship `from` and `to` records with nonnegative integer `min` and integer `max` or `max:many`. |

For a relation A→B, `from` is the number of A instances allowed per B, and `to` the number of B instances allowed per A. Min/max text is placed on its corresponding leg through the relationship diamond. `many` prints as N. This is not row-count metadata or arrow direction.

Every visible binary relation in this profile must have both participation annotations. An identifying relationship must connect its declared weak entity to that entity's declared owner. Each weak instance has exactly one owner: the **owner-end** multiplicity is 1..1. Each selected weak entity has one visible identifying relationship and a visible owner; ownership cycles fail. It needs a partial key. Derived or multivalued fields cannot simultaneously be full/partial keys. Partial keys cannot be declared on strong entities. Composite flags must match actual child fields.

The original entity and field IDs survive the projection. Generated attribute/relationship occurrences and their connections are not persisted as additional logical entities. General arbitrary n-ary relationships, multiple identifying owners, all textbook variants, relational inference and external interchange remain outside this binary profile. The document does not claim complete Chen-theory validation of business identity decisions.

## 24.4 Use-case subject and extension semantics

The additive `uml.usecase@2` profile uses `uml.subject`, `uml.actor`, and `uml.usecase`, with existing participation, include, extend and same-kind generalization relations. Each selected use case declares a nonempty `x_usecase.subjects` list of distinct subject references. An actor is not a server or a data table.

A use case may declare distinct named `extension_points`. An `uml.extend` relation must carry `x_usecase.extension_point` naming a point on its target plus either a nonempty prose `condition` or a resolvable `condition_ref`. It cannot carry both. Conditions are requirements, not evaluated guards. Include/extend endpoints share a declared subject in this installed profile. Include/generalization cycles and endpoint compatibility retain their existing checks. A subject frame may not contradict the use case's declared membership.

```ddn
object review "Review lot" {
    kind: "uml.usecase";
    x_usecase: {subjects:[@subject],extension_points:["before disposition"]};
}
relation escalation "Escalates when necessary" @escalate -> @review {
    kind: "uml.extend";
    x_usecase: {
        extension_point:"before disposition",
        condition:"The declared review policy requires escalation."
    };
}
```

Extension-point compartments are measured inside the ellipse. The supplied fixture groups actors separately so its subject frame does not visually claim to contain them. A graph frame is not a general compound-layout solver; profiles cannot guarantee every arbitrary placement choice communicates membership correctly. Hard placement constraints remain enforceable, and profile diagrams require review of boundary geometry.

This is a useful explicit use-case subset aligned with selected concepts from UML [Q6], not full UML semantics, an XMI adapter, or an independent UML conformance certificate.

## 24.5 Documented flowchart profile

`flow.documented@2` retains the earlier decision/terminal/process/document/I-O/subprocess profile and adds `flow.connector`, `flow.offpage`, `flow.storage`, and `flow.annotation`. Storage is rendered with a cylinder motif. Annotation uses a bracketed note and `flow.annotation` attachment, and is not counted as an unreachable control-flow process.

An off-page connector has `x_continuation:{key,side:"in"|"out",page?:text}`. A declared key has one out and one in definition, joined by an explicit `flow.continues` relation. Out connectors only send this continuation; in connectors only receive it. Unmatched keys, contradictory directions, unsupported relation kinds or unattached annotations fail.

Both endpoints are shown in the supplied review view for validation. `page` is an explanatory label; it does not automatically paginate the graph or generate an external hyperlink. Full publication-specific cross-sheet continuation placement remains future work. Existing reachability, endpoint, branch, routing and page checks still apply to the actual control subset; annotation attachments do not imply control execution.

## 24.6 Integration and acceptance

The SDK remains `DDNLive`, with one global build and an ESM facade. All old 0.2–0.4 source remains accepted; these additions use version 0.5 and versioned installed profile IDs. Schemas accept recursive compiled child view records only within runtime depth/budget checks. No arbitrary source-defined shape code or remote plugin installation is introduced.

Studio retains raw script, file/folder/ZIP/JSON opening and downloads. New matrix editing and raw record/rule editing write source spans with undo. The capability list disables graph placement for quantitative/matrix/panel/fishbone views. Child data never becomes editable just because it appears inside a selectable SVG.

The mandatory corpus includes a dashboard using Pareto/histogram/heatmap/lifecycle children; the same child repeated twice; child-only data changing parent fingerprints; all IDs/references resolving; cycle/depth rejection; fixed-page readability rejection; source links and downloads; unchanged purchasing-route efficiency; weak-key and extension-point negatives; annotation and continuation checks. Each build regenerates runtime, websites, portable pages, source/output hashes and static fallbacks from the same code.

[Q6] OMG UML 2.5.1 specification page and normative artifacts: https://www.omg.org/spec/UML/2.5.1/About-UML (checked 2026-09-08). No OMG artwork or proprietary implementation is copied.
