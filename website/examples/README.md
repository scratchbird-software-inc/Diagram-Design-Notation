# Example diagrams

Runnable `.ddn` sources, grouped by purpose. Render any of them with the CLI:

```sh
node ../../notation/cli/cli.js render basics/05-flow.ddn --workspace . --out /tmp/flow.svg
node ../../notation/cli/cli.js render projections/views.ddn --workspace . --view raci --out /tmp/raci.svg
```

- `basics/` — 61 numbered examples (01-customer … 61-self-contained)
  plus shared modules (`shared.ddn`, `customer-data.ddn`). (The import-era
  `manifest.json` was removed in B1-010: it covered only examples 01–18,
  pointed at nonexistent `examples/rendered/` paths, was stamped
  `0.5.0-draft.1`, and nothing in the repo referenced it — the live golden
  manifest is `use-cases/manifest.json`.)
  Covers elements, routing, looks, hand-drawn style, layouts, nested fields,
  publication, authorized export, authorized SQL DDL export, process contracts,
  enterprise gates, curved
  relations, radar charts, funnel charts, gauge charts, candlestick charts,
  treemaps, Sankey diagrams, C4-style context/container/component views, and
  top-down organisation charts, work breakdown structures, mind maps,
  concept maps, EPC process chains, canvas packs (BMC/Lean plus
  environmental-scan and five-forces canvases), strategy quadrant
  matrices (BCG/Ansoff/TOWS), empathy maps and scorecards, journey maps,
  story maps, crow's-foot ERD, pyramid diagrams, venn diagrams,
  sequence-style and communication interaction diagrams, and object/instance
  snapshots, hierarchical state machines, activity diagrams with partitions,
  BPMN-style collaborations, and timing/state-over-time diagrams,
  SysML-style block diagrams, PERT/CPM critical-path views
  (`52-pert-cpm.ddn`), and fault/event trees (`53-fault-event-tree.ddn`), and network/bus and
  rack diagrams (`54-network-diagram.ddn`), and low-fidelity UI wireframes
  (`55-wireframe.ddn`), and family tree / genealogy views
  (`56-family-tree.ddn`), and registry-driven element defaults
  (`57-element-defaults.ddn`), and CSS class hooks for host-page styling
  (`58-css-hooks.ddn` + companion `.html`), and data refresh via
  `ws.replaceData` (`59-data-refresh.ddn`), and spacing hints
  (tight/normal/loose/expanded) on views and formats (`60-spacing-hints.ddn`),
  and a three-section self-contained file (model + data + views, no imports;
  RFC-117) (`61-self-contained.ddn`).
- `projections/` — one model projected into RACI/CRUD/DFD/ERD/Chen/UML/etc.
  views (`model.ddn`, `views.ddn`, `formats.ddn`, `catalogue.json`).
- `quality/` — quality/lifecycle/reporting examples (`model.ddn`,
  `details.ddn`, `formats.ddn`, `views.ddn`, `fixture.json`, `catalogue.json`).
- `gallery/` — generated full-coverage gallery (B1-010): one pre-rendered SVG
  per installed profile (all 73) plus variation sheets (chart marks, looks ×
  palettes, routing × look, layout algorithms, spacing levels) — 130 SVGs via
  the real CLI render path, a static `index.html` (no inlined runtime,
  `file://`-safe), and `coverage.json`, the machine-readable coverage map the
  permanent gate `notation/tests/gallery-coverage.js` enforces. Sources for
  the variation sheets live in `gallery/src/`. Regenerate with
  `npm run build:gallery` (committed outputs per D5).
- `embed/` — browser proofs for the modular runtime bundles (B1-004):
  `core-graph.html` loads only `ddn-core.js` + `ddn-graph.js` and renders the
  `basics/01-customer.ddn` overview; `core-only-check.html` loads only
  `ddn-core.js`, checks the same source and shows the coded `DDN-E010` refusal
  when a render is attempted without a renderer bundle; `data-refresh.html`
  (B1-006) loads `ddn-core.js` + `ddn-graph.js` + `ddn-projections.js` and
  swaps a chart's data-block records with `ws.replaceData` on a button click,
  re-rendering in place.
- `use-cases/` — 22 scenarios (whiteboard, ERD, relational, SQL dependencies,
  documents, graph schema, streaming, lineage, governance, security,
  recovery, migration, …) with shared `data/` modules and `formats.ddn`.

All data is synthetic. Regenerated `rendered/` outputs are intentionally not
committed; produce them locally with the commands above.
