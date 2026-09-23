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
| `tools/`    | **Shared tooling**          | Build scripts (SDK, gallery, standalone pages, viewer), local static server, packaging tests                                                                                                                                                                                                                                                              |
| `tests/`    | **Repo-level tests**        | Website link-integrity and build-freshness gate; AI-REFERENCE.md ddn-block validation gate                                                                                                                                                                                                                                                                                                           |

## Documentation

- `AI-REFERENCE.md` — single-file language reference designed to be handed to an AI so it can author .ddn sources

## Status

Currently this is still in very early development and released/made-public so that I can get some feedback before officially releasing it.

I am thinking that once this is finished to submit it as a standard, but it is concept only and the forms are currently AI slop.

## Quick start

I designed everything as a set of static modules so you do not need a web server - everything in the project should work by just opening the files in a browser

### Runtime bundles

The browser SDK in `notation/dist/` ships as optional libraries plus the unchanged all-in-one build. Sources are real ES modules; the bundles are built with Rollup (pinned devDependency) in three formats each — readable IIFE (`.js`), ES module (`.mjs`), minified IIFE with source map (`.min.js` + `.min.js.map`). Byte sizes at 0.6.0-beta.1 (generated details in `notation/dist/README.md`; the same bundles are downloadable from the site's `website/download/` page):

| Bundle               | Contains                                                                                      | Requires                                            | `.js` bytes | `.min.js` bytes | `.min.js` gzip |
| -------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------- | --------------- | -------------- |
| `ddn-core`           | Parse/build/validate/export, projection + quality planning data, workspace API (no rendering) | —                                                   | 644,384     | 556,499         | 120,672        |
| `ddn-graph`          | Graph renderer (ERD/flow/C4/state/BPMN…); registers the `graph` kind                          | `ddn-core.js`                                       | 146,146     | 104,829         | 38,933         |
| `ddn-quality`        | Quality charts, decision tables, fishbone renderers                                           | core + graph (renders through `ddn-projections.js`) | 20,469      | 15,633          | 7,022          |
| `ddn-projections`    | Chart/matrix/panels/timeline/table/sequence/timing/chen                                       | core + graph                                        | 52,224      | 42,708          | 16,962         |
| `ddn.global`         | All of the above + Studio component (what tests and standalone pages embed)                   | —                                                   | 884,121     | 743,085         | 188,182        |

Import just what you need: a downstream bundler pulling only the check-level API from `ddn-core.mjs` emits ≈640 KB instead of ≈876 KB for the all-in-one (measured in `notation/tests/esm-dist.js`), and the minified core gzips to ≈121 KB. Each `ddn-X` bundle has `.js`/`.mjs`/`.min.js` + `.d.ts` copies. Loading modules out of order throws immediately; rendering a kind whose bundle is missing throws coded error `DDN-E010` naming the providing bundle. See `website/examples/embed/` for live proofs.

**Data refresh:** a host page (dashboard, live report) can replace the records of a named `data` block without touching the model, views or layout — `ws.replaceData(name, records)` rewrites only that block's record lines and returns `{revision, diagnostics}`. Records must carry the same keys as the block's existing first record (`DDN-E011` otherwise; unknown block name is `DDN-E002`; the source is untouched on error). Same values re-render every view byte-identical; changed values move only the marks of data-driven views. 


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
0.6.0-beta.1, license GPL-2.0-or-later, zero *runtime* dependencies — the
Rollup build toolchain is a pinned devDependency and never ships in the
package). `npm pack` in
`notation/` produces a tarball limited to `dist/`, `README.md`, and
`package.json`; there is no registry publishing — install the tarball
directly (`npm i ./ddn-notation-0.6.0-beta.1.tgz`, later `npm i @ddn/notation`
once published). Subpaths resolve in both CommonJS and ESM:

| Import                      | Resolves to                           | Notes                                                                                     |
| --------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@ddn/notation`             | `dist/ddn.global.js` / `dist/ddn.mjs` | all-in-one runtime                                                                        |
| `@ddn/notation/core`        | `dist/ddn-core.js` / `.mjs`           | parse/validate/export; rendering throws `DDN-E010`                                        |
| `@ddn/notation/graph`       | `dist/ddn-graph.js` / `.mjs`          | graph renderer (ESM wrapper loads core first; CJS: `require('@ddn/notation/core')` first) |
| `@ddn/notation/projections` | `dist/ddn-projections.js` / `.mjs`    | chart/matrix/panels/timeline/table/sequence/timing/chen                                   |
| `@ddn/notation/quality`     | `dist/ddn-quality.js` / `.mjs`        | quality charts, decision tables, fishbone                                                 |

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

## Licensing

I am currently doing this as GPL-2.0-or-later; see `LICENSE` but depending on feedback I many change it to something like the postgresql license. — see `NOTICE.md`.

## Legacy path mapping

Documents imported from the 0.6.0-beta.1 monolith and the designer specification 0.1 package may still reference their original paths.  This will be corrected over time.

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