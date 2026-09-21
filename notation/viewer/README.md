# DDN Viewer (`ddn-viewer.html`)

A single-file, non-designer viewer for `.ddn` diagrams. It runs from `file://` —
no server, no install, no network: the full DDN runtime is inlined into the one
HTML file. Open the file in any current browser (Chrome or Firefox), load a
source, pick a view, and control presentation. There are no editing features.

## Getting the file

`ddn-viewer.html` is committed beside this README and is regenerated from
source pieces (do not edit it directly):

- sources: `src/template.html`, `src/viewer.css`, `src/viewer.js`
- build: `npm --prefix notation run build:viewer` (run after `build:sdk`;
  `tools/build-viewer.js` inlines `dist/ddn.global.js` + the sources into the
  template; the build is deterministic — same inputs, byte-identical output)

## Using it

Loading a source (three ways, all client-side):

- **Open .ddn…** — file picker; multiple files may be selected (the first is
  the entry, the rest are available to `import`).
- **Drag-drop** — drop one or more `.ddn` files anywhere on the page.
- **Paste** — paste source text into the sidebar textarea and press
  *Load pasted source*.

Once loaded:

- **View picker** — lists every view declared in the loaded files
  (`file · view name`).
- **Zoom** — *Fit page*, *Fit width*, *Fit height*, *100%*, *−* / *+* buttons;
  the current percentage is shown next to them. Fits recompute on window
  resize; pressing *−* / *+* switches to an explicit scale.
- **Font override** — type a CSS font-family stack (e.g. `Georgia, serif`);
  applies to all diagram text.
- **Colour overrides** — the sidebar lists every object kind and relation
  class present in the current view, each with a colour picker. Click an
  object in the diagram to override that one object only. Overrides are CSS
  rules on the B1-003 class hooks (`.ddn-kind-<code>`, `.ddn-verb-<verb>`,
  `[data-ddn-id="<element id>"]`).
- **Reset overrides** — clears all font/colour overrides.
- **Export SVG / Export PNG** — download the diagram as currently presented
  (overrides included). PNG is rasterised on a 2× canvas.

**Overrides are presentation-only.** They live in a `<style>` element in the
viewer page; the loaded `.ddn` source text is never modified — the status bar
says so at all times ("presentation overrides; source unchanged").

## Browser support

Works from `file://` in current Chrome and Firefox. Only standard web APIs are
used (file input/`File.text()`, drag-drop, `<canvas>` 2D + `toDataURL`, Blob
downloads) — no Chrome-only APIs such as `showDirectoryPicker` or
`OffscreenCanvas`.
