# Unified diagram tool

`notation/tool/ddn-tool.html` — served on the website as
`tools/index.html` — is the single-file unified diagram tool (B1-027). It
replaces the three retired pages (`tools/viewer/index.html`,
`tools/studio/index.html`, `tools/studio/editor.html`), which are now redirect
stubs forwarding their parameters. The full runtime and the example corpus
are inlined into one HTML file, so it runs from `file://` with no server,
install, or network (deep links that fetch need HTTP — see below).

## Getting and rebuilding

The file is committed and regenerated deterministically from
`notation/tool/src/{template.html,tool.css,tool.js,worker.js}` by
`node tools/build-tool.js` (run after `build:sdk`). Do not edit the built
file.

## Rendering: worker by default (B1-043)

Rendering runs in a **persistent Web Worker** by default. The main thread
compiles the view, applies presentation overrides, measures text and applies
results; the worker runs the engine computation (layout, routing, SVG
generation) so the page stays responsive on large views. Details:

- The worker is created from a Blob URL whose source the build embeds as a
  string in the single file (no external script, so `file://` and strict
  contexts work; verified from both `file://` and HTTP in Chromium).
- One request, one batched response per render: the applied view model plus a
  packed pre-measured text table (string/role tables + `Float64Array`s) go in;
  SVG, scene, diagnostics and the measured-tuple table come back.
- **Determinism guard:** every text measurement the worker reports is
  verified against the main thread's canvas measurement before the picture is
  shown. Any mismatch — or a worker failure — permanently degrades the page
  to synchronous rendering (never a wrong or divergent picture).
- A new render supersedes an in-flight one (revision counter; late results
  are discarded).
- During a render the previous picture dims and a spinner shows; the stage
  stays interactive.

`?worker=off` forces the synchronous path (debugging, tests, exotic hosts).
The status bar announces the synchronous fallback when it is active.

## Layout and drawers

The page is a diagram stage (pointer-drag pan, wheel/slider zoom, fit
page/width/height/100%) with a slim icon toolbar and four pop-in drawers:
**appearance** (top), **source** (bottom), **files** (left), **export**
(right). Drawers overlay the stage, animate open/closed, and close
independently.

Each drawer has three states — `open`, `closed`, `none` (icon hidden) —
configured by, in ascending precedence:

1. the `?mode=` preset: `diagram` (bare stage, no toolbar — for embeds),
   `view` (stage + viewport controls only), `explore` (default; toolbar, all
   drawers closed), `edit` (toolbar, source drawer open);
2. the saved settings in `localStorage` key `ddn-tool-drawers` (gear popup);
3. the URL parameter, e.g.
   `?drawers=appearance:closed,source:none,files:closed,export:closed`
   (malformed pairs are ignored).

## Loading sources

- **Files drawer**: open files / a folder / a workspace `.zip` or `.json`
  (with merge-into-current), drag-drop anywhere on the page, paste source
  text, or pick from the bundled example catalogue.
- **`?src=<relative .ddn path>`** deep link: fetches the source relative to
  the page together with its whole import closure (multi-file examples
  render), size-capped like a dropped file. Strictly relative — any scheme,
  host, or absolute path is rejected inline.
- **`?entry=<catalogue entry or relative .ddn path>&view=<view id>`**: if the
  entry is in the bundled catalogue it boots from there; otherwise the path
  is fetched with the same import closure. `history.replaceState` keeps the
  URL shareable when switching examples/views.

## Feature map (from the retired tools)

- Viewer: fit modes, per-kind/verb/object colour overrides, per-kind
  typography, click-to-select panels, PNG export — appearance drawer.
- Studio gallery: example catalogue, appearance + advanced layout/page/pen
  controls, capability-driven control disabling — files + appearance drawers.
- Studio editor: per-file source editing with apply/discard and live apply,
  undo/redo, find/replace/go-to-line, guided inspector edits (label, kind,
  pin/unpin, hide, add field, delete, go-to-source, add element/relation),
  drag-to-pin on the stage, workspace new/rename/delete and zip/json I/O,
  dirty guard on unload — source + files drawers.
- Export drawer: SVG, PNG (2×), WebP (2×), example snapshot (workspace JSON).

Rendering reuses the shared `<ddn-example>` component (`DDNLive.mount`); its
internal chrome is hidden and every feature is driven through its public
surface plus `DDNLive.authoring` / `DDNLive.io`. Presentation overrides are a
temporary view overlay — the loaded source is only changed by explicit source
or inspector edits.

## Appearance drawer: override-channel option map (B1-046)

Every presentation option the live API's override channel accepts
(`DDNLive.checkOptions` / `api.js` `defaults`) is reachable from the
appearance drawer. The mapping is guarded by a test in
`notation/tests/tool.js`:

| Drawer group | Control | Override key |
| --- | --- | --- |
| Style | Drawing style | `look` |
| Style | Palette | `theme` |
| Style | Font role | `font` |
| Style | Routing | `routing` |
| Style | Curve tension | `curveTension` |
| Style | Curve radius (px) | `curveRadius` |
| Style | Crossings | `crossings` |
| Style | Endpoint ordering | `endpointOrdering` |
| Layout | Placement | `placement` |
| Layout | Auto-place | `autoPlace` |
| Layout | Layout centre | `center` |
| Layout | Grid step (px) | `gridStep` |
| Layout | Base font (px) | `fontSize` |
| Layout | Pen roughness | `roughness` |
| Layout | Hatch shading | `hachure` |
| Content | Detail | `fields` |
| Content | Field depth (levels) | `depth` |
| Content | Relation labels | `labels` |
| Content | Domain bindings | `domains` |
| Content | Datatypes | `datatypes` |
| Content | Kind indicator | `kind` |
| Content | Chart mark | `mark` |
| Chrome | Legend | `legend` |
| Chrome | Title block | `title` |
| Chrome | Footer line | `footer` |
| Page | Page / artboard | `page` |
| Page | Width (px) | `width` |
| Page | Height (px) | `height` |
| Routing per relation class | per-verb / per-relation routing rows | `relationRouting` |

Selects offer **As authored** (`source`), which clears the override; numeric
fields clear back to the source value when emptied.

**Base font validation (DDN071):** the renderer rejects a base font whose
smallest text role (11⁄16 of the base, before page scaling) would fall below
`publication.minimum_text` (default 8pt ≈ 10.67px). The Base font input is
constrained to the satisfiable range derived from that rule (floor 16px at
the default minimum; lower when the source relaxes `minimum_text`). A value
typed in anyway produces an inline message naming the implied minimum —
"Base font 8px would make the smallest text 5.50px, below the 10.67px
minimum (DDN071) — use ≥16px" — without touching the stage; the runtime
DDN071 message itself also states the implied minimum base font. Invalid
overrides fail identically via the default worker path and `?worker=off`.

## Test hooks

`window.DDNTool` mirrors the old `DDNViewer` surface (pure functions plus
`loadFiles`, `setFit`, `exportSvgString`, `setDrawer`, `getDrawerConfig`,
`state`, …) for tests and integrations; `window.DDNRedirect.mapLegacyParams`
is the old-URL parameter mapper used by the redirect stubs.
