# Limits & capabilities

Every cap below is enforced by code — hitting one raises a coded error, never
silent truncation. The measured performance baseline against these boundaries
is committed at `standard/registry/performance-baseline.json` (regenerate with
`npm run benchmark` from the repository root; the smoke version runs in
`npm test`).

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
| Workspace source size (library API) | 2,000,000 chars per file; 12,000,000 total | `LIVE010` / `LIVE011` | `notation/studio/src/api.js` (`filesChecked()`) |
| Workspace file count | 1,500 files | `LIVE011` | `notation/studio/src/api.js` (`filesChecked()`) |
| Workspace undo history | 60 entries / 16 MB of patches | (oldest entry dropped) | `notation/studio/src/api.js` (`commit()`) |
| Compiled-IR cache per workspace | 4 views (LRU) | (recompiles on eviction) | `notation/studio/src/api.js` (`compiled()`) |

The library API (`createWorkspace`/`renderSync`) guards workspace size too:
each source is at most 2,000,000 characters and a workspace totals at most
12,000,000 characters across 1,500 files (`LIVE010`/`LIVE011` in
`notation/studio/src/api.js` `filesChecked()`). The larger 50 MB per-source
cap of the browser surfaces (see [viewer.md](viewer.md), [tool.md](tool.md))
sits on top of that, not instead of it.

## Rendering model (honest)

Rendering is **synchronous by default**; `renderSync()` is the core path
(see `notation/studio/src/api.js`). The unified tool additionally renders
**off-thread in a worker** when the host supports it: `render()` crosses a
worker boundary for layout/routing/SVG and degrades to byte-identical
synchronous output when the worker is unavailable or unverifiable
(`?worker=off` forces the synchronous path; a stale render prepared before a
source change is refused with DDN-W953). The designer
specification's responsiveness figures are annotated TARGET vs MEASURED in
`designer/specification/16-performance.md`; the MEASURED numbers come from the
committed baseline file above.

## Working within the limits

- **Filter, don't shrink the model.** Views select a subset of one model;
  keep the model whole and declare narrow views (`data:` subsets, projection
  `filter`).
- **Drill down with subdiagrams.** A node can expose a detail view
  (`subdiagram … { view: @detail; mode: reference }`); embedded pages receive
  a `ddn-navigate` event (see [embedding.md](embedding.md)) and swap the
  rendered view — each level stays under 128/384 independently.
- **Compose dashboards.** `panels.composed@1` embeds up to 12 child views,
  each with its own 128/384 budget, exactly one level deep — see the dashboard
  case in the performance baseline and the live-swap pattern in
  [data-refresh.md](data-refresh.md).
- **Link diagrams.** Split a large domain into linked views and files
  (imports) rather than one giant view; the CLI, Studio and the unified tool
  navigate between them.
