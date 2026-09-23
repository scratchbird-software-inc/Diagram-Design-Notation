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

Four client-side ways: **Open .ddn…** (file picker; multiple files allowed —
the first is the entry, the rest satisfy `import`), **drag-drop** anywhere on
the page, **paste** source text into the sidebar and press *Load pasted
source*, or a **`?src=` deep link** (B1-023): open
`ddn-viewer.html?src=<relative .ddn path>` and the viewer fetches that source
relative to the page, loads it as a single-file workspace, and selects its
first view. The website examples browser emits one such link per example. The
path must be strictly relative — any scheme (`javascript:`, `data:`, even
`https:`), host, or absolute path is rejected inline; the fetched text is
size-capped at 50 MB like a dropped file, and parse errors show via the
normal status-line error path. Over `file://` browsers block page fetches, so
a deep link there answers a clear "serve over HTTP (`npm run serve`) or use
Open file" message instead of failing silently. The designer standalone page
(`tools/designer/index.html?src=…`) accepts the same contract, loading the
file as a new single-file document.

## Controls

- **View picker** — every view declared in the loaded files (`file · view`).
- **Zoom / fit modes** — *Fit page*, *Fit width*, *Fit height*, *100%*, and
  `−` / `+` buttons; the current percentage is shown. Fits recompute on
  window resize; pressing `−`/`+` switches to an explicit scale.
- **Font family / size dropdowns** (top bar) — the four runtime font stacks
  (`sans`, `serif`, `mono`, `handwriting`, shown with their real rendered
  names) and sizes 8–24 px, or *source default*. Applied through the render
  override channel (`font` / `fontSize`) — the diagram is re-laid out, so the
  size dropdown is the reflow-safe control.
- **Typography per kind** — a sidebar row (family + size dropdowns) for every
  object kind present in the view. These are CSS rules on
  `.ddn-kind-<code> text` in the viewer stylesheet: they do **not** re-run
  layout (a larger size can overflow a shape) — see
  [styling.md](styling.md#per-kind-typography-css).
- **Colour overrides** — the sidebar lists every object kind and relation
  class present in the current view, each with a colour picker. Clicking an
  object in the diagram overrides that one object only. Overrides are CSS
  rules on the B1-003 class hooks (`.ddn-kind-<code>`, `.ddn-verb-<verb>`,
  `[data-ddn-id="<element id>"]`) — see [styling.md](styling.md).
- **Relations editor** — master row for all relation types (routing
  `orthogonal`/`straight`/`curved`/`rounded`, curve tension 0–1, curve radius
  px, crossings `gap`/`bridge`/`square bridge`, endpoint ordering
  `optimize`/`preserve`), one routing dropdown per verb in the view, and a
  click-an-edge panel that binds routing to a single relation id. All of it
  rides the render override channel (`routing`, `crossings`,
  `endpointOrdering`, `curveTension`, `curveRadius`, `relationRouting` — see
  [api-reference.md](api-reference.md)); id keys win over verb keys, verb
  keys win over the master row. Crossings and endpoint ordering are
  master-level only (pairwise canvas postprocessing). There is no junctions
  control by design: the runtime only permits explicit junction semantics
  (`DDN046`), so junctions are not routing geometry.
- **Reset typography / Reset relations / Reset overrides** — each section
  resets independently; *Reset overrides* clears everything.
- **Export SVG / Export PNG** — downloads the diagram as currently
  presented, overrides included; PNG is rasterised on a 2× canvas.

## Override model

The viewer keeps a single `presentation` state object (global font, per-kind
typography, colour overrides, relation options). Render-channel entries are
merged into `renderSync({ overrides })` — a temporary view overlay; CSS
entries live in a `<style>` element in the viewer page. The loaded `.ddn`
source text is never modified — the status bar says so at all times
("presentation overrides; source unchanged"). Because overrides ride on the
renderer class hooks and the override channel, they survive re-renders and
apply across views of the same model.

## Browser support

`file://` in current Chrome and Firefox. Only standard web APIs are used
(file input/`File.text()`, drag-drop, `<canvas>` 2D + `toDataURL`, Blob
downloads) — no Chrome-only APIs such as `showDirectoryPicker` or
`OffscreenCanvas`.
