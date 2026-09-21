# 21. Quality causes, encoded matrices, and source-assignment editing

**DDN 0.6.0-beta.1. Implemented reference contract.** This chapter adds profiles without changing the separation of data, reusable formats, and named views. Source remains UTF-8. Runtime capabilities, examples, validators, and the public library must agree; a source property must not silently select an unimplemented algorithm.

## 21.1 Fishbone / Ishikawa profile

`projection.kind: fishbone` with `profile: "fishbone.basic@1"` selects a measured spine-and-branch projection. Objects have kinds `quality.effect`, `quality.category`, and `quality.cause`. Directed `quality.cause` relations point **from contributing cause to parent cause/category/effect**. The source identifies possible causal relationships; the renderer does not establish their truth. This follows the qualitative cause/category purpose described by ASQ [Q1], not a statistical causality test.

```ddn
projection {
    kind: fishbone;
    profile: "fishbone.basic@1";
    effect: @m.causes.effect;
    relation: "quality.cause";
}
```

`effect` is one selected `quality.effect`. Its first incoming level contains one to twelve `quality.category` definitions. Deeper branches are selected cause definitions. The renderer walks incoming relationships and places alternating categories above and below the spine. Branch hierarchy, label widths, and depth determine spacing. The head contains the effect label. Contour/rib lines are visual representations of the declared relations, not newly created data objects or electrical junctions.

One cause may participate under multiple categories. It remains one semantic object and has several appearance IDs built from its path. A repeated subcause expands under each participating path. Selection maps every appearance to the original cause and contributing relation. A child is not duplicated into the source to satisfy a particular picture.

The profile rejects causal cycles, disconnected selected cause relationships, missing/out-of-view references, field-level endpoints, empty category sets, more than twelve root categories, more than four cause levels, or more than 250 expanded occurrences. These are declared runtime limits, not properties of the Ishikawa method. New graph-placement or hard-position controls are not applicable to the specialized projection; controls must reject them rather than falsely claim to honor pins.

Classic, hand-drawn, and neo treatment affect the furniture and strokes, not parentage. Source order supplies deterministic branch order; other layouts do not infer causal strength. Arbitrarily long labels and very dense cause trees remain subject to measurement and page guards; split the review into linked views rather than shrinking labels into illegibility.

## 21.2 Matrix encodings

The existing matrix planner derives each cell from a relationship kind and row/column identities. The new `matrix.heatmap@1` profile adds an explicit `encoding`. A cell with no source relationship is **missing**, and must remain distinct from a known zero. Numeric strings are not coerced to numbers. More than one contributing relationship is not silently aggregated by this profile.

```ddn
projection {
    kind: matrix;
    profile: "matrix.heatmap@1";
    rows: [@m.responsibilities.inspect, @m.responsibilities.contain];
    columns: [@m.responsibilities.plant_a, @m.responsibilities.plant_b];
    relation: assoc;
    value: "x_record.score";
    write_data: @m.responsibilities;
    encoding: {mode: numeric, domain: [0, 10], palette: blue};
}
```

| Mode | Required parameters | Validity and rendering |
|---|---|---|
| `numeric` | `domain: [low, high]` | Two finite strictly increasing limits. Values outside the domain fail instead of clamping. Intensity is `(value-low)/(high-low)`. |
| `category` | `values: [...]`, `labels: [...]` | Distinct scalar categories with equal-length, nonempty labels. Unmapped values fail. Maximum twelve categories. |
| `bands` | `boundaries: [...]`, `labels: [...]` | Increasing finite bounds; one label for each interval. `[low,high)` except final upper bound inclusive. Values outside all bands fail. |

`palette` chooses a registered `blue` or `diverging` value scale; it does not redefine entity or relation colours. Every encoded cell retains its value/status text and a legend. Missing cells explicitly say no record. A supplied score is not automatically an arithmetic risk measure; its calculation and suitability are data-policy requirements outside the renderer.

The numeric/category assignments are source relations, not a cached numeric array. Cell marks include `rowId`, `columnId`, relationship IDs, the value-binding path and original scalar. Selected cells can be edited through source-aware tools.

## 21.3 Matrix write-back

A matrix view may select `write_data`, a reference to a shared data block explicitly present in that view's `data` collection. If omitted, the authoring layer attempts the unambiguous selected data block containing the first row declaration. If no suitable imported target exists, creation fails and requests an explicit `write_data`. It never silently creates assignments in a view-local block that another view of the shared model cannot see.

```javascript
DDNLive.authoring.setMatrixCell(workspace, "views.ddn", "raci",
    rowId, columnId, "C");
DDNLive.authoring.setMatrixCell(workspace, "views.ddn", "raci",
    rowId, columnId, null, {remove: true});
DDNLive.authoring.setMatrixCells(workspace, "views.ddn", "raci", [
    {row: taskId, column: oldOwnerId, value: "C"},
    {row: taskId, column: newOwnerId, value: "A"}
]);
```

The binding must address a safe extension property, for example `x_assignment.code` or `x_record.score`. A creation inserts a named relationship in the shared data section and uses resolvable source references to both endpoints. Existing assignments update only their selected property. Remove deletes the specific relationship definition. Joined/multisource cells are not directly editable as one assignment. Unknown keys, invalid identifiers, nonfinite values, duplicate cell operations and targets outside the matrix fail before mutation.

A batch contains one to 100 operations and commits atomically after the selected view validates. This supports transferring an accountable role without an intermediate state with zero or two accountable assignments. Undo restores the exact prior source buffers. Other views are revalidated on their next render; this is not yet global transactional validation of all dependent views. Raw source drafts intentionally can remain invalid.

RACI's supplied policy remains exactly one `A` and at least one `R` per row, with only R/A/C/I codes. CRUD accepts distinct C/R/U/D letters. This is an explicit installed policy, not a universal assertion about all organizations' responsibility methods. A colour/style toggle never edits any assignment.

## 21.4 Diagnostics and acceptance

`DDN-QF001..004` cover fishbone references, roles, cycles, expansion limits and disconnected paths. `DDN-QM001..002` cover encoding shape/parameters and incompatible cell values. `DDN-E007` covers guarded matrix editing. General parser, profile, unit, page, and export diagnostics still apply.

Acceptance must include repeated cause identities; cycle/depth rejection; numeric zero versus absent cells; edge-inclusive bands; numeric-string rejection; empty-cell creation observable in a second graph view; invalid RACI creation with no source mutation; batched accountability changes; and exact undo. No image-only fixture can establish these properties.

Source witness: `website/examples/quality/model.ddn`, `views.ddn`; tests: `tests/quality.js`. [Q1] ASQ, Fishbone: https://asq.org/quality-resources/fishbone (checked 2026-09-08). The implementation is original; no ASQ artwork is redistributed.
