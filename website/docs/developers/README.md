# DDN developer documentation

Developer-facing documentation for the Diagram Design Notation (DDN) reference
runtime, version 0.6.0-beta.1. These pages cover using the runtime as a
library and embedding rendered diagrams; they are verified against
`notation/studio/src/public.d.ts` and the shipped bundles under
`notation/dist/` by the permanent gate `notation/tests/gallery-coverage.js`.

## Doc map

| Page | Read it when |
|---|---|
| [getting-started.md](getting-started.md) | You want the first render on screen in ten lines — browser script tag or Node `require`. |
| [modules.md](modules.md) | You want to load only part of the runtime (core/graph/projections/quality bundles, sizes, load order). |
| [api-reference.md](api-reference.md) | You need the workspace object: parse, check, render, mount, snapshots, data replacement, authoring, io. |
| [embedding.md](embedding.md) | You are embedding diagrams in a page or framework and need CSP / `file://` guidance. |
| [tool.md](tool.md) | You want the unified diagram tool (`ddn-tool.html`, served as `tools/index.html`): drawers, modes, deep links, export. |
| [viewer.md](viewer.md) | Historical: the retired single-file viewer (`ddn-viewer.html`), replaced by the unified tool in B1-027. |
| [styling.md](styling.md) | You want to restyle rendered SVG with CSS: class hooks, cascade rules, `ddn.css`. |
| [data-refresh.md](data-refresh.md) | You are building a dashboard that swaps data-block records without touching the model. |
| [authoring-sources.md](authoring-sources.md) | You are writing `.ddn` source by hand: language tour with links into the spec chapters. |
| [migration-0.5-to-0.6.md](migration-0.5-to-0.6.md) | You have 0.5.x content or integrations and need the Beta-1 changes with before/after. |

## Orientation

The repository has four moving parts a developer meets:

- **`notation/runtime/`** — the reference implementation sources (parser,
  validation, layout/routing, deterministic SVG renderer). UMD, no
  dependencies, `'use strict'`.
- **`notation/dist/`** — the shipped bundles built from those sources by
  `npm run build:sdk` (`tools/build-sdk.js`). `ddn.global.js` is everything;
  `ddn-core/graph/projections/quality.js` are the modular splits (see
  [modules.md](modules.md)).
- **`notation/studio/src/`** — the public API layer (`api.js`,
  `public.d.ts`), the `<ddn-example>` web component, and Studio itself.
- **`notation/cli/cli.js`** — the command-line front end
  (`check` / `render` / `resolve`) over the same code path the library uses.

Every diagram in the repo is produced by the one deterministic render path:
same source bytes in, same SVG bytes out. The example gallery at
[`website/examples/gallery/index.html`](../../examples/gallery/index.html) shows one
render per installed profile plus all variation sheets; it is regenerated with
`npm run build:gallery`.
