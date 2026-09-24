# Data refresh (live dashboards)

B1-006 added `ws.replaceData(name, records)`: swap the records of a named
`data` block while leaving every other byte of the source untouched. B1-029
made the refresh **keyed and transactional**. It is the supported way to
drive a live diagram from changing data — the model, views, layout structure,
pins, and format bundles all survive; only the record payload changes.

## The contract

- `name` is the data block's declared name (e.g. `data metrics { … }` →
  `"metrics"`).
- Each record is a plain object. Records must carry the **same field keys as
  the block's existing first record** — a missing or extra key throws
  `DDN-E011` (verified in `notation/tests/data-refresh.js`). No silent shape
  drift.
- **Stable record keys.** An incoming record may carry a refresh-level `key`
  field naming the declaration id it updates (`key: "m2"` → `object m2 …`).
  Keys are all-or-nothing per call, must be valid unique DDN identifiers, and
  are stripped from the written payload. A matching key updates in place; an
  unknown key appends a new declaration with that id; an existing record no
  key matches is removed. Reordered payloads therefore **cannot corrupt
  identities**. Without keys, matching is positional and *order-sensitive*.
- **Transactional commit.** Before anything commits, the refresh checks each
  incoming field value against the field types inferred from the block's
  existing records (`null` is UNKNOWN — always accepted, and a `null`-observed
  field accepts any later type) and validates every workspace view against the
  candidate source. On failure **nothing is committed** and the result carries
  structured `DDN-E012` diagnostics naming the view, the record key, the field
  and the failure (`type-mismatch`, `removed-record-referenced`,
  `view-validation`, `source-validation`).
- **Removal semantics.** Removing a record a view still references is
  *rejected* transactionally — there is no committed-then-`DDN031` state.
- **Membership rules.** Views that select the block (`data: [@metrics]`) have
  *selector membership* and pick up added records automatically. Views that
  bind records explicitly (`records: [@metrics.m1, …]`, matrix rows/columns)
  keep exactly their bound records — by design — and the result reports it
  with a `DDN-W015` warning carrying `addedRecordsNotVisible`.
- **Empty result sets.** A block MAY be refreshed to empty (subject to the
  removal rule). Selector views render an empty canvas; charts/tables authored
  with an intentionally empty `records: []` render an empty plot with axes
  (bar/line/area/point) or a header-only table. Filtering a non-empty set to
  zero still fails `DDN-PJ012` — an empty declaration is honest, an empty
  filter result is misleading.
- The call returns
  `{ committed, revision, added, removed, updated, diagnostics }`
  (a strict superset of the pre-B1-029 `{ revision, diagnostics }`) and bumps
  the workspace revision when it commits, so `subscribe` listeners and
  mounted elements re-render automatically. When `committed` is `false`, the
  source and revision are byte-untouched.
- Both object records (`x_record` on `object`) and relation records are
  supported.

## Dashboard recipe

```html
<div id="chart"></div>
<script src="notation/dist/ddn.global.js"></script>
<script>
  const ws = DDNLive.createWorkspace({ "dash.ddn": source });   // declares data metrics {…}
  const diagram = DDNLive.mount(document.getElementById("chart"), {
    workspace: ws, entry: "dash.ddn", view: "latency_chart"
  });

  async function poll() {
    const rows = await fetch("/api/latency").then(r => r.json());
    const result = ws.replaceData("metrics", rows.map(d => ({ key: d.id, label: d.route, value: d.p95, unit: "ms" })));
    if (!result.committed) console.warn("refresh rejected", result.diagnostics);
    // mounted diagram re-renders on its own; nothing else to call
  }
  setInterval(poll, 5000);
</script>
```

For headless use, call `renderSync` after each `replaceData` and diff
`modelFingerprint` if you want to prove the model did not change:

```js
const before = ws.renderSync({ entry: "dash.ddn", view: "latency_chart" }).modelFingerprint;
ws.replaceData("metrics", nextRows);
const after = ws.renderSync({ entry: "dash.ddn", view: "latency_chart" });
console.assert(before === after.modelFingerprint, "data-only change");
```

## Complete working examples

- `website/examples/embed/data-refresh.html` — a browser proof over
  `ddn-core.js` + `ddn-graph.js` + `ddn-projections.js`: buttons swap,
  reorder (keyed), add/remove, and empty the `metrics` records of an inlined
  copy of `website/examples/basics/59-data-refresh.ddn` and re-render in
  place, printing the result object each time.
- `website/examples/basics/59-data-refresh.ddn` — the two-view source (a bar
  chart and a dependency graph over the same data block).
- `notation/tests/data-refresh.js` — the contract tests, including the
  `DDN-E011` shape-mismatch rejections, keyed-reorder identity preservation,
  transactional type/reference rejection, membership reporting, and the
  empty-state proofs.

## When not to use it

`replaceData` replaces *records*, not structure. New objects, new relations,
renamed fields, or view changes are authoring operations — use
`applyEdits`/`updateFiles` or the `authoring` façade (see
[api-reference.md](api-reference.md)).
