# Viewer

`notation/viewer/ddn-viewer.html` is the single-file, non-designer viewer
(B1-007): the full runtime is inlined into one HTML file, so it runs from
`file://` with no server, install, or network. It has no editing features —
presentation overrides only.

## Getting and rebuilding

The file is committed and regenerated deterministically from
`notation/viewer/src/{template.html,viewer.css,viewer.js}` by
`npm --prefix notation run build:viewer` (run after `build:sdk`). Do not edit
the built file.

## Loading sources

Three client-side ways: **Open .ddn…** (file picker; multiple files allowed —
the first is the entry, the rest satisfy `import`), **drag-drop** anywhere on
the page, or **paste** source text into the sidebar and press *Load pasted
source*.

## Controls

- **View picker** — every view declared in the loaded files (`file · view`).
- **Zoom / fit modes** — *Fit page*, *Fit width*, *Fit height*, *100%*, and
  `−` / `+` buttons; the current percentage is shown. Fits recompute on
  window resize; pressing `−`/`+` switches to an explicit scale.
- **Font override** — a CSS font-family stack (e.g. `Georgia, serif`)
  applied to all diagram text.
- **Colour overrides** — the sidebar lists every object kind and relation
  class present in the current view, each with a colour picker. Clicking an
  object in the diagram overrides that one object only. Overrides are CSS
  rules on the B1-003 class hooks (`.ddn-kind-<code>`, `.ddn-verb-<verb>`,
  `[data-ddn-id="<element id>"]`) — see [styling.md](styling.md).
- **Reset overrides** — clears all font/colour overrides.
- **Export SVG / Export PNG** — downloads the diagram as currently
  presented, overrides included; PNG is rasterised on a 2× canvas.

## Override model

Overrides live in a `<style>` element in the viewer page; the loaded `.ddn`
source text is never modified — the status bar says so at all times
("presentation overrides; source unchanged"). Because overrides ride on the
renderer class hooks, they survive re-renders and apply across views of the
same model.

## Browser support

`file://` in current Chrome and Firefox. Only standard web APIs are used
(file input/`File.text()`, drag-drop, `<canvas>` 2D + `toDataURL`, Blob
downloads) — no Chrome-only APIs such as `showDirectoryPicker` or
`OffscreenCanvas`.
