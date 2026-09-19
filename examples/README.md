# Example diagrams

Runnable `.ddn` sources, grouped by purpose. Render any of them with the CLI:

```sh
node ../notation/cli/cli.js render basics/05-flow.ddn --workspace . --out /tmp/flow.svg
node ../notation/cli/cli.js render projections/views.ddn --workspace . --view raci --out /tmp/raci.svg
```

- `basics/` — 35 numbered examples (01-customer … 35-journey-map)
  plus shared modules (`shared.ddn`, `customer-data.ddn`) and `manifest.json`.
  Covers elements, routing, looks, hand-drawn style, layouts, nested fields,
  publication, authorized export, process contracts, enterprise gates, curved
  relations, radar charts, funnel charts, gauge charts, candlestick charts,
  treemaps, Sankey diagrams, C4-style context/container/component views, and
  top-down organisation charts, work breakdown structures, mind maps,
  concept maps, EPC process chains, canvas packs (BMC/Lean plus
  environmental-scan and five-forces canvases), strategy quadrant
  matrices (BCG/Ansoff/TOWS), empathy maps and scorecards, and journey maps.
- `projections/` — one model projected into RACI/CRUD/DFD/ERD/Chen/UML/etc.
  views (`model.ddn`, `views.ddn`, `formats.ddn`, `catalogue.json`).
- `quality/` — quality/lifecycle/reporting examples (`model.ddn`,
  `details.ddn`, `formats.ddn`, `views.ddn`, `fixture.json`, `catalogue.json`).
- `use-cases/` — 22 scenarios (whiteboard, ERD, relational, SQL dependencies,
  documents, graph schema, streaming, lineage, governance, security,
  recovery, migration, …) with shared `data/` modules and `formats.ddn`.

All data is synthetic. Regenerated `rendered/` outputs are intentionally not
committed; produce them locally with the commands above.
