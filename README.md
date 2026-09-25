<p><img src="assets/brand/scratchweaver.svg" alt="ScratchWeaver logo" width="120"></p>

## ScratchWeaver — the Diagram Design Notation (DDN) toolkit

**ScratchWeaver** is the product name of this toolkit, from **[ScratchBird Software Inc.](https://www.scratchbird.ca)** The language it implements keeps its name: Diagram Design Notation (DDN).

A simple script language that allows complex diagrams to be created with just a few lines of text.  

It was inspired by mermaid diagrams, but, goes far beyond what mermaid supports

It is currently alpha, working toward beta but can be used - please report all needed fixes into the discussions section.

### Why did I create this?

I am working on a very large, very complex project that I need to document.  I also have a second project that needs live dashboards and business analysis tools - but everything I wanted to use was either insufficient or too complex to work with.

So in creating the tools I needed, I created tools I thought others may find helpful.

The visual editors and viewers are not used in my other projects so they are very basic and need alot of polish.

### Repository layout

| Directory   | Component                   | Contents                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `website/`  | **Project website**         | Deployable static root: generated pages + the examples and docs corpora                                                                                                                                                                                                                                                                                   |
| `standard/` | **Proposed DDN standard**   | Normative specification chapters, EBNF grammar, JSON schemas, the notation vocabulary registry, notation plates, governance                                                                                                                                                                                                                               |
| `notation/` | **Notation project**        | Pure-JavaScript reference runtime (parser → validation → layout/routing → deterministic SVG), CLI, browser Studio, adapters, tests                                                                                                                                                                                                                        |
| `designer/` | **Visual designer project** | Designer specification (0.1), proposed contracts (schemas, UI maps, API types), working prototype with full 188-kind palette, RACI/CRUD matrix cell editor and chart editor, compact-density chrome with splitters/resizable floating or window-popped panels, presentation-only Display tab, SVG/PNG/WebP + .ddn/ZIP text downloads, research, decisions |
| `tools/`    | **Shared tooling**          | Build scripts (SDK, gallery, standalone pages, unified tool), local static server, packaging tests                                                                                                                                                                                                                                                              |
| `tests/`    | **Repo-level tests**        | Website link-integrity and build-freshness gate; AI-REFERENCE.md ddn-block validation gate (skipped when the internal, gitignored AI-REFERENCE.md is absent)                                                                                                                                                                                                                                                                                                           |

## Status

Currently this is still in very early development and released/made-public so that I can get some feedback before officially releasing it.

I am thinking that once this is finished to submit it as a standard, but it is concept only and the forms are currently AI slop.

## Quick start

I designed everything as a set of static modules so you do not need a web server - everything in the project should work by just opening the files in a browser

### Runtime bundles

The browser SDK in `notation/dist/` ships as optional libraries plus the unchanged all-in-one build. Sources are real ES modules; the bundles are built with Rollup (pinned devDependency) in three formats each — readable IIFE (`.js`), ES module (`.mjs`), minified IIFE with source map (`.min.js` + `.min.js.map`). Byte sizes at 0.7.0 (generated details in `notation/dist/README.md`; the same bundles are downloadable from the site's `website/download/` page):

| Bundle               | Contains                                                                                      | Requires                                            | `.js` bytes | `.min.js` bytes | `.min.js` gzip |
| -------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------- | --------------- | -------------- |
| `ddn-core`           | Parse/build/validate/export, projection + quality planning data, workspace API (no rendering) | —                                                   | 695,510     | 596,571         | 133,757        |
| `ddn-graph`          | Graph renderer (ERD/flow/C4/state/BPMN…); registers the `graph` kind                          | `ddn-core.js`                                       | 151,781     | 108,180         | 40,007         |
| `ddn-quality`        | Quality charts, decision tables, fishbone renderers                                           | core + graph (renders through `ddn-projections.js`) | 20,469      | 15,633          | 7,022          |
| `ddn-projections`    | Chart/matrix/panels/timeline/table/sequence/timing/chen                                       | core + graph                                        | 91,683      | 75,333          | 27,810         |
| `ddn-geo` (optional) | Map projections (mercator/equirectangular/albers/equalEarth), GeoJSON, choropleth/symbol/outline maps | core + graph                             | 23,771      | 16,201          | 6,841          |
| `ddn-iso` (optional) | Isometric depth (B1-034): axonometric 30° projection, chart extrusions (bar/pie/donut/area/treemap), iso graph prisms | core + graph | 23,406 | 14,396 | 5,996 |
| `ddn.global`         | All of the above except `ddn-geo` and `ddn-iso` + Studio component (what tests and standalone pages embed) | — | 980,489     | 819,295         | 213,042        |

Import just what you need: a downstream bundler pulling only the check-level API from `ddn-core.mjs` emits ≈640 KB instead of ≈876 KB for the all-in-one (measured in `notation/tests/esm-dist.js`), and the minified core gzips to ≈121 KB. Each `ddn-X` bundle has `.js`/`.mjs`/`.min.js` + `.d.ts` copies. Loading modules out of order throws immediately; rendering a kind whose bundle is missing throws coded error `DDN-E010` naming the providing bundle — with owner-directed exceptions for the two optional modules: `ddn-geo` ("Map view requires ddn-geo.js") and `ddn-iso` ("Isometric view requires ddn-iso.js") degrade to a visible inline placeholder plus the coded `DDN-E010` diagnostic, never silently; a `depth` property without `ddn-iso` renders flat with the coded diagnostic. See `website/examples/embed/` for live proofs.

**Data refresh:** a host page (dashboard, live report) can replace the records of a named `data` block without touching the model, views or layout — `ws.replaceData(name, records)` rewrites only that block's record lines and returns `{committed, revision, added, removed, updated, diagnostics}`. Records match by an optional `key` field (the declaration id), so reordered payloads never corrupt identities; without keys the fallback is positional and order-sensitive. Records must carry the same field keys as the block's existing first record (`DDN-E011` otherwise; unknown block name is `DDN-E002`). Refresh is transactional: field types are checked against the block's declared types and every affected view is validated before commit — on failure nothing commits and `diagnostics` names the view, record key and failure (`DDN-E012`). Removing a record a view still references is rejected; selector-membership views pick up added records automatically while explicit-membership views keep their bound records and get a `DDN-W015` `addedRecordsNotVisible` report; refreshing to an empty set is legal and renders the declared empty state. Same values re-render every view byte-identical; changed values move only the marks of data-driven views. 


The dashboard recipe is three lines:

```js
ws.replaceData('metrics', rows);
const r = ws.renderSync({entry: 'main.ddn', view: 'latency_chart'});
host.innerHTML = r.svg;
```

See `website/examples/basics/59-data-refresh.ddn` and `website/examples/embed/data-refresh.html`.

**Spacing hints:** a view or a shared format bundle can declare spacing: tight|normal|loose|expanded

### npm package

The runtime is pack-able as `@ddn/notation` (`notation/`; version
0.7.0, license GPL-2.0-or-later, zero *runtime* dependencies — the
Rollup build toolchain is a pinned devDependency and never ships in the
package). `npm pack` in
`notation/` produces a tarball limited to `dist/`, `README.md`, and
`package.json`. **Not yet published to the npm registry** — install the
tarball directly (`npm i ./ddn-notation-0.7.0.tgz`); `npm i
@ddn/notation` becomes available once the first `v*` tag is published. The
publish path itself is ready and continuously validated:
`.github/workflows/publish.yml` runs the packaging gate and
`npm publish --dry-run` on every push, and would publish on `v*` version tags
once the `NPM_TOKEN` repository secret is configured (it skips gracefully
until then; the committed `private: true` in `notation/package.json` is a
deliberate accident guard the tag-gated job strips at publish time).
Subpaths resolve in both CommonJS and ESM:

| Import                      | Resolves to                           | Notes                                                                                     |
| --------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@ddn/notation`             | `dist/ddn.global.js` / `dist/ddn.mjs` | all-in-one runtime                                                                        |
| `@ddn/notation/core`        | `dist/ddn-core.js` / `.mjs`           | parse/validate/export; rendering throws `DDN-E010`                                        |
| `@ddn/notation/graph`       | `dist/ddn-graph.js` / `.mjs`          | graph renderer (ESM wrapper loads core first; CJS: `require('@ddn/notation/core')` first) |
| `@ddn/notation/projections` | `dist/ddn-projections.js` / `.mjs`    | chart/matrix/panels/timeline/table/sequence/timing/chen                                   |
| `@ddn/notation/quality`     | `dist/ddn-quality.js` / `.mjs`        | quality charts, decision tables, fishbone                                                 |
| `@ddn/notation/geo`         | `dist/ddn-geo.js` / `.mjs`            | optional geographic module (map projections, GeoJSON, choropleth/symbol/outline)          |
| `@ddn/notation/iso`         | `dist/ddn-iso.js` / `.mjs`            | optional isometric module (axonometric 30° depth, chart extrusions, iso graph prisms)     |

```js
import ddn from '@ddn/notation/graph';              // ESM: prerequisites auto-loaded
const { createWorkspace } = require('@ddn/notation'); // CJS
```

`"sideEffects": ["dist/*.js"]` is deliberate: the IIFE bundles register onto
`globalThis`, while the `.mjs` ES modules stay tree-shakeable for downstream
bundlers.
The package's license is GPL-2.0-or-later (the `license` field is
authoritative; the tarball carries no `LICENSE` file because `notation/` has
none — see the repository root).

## Limits & capabilities

Every cap below is enforced by code, not convention — hitting one raises a
coded error, never silent truncation. Measured performance against these
boundaries is in
[`standard/registry/performance-baseline.json`](standard/registry/performance-baseline.json)
(regenerate with `npm run benchmark`); the designer responsiveness numbers in
`designer/specification/16-performance.md` are annotated TARGET vs MEASURED.

| Cap | Value | Raised as | Enforcing code |
| --- | ----- | --------- | -------------- |
| Elements selected into one live view | 128 | `LIVE013` | `notation/studio/src/api.js` (`compiled()`) |
| Relations visible in one live view | 384 | `LIVE013` | `notation/studio/src/api.js` (`compiled()`) |
| Child view of a composed dashboard | 128 elements / 384 relations | `DDN-QP003` | `notation/runtime/ddn-core.js` (`build()`, panels branch) |
| Dashboard nesting | one child-view level — no recursive dashboards | `DDN-QP002` | `notation/runtime/ddn-core.js` (`build()`, panels branch) |
| Embedded child views per dashboard | 12 | `DDN-QP003` | `notation/runtime/ddn-core.js` (`build()`, panels branch) |
| Panels in a `kind:panels` projection | 1–80 panels on a 1–12 column grid | `DDN-PJ020` | `notation/runtime/ddn-projection-data.js` |
| Quality/chart reference list | 1–1000 references, unique identity | `DDN-Q003` | `notation/runtime/ddn-quality-data.js` |
| Publication page width/height | 64–100000 px, finite | `DDN046` | `notation/runtime/ddn-core.js` |
| Source file size (viewer / unified tool) | 50 MB per source | plain `Error` | `MAX_FILE_BYTES` in `notation/tool/src/tool.js`, `notation/viewer/src/viewer.js` |
| Raster (PNG) export side | 16384 px | plain `Error` | `MAX_RASTER_PX` in `notation/viewer/src/viewer.js`, `notation/tool/src/tool.js` |
| Workspace undo history | 60 entries / 16 MB of patches | (oldest entry dropped) | `notation/studio/src/api.js` (`commit()`) |
| Compiled-IR cache per workspace | 4 views (LRU) | (recompiles on eviction) | `notation/studio/src/api.js` (`compiled()`) |

The library API (`createWorkspace`/`renderSync`) imposes no source-size cap of
its own — you hand it text you already hold — so the 50 MB cap is a guard of
the browser surfaces, not of the language.

**Rendering is synchronous and single-threaded.** `render()` is an async
wrapper over the synchronous renderer (same thread, same tick — see
`renderSync`/`render` in `notation/studio/src/api.js`); no worker offload
exists today. Off-thread rendering is a roadmap item, not a current
capability, so size views to the limits above instead of expecting the UI to
stay responsive through an oversized render.

**Working within the limits — guidance patterns:**

- *Filter, don't shrink the model.* Views select a subset of one model; keep
  the model whole and declare narrow views (`data:` subsets, projection
  `filter`).
- *Drill down with subdiagrams.* A node can expose a detail view
  (`subdiagram … { view: @detail; mode: reference }`); hosts get a
  `ddn-navigate` event and swap the rendered view — each level stays under
  128/384 independently.
- *Compose dashboards.* `panels.composed@1` embeds up to 12 child views, each
  with its own 128/384 budget, exactly one level deep.
- *Link diagrams.* Split a large domain into linked views/files (imports)
  rather than one giant view; the CLI and Studio navigate between them.

## Licensing

I am currently doing this as GPL-2.0-or-later; see `LICENSE` but depending on feedback I many change it to something like the postgresql license. — see `NOTICE.md`.

## Legacy path mapping

Documents imported from the 0.7.0 monolith and the designer specification 0.1 package may still reference their original paths.  This will be corrected over time.

**Mapping:**

| Legacy path              | Current path                          |
| ------------------------ | ------------------------------------- |
| `spec/`                  | `standard/specification/`             |
| `grammar/`               | `standard/grammar/`                   |
| `schema/`                | `standard/schemas/`                   |
| `registry/`, `profiles/` | `standard/registry/`                  |
| `gallery/`               | `standard/plates/`                    |
| `reference/*.js`         | `notation/runtime/`                   |
| `reference/cli.js`       | `notation/cli/cli.js`                 |
| `live/`                  | `notation/studio/`                    |
| `dist/`                  | `notation/dist/`                      |
| `examples/*.ddn`         | `website/examples/basics/`            |
| `use-cases/`             | `website/examples/use-cases/`         |
| `docs/`                  | `website/docs/`                       |
| root `index.html`        | `website/index.html`                  |
| `codex/RFC-TEMPLATE.md`  | `standard/governance/RFC-TEMPLATE.md` |
| designer pkg `spec/`     | `designer/specification/`             |
| designer pkg `review/`   | `designer/decisions/`                 |

## Contributing

See `CONTRIBUTING.md`. Security reporting: `SECURITY.md`.