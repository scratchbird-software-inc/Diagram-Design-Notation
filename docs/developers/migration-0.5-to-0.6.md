# Migration: 0.5 → 0.6.0-beta.1

Beta 1 (0.6.0-beta.1; designer 0.2.0-beta.1) is additive over 0.5.x: every
0.5 source still parses, and renders that opt into nothing are byte-identical
to their 0.5 output (the determinism goldens in `notation/tests/` prove it).
This page lists what changed, with before/after for each.

## Version stamps

**Before (0.5.x):** runtime and package stamps `0.5.x`, language versions
`"0.3"`/`"0.4"`/`"0.5"` in sources.
**After:** `notation/package.json` and the runtime stamp `0.6.0-beta.1`
(`DDNLive.VERSION`), designer `0.2.0-beta.1`. Language version stamps in
`.ddn` files are **unchanged** — sources keep declaring `ddn "0.3"…"0.5"`;
no source edit is required.

## Element defaults are registry-driven and visible (B1-002)

**Before:** defaults for an element kind lived in the renderer; a declared
element showed only the properties the author wrote.
**After:** `DDNLive.defaults.forKind(kind)` returns the registry default
property set for a kind, and declare/create paths populate from it.

```js
// after
DDNLive.defaults.forKind("table");   // deep copy of the registry defaults, {} when none
```

## CSS class hooks and ddn.css (B1-003)

**Before:** restyling a rendered diagram meant post-processing SVG.
**After:** every render carries stable hooks (`.ddn-node`, `.ddn-rel`,
`.ddn-kind-<code>`, `.ddn-verb-<verb>`, `data-id`, …) and ships
`notation/dist/ddn.css` with `--ddn-*` custom properties. Page CSS fills the
gaps the script left unset; inline presentation attributes still win.

```css
/* after */
:root { --ddn-node-stroke: #6ab0ff; }
.ddn-kind-tbl { stroke-width: 2.5; }
```

Full class list and cascade rules: [styling.md](styling.md).

## Modular runtime bundles (B1-004)

**Before:** one all-in-one script or nothing.
**After:** `ddn-core.js` → `ddn-graph.js` → `ddn-projections.js` →
`ddn-quality.js` load in order; `ddn.global.js` remains the all-in-one. A
capability whose bundle is missing throws `DDN-E010` naming the file.

```html
<!-- after: validation-only page -->
<script src="notation/dist/ddn-core.js"></script>
```

Sizes and the full matrix: [modules.md](modules.md).

## npm packaging (B1-005)

**Before:** consumers copied files out of the repo.
**After:** `notation/` packs as `@ddn/notation` with an `exports` map:
`.` (global), `./core`, `./graph`, `./projections`, `./quality`, each with
import/require/types entries.

## Data refresh API (B1-006)

**Before:** live data meant regenerating source text and re-parsing.
**After:** `ws.replaceData(name, records)` swaps a data block's records in
place; record keys must match the block's first record or `DDN-E011`.
Recipe: [data-refresh.md](data-refresh.md).

## End-user viewer (B1-007)

**New, nothing to migrate:** `notation/viewer/ddn-viewer.html` — single-file
`file://` viewer with fit modes, font/colour overrides, SVG/PNG export. See
[viewer.md](viewer.md).

## Spacing hints (B1-008)

**Before:** inter-node gaps were only the format's `gap`/`row_gap` numbers.
**After:** optional additive `spacing: tight|normal|loose|expanded` on views
and format bundles (view wins; absent = `normal` = byte-identical to before;
unknown value rejected as `DDN033`). Factors 0.75/1.0/1.4/2.0 scale graph
gaps and route-label margins only — node bodies and fonts never scale.

```ddn
view workshop "Orders / wide" { data: [@model]; format: @f.common; spacing: loose; }
```

## Script/golden refresh (B1-009)

All 114 `.ddn` example files re-verified (check + render-twice
byte-determinism + golden hashes), and a permanent gate now parse-checks
every ` ```ddn ` fenced block in the README and spec. No consumer action.
