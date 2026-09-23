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
`notation/tool/src/{template.html,tool.css,tool.js}` by
`node tools/build-tool.js` (run after `build:sdk`). Do not edit the built
file.

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

## Test hooks

`window.DDNTool` mirrors the old `DDNViewer` surface (pure functions plus
`loadFiles`, `setFit`, `exportSvgString`, `setDrawer`, `getDrawerConfig`,
`state`, …) for tests and integrations; `window.DDNRedirect.mapLegacyParams`
is the old-URL parameter mapper used by the redirect stubs.
