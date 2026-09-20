# Creation, selection, inline editing and clipboard

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Blank workspace
Start with a valid minimal module, shared data block, shared default format and one empty named view. Offer Sketch, Data model, Process, Architecture, Matrix/report, or open existing. A template selects profile and defaults explicitly; it does not inject a complete invented business model. Friendly names are editable while stable IDs are generated separately.

> Implementation status (ED-013): eight canvas template starters are implemented in the prototype's Add shelf (Business Model Canvas, Lean Canvas, SWOT, PEST, PESTLE, Porter five forces, empathy map, balanced scorecard). Each one instantiates its profile's fixed grid with one synthetic starter note per block in a single atomic command (`Commands.createCanvasFromTemplate`), then opens the generated view in the panels editor; the starter notes are clearly placeholder guidance, never business data.

## Creation destination
The Add shelf displays “Create in model.ddn / model.” A project default can preselect it. New objects go to that selected data block, even when the visual view is in another file. Create the necessary import and view selection atomically. Creating a local-only object is a deliberate alternative labeled “Only this view's local data.” Do not reuse the current helper's `editor_data` behavior as the universal policy.

> Implementation status (ED-001): the prototype still writes every creation through the current helper's local `editor_data` block in the view's source file. Destination selection (“Create in …”) is unimplemented M2 work and AUD-002 remains open; the prototype labels this in its creation dialogs.

## Drag and click insertion
Dragging a template shows a ghost, applicable drop zones and pin intent. The default pointer drop means **Place here and pin** because the position was deliberately chosen; show the pin badge and a one-click “Let layout move it” action. The Insert button or keyboard action means **Add automatically**, creating an unpinned object. The project can remember the alternate drop preference, but it remains visible during the gesture. No auto-layout runs while the user is holding a pointer.

Click-place is a full alternative: choose a template, click a location, then name the item. Keyboard insertion chooses a template from the command menu and either uses automatic placement or opens a position control. Escape cancels. A drop onto an existing node does not replace it. It may offer Add field, Add child, or Create related only when those are explicit valid actions.

## Selection and text
Click selects an occurrence. Alt/selection-menu resolves a crowded group. Clicking a field selects the field without changing the parent definition selection invisibly. Double-click or Enter enters an HTML text editor aligned to the rendered label. Labels remain plain text; no rich executable markup. Tab follows property controls, not geometry. Selection outlines and hit areas are overlays excluded from export.

Box/lasso selection chooses occurrences in the active view. A group selection does not create a model group. A context pad offers Connect, Add related, Edit contents, More; it stays outside text/ports and can be opened from the keyboard. The pointer target width is fixed in screen coordinates while diagram content zooms.

## Reuse, copy and duplicates
The Model shelf's drag action creates another appearance of an existing definition in a different view; it does not create a new table. If the same definition is already in this view, focus it by default; offer “Add another appearance” only when occurrence support exists. Clipboard actions explicitly distinguish “Paste linked appearance” and “Duplicate definition.” The latter generates new stable IDs and remaps internal references, while external references remain references unless the user requests deeper duplication.

Cross-workspace paste must show imported dependencies and name/ID conflicts. No automatic same-name merge. Copying a deployment instance must not be described as creating a database replica unless the model explicitly includes that relationship. Preserve unknown extension properties on copy and disclose any unsupported conversion.

## Delete and remove
Delete defaults to **Remove from this view**. If the selected item is a projected field/cell/mark, explain its source and offer the appropriate removal action rather than hiding a fact invisibly. Delete from model is a separate destructive command with incoming/outgoing/derived references, affected views and chosen handling. Never reconnect neighbors automatically after deleting a node from a semantic graph; that can invent a relation.
