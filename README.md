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
| `designer/` | **Visual designer project** | Designer specification (0.1), proposed contracts (schemas, UI maps, API types), working prototype with full 188-kind palette, RACI/CRUD matrix cell editor and chart editor (records, marks, bindings), research, decisions |
| `examples/` | **Example diagrams** | 58 basics, projection and quality corpora, 22 use-case scenarios |

Supporting directories: `docs/` (project documentation and website, TBD) and
`tools/` (shared build/serve/package scripts).

## Status

Draft proposal, pre-1.0. Language/runtime/registry at **0.6.0-beta.1**,
designer specification at **0.1.0**. See `standard/specification/00-status-and-scope.md`
and `designer/specification/00-charter.md`. This project does not claim UML,
BPMN, or DMN conformance, and local fixture tests are not legal, accounting,
or security approval.

## Quick start

**No server needed:** open `index.html` in any browser — it renders a live
diagram in-page and links to every standalone page: the full diagram gallery
(`notation/studio/portable-gallery.html`), the Studio editor
(`notation/studio/portable-editor.html`), the working designer prototype
(`designer/prototype/standalone.html`), and the notation plates
(`standard/plates/index.html`). All work from `file://`.

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
| `ddn-core.js` | Parse/build/validate/export, projection + quality planning data, workspace API (no rendering) | — | 620,968 |
| `ddn-graph.js` | Graph renderer (ERD/flow/C4/state/BPMN…); registers the `graph` kind | `ddn-core.js` | 141,045 |
| `ddn-quality.js` | Quality charts, decision tables, fishbone renderers | core + graph (renders through `ddn-projections.js`) | 18,063 |
| `ddn-projections.js` | Chart/matrix/panels/timeline/table/sequence/timing/chen | core + graph | 49,607 |
| `ddn.global.js` | All of the above + Studio component (what tests and standalone pages embed) | — | 857,488 |

Each `ddn-X.js` has `ddn-X.mjs`/`.d.ts` copies. Loading modules out of order
throws immediately; rendering a kind whose bundle is missing throws coded error
`DDN-E010` naming the providing bundle. See `examples/embed/` for live proofs.

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
