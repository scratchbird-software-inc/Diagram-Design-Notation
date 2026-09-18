# Responsiveness, measurements and deterministic behavior

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Proposed budgets, not current claims
On a declared reference desktop, aim for pointer feedback within one animation frame during a drag; do not route the entire graph on every pointermove. Target small-view postcommit render feedback under 250ms and medium bounded views under 1s, with a visible cancellable busy state beyond that. These are acceptance targets to be benchmarked, not measurements of the finished editor or arbitrary hardware guarantees.

Maintain separate timings for input handling, draft-command planning, source commit, validation, measurement, layout/routing, SVG generation, DOM installation and accessibility-tree update. A fast SVG string build can still block due to DOM size; measure both. Report cold/warm cache performance and representative failure paths.

## Preview strategy
During drag, translate a ghost/overlay of the selected nodes and render cheap incident guide paths. Keep the last authoritative diagram behind it. Do not mutate semantic nodes for each pointer event. On release, prepare one command and route from the new source constraints. If infeasible, retain the draft placement visibly and give recovery choices, or reject that view mutation according to the selected policy; never silently move unrelated pins.

## Layout correctness and scope
Per-side endpoint ordering remains part of the router, not an editor postprocessing trick. The editor shows semantic handles and supplies allowed visual anchors. Source pins, explicit ports/fields and waypoints are separate constraints. An editor must not reorder fields merely to simplify routing. Compact/hidden fields remain mapped to original member IDs.

Selected-region optimization should leave the rest stable. Use previous accepted geometry as a hint only where no explicit rule binds coordinates. A new look or palette should not change semantic or layout seeds. Measured font changes may alter size, but the UI reports resulting layout invalidation. Print scaling cannot make a page silently unreadable.

## Determinism and caching
Seed random-looking strokes from stable IDs and explicit seed. Sort ambiguous graph candidates deterministically. Cache descriptor resolution by profile/runtime version; measurement by content/font configuration; source parses by file hash; projected models by dependency closure. Discard late worker results from stale source or view generations. Undo/redo must restore source, not merely a screenshot that happens to look similar.

## Workload suite
Benchmark: 2-node sketch; 12-node field ERD; 48-node graph; current 128-node/384-edge boundary; accounting endpoint-order fixture; long-label flowchart; 20-series chart; 50×20 matrix where permitted; rule partition near its cap; composed 12-child page; large imported source with a small selected view; and 391 current source views in compatibility builds. Record warnings and rejected cases instead of averaging them out.

## Stability gates
No source loss on timeout; no double history commit; no phantom pins from a cancelled drag; no hidden loading of examples unrelated to the active page; bounded undo history with a visible checkpoint; repeated opening/destruction releases event listeners and workers; repeated same-model renders have stable semantic fingerprints and justified geometry differences only.
