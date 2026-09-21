# Data Design Notation (DDN)

A **model-first diagram language** and open standard proposal: you author data,
format, and view declarations separately in plain-text `.ddn` files, and one
semantic model projects into many diagram types (ERD (incl. crow's-foot cardinality), DFD, flowchart, C4 context/container/component,
matrix/RACI, chart, radar chart, funnel chart, gauge chart, candlestick chart, treemap, Sankey diagram, timeline, fishbone, decision, org charts, work breakdown structures, mind maps, concept maps, EPC process chains, business-model/lean canvases, PESTLE/five-forces canvases, BCG/Ansoff/TOWS matrices, empathy maps and balanced scorecards, journey maps, story maps, pyramids, venn diagrams, sequence diagrams, communication diagrams, object diagrams, hierarchical state machines, activity diagrams, BPMN-style collaborations, timing diagrams, interaction overviews, CMMN-style case diagrams, SysML-style block diagrams, ArchiMate-style layered views, PERT/CPM critical-path views, fault/event trees, network/bus and rack diagrams, UI wireframes, family trees, …) through versioned
profiles and projections. Publication is allowlist-gated: approved views export an explicit JSON projection or an allowlisted SQL DDL export.

This repository is a monorepo with four components:

| Directory | Component | Contents |
|---|---|---|
| `standard/` | **Proposed DDN standard** | Normative specification chapters, EBNF grammar, JSON schemas, the notation vocabulary registry, notation plates, governance |
| `notation/` | **Notation project** | Pure-JavaScript reference runtime (parser → validation → layout/routing → deterministic SVG), CLI, browser Studio, adapters, tests |
| `designer/` | **Visual designer project** | Designer specification (0.1), proposed contracts (schemas, UI maps, API types), working prototype with full 188-kind palette, RACI/CRUD matrix cell editor and chart editor (records, marks, bindings), compact-density chrome with splitters/floating panels and SVG/PNG/WebP export, research, decisions |
| `examples/` | **Example diagrams** | 60 basics, projection and quality corpora, 22 use-case scenarios, the generated full-coverage gallery |

Supporting directories: `docs/` (project documentation, including the
developer documentation under `docs/developers/`) and
`tools/` (shared build/serve/package scripts).

## Status

Draft proposal, pre-1.0. Language/runtime/registry at **0.6.0-beta.1**,
designer specification at **0.2.0-beta.1**. See `standard/specification/00-status-and-scope.md`
and `designer/specification/00-charter.md`. This project does not claim UML,
BPMN, or DMN conformance, and local fixture tests are not legal, accounting,
or security approval.

## Quick start

**No server needed:** open `index.html` in any browser — it renders a live
diagram in-page and links to every standalone page: the full diagram gallery
(`notation/studio/portable-gallery.html`), the Studio editor
(`notation/studio/portable-editor.html`), the end-user viewer
(`notation/viewer/ddn-viewer.html` — open/paste a source, fit page/width/
height/100%, font and colour overrides per kind/relation-class/object,
SVG+PNG export, all presentation-only), the working designer prototype
(`designer/prototype/standalone.html` — compact/comfortable density,
draggable splitters, detachable floating panels, plate-glyph palette,
SVG/PNG/WebP + DDN/ZIP downloads), and the notation plates
(`standard/plates/index.html`). All work from `file://`.

**Full-coverage example gallery:** `examples/gallery/index.html` — one
pre-rendered SVG per installed profile (all 73) plus variation sheets for
every chart mark, look × palette, routing × style, layout algorithm, and
spacing level (130 renders via the CLI path; regenerate with
`npm run build:gallery`). **Developer documentation:**
`docs/developers/` — getting started, runtime modules, API reference,
embedding, viewer, styling, data refresh, source authoring, and the
0.5 → 0.6 migration guide.

Requires Node 22+ for tests/tooling (no runtime dependencies; Python 3.12+
optional — see `tools/requirements-dev.txt`).

```sh
npm test                                  # notation test suites
npm run serve                             # http://127.0.0.1:8080 → repo root
# Studio:    http://127.0.0.1:8080/notation/studio/editor.html
# Prototype: http://127.0.0.1:8080/designer/prototype/index.html

node notation/cli/cli.js check examples/basics/01-customer.ddn --workspace .
node notation/cli/cli.js render examples/basics/01-customer.ddn --workspace . --out /tmp/customer.svg
```

## Runtime bundles

The browser SDK in `notation/dist/` ships as optional libraries plus the
unchanged all-in-one build (byte sizes at 0.6.0-beta.1; generated details in
`notation/dist/README.md`):

| Bundle | Contains | Requires | Bytes |
|---|---|---|---|
| `ddn-core.js` | Parse/build/validate/export, projection + quality planning data, workspace API (no rendering) | — | 623,929 |
| `ddn-graph.js` | Graph renderer (ERD/flow/C4/state/BPMN…); registers the `graph` kind | `ddn-core.js` | 141,045 |
| `ddn-quality.js` | Quality charts, decision tables, fishbone renderers | core + graph (renders through `ddn-projections.js`) | 18,063 |
| `ddn-projections.js` | Chart/matrix/panels/timeline/table/sequence/timing/chen | core + graph | 49,607 |
| `ddn.global.js` | All of the above + Studio component (what tests and standalone pages embed) | — | 860,449 |

Each `ddn-X.js` has `ddn-X.mjs`/`.d.ts` copies. Loading modules out of order
throws immediately; rendering a kind whose bundle is missing throws coded error
`DDN-E010` naming the providing bundle. See `examples/embed/` for live proofs.

**Data refresh:** a host page (dashboard, live report) can replace the records
of a named `data` block without touching the model, views or layout —
`ws.replaceData(name, records)` rewrites only that block's record lines and
returns `{revision, diagnostics}`. Records must carry the same keys as the
block's existing first record (`DDN-E011` otherwise; unknown block name is
`DDN-E002`; the source is untouched on error). Same values re-render every
view byte-identical; changed values move only the marks of data-driven views.
The dashboard recipe is three lines:

```js
ws.replaceData('metrics', rows);
const r = ws.renderSync({entry: 'main.ddn', view: 'latency_chart'});
host.innerHTML = r.svg;
```

See `examples/basics/59-data-refresh.ddn` and `examples/embed/data-refresh.html`.

**Spacing hints:** a view or a shared format bundle can declare
`spacing: tight|normal|loose|expanded` (view wins over format; absent =
`normal`, byte-identical to historical output). The fixed factors
(0.75/1.0/1.4/2.0) scale inter-node gaps, layer spacing and the route-label
reservation in graph-family diagrams, so long relation labels get wider
reserved bands instead of longer detours. Fixed-grid projections (chart,
matrix, panels, …) ignore the hint by design. See
`examples/basics/60-spacing-hints.ddn` (one model, four views).

## npm package

The runtime is pack-able as `@ddn/notation` (`notation/`; version
0.6.0-beta.1, license GPL-2.0-or-later, zero dependencies). `npm pack` in
`notation/` produces a tarball limited to `dist/`, `README.md`, and
`package.json`; there is no registry publishing — install the tarball
directly (`npm i ./ddn-notation-0.6.0-beta.1.tgz`, later `npm i @ddn/notation`
once published). Subpaths resolve in both CommonJS and ESM:

| Import | Resolves to | Notes |
|---|---|---|
| `@ddn/notation` | `dist/ddn.global.js` / `dist/ddn.mjs` | all-in-one runtime |
| `@ddn/notation/core` | `dist/ddn-core.js` / `.mjs` | parse/validate/export; rendering throws `DDN-E010` |
| `@ddn/notation/graph` | `dist/ddn-graph.js` / `.mjs` | graph renderer (ESM wrapper loads core first; CJS: `require('@ddn/notation/core')` first) |
| `@ddn/notation/projections` | `dist/ddn-projections.js` / `.mjs` | chart/matrix/panels/timeline/table/sequence/timing/chen |
| `@ddn/notation/quality` | `dist/ddn-quality.js` / `.mjs` | quality charts, decision tables, fishbone |

```js
import ddn from '@ddn/notation/graph';              // ESM: prerequisites auto-loaded
const { createWorkspace } = require('@ddn/notation'); // CJS
```

`"sideEffects": true` is deliberate: the bundles register onto `globalThis`.
The package's license is GPL-2.0-or-later (the `license` field is
authoritative; the tarball carries no `LICENSE` file because `notation/` has
none — see the repository root).

## Licensing

GPL-2.0-or-later; see `LICENSE`. The previous draft packages were distributed
under MIT by the same contributors; the project was relicensed at import. No
fonts or third-party runtime code are vendored — see `NOTICE.md`.

## Legacy path mapping

Documents imported from the 0.6.0-beta.1 monolith and the designer
specification 0.1 package may still reference their original paths. Mapping:

| Legacy path | Current path |
|---|---|
| `spec/` | `standard/specification/` |
| `grammar/` | `standard/grammar/` |
| `schema/` | `standard/schemas/` |
| `registry/`, `profiles/` | `standard/registry/` |
| `gallery/` | `standard/plates/` |
| `reference/*.js` | `notation/runtime/` |
| `reference/cli.js` | `notation/cli/cli.js` |
| `live/` | `notation/studio/` |
| `dist/` | `notation/dist/` |
| `examples/*.ddn` | `examples/basics/` |
| `use-cases/` | `examples/use-cases/` |
| `codex/RFC-TEMPLATE.md` | `standard/governance/RFC-TEMPLATE.md` |
| designer pkg `spec/` | `designer/specification/` |
| designer pkg `review/` | `designer/decisions/` |

## Contributing

See `CONTRIBUTING.md`. Security reporting: `SECURITY.md`.
