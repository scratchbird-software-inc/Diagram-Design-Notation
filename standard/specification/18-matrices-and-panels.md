# 18. Matrices, record tables and panels

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


## 18.1 Relationship matrices

A matrix projection declares ordered `rows`, ordered `columns`, `relation` and `value`. A relationship contributes only when its source is a declared row and its target is a declared column. Direction is not guessed or reversed. Matrix values come from properties of that relationship; row and column captions come from their source elements.

```ddn
projection responsibilities {
    kind: matrix;
    profile: "matrix.raci@1";
    rows: [@process.order, @process.receive];
    columns: [@roles.buyer, @roles.manager, @roles.warehouse];
    relation: "analysis.assignment";
    value: "x_assignment.code";
}
```

The referenced assignments are ordinary shared semantic relationships:

```ddn
relation order_owner "Own purchase approval" @process.order -> @roles.manager {
    kind: "analysis.assignment";
    x_assignment: { code: "A" };
}
```

The default duplicate-cell policy is `error`. `matrix.relations@1` can explicitly set `duplicates:join`, in which case all contributing IDs and values remain present. RACI/CRUD do not permit that escape hatch. Blank cells mean no matching assignment, not an invented empty relationship.

`matrix.raci@1` requires exactly one A and at least one R per row, with individual assignment codes R, A, C or I. This is this profile's policy; combined RA codes or alternative organizational policies require another reviewed profile. `matrix.crud@1` accepts distinct C/R/U/D letters and rejects repeats or unknown codes. These codes describe intended access; they do not issue database grants.

Column widths, row heights and wrapped captions derive from contents. A cell keeps its relationship provenance; a chart or matrix is not a separately maintained truth. Selecting a cell can reveal its assignments, and the inspector can edit an existing single assignment code. Creating an assignment in an empty cell and drag-based row/column editing remain source operations in this release.

### Quadrant strategy matrices

The profiles `matrix.bcg@1`, `matrix.ansoff@1` and `matrix.tows@1` reuse the same matrix projection as fixed 2×2 strategy matrices. Each declared row and column element carries the registered extension record `x_category: {axis, level}` naming the axis it sits on and its level on that axis. Each profile pins an exact category set: BCG rows are `growth` levels `high`/`low` and columns are `share` levels `high`/`low`; Ansoff rows are `market` levels `existing`/`new` and columns are `product` levels `existing`/`new`; TOWS rows are `internal` levels `strength`/`weakness` and columns are `external` levels `opportunity`/`threat`. A wrong count, a missing `x_category`, a wrong axis, or an unknown or duplicated level is rejected as `DDN-PJ082`; the declared `rows`/`columns` array order remains the display order. Cells are ordinary relations between a row category and a column category whose `name` is the item label, bound with `value:"name"`; these profiles allow `duplicates:join`, so several declared items can share one quadrant. Quadrant cells are declared items, not computed positions — the profiles do not compute market share, infer SWOT entries, or recommend strategy.

### Story maps

`matrix.storymap@1` reuses the matrix projection as a user story map. Rows are ordered releases with the first release on top (display order is the declared `rows` array order), and columns are ordered backbone activities (`analysis.task` objects). The binding is fixed: `relation:"assoc"` and `value:"x_story.task"`; any other relation or value is rejected as `DDN-PJ014`. Each cell is a declared `assoc` relation from a release to a backbone activity carrying `x_story: { task: @story }`, where the referenced story must be a selected `analysis.task` object — anything else fails as `DDN-PJ093`, and references outside the view's data scope fail as `DDN-PJ007` like any other projection binding. One story occupies one cell: placing the same story in two releases, or twice within one release, is rejected as `DDN-PJ086` with a message naming the story and the releases. The cell keeps the story element id as its provenance (with the placing relation retained as `relationId`), so selecting a cell reveals the story object. The profile renders the map only; estimation or velocity math, backlog ranking and tracker synchronization are out of scope.

## 18.2 Record tables and decision-table presentations

`table.records@1` declares `records` and a `columns` array of `{key,label}`. Keys must be distinct safe property paths. Values must be scalar; `null` is displayed explicitly, missing values error unless `missing:blank` is selected. This differs from missing versus null in a schema definition, which retains the original core semantics.

A table can display decision conditions, actions, priorities and expected outcomes. They are strings and values. It is **not** a DMN decision table or an executable rule engine, and does not infer hit policy, coverage or conflict-freedom. The sample `decision_table` is labeled accordingly.

Optional `filter:{key,op:eq|in,value}` and `order:{key,direction:asc|desc}` operate only on the supplied records, with stable tie order. No arbitrary expressions or network loaders are enabled.

## 18.3 Panel composition

`panels.basic@1` declares 1–12 columns and explicit panel records with `id`, `title`, zero-based `row` and `column`, positive integer `rowspan`/`colspan`, and `items:[references]`. Panel spans must not overlap or extend past the declared columns. Repeating a semantic item in different panels is permitted and produces separate visual occurrences with the same source identity.

Titles, item labels and descriptions wrap to measured panel width. Row heights expand to fit spanning content. A `value` property can select a scalar field for panel item text; otherwise the item description is used. The layout supports spans but **not recursive independent child views, widget composition, arbitrary charts in cells or browser-resize reflow**. Those are planned separate increments.

The examples provide SWOT, SIPOC and a service journey. Their conventional labels are templates over this reusable compositor. They do not automate strategy evaluation or represent independently certified method implementations.

`canvas.bmc@1` and `canvas.lean@1` bind the two canonical nine-block strategy canvases to fixed 10-column panel grids. The BMC blocks are `kp` (key partners), `ka` (key activities), `kr` (key resources), `vp` (value propositions), `cr` (customer relationships), `ch` (channels), `cs` (customer segments), `cost` (cost structure) and `rev` (revenue streams); the Lean Canvas blocks are `problem`, `solution`, `keymetrics`, `uvp`, `unfair`, `channels`, `segments`, `cost` and `revenue`. All nine block panels must be present; the first absent block fails with `DDN-PJ080`, naming the missing panel id and title. Extra annotation panels are permitted; grid and span errors keep the generic `DDN-PJ020`/`DDN-PJ021`/`DDN-PJ009` codes. These profiles are templates over the panel compositor — they do not automate strategy evaluation or represent independently certified method implementations.

`canvas.pest@1`, `canvas.pestle@1` and `canvas.porter5@1` bind environmental-scan and five-forces canvases to fixed panel templates on the same compositor. The PEST panels are `political`, `economic`, `social` and `technological` in one four-column strip; PESTLE adds `legal` and `environmental` on a three-column, two-row grid; Porter's five forces places `rivalry` at the center with `entrants`, `supplier`, `buyer` and `substitutes` around it on a three-column grid. All required panels must be present; the first absent panel fails with `DDN-PJ081`, naming the missing panel id and title. Extra annotation panels are permitted; grid and span errors keep the generic codes. These profiles do not score or weight forces and do not represent independently certified method implementations.

`canvas.empathy@1` and `canvas.scorecard@1` bind empathy maps and balanced scorecards to fixed two-column panel templates on the same compositor. The empathy template places the `says` and `thinks` quadrants on the top row, a full-width `persona` band (`colspan:2`) across the middle, and the `does` and `feels` quadrants on the bottom row; panel items are declared notes. The scorecard template places the `financial`, `customer`, `internal` (internal process) and `learning` (learning & growth) perspectives in a two-by-two grid; each panel's item list states declared objectives, not computed KPIs — the profile does no KPI computation, target tracking or strategy execution. All required panels must be present; the first absent panel fails with `DDN-PJ083`, naming the missing panel id and title. Extra annotation panels are permitted; grid and span errors keep the generic `DDN-PJ020`/`DDN-PJ021`/`DDN-PJ009` codes.

### Journey maps

`panels.journey@1` binds a customer journey map to a fixed phase/lane grid on the same compositor. The projection declares 2–8 `columns` (the phase count P). Row 0 carries exactly P phase header panels `phase-<slug>` (slug matching `^[a-z][a-z0-9-]*$`, unique, one per column in column order); rows 1–3 carry the `actions`, `touchpoints` and `opportunities` lanes with exactly one `<lane>-<slug>` panel per phase column; row 4 is the single full-width panel `emotions` (`row:4, column:0, colspan:P`). Any violation of this grid — a missing or misplaced phase header, lane panel or emotions band, an unexpected extra panel, or a column count that does not match the declared phases — fails with `DDN-PJ085`, naming the specific problem. Every panel still keeps at least one item under the generic `DDN-PJ009` rule; phase and lane panels intentionally carry note items.

Emotion items are records whose existing `x_record` extension contract carries `phase` (a declared phase slug) and `value` (a finite number in 1–5 inclusive, else `DDN-PJ084`). Items must appear in non-decreasing phase column order in the declared items array; an out-of-order item or an unknown phase slug fails with `DDN-PJ085`. The emotions band renders the declared values as a straight-segment polyline across the phase column centers on a 1–5 gridline scale with a numeric label per point — no curve smoothing, per-channel heatmaps or automatic sentiment analysis. The values are declared experience data, not sentiment inference.

## 18.4 Editing and export

Source remains editable as raw DDN with undo/redo and workspace import/export. The specialized record and assignment inspector writes validated source changes, not computed scene values. An aggregated mark has multiple contributor IDs; individual records can be inspected. It is never edited as an independent total.

Validation of a guided edit is atomic for the current view. Other dependent views are revalidated on their next render; the editor does not currently promise a transaction that validates every view in an arbitrary workspace before accepting a source edit. Raw source edits intentionally allow invalid drafts. Unsupported public/redacted projections fail closed. Full source downloads are not redacted publication.
