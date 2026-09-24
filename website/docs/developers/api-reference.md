# API reference

The public surface of the DDN runtime, as declared in
`notation/studio/src/public.d.ts` (0.6.0-beta.1). The same object is
`window.DDNLive` in the browser, `require("@ddn/notation")` under Node, and
the default export of `notation/dist/ddn.mjs`. Every method below is
grep-verified against `public.d.ts` by `notation/tests/gallery-coverage.js`.

Top-level: `profileCatalogue`, `VERSION`, `runtime`, `createWorkspace`,
`registerWorkspace`, `mount`, `fromSnapshot`, `parse`, `authoring`, `io`,
`defaults`, `setTextProvider`, `setTextMetrics`.

## Creating and inspecting workspaces

### `createWorkspace(files)`

`createWorkspace(files: SourceFiles): Workspace` — compile a set of source
files (`{ "name.ddn": "source text" }`) into a workspace. File names matter:
`import` paths resolve against them.

```js
const ws = DDNLive.createWorkspace({ "model.ddn": source });
```

### `registerWorkspace(name, files)`

`registerWorkspace(name, files): Workspace` — like `createWorkspace`, plus
registers the workspace under a name so other API entry points can find it.

### `parse(source, file?)`

`parse(source: string, file?: string)` — parse one source file without a
workspace. Returns the declaration list (`declarations`), `imports`, and
diagnostics. This is the syntax-only check; semantic checking happens on
`resolve`/`analyze`. The CLI equivalent of a full check is
`node notation/cli/cli.js check <file> --workspace <dir>`.

```js
const parsed = DDNLive.parse(source, "model.ddn");
console.log(parsed.declarations.length, parsed.imports.length);
```

### `entries()` and `views(entry)`

`ws.entries(): Array<{file, views: Array<{id, name}>}>` — every entry file
with its declared views. `ws.views(entry)` scopes the same list to one file.

### `analyze(file)`

`ws.analyze(file)` — structural analysis of one file: declarations,
references, and diagnostics without projection resolution.

### `resolve(entry, view)`

`ws.resolve(entry, view)` — the resolved model for one view: `elements`,
`relations`, the view IR with its resolved `profiles` bundle (style, layout,
publication, …), and `diagnostics`. This is the full semantic check: any
validation error in the view surfaces here.

```js
const ir = ws.resolve("model.ddn", "overview");
console.log(ir.elements.length, ir.view.profiles.projection.profile);
```

### `inspect(entry, view)`

`ws.inspect(entry, view)` — renderer-facing detail for one view (geometry,
ports, routing decisions). Used by tooling that needs to reason about the
placed diagram rather than the model.

## Rendering

### `renderSync(request)`

`ws.renderSync({ entry, view, overrides?, layoutState? }): RenderResult` —
render one view deterministically. `RenderResult` carries `svg`, `scene`,
`layoutState`, `diagnostics`, `milliseconds`, `modelFingerprint`,
`sourceMap`, `dependencies`, and the resolved `overrides`.

```js
const r = ws.renderSync({ entry: "model.ddn", view: "overview",
  overrides: { look: "handDrawn", routing: "curved" } });
document.querySelector("#out").innerHTML = r.svg;
```

`overrides` is the `Options` type from `public.d.ts` (theme, look, routing,
mark, placement, spacing-era presentation switches). `'source'` means "keep
what the view declared".

Relation-rendering override keys (B1-011):

- `relationRouting: Record<string, 'orthogonal'|'straight'|'curved'|'rounded'>`
  — per-verb / per-relation routing overlay. Keys are verb ids or relation
  ids of the current view; relation-id keys win over verb keys, and verb keys
  win over the view-level `routing`. `rounded` maps to a curved route with
  rounded bends, per relation. Unknown keys reject `LIVE022` (naming the
  key), unsupported values reject `LIVE023`; data-bound/chen views reject it
  with `LIVE021` and interaction (fixed-lane) views with `LIVE020`, exactly
  like `routing`.
- `curveTension: number` (0–1) and `curveRadius: number` (px, 0–512) —
  view-level curve quantities; out-of-range values reject `LIVE003`. They are
  accepted but inert when the effective routing is not curved.

### `render(request)`

`ws.render(request): Promise<RenderResult>` — the async twin of
`renderSync`; same result shape. Use it in UIs that must not block.

### `exportModel(request)` and `exportVegaLite(request)`

`ws.exportModel(request): string` — serialize the view's publication export
(honours the view's `export` profile: `full`/`redacted`, identifier mode,
`json`/`sql` format). `ws.exportVegaLite(request)` returns the chart spec for
chart views; it needs `ddn-projections.js` loaded (else `DDN-E010`).

### `projectionPlan(entry, view)`

`ws.projectionPlan(entry, view)` — the projection's computed plan (records,
encodings, axes) before marks are drawn. Useful for testing chart semantics
without rendering.

### `evaluateDecision(entry, view, input)` and `simulateLifecycle(entry, view, events, expected?)`

Quality-family evaluators: `evaluateDecision` runs a decision/rule-table view
against one input record; `simulateLifecycle` plays an event list through a
state view and optionally asserts the final state.

## Editing and file management

### `updateFiles(changes)`, `replaceFiles(files)`, `removeFile(file, options?)`

Whole-text file updates. `updateFiles` patches some files (added/changed
content), `replaceFiles` swaps the entire file map, `removeFile` deletes one
file (`{ force: true }` to drop it even when others import it). All return
the new revision.

### `dependents(file)` and `renameFile(oldName, newName)`

`ws.dependents(file)` lists files importing the given file;
`renameFile` renames a file and rewrites every `import` that points at it.

### `applyEdits(edits, options?)`

`ws.applyEdits(edits: TextEdit[], { expectedRevision?, entry?, view? })` —
apply surgical `{ file, start, end, text }` edits. With `expectedRevision`
the call fails on a stale base instead of clobbering; with `entry`/`view` the
edits are validated against that view immediately.

### `history()`, `undo()`, `redo()`

Undo stack for everything above. `history()` reports
`{ canUndo, canRedo, undoLabel, redoLabel }`; `undo()`/`redo()` step it and
report whether anything changed.

### `revision` and `subscribe(fn)`

`ws.revision` is the monotonically increasing workspace version.
`ws.subscribe(fn)` registers a listener called with
`{ revision, changedFiles }` after every mutation; it returns an unsubscribe
function.

```js
const off = ws.subscribe(({ revision, changedFiles }) => {
  console.log("rev", revision, "changed", changedFiles);
  rerender();
});
```

## Live data

### `replaceData(name, records)`

`ws.replaceData(name, records): { committed, revision, added, removed, updated, diagnostics }`
— replace the records of a named `data` block, leaving every other byte of
the source untouched (B1-006; keyed transactional contract since B1-029).
Records must carry the same field keys as the block's existing first record,
or the call throws `DDN-E011`. An optional per-record `key` field matches
records to declaration ids, so reordering never reassigns values to the wrong
identity; without keys, matching is positional and order-sensitive. The
refresh is transactional: on any validation failure `committed` is `false`,
the source is byte-untouched, and `diagnostics` names the view, record key
and failure (`DDN-E012`); added records invisible to explicit-membership
views are reported via `DDN-W015`. See
[data-refresh.md](data-refresh.md) for the full contract and the dashboard
recipe.

```js
ws.replaceData("metrics", [
  { key: "m1", label: "Alpha", value: 16, unit: "ms" },
  { key: "m2", label: "Beta",  value: 8,  unit: "ms" }
]);
```

## Mounting and snapshots

### `mount(element, options)`

`mount(element, { workspace, entry, view, overrides?, layoutState? }): DiagramElement`
— attach a live `<ddn-example>` element that renders now and re-renders on
workspace changes. The element exposes `ready`, `setOptions(options)`,
`exportSVG()`, `getState()`, `destroy()`, and emits `ddn-render`,
`ddn-error`, and `ddn-navigate` events. See [embedding.md](embedding.md).

### `fromSnapshot(snapshot)`

`fromSnapshot(snapshot): MountOptions` — turn a `Snapshot` back into mount
options (files + entry + view + overrides + layout state), e.g. to restore a
saved diagram.

### `snapshot(entry, view, overrides?, layoutState?)`

`ws.snapshot(...): Snapshot` — the inverse: capture everything needed to
reproduce a render (`format: "ddn-workspace@1"`, runtime stamps, files,
request).

### `destroy()`

`ws.destroy()` — release the workspace. Mounted elements should be destroyed
first (`diagram.destroy()`).

## Structured authoring

### `authoring`

`DDNLive.authoring` is the structured-edit façade (`Authoring` in
`public.d.ts`): methods like `setMatrixCell`, `setMatrixCells`,
`setRecordValue`, `replaceData`, `setAssignment`, `setLabel`, `setProperty`,
`pin`/`unpin`/`hide`, `addElement`, `addField`, `addRelation`,
`deleteDefinition`, and `sourceOf`. Each takes the workspace plus
`entry`/`view` coordinates and performs a validated source edit — this is
what the visual designer uses, so hand tools get the same guarantees.

```js
DDNLive.authoring.setLabel(ws, "model.ddn", "overview", "model.order", "Sales order");
```

## File exchange

### `io`

`DDNLive.io` (`IO` in `public.d.ts`) — browser-side file exchange:
`open(files)` (FileList → sources + snapshot), `toJSON(snapshot)`,
`toZIP(snapshot)` / `unzip(bytes)`, `zipStore(files)`, `crc32(bytes)`,
`download(name, data, type?)`, and `bundle(files, entry)` (RFC-117: merge a
workspace into one self-contained multi-module `.ddn` source → `{text,
diagnostics}`; deterministic, render byte-identical to the original
workspace; external imports kept with a `DDN-W013` warning).

## Element defaults

### `defaults`

`DDNLive.defaults.forKind(kind)` returns a deep copy of the registry default
property set for an element kind (`{}` when the kind has none) — the same
defaults B1-002 populates on declare/create. Use it to pre-fill forms or to
diff an element against the registry baseline.
