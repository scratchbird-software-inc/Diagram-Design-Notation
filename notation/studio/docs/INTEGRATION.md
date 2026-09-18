# Developer integration — consolidated DDN 0.5

Copy `dist/ddn.global.js` to a self-hosted static location. No reference-site directories are needed. Load the runtime once and supply an authorized map of UTF-8 DDN files.

```html
<script src="/vendor/ddn.global.js"></script>
<div id="diagram"></div>
<script>
const files = {
  'main.ddn': `ddn "0.3"; module "hello";
    data m { object a "Client"; object b "Service";
      relation r @a -> @b { kind: assoc; }
    }
    view v { data: [@m]; publication { size: content; fit: none; } }
  `
};
const workspace = DDNLive.createWorkspace(files);
const diagram = DDNLive.mount(document.querySelector('#diagram'), {
  workspace, entry: 'main.ddn', view: 'v'
});
diagram.addEventListener('ddn-error', e => console.error(e.detail));
</script>
```

Change only appearance:

```javascript
await diagram.setOptions({theme:'night',look:'handDrawn',routing:'curved'});
await diagram.setOptions({placement:'circular',center:'pins',autoPlace:true});
const svg = diagram.exportSVG();
```

Update a shared source file using `workspace.updateFiles({...})`. Every mounted view subscribed to that workspace sees the new source. Independent view options and paused state do not become shared model facts.

For rendering without the viewer UI:

```javascript
import DDNLive from '/vendor/ddn.mjs';
const workspace = DDNLive.createWorkspace(files);
const result = await workspace.render({entry:'main.ddn',view:'v'});
console.log(result.svg, result.diagnostics);
```

The `.mjs` facade imports `ddn.global.js` beside it. Serve it with a JavaScript MIME type. `render` is Promise-compatible, **not background-worker execution**. The host must safely insert returned SVG under its own policy; mounting through the provided component additionally sanitizes/scopes it. Type declarations are `dist/ddn.d.ts`.

## Local files and workspaces

```javascript
const opened = await DDNLive.io.open(fileInput.files);
const settings = DDNLive.fromSnapshot(opened.snapshot);
const diagram = DDNLive.mount(container, settings);
// For an internal authoring download:
const snapshot = settings.workspace.snapshot(settings.entry, settings.view);
DDNLive.io.download('design.zip', DDNLive.io.toZIP(snapshot), 'application/zip');
```

`io.open` reads only user-selected inputs, with safe path, size, UTF-8 and ZIP checks. A `.ddn` upload containing imports needs those files; choose a folder or workspace ZIP. It does not recursively fetch URLs from DDN text.

## Source transactions

The `authoring` API offers validated span-based label/kind changes, add element/field/relation, hide, pin/unpin and dependent-safe deletion. `workspace.applyEdits` takes `{file,start,end,text}` plus an expected revision and optional entry/view for full validation. Use `undo()`/`redo()` for committed edits. `renameFile` rewrites relative import string tokens while preserving module identity.

These methods power Studio; they are not a replacement for all language constructs. Raw source remains fully editable.

## Deployment and security boundaries

The library is distributed privately for review, not published to npm or a CDN. It needs no remote account, font download or rendering service. CSP/Trusted Types, browser qualification, resource isolation and application authorization require integration review. The component's shadow-root styles require an appropriate style policy; no advice to disable browser security flags is given.

Source snapshots are full internal projects. Do not send unauthorized source to the browser and rely on display hiding. Policy-projected model/SVG export retains the 0.3 allowlist checks; redacted sequence exports are rejected until that projection has its own payload closure.

Call `diagram.destroy()` and release the workspace when no longer used. Multiple instances prefix their SVG IDs independently. The model fingerprint is a regression/change indicator, not a cryptographic signature.


## 0.4 profiles and projections

The same renderer now dispatches a view’s `projection` concern. Graph-only controls are unavailable for matrices, charts, panels and date-bound schedules. Chart views offer supported mark changes without changing data. `workspace.projectionPlan(entry,view)` exposes bound records and provenance; `workspace.exportVegaLite(request)` is an optional local-values export, not a mandatory dependency. See `../../spec/20-projection-sdk-and-editing.md` for new inspector and API contracts.


## 0.5 quality, lifecycle and reporting

The same runtime accepts `ddn "0.5";`. New reusable projection kinds are `fishbone` and `decision`; registered profiles add typed encoded matrices, series/transforms, flat state models and child panels. See standard chapters 21–24. One-level dashboards render children through the same runtime. Source-backed child marks report `childView` alongside source IDs; navigate/edit the child rather than treating an aggregate as a new independent object.

```javascript
const result = workspace.evaluateDecision("views.ddn", "decision_unique", {severity:"low", score:5});
const trace = workspace.simulateLifecycle("views.ddn", "lifecycle", [{event:"submit"}]);
DDNLive.authoring.setMatrixCell(workspace, "views.ddn", "raci", rowId, roleId, "C");
DDNLive.authoring.setMatrixCells(workspace, "views.ddn", "raci", [
  {row: rowId, column: oldOwnerId, value: "C"},
  {row: rowId, column: newOwnerId, value: "A"}
]);
```

Matrix creation uses the projection's `write_data` shared block or an unambiguous shared row block, not a display-only cell. Transactions validate the current view before commit and are undoable; other dependent views validate on their next render. Rule evaluation is pure, typed and budgeted; transition actions are never executed. Chart values/dates and matrix cell coordinates cannot be dragged or re-laid out as graph nodes. Unsupported quality mark overrides and redacted projections fail explicitly.

## Endpoint-ordering policy (0.5.0-draft.2)

Free compatible slots are optimized by default. The optional overlay `endpointOrdering: "preserve"` selects the legacy stable-ID slot order; `"source"` follows the DDN layout. This does not change field identities, pins, or quantitative coordinate meaning. See `../../spec/26-local-endpoint-ordering.md`.
