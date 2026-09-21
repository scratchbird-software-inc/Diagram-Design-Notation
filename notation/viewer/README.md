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
- **Font family / size dropdowns** (top bar) — pick one of the four runtime
  font stacks (`sans`, `serif`, `mono`, `handwriting`, shown with their real
  rendered names) and a size (8–24 px), or *source default*. These go through
  the render override channel (`font` / `fontSize`), so the diagram is
  re-laid out — this is the reflow-safe way to change text size.
- **Typography per kind** (sidebar) — every object kind present in the
  current view gets a family dropdown and a size dropdown. These are CSS
  rules on `.ddn-kind-<code> text` in the viewer stylesheet: they restyle the
  text **without re-running layout**, so a larger size can overflow its
  shape. Use the top-bar size dropdown when you need a proper reflow.
- **Colour overrides** — the sidebar lists every object kind and relation
  class present in the current view, each with a colour picker. Click an
  object in the diagram to override that one object only. Overrides are CSS
  rules on the B1-003 class hooks (`.ddn-kind-<code>`, `.ddn-verb-<verb>`,
  `[data-ddn-id="<element id>"]`).
- **Relations** (sidebar) — a full relation options editor, all applied via
  the render override channel and re-rendered:
  - *All relation types* (master row): routing (`orthogonal`, `straight`,
    `curved` — bezier bends, `rounded` — curved with rounded bends), curve
    tension (0–1) and curve radius (px) for curved routes, crossing
    treatment (`gap`, `bridge`, `square bridge`), endpoint ordering
    (`optimize`, `preserve`). Crossings and endpoint ordering exist only at
    this level: they are pairwise canvas postprocessing, not per-edge
    geometry. There is deliberately **no junctions control** — DDN only
    allows explicit junction semantics (`DDN046` rejects anything else), so
    junctions are not a routing option; the junction-adjacent options are
    crossings and endpoint ordering above.
  - *Per relation type* — one routing dropdown per verb present in the view
    (`overrides.relationRouting` keyed by verb).
  - *Per relation* — click an edge in the diagram: it highlights and the
    *Selected relation* panel binds a routing dropdown to that relation id
    (id keys win over verb keys, verb keys win over the master row).
- **Reset typography / Reset relations / Reset overrides** — clear each
  section independently, or everything at once.
- **Export SVG / Export PNG** — download the diagram as currently presented
  (overrides included). PNG is rasterised on a 2× canvas.

**Overrides are presentation-only.** Render-channel overrides (fonts,
routing, crossings, …) are passed to `renderSync` as a temporary view
overlay; CSS overrides live in a `<style>` element in the viewer page. The
loaded `.ddn` source text is never modified — the status bar says so at all
times ("presentation overrides; source unchanged").

## Browser support

Works from `file://` in current Chrome and Firefox. Only standard web APIs are
used (file input/`File.text()`, drag-drop, `<canvas>` 2D + `toDataURL`, Blob
downloads) — no Chrome-only APIs such as `showDirectoryPicker` or
`OffscreenCanvas`.
