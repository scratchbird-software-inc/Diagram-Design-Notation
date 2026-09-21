# Unified JavaScript library and live views

**DDN 0.3.0-draft.2 · proposed standard · normative integration contract for this draft.**

This release consolidates the uploaded 0.3 core and the later live controls. There is one decoder/renderer path. It does not rename the 0.2 compatibility renderer to 0.3. The original 0.3 endpoint contracts, registered-metadata checks, recursive field identities, typography, publication checks, export policies and interaction restrictions remain active.

## Distribution and layers

`dist/ddn.global.js` is the complete browser build: parser, resolver, registry, glyphs, validation, layout, routing, SVG, viewer controls, workspace I/O and guided source edits. `dist/ddn.mjs` is an ES-module **facade importing that same global build**, not a tree-shaken native ESM rewrite. `dist/ddn.d.ts` declares the public API. CommonJS can require the global build for server/build rendering. No npm/CDN publication is claimed.

The runtime also ships as optional modular bundles so a page can load only what it displays: `dist/ddn-core.js` (parse/build/validate/export, projection and quality planning data, and the workspace API — no rendering), `dist/ddn-graph.js` (graph renderer; registers the `graph` projection kind), `dist/ddn-projections.js` (chart/matrix/panels/timeline/table/sequence/timing/chen) and `dist/ddn-quality.js` (quality charts, decision tables, fishbone). Load order is core first, then graph, then quality and projections in either order; each non-core bundle throws immediately when its prerequisite is missing, loading the same bundle twice is a no-op, and mixed versions keep the single-version guard. The engine is a renderer registry (`DDNEngine.registerProjectionRenderer(name, fn)`); rendering or planning an unregistered kind throws coded error `DDN-E010` naming the kind and the bundle that provides it. The fishbone and decision renderers compose the page through `ddn-projections.js`, so those kinds need both quality and projections loaded at render time. `ddn.global.js` remains the unchanged all-in-one build (everything plus the Studio component); every `ddn-X.js` has a matching `ddn-X.mjs` facade and type copies, and `dist/README.md` (generated at build time) lists contents, guards and byte sizes. The all-in-one and the modules MUST NOT be mixed on one page.

`DDNLive` is the public global. The source modules in `reference/` are implementation interfaces; consumers SHOULD use the public facade. Studio and every new live gallery use it too. The editor UI remains a separate page/script; a viewer does not need to load Studio. No font files, sample corpus, remote account, remote import resolver or rendering service are required by the runtime.

## Shared workspace, independent appearances

`createWorkspace(files)` receives a map of normalized relative POSIX `.ddn` paths to decoded source strings. Imports resolve within that map only. The host MUST obtain and authorize the source; an import cannot grant filesystem or network access. A named view references shared data/format declarations. The workspace MAY back many mounted views. Source updates notify subscribers; each appearance retains its own overrides and paused position state.

`renderSync({entry,view,overrides,layoutState})` compiles and renders. `render(...)` provides a Promise facade to the **same synchronous computation**: it is not a Web Worker or a hard-cancellable job. Supersession can prevent queued work from starting; it cannot interrupt running layout. Resource limits are 1,500 files, 12,000,000 source characters, 2,000,000 characters per source and 128 visible elements / 384 relations per live view. Source models may be larger than an individual view.

The result includes SVG, scene geometry, diagnostics, source mappings where authorized, profiles, rendering duration, and an explicitly noncryptographic model fingerprint. A successful render is not proof of global optimal layout, security, accounting correctness or professional approval.

## Temporary options and source policy

`setOptions` applies a view overlay; it does not rewrite data declarations. Options include look, palette, placement, centring, pause/reflow, curve form, crossing treatment, detail, field/domain/datatype visibility, font role/size, legend form, page and viewport zoom. Actual allowed values come from the executable capability manifest and public declarations.

An overlay MUST NOT disable validation or redefine relation kinds, slot meanings or export authorization. Authored per-relation routing overrides win over the global connector selector. Coordinates, explicit sides and named-field identities are not deleted to produce a lower crossing score. Source changes and semantic edits are separate explicit actions.

Page size is an artboard request; viewport zoom is magnification only. Unreadable A4/Letter requests or infeasible geometry produce diagnostics/errors. The UI marks a previous successful picture as stale and disables SVG export until a successful current render exists. It MUST NOT silently export the previous successful image as the new source.

## Mounting and lifetime

`mount(element,{workspace,entry,view,overrides})` creates the `ddn-example` element and returns it. `ready` tracks the current scheduled render. `destroy()` disconnects listeners/observers. The host owns separately created workspaces and calls their `destroy()` when no longer needed. Load one runtime version per page; repeated loading of the same version reuses the global, while a different version is rejected.

The element scopes SVG IDs and selectors before insertion, uses its own Shadow DOM, rejects active SVG content, and emits `ddn-render`, `ddn-error`, `ddn-select`, and `ddn-navigate`. A host resolves links between documents. The gallery resolves known view references without treating links as new data objects. This is not a complete strict-CSP/Trusted Types integration profile.

## Source and authorized exports

Display hiding is not redaction. The 0.3 allowlist export pipeline remains the authority for projected SVG/model output. The public API never provides an override that weakens the source export policy. A redacted appearance disables its convenient source snapshot control, and has no source mappings/dependency listing in its render result. An application that already supplies full source can still access its own workspace; this is not an access-control sandbox.

**Never send unauthorized fields, samples or metadata to an unauthorized browser.** Source-workspace downloads are private/internal authoring outputs; the operator must be authorized for every supplied file. The experimental interaction projection still rejects redaction without an approved occurrence/payload closure. It also rejects arbitrary curved/layered geometry instead of pretending ordered lanes are a free graph.

## Static publishing

The same renderer can export SVG for print, PDF pipelines or Markdown hosts that do not execute JavaScript. The live website stores source, not a separate image for each combination of appearance options. Reference icon/notation plates may remain static diagrams. An exported SVG is vector content, not executable DDN.

## Renderer CSS class hooks

The SVG produced by `render`/`renderSync` carries the deterministic class hooks specified in `../standard/specification/04-notation-and-looks.md` §11 (`ddn-svg ddn-view-*`, `ddn-node ddn-kind-*`, `ddn-rel ddn-verb-*`, `ddn-field`, `ddn-label`, `ddn-panel`, `ddn-frame`, `ddn-mark ddn-mark-*`). They are pure additions: bytes without a host stylesheet are unchanged in appearance, and rendering stays deterministic — classes derive from registry codes/ids only. The distribution also ships `dist/ddn.css`, an optional stylesheet mapping those classes to `--ddn-*` custom properties, and the `<ddn-example>` element accepts an optional `theme` attribute (a JSON object of `--ddn-*` property overrides) that injects a constructed stylesheet on its shadow host so the values cascade into the rendered SVG.
