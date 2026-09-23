# Changelog

All notable changes to the Diagram Design Notation project are documented here.
Component-level history predating the monorepo import lives in
`notation/CHANGELOG.md` and `website/examples/use-cases/CHANGELOG.md`.

## [Unreleased]

- Fixed: viewer `?src=` deep links now fetch the entry file's whole import
  closure (B1-026). Multi-file examples (everything under
  `website/examples/use-cases/`) previously rendered an empty stage with a
  `DDN022` status-line error because only the entry file was fetched;
  `srcImportClosure` in `notation/viewer/src/viewer.js` recursively pulls
  imported siblings (cycle-safe, size-capped, fetch errors name the missing
  file), matching the studio's closure pattern.

- Optional geographic module `ddn-geo` (B1-025) — the sixth runtime bundle,
  never embedded in `ddn.global.js`, loaded only when a page renders map
  views:
  - Pure-math projections with zero dependencies: `mercator`,
    `equirectangular`, `albers` (29.5°/45.5° parallels, latitude-clamped fit
    for whole-world data), `equalEarth`; verified against independently
    computed reference coordinates.
  - GeoJSON ingestion (`Feature`/`FeatureCollection`;
    `Polygon`/`MultiPolygon`/`Point`/`MultiPoint`) with antimeridian-safe
    path generation; `DDNGeo.geoPath`/`DDNGeo.projections` exposed for
    host-side geometry (contour-ready).
  - Three installed profiles: `geo.choropleth@1` (region join by feature id
    or name, sequential ramp, legend), `geo.symbols@1` (lon/lat symbols with
    sqrt size scale), `geo.outline@1` (base map / projection-comparison
    plates, optional 10° graticule).
  - Geography ships separately as the optional ~96 KB asset
    `assets/geo/world-110m.json` (Natural Earth 110m, public domain, built
    by `tools/build-geo-assets.mjs`); views reference it by name/URL
    (`geography:"assets/geo/world-110m.json"`, host registers it via
    `DDNGeo.registerGeography`; the CLI pre-registers it) or bind inline
    GeoJSON (`geography: @data.record`) for self-contained files.
  - Graceful missing behavior (owner-directed): the `geo` kind registers
    `optional: true`; rendering a geo view without `ddn-geo.js` yields a
    visible inline SVG placeholder ("Map view requires ddn-geo.js") plus the
    coded `DDN-E010` diagnostic on the diagnostics channel — never silent.
    Planning and all other kinds keep the hard `DDN-E010` throw.
  - New diagnostics `DDN-PJ143`–`DDN-PJ148` and info `DDN-PJW05`;
    ddn-core grows only the `geo` kind keyword and three projection
    property keywords (`geography`, `method`, `graticule`).
  - Examples `67-geo-choropleth.ddn`, `68-geo-symbols.ddn`,
    `69-geo-projections.ddn` (four projection plates); gallery plates,
    packaging (`@ddn/notation/geo` subpath), download table and modules
    guide updated; Vega-parity note: the dorling cartogram is deferred
    (needs a distortion kernel — see the B1-025 report).

- Category-2 chart pack in the optional `ddn-projections` bundle (B1-024) —
  ddn-core does not grow semantically (only five new projection property
  keywords: `bin_count`, `k`, `others`, `error`, `trend). Twenty-two new
  chart marks, all deterministic SVG, data-bound via the existing
  records/x/y/series/target machinery, each with its own installed profile,
  gallery plate and runnable example:
  - Distributions: `histogram` (equal-width binning, `bin_count`), `density`
    (Gaussian KDE, Silverman bandwidth, fixed 81-point grid), `qq` (normal
    Q-Q, Acklam inversion, quartile reference), `quantiledot`, `dotplot`,
    `boxplot` (R-7 quartiles, Tukey 1.5×IQR, outlier records), `violin`
    (per-category KDE, shared density scale), `beeswarm` (deterministic
    non-overlap lanes), `topk` (`k`, `others` merge/drop).
  - Tree family (dotted-path hierarchy shared with treemap): `tidytree`,
    `radialtree`, `circlepack` (deterministic ring packing), `sunburst`,
    `packedbubble`.
  - Grid/other: `heatmap` (x × series intensity grid), `densityheatmap`
    (bin_count² 2D binning), `calendar` (Monday-first UTC week grid),
    `parallelcoords` (per-axis normalization; constant axes/missing values
    are UNKNOWN mid-height with `DDN-PJW04`, never zeros), `wordcloud`
    (greedy Archimedean-spiral placer on the shared text measurer).
  - Network: `arc` (weight-ordered axis), `force` (deterministic seeded
    Fruchterman–Reingold, fixed seed 0xB1024, 300 cooling iterations — same
    seed pattern as sketch/organic), `edgebundle` (LCA routing over the
    dotted-path hierarchy on a radial tidy layout).
  - Statistical overlays (not new views): `error:"binding"` draws I-beam
    error bars on `bar`/`point` marks; `trend:linear|loess` overlays a
    least-squares line or a tricube loess curve (span 0.3, 51-point grid) on
    numeric point/line charts, with the axis extended to cover the overlay.
  - Value-state discipline: zero-variance KDE/Q-Q/trend inputs refuse as
    UNKNOWN (`DDN-PJ132`) instead of drawing silent zeros; insufficient
    samples, invalid `bin_count`/`k`/`others`, duplicate cells/words/days,
    and nonpositive weights/links are coded refusals (`DDN-PJ131`, `PJ133`
    … `PJ138`, `PJ141`, `PJ142`). Profiles `chart.histogram@1` …
    `chart.edgebundle@1` registered in `standard/registry/profiles/
    catalogue.json` (95 installed profiles, mirrored into
    `capabilities.json`). Examples `62-distribution-charts`,
    `63-tree-charts`, `64-grid-charts`, `65-network-charts`,
    `66-chart-overlays`; the gallery marks sheet now plates every mark
    (34 views). Bundle delta: `ddn-projections.js` 52,224 → 89,704 bytes
    (min 42,708 → 73,999; min+gzip ~16.8 KB → ~27.0 KB). Tests:
    `distribution-charts.js`, `tree-charts.js`, `grid-charts.js`,
    `network-charts.js`, `chart-overlays.js` wired into `npm test`.

- `AI-REFERENCE.md` is now internal-only: gitignored and removed from the public repo/website; `tests/ai-reference.js` skips gracefully when it is absent.
- One-click "open in viewer / designer" from the examples browser (B1-023):
  every `.ddn` row on the examples page now links the end-user viewer via a
  `?src=<relative path>` deep link; single-file examples (no `import "…"`
  lines) also link the visual designer, while multi-file examples are
  viewer-only with a note. The viewer and the designer standalone pages both
  accept `?src=` (query-string mechanism chosen; `#src=` rejected — fragment
  state would collide with future in-page anchors and is invisible to access
  logs): the source is fetched relative to the page, size-capped at the same
  50 MB as file drops, loaded as a single-file workspace, and its first view
  selected. Validation is strict — any scheme (`javascript:`/`data:`/`https:`),
  scheme-relative host, absolute path, or non-`.ddn` target is
  rejected inline; under `file://` a blocked fetch explains "serve over HTTP
  (`npm run serve`) or use Open file" instead of failing silently. The
  designer replaces its boot fixture workspace with the fetched document and
  confirms before discarding unsaved edits. Surface: `viewer.js`
  `srcFromQuery`/`srcFetchErrorMessage`/`loadFromSrc`, designer `app.js` boot
  hook, `build-site.mjs` "Open in" column (import detection is a line-anchored
  grep — imports are top-level line statements, so the site builder needs no
  runtime load). Tests: `notation/tests/viewer.js` query-param units, new
  `tests/viewer-src-http.js` headless-chromium-over-`tools/serve.js` proof
  (renders an example, rejects `javascript:`, reports HTTP 404), and a
  per-row link-rule assertion in `tests/website-links.js` (120 examples: 35
  designer + 120 viewer links).

- `layout.frame_overflow: expand | confine` for scoped frames (B1-022,
  RFC-118): a view `frame` and its members can no longer disagree. Under the
  default `expand`, a declared `at`/`size` frame rect grows to enclose the
  member bounding box plus the standard frame padding (20 CSS px left/right,
  54 top, 22 bottom) — a rect that already encloses its members is unchanged,
  so existing renders are byte-identical; members never escape and nothing is
  hidden. Under `confine`, the frame keeps its declared/computed rect and
  unpinned members of a declared `at`+`size` frame are clamped into its padded
  interior during placement — automatically what manual `place` pins did; a
  pinned member outside the fixed frame, or a member too large for the
  interior, still fails (LIVE-P004/DDN-P004). Fixed-frame constraints bind
  placement only under `confine`; under `expand` the frame grows instead.
  Invalid values fail DDN046. Surface: `ddn-core.js` CHOICES/DEFAULTS/layout
  whitelist, `ddn-render.js` frame rect union, `ddn-patterns.js` constraint
  gating, `ddn-placement.js` confine clamp; spec chapter 15 "Frame overflow"
  section; capabilities.json property contract + implemented[]; AI-REFERENCE
  property tables; the corpus normalizer strips explicit
  `frame_overflow: expand` (gated in `test:normalize`); new suite
  `notation/tests/frame-overflow.js` (`test:frame-overflow`, 10 tests).
  Closing proof: `website/examples/basics/55-wireframe.ddn` renders correctly
  with its member `place` pins removed via the normalizer (screenshot-verified),
  resolving the wireframe escape noted in the runtime gap log; all other
  goldens byte-identical.
- Corpus normalization (B1-021): every shipped `.ddn` source is now in the
  newest source dialect (`ddn "0.5"`) and minimal — declaration properties
  whose value duplicates the effective default (global `DEFAULTS` merged
  through the view's format bundle and referenced profile declarations,
  including the `layout.center` pinned-pattern fallback) are removed, dead
  empty override blocks are dropped, and emptied profile declarations
  collapse to the bodyless form (`style classic;`). Demonstrative overrides
  stay: routing/look/layout/spacing showcases keep the property they
  demonstrate (keep decisions are logged by the tool). New permanent,
  zero-dependency tool `tools/normalize-ddn.mjs` (write mode, `--check`
  gate, `--verify` render-compare mode, `--report` JSON stats), wired into
  `npm test` as `test:normalize` (`tests/normalize-ddn.js`) so regression
  to pinned-by-default sources fails CI. Normalization was verified by
  rendering every view of every changed file before/after: all renders
  byte-identical except the deliberately un-pinned `08-subdiagrams` views
  (eyeballed, clean natural reflow). `use-cases/manifest.json` hashes
  regenerated with the new `tools/build-use-cases-manifest.mjs` (SVGs
  unchanged; `semanticHash`/`sourceHashes` follow the dialect stamp and
  minimized sources); gallery + site outputs regenerated unchanged.
- Demos and tool pages now use the efficient dist builds (B1-019 follow-up).
  The three `website/examples/embed/` proof pages load the minified modular
  IIFEs (`.min.js`); a new `esm-module.html` proof page demonstrates the
  `.mjs` browser path (with an accurate file:///CORS serving note). The
  single-file tool pages inline the minified runtime: viewer
  (`tools/build-viewer.js`), designer standalone
  (`designer/prototype/build-standalone.mjs`), the website landing page
  (`website/build-site.mjs`), and the portable Studio pages — which also get
  a real generator at last (`tools/build-portable-studio.js`, wired as
  `build:studio-portable` and freshness-gated in `test:dist-freshness`),
  replacing their stale pre-ESM inlined runtime. Modules guide and download
  page document "use `.min.js` for production embeds, `.mjs` for modern
  bundlers".
- Docs: new repo-root `AI-REFERENCE.md` — a single-file, AI-targeted DDN
  language reference (vocabulary tables, property contracts, diagnostics,
  CLI workflow, worked examples) designed to be handed to an AI so it can
  author `.ddn` sources. Refreshed for B1-019 (dist bundle formats, ESM
  runtime sources, package `exports` map) and B1-018 (diagnostics table now
  covers all 357 codes extracted from the runtime + Studio sources,
  including DDN078, DDN-E001…E011, DDN-IO01…IO09, DDN-W901, LIVE-P002), and
  names the product as ScratchWeaver per B1-020. Gated by
  `tests/ai-reference.js` (wired into `npm test`), which extracts every
  ` ```ddn ` block and runs `cli.js check` on it; linked from the README
  and rendered into the website docs landing as `docs/ai-reference.html`.

- B1-020: ScratchWeaver branding (look & feel). The product is now
  **ScratchWeaver**, from ScratchBird Software Inc.; the language keeps its
  name, Diagram Design Notation (DDN). New `assets/brand/` pipeline
  (`tools/build-brand.mjs`, zero-dependency, freshness-gated) extracts the
  ScratchWeaver logo from the ScratchBird brand sheet into a standalone SVG
  (viewBox synthesized from path extents), copies the product PNG, and
  rasterizes favicons. The website header shows the logo + ScratchWeaver
  wordmark with a "Diagram Design Notation" subtitle, every page carries
  favicon links (mirrored standalone pages get them injected by
  `website/build-site.mjs`; viewer/designer/studio pages embed data-URI
  icons via their own builders), the footer declares the ScratchBird
  Software Inc. provenance, and the site accent colour moved from teal
  (#146b7c) to the logo blue (#0c75bd). README, NOTICE, and package
  descriptions gained the product line. No DDN identifiers, filenames,
  error codes, or CSS class names were renamed; npm and GitHub repo renames
  remain out of scope.

- B1-019: ESM migration + Rollup build (RC1 preparation). Every
  `notation/runtime/*.js` and the Studio library sources
  (`notation/studio/src/{api,io,authoring,component}.js`) are now real ES
  modules with explicit imports/exports; the bespoke concatenation builder
  and its global-shadowing IIFE trick are gone. `tools/build-sdk.js` now
  drives Rollup (`tools/rollup.config.mjs`; pinned devDependencies
  `rollup@4.63.4` + `@rollup/plugin-terser@0.4.4` — the runtime still has
  zero runtime dependencies, and docs/tests now say so explicitly). Each of
  the five public bundles (`ddn-core`, `ddn-graph`, `ddn-quality`,
  `ddn-projections`, `ddn.global`) ships three formats: readable browser
  IIFE (`.js`, unchanged globals/guards/DDN-E010 semantics), minified IIFE
  with source map (`.min.js` + `.min.js.map`), and a real ES module
  (`.mjs`) with named namespace exports for tree-shaking; the package
  `sideEffects` annotation is now `["dist/*.js"]`. Cross-bundle coupling
  goes through an explicit module registry
  (`notation/runtime/ddn-module-registry.js`) instead of `host.*` lookups
  inside runtime code. Registry/glyph/profile assets are generated ESM
  modules (`notation/runtime/assets/`, freshness-gated). Behavior is
  unchanged: goldens byte-identical, full `npm test` green, new
  `test:esm-dist` (ESM smoke + measured tree-shaking) and
  `test:dist-freshness` (byte-freshness for all artifacts) suites.
- B1-018a: runtime parser/render hardening from the runtime audit
  (`notation/runtime/`). `bundle()` no longer crashes when a module identity
  is not lexable as a reference component (`/`, `:`, leading digit) — it emits
  `DDN-W014` and leaves the reference as-is — and external import aliases are
  now keyed by alias alone, so two distinct external targets under one alias
  produce a `DDN-W014` naming both targets instead of an invalid bundle that
  fails `DDN014` on re-parse; target files are parsed once per bundle, not
  once per reference. `workflowErrors` reachability is now breadth-first over
  an adjacency map (was O(states × transitions); a 200k-state input hung), and
  its cycle-cut DFS, `createWorkspace` import loading, `bundle()`'s import
  walk, the layered-layout Tarjan SCC, the tree/mindmap subtree walks, and the
  pattern solver's `directedRanks` are all iterative — deep hostile inputs can
  no longer cause uncaught `RangeError` stack overflows. A `uid` of
  `"__proto__"` can no longer corrupt the placement/route/key maps (now
  null-prototype objects). Module ids deeper than 16 dotted segments resolve
  as sibling references; `publication.width`/`height`/`margin` must be finite
  and bounded (`DDN046`); `DDN020` messages now name the offending import
  path. Render lane: SQL DDL export sanitizes ids/kinds interpolated into
  `-- ` comments (newline injection into the `.sql` artifact is neutralized);
  the text-metrics request capture map is bounded at 4096 entries (FIFO);
  registry-supplied colours, dash patterns, and silhouettes are escaped in SVG
  attributes (matching `ddn-sketch.js`); subdiagram reference hrefs accept
  only safe relative identifiers (new code `DDN078`); spread-based
  `Math.min/max` over model-size arrays is replaced with reduces; sample
  tables render at most 1000 rows with an explicit "+N rows not rendered"
  note; unknown `style.font` falls back to the sans family instead of emitting
  `font-family:undefined`; pattern solvers enforce a search-budget cap (new
  code `LIVE-P002`). Regression tests: `notation/tests/audit-hardening.js`
  (`npm --prefix notation run test:audit-hardening`), every test verified to
  fail against the pre-fix sources.

- B1-018b: designer/viewer hardening from the pages audit. The viewer's view
  picker works again (options are now index-valued into the picker list —
  the old empty-separator join/`split('')` made every switch fail with
  LIVE012); renderer SVG enters the DOM through a `safeSVG()` sanitizer
  ported from the designer (DOMParser + script/foreignObject/on\*/href
  stripping) instead of raw `innerHTML`; the drop filter's dead `|| true`
  clause is gone (only plausible `.ddn`/text files accepted); opened files
  are capped at 50 MB with a user-facing message, stored in a
  prototype-free map (duplicate basenames reported, `__proto__` safe), and
  the file input resets after load; loading a new document resets selection
  and presentation overrides; PNG export canvas is capped at 16384 px per
  side. Designer: persisted splitter widths are validated at boot
  (`splitters.bootWidth`) so corrupt localStorage values can no longer throw
  or collapse panels; the dead `#fileInput` element was removed; `setView`'s
  unknown-view fallback scans real workspace entries. Regenerated artifacts:
  `notation/viewer/ddn-viewer.html`, designer `index.html`/`standalone.html`,
  website mirrors.

- B1-017: the repository root stops being the website — **`website/` is now
  the deployable, fully self-contained static site** (works from `file://` and
  any static host; no `../` escapes, enforced by `tests/website-links.js`).
  `examples/` moved to `website/examples/` and `docs/` to `website/docs/`
  (git mv, history preserved); the old root `index.html` was superseded by a
  redesigned `website/index.html` (shared design system `website/assets/site.css`,
  hero + live in-browser render panel, feature grid, responsive to 360 px).
  New zero-dependency generator `website/build-site.mjs` (`npm run build:site`)
  mirrors the standalone tools (`tools/viewer/`, `tools/designer/`,
  `tools/studio/`), the gallery (`gallery/`), the notation plates (`plates/`),
  and the runtime bundles (`dist/`), and renders all Markdown documentation —
  `website/docs/**`, `website/examples/README.md`, `standard/specification/*`,
  `standard/governance/**`, Studio tool docs — to shell-wrapped HTML with a
  small deterministic built-in renderer. Generated outputs are committed;
  `tests/website-links.js` (`npm run test:site`, wired into `npm test`) checks
  every link on every page and re-runs the build into a temp directory to
  byte-compare freshness. `standard/` stays at the repository root; the site
  surfaces it as rendered HTML copies. Root README rewritten; CI smoke-test
  paths, test suites, gallery builder, and tooling updated for the new paths.
- B1-016: project renamed to **Diagram Design Notation** (formerly "Data"
  rather than "Diagram"; every user-visible occurrence of the old long name
  was swept). The acronym **DDN is unchanged** — every machine identifier
  (`DDNLive`, `ddn-*.js` bundles, `.ddn` extension, npm package names, error
  codes, CSS classes, `ddn-workspace@1`) stays as it was. The rename touches
  user-visible long-name occurrences only: READMEs, landing/viewer/studio/
  designer pages, the registry display name, gallery and standalone-page
  generators, and this changelog. Versions stay `0.6.0-beta.1` (runtime) and
  `0.2.0-beta.1` (designer).
- B1-014: designer display options, text download formats, resizable and
  window pop-out panels. The designer prototype's shelf gains a **Display**
  tab — presentation-only (never written to source): global typography and
  relation options (routing/crossings/endpoint ordering/curve tension/radius/
  per-verb routing) through the existing per-view override channel, plus
  per-kind typography and kind/verb/object colours as a localStorage-backed
  CSS overlay on the `.ddn-kind-*`/`.ddn-verb-*`/`data-ddn-id` hooks. The
  Download modal regroups into **Text** (current file `.ddn`; single
  self-contained sectioned `.ddn` of the entire workspace via
  `DDNLive.io.bundle` — re-opens anywhere DDN loads; ZIP of all sources) and
  **Image** (SVG/PNG/WebP, unchanged). Floating panels resize (`resize: both`,
  220×160 minimum, visible grip, session-only), and the shelf/inspector can
  pop out into a separate OS window for multi-monitor work — fully functional
  there (panel lookups go through live `panelRoot` element references across
  documents) and re-docking when the window closes. Covered by
  `designer/tests/b1-014-display-and-popout.js`.
- B1-015 / RFC-117: self-contained multi-module `.ddn` files and bundling. A
  file may hold several `module "…";` sections — model, data, views and
  formats in one file (`examples/basics/61-self-contained.ddn`). File-level
  imports precede the first module header (canonical) or immediately follow
  the FIRST header (legacy position, unchanged for existing files); an import
  anywhere else is rejected with the new diagnostic DDN015. Sibling sections
  resolve each other by module-qualified id with no import between them;
  importing a multi-module file imports all its modules. Module/declaration
  identity guards (DDN013/DDN014/DDN023/DDN024) are unchanged, the source
  version stays `"0.5"`, and older runtimes reject multi-section files with a
  clean DDN010. New bundle surface: `DDNLive.io.bundle(files, entry)` and
  `node notation/cli/cli.js bundle <entry.ddn> --workspace . --out out.ddn`
  merge a workspace into one sectioned file — original section bodies minus
  header lines (comments/formatting preserved), entry module first then by
  module id, inter-bundle imports dropped (alias references canonicalized to
  module-qualified sibling references), external imports kept at the top with
  a DDN-W013 warning — deterministic, with a byte-identical render
  round-trip proven over 75 views of the basics/projections/quality
  workspaces (`notation/tests/multi-module.js`, `notation/tests/bundle.js`).

- B1-012: designer prototype chrome rework — the Download modal gains Current
  PNG (2×) and Current WebP (2×) beside DDN/ZIP/SVG (serialize-to-`<img>`, 2×
  canvas, `toDataURL`, mirroring the viewer; WebP feature-detected with the
  button disabled + reason when unsupported — never a mislabeled file; the
  renderFailure guard blocks every diagram format; filenames
  `designer-prototype.{svg,png,webp}`). Density is driven by `--ui-*` custom
  properties: Compact (12 px/28 px buttons/56 px palette cells) is the default
  with a persisted Compact/Comfortable toggle (Comfortable ≈ the old
  14 px/34 px). Draggable splitters resize shelf/inspector columns
  (160–420 px / 220–520 px clamps, double-click reset, persisted). Shelf and
  inspector detach into floating, title-bar-draggable panels with canvas
  reflow (column collapses to 0) and re-attach; floating is session-only.
  Every bottom sheet gains a collapse toggle. Palette buttons render the
  kind's real notation plate glyph via the new additive runtime accessor
  `DDNLive.glyphs.forKind(kindId)` (symbol body + viewBox + meaning, null when
  absent; code text fallback), chrome icons are original stroke SVGs in the
  plate style (no third-party artwork), and every button carries a
  descriptive tooltip. New suites `designer/tests/b1-012-designer-chrome.js`
  (7 tests: pure splitter/density/export units, chrome greps, headless
  chromium driver generated from the real standalone.html incl.
  detach/float/reattach + an ED-002 matrix edit committing afterwards, PNG/WebP
  MIME prefixes) and `notation/tests/glyphs.js` (6 tests). All additive:
  ED-001…ED-013 + B1-002 green, build-standalone byte-identity gate green.

- B1-011: viewer typography + relation options — the end-user viewer's
  free-text font input is replaced by global family/size dropdowns (the four
  runtime stacks, 8–24 px, applied through the reflow-safe `font`/`fontSize`
  override channel); a per-kind typography section mirrors the colour
  enumeration with family+size dropdowns per kind as CSS overlays on
  `.ddn-kind-<code> text` (no reflow, documented); relations get a full
  options editor — a master row (routing orthogonal/straight/curved/rounded,
  curve tension, curve radius, crossings gap/bridge/square bridge, endpoint
  ordering optimize/preserve), one routing row per verb, and a
  click-an-edge per-relation routing editor (highlight + panel). The render
  override channel is extended additively: `relationRouting` keyed by verb or
  relation id (id wins over verb, verb wins over view routing; `rounded` →
  curved+rounded per relation; unknown keys LIVE022, bad values LIVE023,
  LIVE021/LIVE020 guards) and view-level `curveTension`/`curveRadius`
  (LIVE003 range-checked, inert when routing is not curved). No junctions
  control ships by design: the core only permits explicit junction semantics
  (DDN046). New suite `notation/tests/render-overrides.js` (10 tests) +
  extended `tests/viewer.js`; all presentation-only — source bytes never
  modified, zero golden changes.

- B1-010: full example gallery + developer documentation — new deterministic
  generator `tools/build-gallery.js` (wired as `npm run build:gallery`)
  produces `examples/gallery/`: one CLI-rendered SVG for every installed
  profile (73, coverage map generated from `basics/`, `projections/` and
  `quality/` examples — the generator fails on an uncovered profile), plus
  five variation sheets (12 chart marks, 3 looks × 6 palettes, 4 routing
  modes × 3 looks, 11 layout algorithms, 4 spacing levels) rendered from new
  real-content sources under `examples/gallery/src/` — 130 committed SVGs, a
  machine-readable `coverage.json`, and a static, `file://`-safe
  `index.html` linking the pre-rendered SVGs (no inlined runtime). New
  developer documentation under `docs/developers/` (orientation,
  getting-started, modules/bundles, API reference, embedding, viewer,
  styling, data-refresh, source authoring, 0.5 → 0.6 migration) verified
  against `notation/studio/src/public.d.ts`. New permanent gate
  `notation/tests/gallery-coverage.js` (wired as `test:gallery-coverage`
  into the notation test chain) fails when any installed profile lacks a
  gallery entry, when any gallery SVG is missing/non-SVG, when
  api-reference.md names a method absent from `public.d.ts`, or when the
  developer docs contain placeholder markers. Deleted the stale import-era
  `examples/basics/manifest.json` (covered only examples 01–18, referenced
  nonexistent `examples/rendered/` paths, stamped `0.5.0-draft.1`, consumed
  by nothing — repo-wide grep verified zero references; the live golden
  manifest is `examples/use-cases/manifest.json`). Root README and
  index.html link the gallery and the developer docs.
- B1-009: Beta-1 script and golden refresh — ran the full verification
  matrix over every `.ddn` in `examples/` (114 files: `cli.js check` on
  each, every declared view rendered twice, byte-determinism, and the 27
  use-case goldens compared against `manifest.json` hashes and rendered
  bytes) with zero mismatches. Deliberate feature adoption: exactly one
  pre-existing example, `examples/basics/29-concept-map.ddn`, now declares
  `spacing: loose` (all five relations carry long author-written on-edge
  labels that routed tight against parallel curves; before/after renders
  in the report). New permanent parse gate `notation/tests/doc-snippets.js`
  (wired as `test:doc-snippets` into the notation test chain) extracts and
  parse-checks every ```ddn fenced block in `README.md` and
  `standard/specification/*.md`. Stale draft-series wording about the
  project's own status aligned with Beta 1 (spec 00 status chapter,
  chapter stamps of spec 21–25, `notation/CHANGELOG.md`, root README's
  designer-version stamp); standard-status "draft proposal, pre-1.0"
  wording and the pinned registry/language versions are unchanged per
  `standard/governance/VERSIONING.md`. All generated artifacts rebuilt in
  dependency order (build:sdk → build-ui-maps → build-standalone →
  build-standalone-pages → build-viewer), byte-identical.
- B1-008: spacing hints — new optional additive `spacing` property on views
  and on `bundle` declarations inside formats (`tight | normal | loose |
  expanded`; view declaration wins over the format's; absent = `normal`).
  Registered additively in the ddn-core property whitelists per VERSIONING
  rule 1 (no language version bump); an unknown value is rejected as `DDN033`.
  Fixed deterministic factors 0.75/1.0/1.4/2.0 scale the graph-family
  inter-node horizontal/vertical gaps (`gap`, `row_gap`, including the
  pin-pattern pitch), derived layer/band spacing, and the route-label
  reservation margins (8/10 px at `normal`), rounded via the renderer's
  existing numeric helper — so relation routes carrying long text labels get
  wider reserved bands before routing and shorter detours at `loose`/
  `expanded`. Node bodies, fonts, glyphs and fixed canvas furniture never
  scale; fixed-grid projections (chart, matrix, panels, table, timeline,
  fishbone, decision, sequence, timing) ignore the hint by documented design
  with no `check()` warning. `normal` (and omission) is byte-identical to the
  historical output — the entire existing golden set is unchanged (zero
  golden regeneration). Runtime: `ddn-core.js` (whitelist + precedence +
  validation), `ddn-layout.js` (`SPACING`/`spacingScale`; gap and label-band
  scaling in `layoutNodes`/`routingAttempt`/`curvedRouting`),
  `ddn-placement.js` (pattern-gap scaling), `ddn-render.js` (reflow column
  estimate). New suite `notation/tests/spacing-hints.js` (13 tests, wired in
  as `test:spacing-hints`): enum acceptance/rejection on views and formats,
  normal == omitted byte-identity on a multi-view fixture, precedence,
  monotonic canvas spread, label-reservation geometry from scene JSON,
  fixed-grid invariance, determinism. New example
  `examples/basics/60-spacing-hints.ddn` (one model, four views). Docs: spec
  15 (spacing property table + factors), spec 03 (declaration + precedence),
  capabilities.json, examples/README.md, root README.md.

- B1-007: end-user viewer — new single-file, non-designer viewer
  `notation/viewer/ddn-viewer.html` (runtime inlined; sources in
  `notation/viewer/src/`, deterministic build step `tools/build-viewer.js`
  wired as `npm --prefix notation run build:viewer`). Runs from `file://`
  in Chrome and Firefox (no Chrome-only APIs — file input, drag-drop,
  2D canvas + `toDataURL`, Blob downloads only). Features, all client-side:
  open `.ddn` via file picker, drag-drop, or paste; view picker populated
  from the source's declared views; zoom controls (Fit page / Fit width /
  Fit height / 100% / − / + with live % display) implemented as CSS
  transform scale against the SVG's declared size; font-family override;
  colour overrides for every object kind and relation class present in the
  view plus per-object overrides by clicking a node. Per-object overrides
  ride a new additive renderer hook: node marks now carry
  `data-ddn-id="<element-id>"` (`ddn-render.js` graph nodes and
  `ddn-shapes.js` profile-kind nodes) — use-case golden SVG hashes
  regenerated (27 views; semantic hashes unchanged). Overrides are CSS rules
  in the viewer DOM only; the source text is never modified and the status
  bar says so. Reset clears all overrides; Export SVG/PNG downloads the
  diagram as presented (PNG rasterised at 2×). New suite
  `notation/tests/viewer.js` (6 tests, wired in as `test:viewer`): build
  determinism (three byte-identical builds matching the committed file),
  generated-markup control checks, node unit tests of the pure functions
  `computeFitScale` / `overrideRuleFor` / `viewListFrom`, and a fixture
  render asserting the override selectors exist in real output. New usage
  doc `notation/viewer/README.md`; viewer linked from the root `index.html`
  landing grid.

- B1-006: data refresh API — new public `ws.replaceData(name, records)` on the
  workspace object (backing implementation `DDNLive.authoring.replaceData`):
  it rewrites ONLY the named `data` block's record lines (declarations
  carrying an `x_record` value record) with the canonical authoring
  serializer — same key order as the incoming objects — applies one validated
  source transaction and returns `{revision, diagnostics}`. Field-shape
  contract keyed on the block's existing first record (order-insensitive;
  empty replacement legal only for record-less blocks): violations throw
  `DDN-E011`, unknown/ambiguous block names reuse `DDN-E002`, and the source
  is untouched on error. Record counts may grow (deterministic
  `<name>_r<N>` ids) or shrink (trailing record lines removed). Guarantees,
  proven in new suite `notation/tests/data-refresh.js` (12 tests, wired in as
  `test:data-refresh`): same-values refresh renders every view (graph +
  chart + matrix) byte-identical; changed values leave graph views
  byte-identical and move only chart/matrix marks (identical axis/title/
  footer text nodes, changed mark geometry/labels); output source depends
  only on (source, name, records); CLI `check` passes after refresh. New
  example `examples/basics/59-data-refresh.ddn` and browser proof
  `examples/embed/data-refresh.html` (ddn-core + ddn-graph + ddn-projections
  only; button swaps the dataset and re-renders in place). Spec chapter
  `20-projection-sdk-and-editing.md` gains a "Data refresh" section with the
  3-line dashboard recipe; `public.d.ts` updated.

- B1-005: npm packaging — `notation/package.json` gains `main`/`module`/
  `types`, an `exports` map (`.`, `./core`, `./graph`, `./projections`,
  `./quality`, `./package.json`; `require` → `.js`, `import` → `.mjs`, types →
  `.d.ts`/`.d.mts`), a `files` allowlist (`dist`, `README.md`),
  `"sideEffects": true` (the bundles register onto `globalThis`), and
  `prepublishOnly: npm run build:sdk`. The non-core `.mjs` wrappers now import
  their prerequisite bundles first (`core` → module), so one ESM `import` of
  `@ddn/notation/graph` is self-sufficient; same-version module stacking in
  one realm stays a no-op per the B1-004 guard. `npm pack` yields a
  788,983-byte tarball of exactly `dist/` + `README.md` + `package.json`; a
  temp consumer install proves all five subpaths in both CJS and ESM, core's
  `DDN-E010` on render, and byte-identical graph rendering vs the all-in-one.
  New suite `tools/tests/packaging.js` (root test chain, after notation
  tests; pack → extract → child-process requires, no network). No registry
  publishing; no dependency changes.

- B1-004: modular runtime bundles — the SDK now ships as optional libraries in
  `notation/dist/`: `ddn-core.js` (parse/build/validate/export, projection and
  quality planning data, workspace API; no rendering), `ddn-graph.js` (graph
  renderer), `ddn-projections.js` (chart/matrix/panels/timeline/table/sequence/
  timing/chen) and `ddn-quality.js` (quality charts/decision/fishbone), each
  with `.mjs` and type copies, plus the unchanged all-in-one `ddn.global.js`.
  Load-order guards (core → graph → quality/projections, double-load no-op,
  single-version guard kept); the engine is now a renderer registry
  (`DDNEngine.registerProjectionRenderer`) and rendering or planning an
  unregistered kind throws new coded error `DDN-E010` naming the bundle that
  provides it. `tools/build-sdk.js` is data-driven (one `BUNDLES` map builds
  both the modules and the all-in-one), emits a generated
  `notation/dist/README.md`, and `release/validation/sdk-build.json` gains a
  per-bundle `bundles` object (bytes/sha256/files). Browser proofs:
  `examples/embed/core-graph.html` and `examples/embed/core-only-check.html`.
  Full-bundle behavior is byte-identical (whole existing golden set unchanged).

- B1-003: deterministic CSS class hooks on every rendered SVG mark — root
  `ddn-svg ddn-view-<kind> ddn-profile-<slug>`, nodes `ddn-node ddn-kind-<code>`,
  relations `ddn-rel ddn-verb-<verb>`, plus `ddn-field`, `ddn-label`,
  `ddn-panel`, `ddn-frame` and `ddn-mark ddn-mark-<type>` in projections.
  Pure addition of `class` attributes: no visual change without page CSS,
  renderer stays deterministic (registry-derived classes only), script-level
  presentation stays inline and wins for the elements it names; no `<style>`
  block and no `!important` in renderer output. Optional ready-made stylesheet
  `notation/dist/ddn.css` (source `notation/studio/src/ddn.css`, real rules
  mapping the hook classes to `--ddn-*` custom properties) and an optional
  `theme` attribute on `<ddn-example>` injecting those properties as a
  constructed stylesheet. Cascade documented in spec 04 §11 and spec 14.
  Use-case goldens (27) regenerated through the documented manifest path.
  New example `examples/basics/58-css-hooks.ddn` (+ companion `.html`) and
  headless fixture `notation/tests/fixtures/css-override.html`.
- B1-002: registry-driven element defaults — every kind in both registry
  catalogues carries a `defaults` object (additive growth; `{}` where a kind
  has no meaningful defaults, meaningful sets for `cache`, `archive`, `cloud`,
  `snapshot`, `history`). New public API `DDNLive.defaults.forKind(kind)`
  (runtime `notation/runtime/ddn-defaults.js`, d.ts updated). The designer
  creation commands merge registry defaults before explicit properties
  (explicit wins) and write them into the source; the renderer never applies
  them, so all pre-existing sources render byte-identical. Schema build
  type-checks defaults against the property contracts. New example
  `examples/basics/57-element-defaults.ddn`.

## [0.6.0-beta.1] - 2026-09-20

Beta 1: 38 runtime items, 13 designer items — see item history. Runtime and
standard packaging release: every version stamp moves from `0.5.0-draft.2`
(designer `0.1.0`) to `0.6.0-beta.1` (designer `0.2.0-beta.1`). Not a language
change — `ddn "0.5"` sources and `ddn-core@0.3` are untouched.

- Designer prototype: canvas template starters (BMC, Lean, SWOT, PEST, PESTLE,
  Porter 5, empathy, scorecard) generating pre-populated panels views in one
  command (ED-013).
- Designer prototype: sequence diagram editor for `uml.sequence@1` (lifelines,
  messages, returns, declaration-order moves) (ED-012; covers VE-AC-062/063).
- Designer prototype: lane editing on view frames (create/rename/resize/assign
  with previews; `x_partition` for `uml.activity@1`) (ED-011; covers
  VE-AC-040).
- Designer prototype: draft validation UX (Problems strip, incomplete typing,
  workspace review scope, occurrence-addressed navigation) (ED-010; covers
  VE-AC-006/007).
- Designer prototype: occurrence addressing layer (`occ:` ids,
  add-existing/remove/move/override commands with explicit restriction
  responses) (ED-009; covers VE-AC-036).
- Designer prototype: relation reconnection command with impact preview (drag
  + inspector paths), closing the AUD-003 reconnection gap (ED-008; covers
  VE-AC-023).
- Designer prototype: decision table editor (`rule.row` rows, typed
  predicates, hit-policy command, analysis and fixture evaluation) (ED-007;
  covers VE-AC-059/060).
- Designer prototype: panels editor (grid, item moves, child-view slots,
  canvas fixed-grid guards) (ED-006; covers VE-AC-055/056).
- Designer prototype: fishbone editor (effect/category/cause commands,
  attach-existing-cause with distinct occurrence paths) (ED-005; covers
  VE-AC-057).
- Designer prototype: timeline editor (date controls, drag-as-date-edit with
  preview, `analysis.precedes` dependency linking) (ED-004; covers VE-AC-054).
- Designer prototype: chart editor (record sheet, profile-legal mark
  switching, binding pickers, contributor inspection) and a
  `setProjectionBinding` command contract (ED-003; covers VE-AC-051/052/053).
- Designer prototype: matrix (RACI/CRUD/relations) cell editor with atomic
  batch commits (ED-002; covers VE-AC-049/050).
- Designer prototype: full 188-kind palette driven by `kind-ui-map.json`,
  descriptor-driven inspector header, separable `commands.js` command layer,
  and a Node-based designer test suite (ED-001).
- Family tree / genealogy views via profile `family.tree@1`
  (`family.person`/`family.union`, `family.partner_of`/`family.parent_of`,
  `x_birth`/`x_death`, `DDN-PJ129`/`DDN-PJ130`). RFC-116.
- Low-fidelity UI wireframes via profile `wireframe.ui@1` (seven-control
  stencil, scoped-frame nesting, warning `DDN-PJ128`). RFC-115.
- Network/bus and rack views via profiles `network.basic@1`/`network.rack@1`
  (four original glyphs, `network.attaches`, `x_rack`, `DDN-PJ127`);
  removes 'native bus/junction-network drawing' from capabilities
  `unsupported[]`. RFC-114.
- Fault tree and event tree views via profiles `fault.tree@1`/`event.tree@1`
  (`tree.gate`/`tree.event`, `x_gate`, `DDN-PJ126`). RFC-113.
- PERT/CPM critical-path views via profile `pert.cpm@1` (`x_estimate`,
  computed passes, `DDN-PJ124`/`DDN-PJ125`); removes 'critical-path
  scheduling' from capabilities `unsupported[]`. RFC-112.
- ArchiMate-style layered views via profile `archimate.basic@1` (nine-kind
  vocabulary, `DDN-PJ123` layer-pair legality). Profile-level coverage, not
  ArchiMate conformance. RFC-111.
- SysML-style profiles `sysml.bdd@1`/`sysml.ibd@1`/`sysml.parametric@1`
  (blocks, ports, flows, constraints; `DDN-PJ121`/`DDN-PJ122`).
  Profile-level coverage, not SysML conformance. RFC-110.
- CMMN-style case views via profile `cmmn.basic@1` (stages/milestones/
  sentries, `DDN-PJ120`). Profile-level coverage, not CMMN conformance.
  RFC-109.

- Interaction overview views via profile `uml.interaction_overview@1`
  (`x_subdiagram` view references, `DDN-PJ119`). RFC-108.

- Timing/state-over-time projection (`kind:timing`, profile `uml.timing@1`,
  `x_states`), with `DDN-PJ118` validation. RFC-107.

- BPMN-style process collaboration via profile `bpmn.basic@1` (pools/lanes,
  typed events/gateways, cross-pool message flow; `DDN-PJ116`/`DDN-PJ117`).
  Profile-level coverage, not BPMN conformance. RFC-106.

- Activity-style views with partitions, fork/join and object nodes via profile
  `uml.activity@1` (`DDN-PJ114`/`DDN-PJ115`). RFC-105.

- Hierarchical state views via profile `state.composite@1` (composite frames,
  dashed regions, `DDN-PJ113`). RFC-104.

- Object/instance snapshots via profile `uml.object@1` (`x_instance` classifier
  binding), `DDN-PJ112` slot validation. RFC-103.

- Communication/collaboration views via profile `uml.communication@1` with
  declared message numbers (`x_message.seq`), `DDN-PJ111` validation. RFC-102.

- Sequence-style interaction projection (`kind:sequence`, profile
  `uml.sequence@1`, verb `uml.message`, `x_return`), with
  `DDN-PJ110`/`DDN-PJW03` validation. RFC-101.

- Venn diagrams (2 or 3 sets) via new profile `panels.venn@1` with registered
  `x_sets` membership, fixed region-count geometry, and `DDN-PJ090`/`DDN-PJ091`
  validation.

- Pyramid diagrams via new profile `panels.pyramid@1` (3..5 trapezoid bands
  with optional side annotations), validated by `DDN-PJ089`.

- SQL DDL export: `export { format: sql; … }` on the redacted allowlist profile
  emits CREATE TABLE/PRIMARY KEY/FOREIGN KEY DDL with `-- skipped:` audit
  comments (`DDN-PJ088`, `DDN-PJ092`; allowlist enforcement remains `DDN150`).

- Crow's-foot ERD profile `erd.crowfoot@1`: obligatory `source_mark`/`target_mark`
  cardinality (`one`/`zeroone`/`many`/`zeromany`) on ref/assoc relations, validated
  with `DDN-PJ087` (unknown marks remain `DDN114`).

- User story maps via new profile
  `matrix.storymap@1` (assoc cells carrying `x_story.task` references to
  `analysis.task` stories), with `DDN-PJ086`/`DDN-PJ093` validation.

- Journey maps via new profile
  `panels.journey@1` (phase/lane grid + straight-segment 1..5 emotion polyline), with
  `DDN-PJ084`/`DDN-PJ085` validation.
- Empathy map and balanced scorecard via new profiles
  `canvas.empathy@1`/`canvas.scorecard@1`, with `DDN-PJ083` required-panel
  validation.
- Matrix pack: BCG, Ansoff and TOWS profiles
  (`matrix.bcg@1`/`matrix.ansoff@1`/`matrix.tows@1`) with the registered `x_category`
  axis record and `DDN-PJ082` quadrant validation.
- Canvas pack B: PEST, PESTLE and Porter five-forces via new profiles
  `canvas.pest@1`/`canvas.pestle@1`/`canvas.porter5@1`, with `DDN-PJ081`
  required-panel validation.
- Canvas pack A: Business Model Canvas and Lean Canvas via new profiles
  `canvas.bmc@1`/`canvas.lean@1` (panels projection), with `DDN-PJ080`
  required-block validation.
- EPC diagrams via new profile `epc.basic@1` with `epk.event`/`epk.function`/`epk.connector`
  kinds, new `epk.next` verb, new `hexagon` silhouette, and `DDN-PJ105`/`DDN-PJ106`
  validation.
- Concept maps via new profile `concept.map@1` with mandatory explicit relation
  labels (`DDN-PJ104`).

- Mind maps via new profile `mindmap.basic@1` over the native mindmap layout
  (shared `DDN-PJ102` single-root validation).

- Work breakdown structures via new profile `wbs.tree@1` and new profile verb
  `analysis.decomposes` (reuses RT-008's top-down tree layout and `DDN-PJ102`
  single-root validation).

- Org charts via new profile `org.tree@1` and new core verb `reports_to`;
  native tree layout now honours `direction: down`; `DDN-PJ102` single-root
  validation.

- C4-style profile set (`c4.context@1`, `c4.container@1`, `c4.component@1`) with
  six profile kinds, the `c4.rel` verb, boundary frames, and
  `DDN-PJ100`/`DDN-PJ101` validation.

- Sankey diagrams via new profile `chart.sankey@1` (mark `sankey`, reusing the
  chart `target` property as a binding), with `DDN-PJ079`/`DDN-PJ108`
  validation.

- Treemaps via new profile `chart.treemap@1` (mark `treemap`), with
  `DDN-PJ078` validation.

- Candlestick/OHLC charts via new profile `chart.candlestick@1` (mark
  `candlestick`, new chart properties `open`/`high`/`low`/`close`), with
  `DDN-PJ076`/`DDN-PJ077` validation.

- Gauge/KPI dials via new profile `chart.gauge@1` (mark `gauge`), with
  `DDN-PJ074`/`DDN-PJ075` validation.

- Funnel charts via new profile `chart.funnel@1` (mark `funnel`), with
  `DDN-PJ073`/`DDN-PJ107` validation.

- Radar/spider charts via new profile `chart.radar@1` (mark `radar`), with
  `DDN-PJ071`/`DDN-PJ072` validation.

- Chrome/file:// fix: `index.html` and `standard/plates/index.html` are now
  single-file pages (runtime and plates inlined via
  `tools/build-standalone-pages.js`). Flatpak Chrome exposes only the opened
  file to the sandbox, which blocked the external `ddn.global.js` subresource
  ("DDNLive is not defined"); the inlined pages are immune. All linked
  standalone pages (gallery, Studio, designer prototype) were already
  self-contained. Verified in Chrome 151 and Chromium over `file://`.
- Standalone readiness: root `index.html` landing page with live in-browser
  render, `standard/plates/index.html` notation-plate browser, and
  `designer/prototype/standalone.html` single-file designer prototype
  (imported from the designer package, license header updated). Studio and
  gallery nav links retargeted to in-repo destinations; all entry pages
  verified over `file://` (headless Chromium: no console errors, all render).
- Repository created as the DDN open-source monorepo:
  - Imported DDN 0.5.0-draft.2 sources (notation runtime, CLI, Studio,
    specification, grammar, schemas, registry, examples) from the previous
    single-tree package.
  - Imported DDN Designer specification 0.1 (specification, contracts,
    prototype, research, design records, decisions) from its standalone
    package.
  - Relicensed MIT → GPL-2.0-or-later across imported sources.
  - Excluded generated corpora and prebuilt sites (field guide, enterprise
    review, rendered outputs, release evidence); available in the archived
    packages.
