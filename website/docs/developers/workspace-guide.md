# Working with DDN, DDNA and DDNN

Updated October 14, 2026 for the 0.8.0 alpha tools. The package version,
source dialect and DDNA execution profile are separate version identifiers;
these changes do not constitute a 0.9.1 release.

[Open the designer](../../tools/index.html?mode=design) and choose the folder
icon, **Workspace**. The Logical navigator groups the project by purpose;
Files shows the actual files. Search either when a project grows.

## One project, three file roles

| File | Purpose | What the designer does |
| --- | --- | --- |
| `.ddn` | Model identities, data, views, shared formats and layout | Edit definitions once and reuse them in several views; give each appearance its own presentation and position. |
| `.ddna` | Automation companions referring to DDN identities | Edit supported rules and expressions, generate bounded traces, and replay loaded traces. |
| `.ddnn` | Optional text documents referenced by DDN elements | Keep large notes or code outside the diagram file, edit full text, and inspect shared consumers. |

A data section is an authored model or supplied records, not a database
connection. All processing is client-side. Database extraction, schema changes
and execution of stored procedure code belong to a separate reader/application.

## Models and views

1. Open or import the files that belong to the project.
2. Under **Models**, manage data sections, definitions, fields, properties and
   relationships. Choose the destination for a new definition explicitly.
3. Under **Views**, create a view or copy one while retaining shared model
   references. Select its data bindings and which definitions appear.
4. Open several views as tabs. Each remembers its zoom, scroll, selection and
   presentation settings. Equal names in different modules stay distinct.
5. Add another appearance when one definition needs to occur more than once.
   Renaming shared data affects its consumers; moving an appearance affects
   that appearance. The scope strip identifies the view and owning model.

The designer retains at least one view. Some projection families restrict
multiple appearances; the tool reports unsupported cases rather than inventing
an interpretation.

## Shared settings and local presentation

Use **Shared settings** for reusable layout, style and other profile/bundle
values. The view editor shows inherited effective values and local overrides;
reset an override to inherit again. Advanced properties remain available through
JSON-value and Source controls.

Element presets provide defaults for name, type, table and notes. Override the
visible sections per element/appearance, and put the table above or below the
note. Notes support text-oriented Markdown or code, with horizontal and vertical
scrolling for overflow; embedded images and Markdown tables are excluded.

**Select** and **Pin** have the same selection and context-menu actions.
Dragging in Select lets other elements and relation paths rearrange. Dragging
in Pin holds the other elements in place and recalculates relation paths.
**Tidy** requests a fresh arrangement. To connect existing elements, select the
source, right-click, choose **Link to**, choose the target, then the relation type.
The creator also provides Cut, Copy, Paste, Delete and text-formatting controls.

## Text documents and automation

**Text documents** lists DDNN records and their references. Edit the full text,
attach an existing document, move inline text to a sidecar, or detach it. Shared
text edits affect every reference. Guarded removal prevents dangling references;
digests are updated with accepted text changes. SQL is stored as inert code.

**Automation** exposes supported DDNA rule/expression/table editing and the
existing generation/replay tools. Bounded dependency graphs use
`ddna.em2.dag-l0@1`; unique/first/collect decision tables use
`ddna.em2.tables-l0@1`. These are not full DMN/FEEL implementations. EM-5 has
specified host contracts and a boundary validator, but no installed solver or
query engine. A section editor does not add execution support for every profile.
See the [DDNA specification](https://github.com/scratchbird-software-inc/Diagram-Design-Notation/tree/main/ddna).

## Safe editing and saving

Accepted section edits use shared validation and undo/redo. A rejected edit
retains its draft and the previously accepted workspace; error dialogs explain
the failure and can be dismissed with OK. Source preview/apply lets you inspect
changes before acceptance. Problems and Changes help locate errors and edits.
A stale draft cannot silently overwrite a newer workspace revision.

**Save / Save As** writes a workspace ZIP with accepted DDN, DDNA and DDNN
sources, loaded trace files, and view sessions/tabs. Reopen the ZIP to continue.
Apply or discard drafts before saving: unapplied drafts and undo history live
only in the browser session. Newly generated runs use the existing explicit
trace download; they are not automatically archived as loaded traces.

For embeds, `DDNTool.setDocumentLoader(callback)` accepts host-provided DDNN
text at load time. It supplies no hosted storage or database service, and is
not viewport-based paging. See the [tool API guide](tool.md).

## Qualification and present limits

[CI passed on October 14](https://github.com/scratchbird-software-inc/Diagram-Design-Notation/actions/runs/38578889318)
for implementation commit `9899e2c5`: notation suites, CLI/schema checks,
designer/browser integration and the example-link crawl. Workspace acceptance
also covers native Chromium interaction with workers on/off and Firefox DOM
integration smoke; the Firefox checks are not equivalent to native pointer tests.

Section acceptance currently validates all views synchronously, so large projects
can pause. Model-list virtualization, asynchronous dependency-limited validation,
full bulk-database benchmarks, model-only workspaces, and durable draft/history
storage remain follow-ups. Current measurements do not establish performance for
an entire downloaded database. These are implementation limits, not a new
open-source/commercial allocation.
