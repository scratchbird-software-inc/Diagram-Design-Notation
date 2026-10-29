# DDN viewer, designer and verifier

DDN is free, open-source software for general public use under the
[GNU General Public License version 2 or later](LICENSE) (`GPL-2.0-or-later`),
sponsored by [ScratchBird Software Inc.](https://scratchbird.ca). The viewer,
visual designer and verifier run without a Weaver account or subscription.
[Weaver](https://scratchbird.ca/weaver) is the separate commercial platform.
See [notices and sponsorship](NOTICE.md).

This is the new `ddn-next-1` implementation: a standalone viewer, a visual designer that extends that viewer, and a shared headless verifier. It uses the [adopted dialect and property codex](../../docs/DDN/README.md). It contains no code or grammar from the incompatible proof of concept.

The complete edition implements all **152 adopted bounded profiles**, with method-specific palettes, relation rules, defaults, projections and editing controls. The [coverage index](../../docs/DDN/PROFILE-COVERAGE.md) links every contract and its tests. The native edition retains the four-profile capability set (`ddn@1`, `mindmap.basic@1`, `concept.map@1`, `table.records@1`). Missing or deliberately uninstalled packs still produce explicit unsupported/partial results.

## Run locally

From the repository root, after the pinned toolchain bootstrap:

```sh
bash tooling/run.sh build:ddn
```

Open these files directly in a browser; no web server is needed:

- `.work/builds/ddn-distribution/complete/ddn-viewer.html`
- `.work/builds/ddn-distribution/complete/ddn-visual-designer.html`
- `.work/builds/ddn-distribution/complete/ddn-verifier.html`

The four-profile artifacts remain one directory above `complete/`. Each edition has its own manifest and size report.

The `modular/` directory contains `viewer.html`, `designer.html` and `verifier.html` with shared chunks and automatic diagram-family loading. It also works directly from disk. The website uses this modular delivery and provides an offline ZIP. See [modular architecture, loading and embedding](../../docs/DDN/MODULAR-DISTRIBUTION.md), including API entries that do not mount the application shell. The native and complete single-file editions remain available.

The shells include examples and a local file picker for DDN, included files, stylesheets and image assets. They do not fetch missing files or send data to a service. The viewer source pane is read-only. The designer provides method/profile selection, filtered palettes, eligible-item reuse, connection editing, schema-driven profile/projection controls, typed datasets, workarea settings, draft/column editing, lifecycle actions, undo/redo and source downloads. Saving returns artifacts; it does not claim successful browser persistence.

Choose **File → New diagram…** in the designer to clear the source, workarea, supplied files/assets and undo history, then pick a diagram method/type and name. **Create diagram** starts a fresh editable view; cancelling leaves an empty document. Download work you want to keep before starting over. Native offers its four profiles; complete and modular editions offer all 152, with modular families loaded on demand.

The designer starts without an assumed diagram type. Choose **Choose diagram type…**, select a method preview, then a diagram-type preview, and name the view. Use **All diagram methods** to go back, or search the type previews within a method. Creating it applies that profile’s inherited defaults and opens its matching element palette; charts and tables offer their data and projection controls. **File → Open a sample…** offers small starters and the website gallery. Source diagnostics appear below the editor; **Apply source** or Ctrl+Enter applies text edits. Ctrl+S downloads the current source, including unapplied text. Edits and supplied local assets are also kept in browser storage when available; the next visit offers Restore or Discard. New, sample loading and file drops confirm before replacing unsaved work. Download copies you want to retain outside browser storage.

**Expand view** fills the viewing area with that view; **Shrink to workarea** restores the surrounding surface. Zoomed-out workareas display view cards. Wheel zoom, touch pinch/pan and keyboard shortcuts are available from **File → Keyboard shortcuts**.

Start with:

```ddn
erd Sales
    Customer
    Order
    connect Customer to Order
```

Double-click an element to rename it inline. **Add element** opens the docked palette; drag a type onto the view, select a type and click on the canvas, or double-click a tile to place it at the visible centre. A new element stays where placed until its first connection, then joins the diagram’s automatic layout. Moving it before that first connection retains this temporary placement. Moving an already connected element fixes its position until **Reflow** releases it. **Properties** opens the inspector. **More → Draft text** opens free-form text; **Columns** explicitly converts it to rows while retaining the draft. **Details shown** selects visible fields. Name-only entities are valid conceptual entities without SQL types or invented facts.

**Reflow** (also **WorkArea → Reflow view**) releases fixed element positions and custom route waypoints in the active diagram, then recalculates its layout from its type and relationships. It preserves other views, element sizes and appearance, and supports Undo/Redo.

The small status dot is amber for **Draft**, blue for **In progress**, purple for **In review**, and green for **Accepted**. Hover over or keyboard-focus the dot for an explanation. Select the element and use **More → Status** to change its design status.

Select an item or view and choose **Paper & attachments** to configure paper,
sticky notes, pads, four shadow shapes, pins, clips and tape. Colour pickers and
text values control paper, shadow and attachment colours independently; editing
supports inheritance, explicit occurrence/shared-definition scope and undo/redo.
The [paper comparison page](../../website/features/paper.html) includes
editable examples and the short `paper note` / `shadow centre` notation.

**Appearance & presets** adds compact background, font and preset editors.
Use paper/linen/grid/dot textures, local fonts, and portable user/company packs.
The tools have independent Light/Dark/Warm interface themes and shared colour
pickers. The [appearance guide](../../docs/DDN/APPEARANCE.md) explains scope,
inheritance, local persistence and host integration. Keep optional `ddn-fonts.js`
beside the downloaded viewer/designer HTML to use the bundled font families
offline; system defaults remain unchanged when the pack is omitted.

## Embed the modules

The build also produces `ddn-viewer.js`, `ddn-visual-designer.js`, `ddn-verifier.js` and their shared `modules/` tree. Keep that directory structure. ESM loading follows the host's ordinary policy; the HTML files provide direct-from-disk use.

```js
import { createRuntime, createCompleteRuntimeOptions, createViewer }
    from './complete/ddn-viewer.js';

const runtime = createRuntime(createCompleteRuntimeOptions());
const viewer = createViewer(document.querySelector('#diagram'), { runtime });
await viewer.open({
    entry: 'main.ddn',
    files: [{
        id: 'main.ddn', text: 'erd Sales\n    Customer\n',
        revision: '1', encoding: 'utf-8', writable: true,
    }],
});

viewer.destroy();
runtime.destroy(); // The host owns a supplied runtime.
```

`createDesigner(viewer, { authority })` requires an authority provider. `model.edit`, `lifecycle.review`, `lifecycle.accept` and `lifecycle.reopen` are separate grants. Prepared edits check authority, revisions and installed rules again before commit. Dynamic data enters `runtime.ingest()` with a matching base revision and identified provider; it is not a viewer participation action.

`ddn-verifier.js` exports `createVerifier`, `createCompletePack` and `createCompleteRuntimeOptions`. `analyzeProfile(snapshot.normalized, viewRef, optionalDecisionInputs)` returns read-only bounded decision, flat-state trace or CPM results. These results are also available through the viewer inspector. `createCompletePresentationPack()` exposes the portable measurement/projection ABI; see [representation details](../../docs/DDN/IMPLEMENTATION-DECISIONS.md). Core model, language and rule modules need neither DOM nor Node APIs. Worker adapters are separate execution subpaths; hosts explicitly supply a worker factory and fallback. HTML editions use a lazy local Blob worker and the same computation handlers for fallback.

## Source and tests

| Packages | Responsibility |
| --- | --- |
| `types` | Exact adopted core, scene and browser ABI declarations |
| `model`, `language` | Qualified identities, parser, typed records, templates and source patches |
| `profiles`, `defaults` | Complete compiled codex, profile rules and file > CSS > standard resolution |
| `execution` | Fingerprints, budgets, cancellation and worker/local execution |
| `runtime` | Immutable revisions, providers, commands, lifecycle protection and history |
| `presentation`, `viewer` | All 152 profile scenes, tables, safe Markdown, navigation, inspection and capture |
| `designer` | Editing controls using the shared viewer and command service |
| `verifier`, `standalone` | Staged verification and offline application shells |

Maintained tests live in `project/tests/ddn`:

```sh
bash tooling/run.sh test:ddn
node tooling/browser/bootstrap.mjs       # install pinned browser tools once
bash tooling/run.sh test:ddn:browser
```

Generated output, dependencies, browser profiles and reports stay under `.work`. No Weaver package enters the standalone build. Package `private` flags prevent accidental package-registry publication from this checkout; they do not restrict the DDN GPL licence. The surrounding Weaver repository remains private, with commercial implementation kept outside the DDN tree.

See [implementation status and qualification limits](../../docs/DDN/IMPLEMENTATION.md). The bounded contracts do not imply full UML/BPMN/SysML execution or external certification. Browser/OS, accessibility and performance release qualification remain separately tracked.
