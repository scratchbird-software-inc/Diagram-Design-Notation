# 20. Projection SDK and source editing

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


The existing `DDNLive` public library is extended, not replaced. `createWorkspace`, `mount`, `renderSync`, `render`, source workspace upload/download, validation, undo/redo and source navigation retain their original roles. The default script build includes the trusted catalogue, projection planner, native renderers and controls in one JavaScript file. The `.mjs` entry is still a facade; this is not a tree-shaken modular rewrite or an npm publication.

## New public interfaces

```javascript
const workspace = DDNLive.createWorkspace(files);
const plan = workspace.projectionPlan('views.ddn', 'raci');
const result = workspace.renderSync({entry:'views.ddn', view:'chart_bar'});
const externalSpec = workspace.exportVegaLite({entry:'views.ddn', view:'chart_bar'});

const diagram = DDNLive.mount(container, {
    workspace, entry:'views.ddn', view:'chart_bar'
});
await diagram.setOptions({mark:'donut', theme:'night'});
```

These methods execute real source resolution and validation. `render` remains an async-shaped interface over bounded synchronous work, not a web worker. Native and external chart export paths are distinct. The adapter does not inherit DDN page guards or editor control semantics.

`result.scene.marks` contains rendered occurrence identifiers, contributor `sourceIds`, optional property bindings and geometry. `scene.projection` identifies kind/profile/quantitative status. Generated Chen nodes and links carry a mapping to the original source identities. The base modelFingerprint is independent of view appearance and generated scene objects.

`ddn-select` includes the semantic ID, occurrence ID, contributor IDs, optional property binding and source span. Consumers must not assume every clickable object is a movable graph node. Aggregates are inspectable through their contributors; no API mutates an invented aggregate record.

## Studio

The source editor accepts raw single/multiple DDN files, folder uploads, workspace ZIPs and workspace JSON. Downloads contain current source or the current successful SVG. Full source snapshots are internal artifacts. Invalid source drafts remain editable; a stale previous SVG is marked stale and cannot be exported as current.

The inspector can edit scalar `x_record` properties and existing `x_assignment.code` assignments with validated, undoable source transactions. It updates the original shared definitions. A graph and RACI view of the same assignments, or a table and chart of the same observations, therefore resolve from the same truth.

```javascript
DDNLive.authoring.setRecordValue(workspace, 'views.ddn', 'chart_bar',
    'meridian.procurement.review::facts.m1', 'value', 840);
DDNLive.authoring.setAssignment(workspace, 'views.ddn', 'raci',
    'meridian.procurement.review::responsibilities.post_c', 'I');
```

Guided changes validate against the current view before commit. They preserve unrelated source spans and comments, but replacing a structured literal may reformat that literal and does not guarantee preservation of comments within it. Other dependent views validate on subsequent render. A complete multi-view transactional consistency engine and semantic identifier refactoring remain future work.

## Data refresh

A host page can replace the records of a named `data` block without touching the model, views, layout structure or any other declaration. `workspace.replaceData(name, records)` locates the named block across the workspace, rewrites only its record lines (declarations carrying an `x_record` value record) using the same canonical serializer as the other authoring writes — same key order as the incoming objects, same scalar formatting — and applies one validated source transaction, returning `{revision, diagnostics}`. There is no change-event API: hosts call `replaceData` and then render or mount again. The dashboard recipe is three lines:

```javascript
workspace.replaceData('metrics', rows);
const result = workspace.renderSync({entry:'views.ddn', view:'chart_bar'});
container.innerHTML = result.svg;
```

The field shape of a data block is declared by its records: every incoming record must carry the same keys as the block's existing first record (order-insensitive), and an empty replacement is legal only when the block already declares zero records. Violations fail with coded error `DDN-E011`; an unknown or ambiguous block name fails with `DDN-E002`. On any error the source is untouched. Record counts may change: surplus incoming records append deterministically named record declarations, and trailing existing records are removed — views that still bind removed records then fail validation at render, by design.

Refresh is deterministic: the output source depends only on (source, name, records). Re-rendering after a same-values (deep-equal) refresh produces byte-identical SVG for every view; after a changed-values refresh, graph views without data binding render byte-identical while chart/matrix/timeline views differ only in mark geometry and value labels.

The palette is populated from the same trusted kind/relation definitions. Dotted names are inserted as strings. Pins/drag-to-pin are disabled for data-bound and generated Chen views; dates and numeric coordinates must be changed in their records, not by grabbing marks. The source editor remains universal; complete drag-to-edit matrix cells, widget drawing, interval resizing and arbitrary shape recipe inspectors are not implemented.

## Capability-aware controls

The viewer derives whether fields, paths, legends, pins and auto-placement are meaningful from the projection. Chart marks additionally depend on x type. Unsupported choices are disabled in the controls and rejected through the API. UI disablement alone is not a validator or security boundary.

View-specific override state and shared source state remain separate. Reset appearance does not discard edited data. Changes of look/palette/page and supported mark regenerate SVG; zoom changes viewport magnification only. Multiple mounted views share the workspace but own their presentation and lifecycle resources.

## Security and deployment

The runtime does not fetch imports or execute DDN as JavaScript. Trusted source paths remain workspace-relative. The new scalar bindings reject prototype names; labels are XML-escaped. Existing component insertion strips active SVG content and scopes IDs. These are tested mitigations, not a complete hostile-input or strict-CSP certification.

Redacted profile/projection outputs are explicitly blocked until their authorized occurrence closure is qualified. Send only authorized source to public browsers. The core existing allowlist graph exporter is retained and regression-tested. No API override can turn off its policy.

The self-contained lab and Studio avoid separate local CSS/image access, but a multi-file project should normally be served through `npm run serve`. Browser test reports identify whether normal HTTP navigation worked or injected assets were used. No unexecuted cross-browser test is counted as a success.
