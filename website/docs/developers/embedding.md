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
