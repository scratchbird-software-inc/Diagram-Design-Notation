# Embedding

## Quickstart

Five runnable minimal pages under `website/examples/embed/` cover the common
embedding shapes — open the one that matches yours and copy it:

| Example | Shows | `file://` safe? |
| --- | --- | --- |
| [script-tag-global.html](../../examples/embed/script-tag-global.html) | One `<script src="ddn.global.min.js">` tag → `DDNLive.createWorkspace` → `renderSync` → `innerHTML` | yes |
| [esm-module.html](../../examples/embed/esm-module.html) | ES-module imports of `ddn-core.mjs` + `ddn-graph.mjs` (tree-shakeable, named exports) | no — module imports need any static server (`node tools/serve.js`) |
| [projections-only.html](../../examples/embed/projections-only.html) | Chart page loading only core + graph + projections bundles (skip quality/geo/Studio) | yes |
| [geo-optional.html](../../examples/embed/geo-optional.html) | A `kind:geo` view rendered *without* `ddn-geo`: inline placeholder + coded `DDN-E010` diagnostic, never a silent gap | yes |
| [data-refresh.html](../../examples/embed/data-refresh.html) | Live dashboard: `ws.replaceData(name, records)` swaps data-block records and re-renders in place | yes |
| [iso-load-monitor.html](../../examples/embed/iso-load-monitor.html) | Optional `ddn-iso` module: data-bound isometric depth (`depth: "x_record.load"`) growing/shrinking on each refresh tick with a ≤300 ms SMIL transition | yes |
| [tool-host-control.html](../../examples/embed/tool-host-control.html) | Host-controlled embedding of the unified *tool*: `?toolbar=off` + an `api`-state source drawer opened by host-page buttons via `DDNTool.setDrawer` | no — cross-frame scripting needs any static server (`node tools/serve.js`) |
| [tool-host-roundtrip.html](../../examples/embed/tool-host-roundtrip.html) | The host I/O contract: DDN **in** as a variable via `DDNTool.setSource`, change notification via `DDNTool.onSourceChange`, (edited) DDN back **out** via `DDNTool.getSource({ includeAppearance: true })` — textarea ↔ tool round trip | no — cross-frame scripting needs any static server (`node tools/serve.js`) |

The smallest useful snippet (global build, works from `file://`):

```html
<script src="ddn.global.min.js"></script>
<script>
  const ws = DDNLive.createWorkspace({ "model.ddn": sourceText });
  const r = ws.renderSync({ entry: "model.ddn", view: "overview" });
  document.getElementById("out").innerHTML = r.svg;
</script>
```

`render()` is also available and returns a Promise, but it resolves on the
same thread in the same tick — rendering is synchronous; there is no worker
offload today (roadmap only). Keep views inside the
[limits](limits.md) so a synchronous render stays interactive.

## The web component

`DDNLive.mount` upgrades a host element into a live diagram
(`notation/studio/src/component.js` defines the `<ddn-example>` custom
element behind it):

```html
<div id="d"></div>
<script src="notation/dist/ddn.global.js"></script>
<script>
  const ws = DDNLive.createWorkspace(files);          // { name: source }
  const diagram = DDNLive.mount(document.getElementById("d"), {
    workspace: ws, entry: "model.ddn", view: "overview"
  });
  diagram.ready.then(r => console.log("rendered in", r.milliseconds, "ms"));
  diagram.addEventListener("ddn-render", e => { /* fresh RenderResult in e.detail */ });
  diagram.addEventListener("ddn-error", e => console.error(e.detail.code, e.detail.message));
  diagram.addEventListener("ddn-navigate", e => { /* subdiagram/ref navigation request */ });
</script>
```

The element re-renders automatically when the workspace changes (any
`updateFiles`/`applyEdits`/`replaceData`). Runtime presentation changes go
through `diagram.setOptions({ theme: "dark" })` — overrides are
presentation-only and never rewrite the source. `diagram.exportSVG()` returns
the current SVG text; `diagram.getState()` returns the restorable state;
`diagram.destroy()` detaches.

`mount` is loaded only in `ddn.global.js` (the component is part of the full
bundle); the modular splits are headless — drive them with
`renderSync`/`render` and place `result.svg` yourself.

## Controlling the embedded tool

When you embed the unified *tool* (`ddn-tool.html`, served as
`tools/index.html`) in an iframe — rather than the headless runtime — the
host page controls its chrome through URL parameters at load time and the
`window.DDNTool` surface (reachable as `iframe.contentWindow.DDNTool` on a
same-origin frame) at runtime.

Host-control matrix:

| Knob | Values | Effect |
| --- | --- | --- |
| `?mode=` | `diagram` · `view` · `explore` (default) · `edit` · `design` | Preset for toolbar/icons/drawer states; `diagram` hides the toolbar *and* forces every drawer to `none`. `design` additionally turns the editing affordances on by default (drag-to-pin armed, design bar with add-element/add-relation on the stage) — see "Embedding the designer" below |
| `?toolbar=off` | `off` only; anything else ignored | Hides the whole icon toolbar **without** changing drawer availability — beats the mode preset's `toolbar:true` |
| `?drawers=` | `name:state` pairs, comma-separated | Per-drawer state, highest precedence (over localStorage and the preset); malformed pairs ignored |
| drawer states | `open` · `closed` · `none` · `api` | `none`: unavailable to everyone. `api`: icon hidden, not user-openable, **openable by host code** via `DDNTool.setDrawer`. Never offered in the gear popup, but tolerated there when present |
| `DDNTool.setDrawer(name, state)` | drawer name + state above | Opens/closes/reconfigures a drawer. Opening a `none` drawer throws `drawer "<name>" is none — unavailable; set it to closed or api before opening` — reconfigure it first |
| `DDNTool.setToolbar(visible)` | boolean | Shows/hides the icon toolbar at runtime |
| `DDNTool.getDrawerConfig()` | — | Snapshot of `{ mode, toolbar, icons, drawers }` |
| `DDNTool.loadFiles(files, entry, view)` | `{ name: source }` map | Loads host-supplied sources into the embedded tool (legacy alias of `setSource`) |
| `DDNTool.setSource(source, opts)` — **IN** | source string or `{ name: source }` map | Replaces the workspace; returns a Promise resolving after the render with `{ revision, entry, view }`, rejecting with coded diagnostics (`LIVE010/011`, `DDN-T1xx`, parser/builder codes). `opts.entry`/`opts.view` pick the initial view |
| `DDNTool.getSource(opts)` — **OUT** | — | Current source of truth: `{ files, entry, view, revision }`; `opts.single: true` flattens a single-file workspace to a string (coded `DDN-T107` on multi-file); `opts.includeAppearance: true` first serializes the current presentation into the source (see below) |
| `DDNTool.onSourceChange(cb)` / `offSourceChange(cb)` — **NOTIFY** | callback | `cb({ revision, files, entry, view })` fires debounced (200 ms) after every source-affecting action; `onSourceChange` also returns an unsubscribe function |

## Passing DDN in and out

The mermaid-style embed contract, formalized: the host keeps DDN source **as a
variable**, passes it in, and reads the (possibly edited) source back out —
identically in viewer-style (`mode=diagram`/`view`) and designer-style
(`mode=explore`/`edit`/`design`) usage, with the render worker on or off.

```html
<iframe id="tool" src="tools/index.html?toolbar=off&drawers=source:api"></iframe>
<script>
  const tool = document.getElementById('tool').contentWindow.DDNTool;
  // IN — a source string or a { "name.ddn": text } map; multi-file works.
  await tool.setSource(ddnText);                 // resolves after the render
  // NOTIFY — the "user edited something" signal.
  let latest = null;
  tool.onSourceChange(p => { latest = p; });     // { revision, files, entry, view }
  // OUT — current source of truth, straight back into a variable.
  const out = tool.getSource();                  // { files, entry, view, revision }
  const text = tool.getSource({ single: true }); // single-file flatten
</script>
```

`getSource({ includeAppearance: true })` serializes the user's current
presentation **into the returned source**: option-channel overrides
(palette/font/routing/layout/page/chrome…) are written back as the view
profile properties they came from — the exact inverse of the runtime override
channel — and the CSS-overlay overrides (per-kind/verb/object colours,
per-kind typography, which standard DDN deliberately cannot express) are
stored as the view's `x_tool_presentation` extension record, which loading
re-applies. Both writes go through `DDNLive.authoring.setViewProfile` — the
same canonical serializer every save path uses; there is no second
serializer. The round trip is guaranteed: feeding the result back through
`setSource` re-renders **byte-identical SVG** with the overrides restored
(tested headlessly in `tests/tool-host-io-http.js` and at the SDK level in
`notation/tests/tool.js`).

**Session hand-off** — two honest patterns; pick either:

1. **Keep the latest notification.** Every `onSourceChange` payload already
   carries `{ revision, files }`; when your own UI closes the embed, use the
   latest payload (or nothing, if `revision` never moved).
2. **Read on close.** When your UI tears the embed down, call
   `getSource({ includeAppearance: true })` (or plain `getSource()`) at that
   moment.

There is **no implicit "session end" event**: an iframe-less web embed cannot
know when the host considers the session over — the tool never fires one, and
`beforeunload` is not observable as data. The notification stream plus an
explicit final `getSource` are the whole contract.

Runnable end-to-end:
[examples/embed/tool-host-roundtrip.html](../../examples/embed/tool-host-roundtrip.html).

## Embedding the designer

The designer is not a separate page — **it is the same tool in design mode**:
`?mode=design` gives you everything from `explore` plus the editing
affordances on by default: the source drawer open per preset (like `edit`),
the inspector available, **drag-to-pin armed** (still user-toggleable), and
the design bar on the stage — **Add element** (pick a kind from the plate-glyph
palette, then click on the diagram to place and pin it there) and **Connect**
(click a source element, click a target element, pick a verb — one relation
is created). Every creation is a normal undoable source edit through
`DDNLive.authoring`, so `onSourceChange` / `getSource` report them exactly
like source-drawer edits.

The supported embedded-designer shape is `?mode=design&toolbar=off` plus
host-driven I/O: no tool chrome, the creation gestures on the stage, and the
host passing DDN in and out through the contract above.

```html
<iframe id="designer" style="width:100%;height:560px;border:0"
  src="tools/index.html?mode=design&toolbar=off&drawers=source:api,appearance:api,files:none,export:none"></iframe>
<script>
  const tool = document.getElementById('designer').contentWindow.DDNTool;
  await tool.setSource(ddnText);            // load variable → designer renders it
  tool.onSourceChange(p => { latest = p; }); // visual edits notify the host
  const edited = tool.getSource({ single: true }); // host gets the edited DDN back
</script>
```

Hosts and tests can also drive the gestures programmatically — the same code
paths as the on-stage clicks: `DDNTool.placeElement(kind, x, y)` (the
click-to-place drop), `DDNTool.connectElements(fromId, toId, verb, label)`
(the source→target→verb connect), `DDNTool.startPlacement(kind)` /
`startConnect()` / `cancelDesignGesture()` / `getDesignGesture()` for the
armed-gesture state. Element ids for `connectElements` come from
`tool.workspace.resolve(entry, view).elements`.

Runnable end-to-end (load variable → visual edit → host reads the edited DDN
back; carries a `?selftest=1` harness):
[examples/embed/designer-host.html](../../examples/embed/designer-host.html).


Recipe — bare diagram, no toolbar, with a host button that opens the source
drawer (runnable as
[examples/embed/tool-host-control.html](../../examples/embed/tool-host-control.html)):

```html
<iframe id="tool" style="width:100%;height:560px;border:0"
  src="tools/index.html?toolbar=off&drawers=source:api,appearance:closed,files:none,export:closed"></iframe>
<button onclick="document.getElementById('tool').contentWindow.DDNTool.setDrawer('source','open')">
  Edit source
</button>
```

`toolbar=off` removes every tool icon; `source:api` keeps the source drawer
out of the user's reach while leaving it fully functional for your code —
the combination `mode=diagram` cannot express, since that preset forces all
drawers to `none` (unavailable to everyone, host code included).

Serve the pair over HTTP: cross-frame scripting (`contentWindow.DDNTool`)
and `?src=` deep links are unavailable from `file://` pages — see the
`file://` caveats section below. The tool itself is a single
self-contained file, so any static server (`node tools/serve.js`) is enough.

## Framework notes

- **React/Vue/Svelte:** treat the diagram as an unmanaged leaf. Create the
  workspace once (per source set), `mount` in a ref/`onMount` callback, and
  call `diagram.destroy()` + `ws.destroy()` in the cleanup. Never let the
  framework diff the SVG — re-render through `setOptions` or workspace
  edits only.
- **Server-side rendering:** render on the server with
  `require("@ddn/notation")` + `renderSync` and inline `result.svg` in the
  HTML; hydrate by `mount`-ing only if interactivity is needed.
- **Multiple diagrams:** one workspace per independent source set is
  cheapest; views in the same files share a workspace and re-render together.

## CSP

Rendered output is inline SVG text assigned via `innerHTML`; the runtime
executes no `eval` and loads nothing at runtime. A working policy for a page
embedding the full bundle:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
```

`style-src 'unsafe-inline'` is required only if you use `ddn.css` custom
property overrides inline or the viewer; the renderer itself writes SVG
presentation attributes, not `<style>` blocks (see
[styling.md](styling.md) — no `!important` anywhere, page CSS fills gaps the
script left unset).

The unified tool's render worker (B1-043) is created from a Blob URL, so a
page hosting the *tool* (or any `setRenderBridge` consumer) also needs
`worker-src blob:` (or `child-src blob:` on older engines). Pages embedding
only the runtime do not load any worker.

## `file://` caveats

The runtime itself is `file://`-safe (no fetch; no workers unless a host
installs a render bridge — only the unified tool does, and it uses a Blob-URL
worker, which Chromium runs from `file://` pages too). The caveats are
about *your sources*:

- `createWorkspace` takes source text, not URLs — reading `.ddn` files from
  disk is your job. Over `file://`, use a file picker (`DDNLive.io.open`),
  drag-drop, paste, or inline the sources as the examples under
  `website/examples/embed/` do.
- The gallery page (`website/examples/gallery/index.html`) links pre-rendered SVG
  files with plain `<img src>` precisely so it needs no runtime at all.
- The unified diagram tool (`ddn-tool.html`, served as `tools/index.html`,
  see [tool.md](tool.md)) inlines the runtime and loads sources through
  pickers/drag-drop/paste and the bundled catalogue, so it works fully from
  `file://` in current Chrome and Firefox; its `?src=` deep links need HTTP.
  It replaced the single-file viewer (`ddn-viewer.html`, see
  [viewer.md](viewer.md)) in B1-027.
