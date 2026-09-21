# Data refresh (live dashboards)

B1-006 added `ws.replaceData(name, records)`: swap the records of a named
`data` block while leaving every other byte of the source untouched. It is
the supported way to drive a live diagram from changing data — the model,
views, layout structure, pins, and format bundles all survive; only the
record payload changes.

## The contract

- `name` is the data block's declared name (e.g. `data metrics { … }` →
  `"metrics"`).
- Each record is a plain object. Records must carry the **same keys as the
  block's existing first record** — a missing or extra key throws `DDN-E011`
  (verified in `notation/tests/data-refresh.js`). No silent shape drift.
- The call returns `{ revision, diagnostics }` and bumps the workspace
  revision, so `subscribe` listeners and mounted elements re-render
  automatically.
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
    ws.replaceData("metrics", rows.map(d => ({ label: d.route, value: d.p95, unit: "ms" })));
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

- `examples/embed/data-refresh.html` — a browser proof over
  `ddn-core.js` + `ddn-graph.js` + `ddn-projections.js`: a button swaps the
  `metrics` records of an inlined copy of `examples/basics/59-data-refresh.ddn`
  and re-renders in place.
- `examples/basics/59-data-refresh.ddn` — the two-view source (a bar chart
  and a dependency graph over the same data block).
- `notation/tests/data-refresh.js` — the contract tests, including the
  `DDN-E011` shape-mismatch rejections.

## When not to use it

`replaceData` replaces *records*, not structure. New objects, new relations,
renamed fields, or view changes are authoring operations — use
`applyEdits`/`updateFiles` or the `authoring` façade (see
[api-reference.md](api-reference.md)).
