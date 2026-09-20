# DDN Designer interaction prototype

**Status: review prototype, not the full production visual editor.** The renderer is the unchanged DDN 0.6.0-beta.1 runtime. The existing Studio is not modified or included as a replacement.

Open `../DDN-Designer-Prototype.html` for the self-contained version. `index.html` is the equivalent multi-file version when the complete directory tree is accessible. A loopback server avoids single-file document-portal restrictions on Linux.

## Working actions

- Select graph objects and named fields in the canvas or model list.
- Click any palette kind for automatic placement, or drag/drop for an explicit position and pin. The Add shelf lists all 188 kinds from `../contracts/kind-ui-map.json`, grouped by its eight palette groups with name/keyword/code search; each kind's `creation_action` drives creation (plain semantic elements, fishbone causes under a selected parent, decision rule rows, Chen attributes as entity fields, Chen relationships through Connect).
- Drag an existing object header to pin it; alternatively use the numeric X/Y controls under This view.
- Edit labels, descriptions and untyped fields. Labels are not stable-ID refactoring.
- Create a relationship with two selected endpoints or through Connect's source/target selectors. Named fields remain the actual semantic endpoints.
- Reconnect a committed relation's endpoint: select an edge and drag an endpoint onto another object or field, or use the relation inspector's From/To endpoint pickers (the full keyboard/click equivalent). Both paths open the five-part impact preview (source owner, exact before/after endpoints, affected views, scratch re-render diagnostics, retained identity and route overrides) and commit one atomic, revision-checked transaction that keeps the relation's id, label and properties; illegal targets reject with a plain-language reason before anything writes. Direction reversal stays a separate proposed operation.
- Undo and redo source transactions, including the prototype's staged create-plus-pin transaction.
- Hide an appearance without deleting the shared definition.
- Change live appearance, theme, routing, graph layout and chart mark where supported; preview controls do not change business data.
- Switch between two views of shared commerce definitions, and inspect an actual source-bound RACI matrix or chart.
- Inspect actual source and download DDN, the source workspace ZIP, or the current successful SVG.

The prototype stages operations through the shared command layer (`commands.js`: `createInView`, `editProjectionProperty`, `applyCreationAction`, `reconnectRelation`) in a temporary workspace, then commits the resulting changed source files through `applyEdits`. This offers one undo step for its narrow supported gestures; it is not the production incremental command/impact/draft service defined in the specification. `index.html` and `standalone.html` are regenerated deterministically by `build-standalone.mjs`; the contract maps are wrapped for `file://` script loading by `build-ui-maps.mjs`. Behavior is covered by the Node suites under `../tests/` (`npm --prefix designer test`), including `ed-008-edge-reconnection.js` for reconnection.

## Explicit limitations

The inspector is descriptor-driven from `kind-ui-map.json`: label, description, fields (kinds whose descriptor template is `data-structure`), pin, connect and hide are live; every other descriptor property (basic controls, advanced groups, mapping status) renders read-only with source navigation and is never rewritten. Generic additions still use the current helper's local `editor_data`; production destination selection remains required. Kind conversion, detailed domain/key/constraint editing, comprehensive projection editors (fishbone/decision sheets), partial-profile draft construction, cross-view impact analysis, multiple same-view occurrences, true worker cancellation and production accessibility/security are NOT implemented by this prototype. Their dialogs are prominently labeled **PROPOSED WORKFLOW / NOT EXECUTED**. One kind (`req.requirement`) is created with an explicit, visible `x_diagram` placeholder (code plus "Undecided requirement statement") because the runtime validator requires both at creation; edit them in source or the inspector.

Projection bindings are inspectable; the matrix and chart are real runtime renders, not editable implementations of every future form. The intended complete upload/round-trip workflow belongs to the unchanged Studio today and to the new Designer specification. This prototype downloads its synthetic source; it is not an arbitrary-project importer. It uses a conservative SVG sanitizer for its reviewed fixtures, not a certified untrusted-document security boundary.

Keep original DDN files authoritative. Do not use CSS transforms or framework arrays as a hidden second model. No source, API request, or file is sent to an external service. No font files or competitor code are bundled.
