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

The field shape of a data block is declared by its records: every incoming record must carry the same keys as the block's existing first record (order-insensitive). Violations fail with coded error `DDN-E011`; an unknown or ambiguous block name fails with `DDN-E002`. On any error the source is untouched.

Refresh is keyed and transactional (B1-029):

- **Stable record keys (D1).** Records match by key, not position. An incoming record may carry a refresh-level `key` field naming the declaration id of the record it updates (e.g. `key: "m2"` targets `object m2 …`). Keys are all-or-nothing across one call, must be valid unique nonreserved DDN identifiers, and are stripped from the written record payload. A key matching an existing record updates it in place; an unknown key appends a new record declaration with that id; existing records no key matches are removed. When no keys are declared the refresh falls back to positional matching, which is **order-sensitive**: the i-th incoming record rewrites the i-th declared record, surplus incoming records append deterministically named declarations (`<block>_r<N>`), and trailing existing records are removed.
- **Membership rules (D2).** A view's record set is re-resolved after every refresh. Views that select the block (`data: [@metrics]`) have *selector membership* and pick up added records automatically. Views that bind records explicitly (`records: [@metrics.m1, …]`, matrix rows/columns, timeline records) have *explicit membership* and keep exactly their bound records — this is by design, and the refresh result REPORTS it: for each explicit-membership view that does not bind an added record, the result carries a `DDN-W015` warning diagnostic with `addedRecordsNotVisible` naming the invisible record keys.
- **Transactional validation at commit (D3).** Before anything commits, the refresh validates every workspace view that currently builds against the candidate source (reference resolution plus projection validation), and validates each incoming field value against the field types inferred from the block's existing records (`null` is UNKNOWN: a field observed as `null` accepts any later type, and incoming `null` is always legal). On failure NOTHING is committed — revision and source are untouched — and the result carries structured `DDN-E012` diagnostics naming the view (where applicable), the record key, the field and the failure (`type-mismatch`, `removed-record-referenced`, `view-validation`, `source-validation`). Malformed input (bad shape, non-scalar values, unknown block) keeps throwing coded errors as before.
- **Removal semantics (D4).** Removing a record that a view still references is REJECTED transactionally with a `removed-record-referenced` diagnostic naming the view and the record key. Record-level absence is never rendered as an invented value.
- **Empty result sets (D5).** A record block MAY be refreshed to empty; the removal rules above still apply, so an empty refresh commits only when no view binds the block's records explicitly. Views render their empty state: a selector-membership graph renders an empty canvas with title; a chart or table authored with an intentionally empty `records: []` renders an empty plot with axes (bar/line/area/point marks) or a header-only table — UNKNOWN-not-zero semantics, never fabricated data. Filtering a non-empty record set to zero still fails (`DDN-PJ012`): an empty filter result is a misleading picture, an empty declaration is an honest one.
- **Result object (D6).** `replaceData` returns `{ committed, revision, added, removed, updated, diagnostics }`. `added`/`removed`/`updated` list the affected record keys; `committed:false` with populated `diagnostics` means the source is byte-untouched. The previous `{revision, diagnostics}` shape is a strict subset, so existing callers are unaffected.

Refresh is deterministic: the output source depends only on (source, name, records). Re-rendering after a same-values (deep-equal) refresh produces byte-identical SVG for every view; after a changed-values refresh, graph views without data binding render byte-identical while chart/matrix/timeline views differ only in mark geometry and value labels.

The palette is populated from the same trusted kind/relation definitions. Dotted names are inserted as strings. Pins/drag-to-pin are disabled for data-bound and generated Chen views; dates and numeric coordinates must be changed in their records, not by grabbing marks. The source editor remains universal; complete drag-to-edit matrix cells, widget drawing, interval resizing and arbitrary shape recipe inspectors are not implemented.

## Capability-aware controls

The viewer derives whether fields, paths, legends, pins and auto-placement are meaningful from the projection. Chart marks additionally depend on x type. Unsupported choices are disabled in the controls and rejected through the API. UI disablement alone is not a validator or security boundary.

View-specific override state and shared source state remain separate. Reset appearance does not discard edited data. Changes of look/palette/page and supported mark regenerate SVG; zoom changes viewport magnification only. Multiple mounted views share the workspace but own their presentation and lifecycle resources.

## Security and deployment

The runtime does not fetch imports or execute DDN as JavaScript. Trusted source paths remain workspace-relative. The new scalar bindings reject prototype names; labels are XML-escaped. Existing component insertion strips active SVG content and scopes IDs. These are tested mitigations, not a complete hostile-input or strict-CSP certification.

Redacted profile/projection outputs are explicitly blocked until their authorized occurrence closure is qualified. Send only authorized source to public browsers. The core existing allowlist graph exporter is retained and regression-tested. No API override can turn off its policy.

The self-contained lab and Studio avoid separate local CSS/image access, but a multi-file project should normally be served through `npm run serve`. Browser test reports identify whether normal HTTP navigation worked or injected assets were used. No unexecuted cross-browser test is counted as a success.
