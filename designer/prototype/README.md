# DDN Designer interaction prototype

**Status: review prototype, not the full production visual editor.** The renderer is the unchanged DDN 0.5.0-draft.2 runtime. The existing Studio is not modified or included as a replacement.

Open `../DDN-Designer-Prototype.html` for the self-contained version. `index.html` is the equivalent multi-file version when the complete directory tree is accessible. A loopback server avoids single-file document-portal restrictions on Linux.

## Working actions

- Select graph objects and named fields in the canvas or model list.
- Click a palette starter for automatic placement, or drag/drop for an explicit position and pin.
- Drag an existing object header to pin it; alternatively use the numeric X/Y controls under This view.
- Edit labels and add untyped fields. Labels are not stable-ID refactoring.
- Create a relationship with two selected endpoints or through Connect's source/target selectors. Named fields remain the actual semantic endpoints.
- Undo and redo source transactions, including the prototype's staged create-plus-pin transaction.
- Hide an appearance without deleting the shared definition.
- Change live appearance, theme, routing, graph layout and chart mark where supported; preview controls do not change business data.
- Switch between two views of shared commerce definitions, and inspect an actual source-bound RACI matrix or chart.
- Inspect actual source and download DDN, the source workspace ZIP, or the current successful SVG.

The prototype stages existing helper operations in a temporary workspace, then commits the resulting changed source files through `applyEdits`. This offers one undo step for its narrow supported gestures; it is not the production incremental command/impact/draft service defined in the specification.

## Explicit limitations

The eight starter buttons are a sample, not 188 complete palettes. Generic additions still use the current helper's local `editor_data`; production destination selection remains required. Reconnection, kind conversion, detailed domain/key/constraint editing, comprehensive projection editors, partial-profile draft construction, cross-view impact analysis, multiple same-view occurrences, true worker cancellation and production accessibility/security are NOT implemented by this prototype. Their dialogs are prominently labeled **PROPOSED WORKFLOW / NOT EXECUTED**.

Projection bindings are inspectable; the matrix and chart are real runtime renders, not editable implementations of every future form. The intended complete upload/round-trip workflow belongs to the unchanged Studio today and to the new Designer specification. This prototype downloads its synthetic source; it is not an arbitrary-project importer. It uses a conservative SVG sanitizer for its reviewed fixtures, not a certified untrusted-document security boundary.

Keep original DDN files authoritative. Do not use CSS transforms or framework arrays as a hidden second model. No source, API request, or file is sent to an external service. No font files or competitor code are bundled.
