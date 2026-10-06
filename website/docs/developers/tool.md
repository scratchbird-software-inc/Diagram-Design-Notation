# Unified diagram tool

`notation/tool/ddn-tool.html` — served on the website as
`tools/index.html` — is the single-file unified diagram tool. It
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

## Rendering: worker by default

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
page/width/height/100%) with a slim icon toolbar and pop-in drawers:
**files** (left), **creator** (top), **style & layout** (right),
**document** (right), **inspector** (right), **relation type** (right),
**type sheet** (bottom), **source** (bottom), **properties** (bottom),
**export** (right) and **animation** (right). Drawers overlay the stage and
animate open/closed. The right-side working drawers are exclusive —
opening **document**, **style & layout**, **inspector** or **relation
type** closes the others — and the bottom drawers (**source**, **type
sheet**, **properties**) are exclusive likewise. Drawers follow the
selection: selecting an element or relation opens the **inspector**,
deselecting (empty-canvas click or Escape) opens the **document** drawer.
(The retired top **appearance** drawer name remains accepted as an alias of
`style` in `?drawers=` and saved settings.) A draggable splitter between
the stage and the right column resizes every right drawer together
(240–560 px, persisted in `localStorage` key `ddn-tool-right-width`).

The **creator** drawer (top) holds the capability-filtered entity palette
promoted from the old design-bar popup: grouped object kinds, search (a
non-empty search scans every installed kind past the capability filter),
the "all installed kinds" toggle, and the data-bound-projection hint. It
also carries the **Pointer select** tool: while armed, clicking a canvas
object selects it and opens the **properties** drawer (bottom) with just
that object's properties — the inspector's *Meaning* and *This view*
content, read-write; deactivating closes the drawer and returns to normal.
The design bar's **Add element** button opens/focuses the creator drawer.

The **relation type** drawer (right) is the Connect flow's verb selector:
it opens when Connect is armed, lists the source kind's legal verbs after
the first endpoint is picked and the pair-legal verbs
(`DDNLive.legalVerbs(from, to)`) once both are known, and closes when the
gesture completes or is cancelled.

While the **inspector** or **properties** drawer is open, hovering the
canvas highlights whatever a click would select — a soft glow on elements,
frames and field rows, a stroke highlight on relation edges and labels.
The highlight is pure CSS class toggling (no layout, no re-render), clears
on pointer-leave, and is suppressed while a pointer button is held so pan,
pin-drag and placement gestures never fight it.

The **style & layout** drawer's top section is the view switchboard: the
**active view** selector (moved out of the toolbar), the **view kind**
selector (the view's registered kind — `patent-figure`, `uml-class`, …;
view kinds are a 0.6-dialect construct, so the write is refused with
DDN-V04 on older sources) and, for data-bound views, the **projection
kind** selector (disabled on graph views). Both type controls write to
source and re-derive capability filtering, the creator palette and the
type-sheet dispatch, exactly like a view switch.

The drawer's **Fonts** group is the single font editor. One target
dropdown lists every font-holding target in the active view, with exactly
the controls the notation supports for it: the **view base font** (family
and size px, written to `style { font / font_size }` in source), **each
kind present** (family, size, plus bold / italic / strike-through /
small-caps / text colour — all *session preview*, riding the same CSS
overlay as the colour cosmetics because the notation has no per-kind font
syntax), and each existing **header/footer run** (family and size pt,
written via `setViewChrome`). The legend and title block are listed
disabled — the renderer fixes their typography, so there is nothing to
edit.

Every colour entry point — kind/relation-class/object overrides, page
background, the font editor's text colour — uses one shared colour widget:
a native colour input plus a row of the ten most recently used colours
(most-recent-first, persisted in `localStorage` key
`ddn-tool-colour-history`); all entries feed the same history.

The **inspector** is the selection editor, with three tabs: **Meaning**
(model identity — label, kind, description, relation endpoints/cardinality,
with a cardinality sentence preview), **This view** (view-scoped overrides —
hide, pin, per-occurrence display), and **Details** (a descriptor-generated
form over the element's registered properties, editable through
`authoring.setElementProperties`). Every control group across the document,
style and inspector drawers is labeled with its write scope — **Model**,
**View override** or **Session preview**.

The **type sheet** is a contextual bottom drawer for the active view's
projection type. It auto-opens when the view has a registered sheet body —
CMMN (case-plan outline, sentry editor, planning tables), UML structure
(members, templates, n-ary, generalization sets), UML activity (lanes), UML
sequence (lifelines, messages, fragments), BPMN (events/gateways), patent
(numerals, renumber, ref anchors), and the data-projection sheets: matrix
(batch cell editor), chart (data-aware bindings and record table), timeline
(dates/dependencies), decision (typed predicate cells), fishbone (rib tree)
and panels (grid/child-view slots) — and auto-closes when it has none;
opening or closing it by hand pins that choice for the view until the view
changes.

Each drawer has four states — `open`, `closed`, `none` (icon hidden,
unavailable to everyone), `api` (icon hidden, not user-openable, but openable
by host code via `DDNTool.setDrawer` — for embeds; never offered in the gear
popup, tolerated when present in a saved config) — configured by, in
ascending precedence:

1. the `?mode=` preset: `diagram` (bare stage, no toolbar — for embeds),
   `view` (stage + viewport controls only), `explore` (default; toolbar, all
   drawers closed), `edit` (toolbar, source drawer open), `design` (explore
   plus the editing affordances on by default — see "Design mode" below);
2. the saved settings in `localStorage` key `ddn-tool-drawers` (gear popup);
3. the URL parameter, e.g.
   `?drawers=style:closed,source:api,files:none,export:closed`
   (malformed pairs are ignored).

Independently of the mode, `?toolbar=off` hides the whole icon toolbar
*without* changing drawer availability (unlike `mode=diagram`, which also
forces every drawer to `none`); it beats the preset's toolbar and tolerates
malformed values (anything but `off` is ignored). Combined with
`?drawers=source:api` this gives the host-controlled embed: no chrome at
all, yet the host can still open drawers through `DDNTool` — see
[embedding.md](embedding.md) → "Controlling the embedded tool".

## Loading sources

- **Files drawer**: open files / a folder / a workspace `.zip` or `.json`
  (with merge-into-current), drag-drop anywhere on the page, paste source
  text, or pick from the bundled example catalogue.
- **`?src=<relative.ddn path>`** deep link: fetches the source relative to
  the page together with its whole import closure (multi-file examples
  render), size-capped like a dropped file. Strictly relative — any scheme,
  host, or absolute path is rejected inline.
- **`?entry=<catalogue entry or relative.ddn path>&view=<view id>`**: if the
  entry is in the bundled catalogue it boots from there; otherwise the path
  is fetched with the same import closure. `history.replaceState` keeps the
  URL shareable when switching examples/views.

## Design mode: the designer IS the viewer with more functionality

`?mode=design` is the shipping designer: one page, one I/O contract, with the
editing affordances layered on top of `explore`:

- **Source drawer open per preset** (like `edit`) and the **inspector**
  drawer auto-opening on selection;
- **drag-to-pin armed by default** (the toolbar toggle stays — turn it off any
  time);
- the **design bar** on the stage:
  - **Add element** — opens the **creator** drawer: the object kinds the
    active view's projection can actually hold (capability-filtered via the
    registry's `allowed_in` contract; data-bound projections show a hint
    naming the matching type sheet instead of an element palette), drawn
    with the notation-plate glyphs (`DDNLive.glyphs.forKind`), searchable;
    picking a kind arms click-to-place, and the next click on the diagram
    creates the element at that spot and pins it there (one undoable source
    edit; the new element stays selected for renaming in the inspector);
  - **Connect** — click a source element, click a target element, pick a verb
    in the **relation type** drawer from the relation kinds legal between
    the two endpoints (the same legality contract as the CLI
    `verbs --from --to` query; when no registered verb admits the pair the
    full list is shown with a note — the designer filters offers, it never
    blocks) plus an optional label: one relation is created between them.
    Connect stays armed after a creation so chains of relations are quick;
    Esc cancels any armed gesture.
  - **Tidy** (0.8, standard chapter 57 §D5) — re-runs placement and routing on
    the active view with every authored pin respected. The source is untouched
    unless you confirm **Pin result**, which writes the computed positions of
    the unpinned elements as `place` pins in one undoable transaction.

### DDN 0.8 designer contract surface (standard chapter 57)

- **New document (§D2).** The files drawer's *New document…* command is
  explicit and always visible. In design mode the tool starts **empty** — a
  valid `ddn "0.6"` skeleton (header, module, one view, `size: content`
  publication defaults) — unless it was passed a `.ddn` to open. The template
  picker is keyed to the registered view kinds (chapter 52): blank, ddn-native,
  flowchart, c4-container, patent-figure (with the chapter 53 chrome preset).
  Templates are content files (`notation/tool/templates/*.ddn`), not code;
  after creation the document is ordinary `.ddn` with no template dependency.
- **Multi-pane workspace editing (§D3).** One editor tab per workspace file in
  the source drawer; *New file* defaults to a kebab-case `.ddn` sibling of the
  importing file and offers to insert the matching `import "…" as …;` line;
  *Jump to definition* resolves the `@ref` under the cursor to its declaring
  file:line; a diagnostics list shows every check diagnostic in the stable
  chapter 56 §X4 shape (`{code, severity, file?, line?, view?, message}`) and
  clicking navigates — the list regenerates on each check, never accumulates;
  the active view re-renders debounced while typing, and render failures keep
  the last good picture dimmed.
- **Export boundary (§D4).** Client-side SVG and PNG (2×) are always
  available, fully in the browser, `file://` included. PDF/PPTX are
  commercial/service features and appear nowhere in this page. Foreign-format
  import (e.g. a Mermaid subset) is **deferred to 0.9**; it will land as a
  designer *Import…* command producing ordinary `0.6` source through the same
  skeleton/template path as *New document*.
- **uid semantics (chapter 55 §S5).** The inspector's *Duplicate* mints a new
  uid (`<id>_copy`, then `_copy2`, …): the copy starts unconnected, its
  numeral field empty, and `ref:` anchors keep pointing at the original. A
  move (drag-to-pin, cut/paste in source) edits placement only, so the uid is
  preserved by construction — a move is never a delete-plus-create.

Both creation gestures (and Tidy) need a graph projection; on data-bound projections (charts,
timelines, sequence, …) the buttons disable with an explaining tooltip — the
same rule drag-to-pin already follows. The programmatic counterparts
(`DDNTool.placeElement`, `DDNTool.connectElements`, `startPlacement`,
`startConnect`, `cancelDesignGesture`, `getDesignGesture`) drive the same code
paths for hosts and tests. `?mode=design&toolbar=off` plus the host I/O
contract is the supported embedded-designer shape — see
[embedding.md](embedding.md) → "Embedding the designer" and
[examples/embed/designer-host.html](../../examples/embed/designer-host.html).
The old `designer/prototype/` review prototype is retired: its URLs redirect
here (preserving `?src=`), its sources are kept — deprecated — for history and
its regression suite.

## Feature map (from the retired tools)

- Viewer: fit modes, per-kind/verb/object colour overrides, per-kind
  typography, click-to-select panels, PNG export — style & layout drawer.
- Studio gallery: example catalogue, style + advanced layout/page/pen
  controls, capability-driven control disabling — files + style & layout
  drawers.
- Studio editor: per-file source editing with apply/discard and live apply,
  undo/redo, find/replace/go-to-line, guided inspector edits (label, kind,
  pin/unpin, hide, add field, delete, go-to-source, add element/relation),
  drag-to-pin on the stage, workspace new/rename/delete and zip/json I/O,
  dirty guard on unload — source + files drawers, inspector drawer.
- Designer prototype: kind palette with plate glyphs, click-to-place,
  connect-two-elements — the design bar in design mode.
- Export drawer: SVG, PNG (2×), WebP (2×), example snapshot (workspace JSON).

Rendering reuses the shared `<ddn-example>` component (`DDNLive.mount`); its
internal chrome is hidden and every feature is driven through its public
surface plus `DDNLive.authoring` / `DDNLive.io`. Presentation overrides are a
temporary view overlay — the loaded source is only changed by explicit source
or inspector edits.

## Style & Layout drawer: override-channel option map

Every presentation option the live API's override channel accepts
(`DDNLive.checkOptions` / `api.js` `defaults`) is reachable from the
style & layout drawer. The mapping is guarded by a test in
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

**Artboard validation (DDN071):** the Page/artboard controls (`page`, `width`,
`height`) scale the drawing down to fit (`fit: contain`); an artboard small
enough to push the smallest text role below `publication.minimum_text` would
hard-fail the render. The tool computes that bound before rendering — from
the current scene's unscaled drawing bounds plus the fixed chrome overhead —
and refuses the choice inline, naming the smallest usable artboard ("Artboard
400×400px fits this drawing only at 29% scale … smallest usable artboard for
this drawing is 849×962px …"). The inputs return to the last committed values
and the stage keeps the last good picture undimmed; the runtime DDN071 on
this path names the same remedy (larger page / bigger base font / relaxed
`minimum_text`). Worker on and `?worker=off` behave identically.

## Host I/O contract

For hosts embedding the tool, three additive methods formalize DDN in/out —
the same in every mode and with the render worker on or off:

- **`DDNTool.setSource(source, opts)`** — IN. A single-file source string or a
  `{ "name.ddn": text }` map (`loadFiles` remains as the legacy alias).
  Replaces the workspace and returns a Promise resolving after the render
  with `{ revision, entry, view }`; failures reject with coded diagnostics
  (`LIVE010/011` for the map contract, `DDN-T1xx` for entry/view problems,
  the parser/builder codes for broken source). `opts.entry` / `opts.view`
  pick the initial view.
- **`DDNTool.getSource(opts)`** — OUT. Default: `{ files, entry, view,
  revision }`, the current source of truth. `opts.single: true` flattens a
  single-file workspace to a string (coded `DDN-T107` on multi-file).
  `opts.includeAppearance: true` first serializes the current presentation
  into the current view's source via `DDNLive.authoring.setViewProfile` (the
  canonical save-serializer): option-channel overrides become the view
  profile properties they came from; the CSS-overlay channels (colours,
  per-kind typography) become the view's `x_tool_presentation` extension
  record, which any load re-applies. The result round-trips:
  `setSource(getSource({ includeAppearance: true }))` re-renders
  byte-identical SVG (tested; see below).
- **`DDNTool.onSourceChange(cb)` / `offSourceChange(cb)`** — NOTIFY. Fires
  debounced (200 ms, `DDNTool.SOURCE_NOTIFY_DEBOUNCE_MS`) after every
  source-affecting action — source-drawer apply/live-apply, inspector edit,
  drag-pin, undo/redo, file new/rename/delete, `setSource`/load — with
  `{ revision, files, entry, view }`. There is no implicit session-end event;
  hosts keep the latest payload or call `getSource` when their own UI closes
  the embed (both patterns documented in
  [embedding.md](embedding.md) → "Passing DDN in and out").

Runnable example:
[examples/embed/tool-host-roundtrip.html](../../examples/embed/tool-host-roundtrip.html);
headless coverage in `tests/tool-host-io-http.js` (worker and `?worker=off`).

## Test hooks

`window.DDNTool` mirrors the old `DDNViewer` surface (pure functions plus
`loadFiles`, `setSource`, `getSource`, `onSourceChange`/`offSourceChange`,
`setFit`, `exportSvgString`, `setDrawer`, `setToolbar`,
`getDrawerConfig`, `state`, …) for tests and integrations; `setDrawer` opens
`api` drawers but throws a clear error when asked to open a `none` drawer.
`window.DDNRedirect.mapLegacyParams` is the old-URL parameter mapper used by
the redirect stubs.
