# Studio guide

> Deprecated (B1-027): the studio gallery and editor were replaced by the unified diagram tool
> (`notation/tool/ddn-tool.html`, served as `tools/index.html`; the old studio URLs redirect).
> This guide is kept for reference against the kept sources.

Open `live/editor.html` through the supplied local server, or use `live/portable-editor.html`. The portable editor embeds the same runtime and example source and does not depend on neighbouring assets to function. `dist/editor.html` is a smaller standalone editor with a starter model, not the full example catalogue.

## Existing work

**Open DDN / workspace** selects `.ddn`, workspace JSON or a source ZIP. **Open folder** preserves the relative layout of an entire project. **Add files** merges selected files into the current workspace, asking before replacing same-name files. An individual imported script that references missing files remains editable while the preview reports the missing dependency.

Use **Entry file** and **Named view** above the preview to choose what is rendered. The Workspace sidebar independently chooses which imported source you edit. Imported data, formatting and view declarations are not flattened or copied merely to render another diagram.

## Source editing

The source textarea has no read-only regions. Edit all accepted DDN constructs. Ctrl+Enter applies and validates; Ctrl+S downloads the current DDN file. Live apply commits the buffer after a short idle period; syntax errors preserve your draft. Find, Replace and Go to line are text tools. Replace is deliberately not advertised as a semantic-symbol refactor.

The preview updates from the current source, not from stored images. On failure its previous successful image is marked stale, and SVG export is disabled. Diagnostics include the relevant source/offset where available. Download the draft or full workspace before reloading; unsaved changes remain in page memory only.

## Assisted editing

Select a box/field/relation in the outline or diagram. Edit a display label, change a kind where valid, add a field, hide a view occurrence, pin/unpin, or go to its source declaration. **+ Element** and **+ Relationship** add source declarations; endpoint compatibility is checked by the 0.3 core.

Enable **Drag to pin** to move an object. The release position is written to the selected view as `place ... at`. It does not move the shared business definition. Undo restores the previous source. Other unpinned elements can reflow around the pin. A dedicated visual control does not exist for every property; the full text editor remains available for all of them.

File Rename/Move updates actual relative import literals and preserves module identities/comments. Delete blocks files still imported elsewhere. A new file begins as a shared data module; add imports/view source as needed.

## Appearance and layout

Standard, hand-drawn and neo change drawing treatment. Dark/night have contrasting connectors on grey-blue surfaces. Placement choices include the original native layouts and anchored grid/rings/layers/organic. `tree` validates a declared hierarchy; `spanning_tree` creates a drawing forest from a general graph without deleting extra relations.

Auto-placement pause remembers free positions; it does not pin them in source. **Auto-layout now** reflows them; **Centre pins** navigates to the existing pin focus. Fit and zoom magnify the current diagram only. Page/orientation/font/detail choices trigger actual remeasurement and rendering and may fail if unreadable or incompatible.

## Downloads

**Download .ddn:** current source file only. Keep its imports as separate files.

**Download workspace ZIP / Workspace JSON:** complete source project with selected view, appearance overlay and paused state. Reopen through the same Open button. A saved source workspace includes confidential information if you authored any; it is not a redacted export.

**Export SVG:** current successful policy-projected vector diagram. The host must authorize input source before delivering it to a browser. Hiding fields is never an authorization mechanism.

## Limits

Rendering is synchronous and can take seconds on a dense graph. There is no hard worker cancellation. Pins, strict guide paths, frames or highly constrained graphs can remain difficult or infeasible. The UI does not downgrade the source to another engine. Sequence projections retain special capabilities and disable incompatible free-layout controls.

Studio is a local editor/viewer, not a database administration client or an implemented ERP application. No uploaded script is sent to a server by the application.
