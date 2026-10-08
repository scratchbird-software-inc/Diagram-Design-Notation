# Multi-file workspaces, data editing and view authoring workflow

**DDN Designer specification 0.2.0 — proposed; baseline audited 0.7.0.**

> **Implementation status (2026-10-08, implemented):** all seven requirements
> are shipped in the live unified tool (`notation/tool/src/`, `?mode=design`).
> WW-001: the Files drawer renders the workspace as an import tree
> (`filesUI`/`fileRoleSummary` in `tool.js`) — entry root, imports nested,
> per-file role summaries from parse facts, no-view files labelled "data
> only". WW-002: "New data file" and "New view file" intents beside "New
> file"; both preflight parse/render and undo on failure. WW-003: "New view
> from current data…" in Style & Layout reuses the current view's data/select
> lines verbatim, imports the data-owning files for new destinations
> (`refOwnerFiles`), and declares data-bound binding stubs with real record
> keys when derivable, placeholder INCOMPLETE stubs otherwise. WW-004: the
> Type sheet's Data body (`renderDataSheet`) edits records of every data
> block grouped by owning file through `authoring.setRecordValue`. WW-005:
> every Document drawer value carries a This view / Inherited / Session
> preview chip plus Reset-to-inherited (one-key removal via
> `setViewProfile`/`setViewProperties` with `undefined`). WW-006: selection
> status names the owning file when it differs from the view's file, and
> delete confirms report "used in n views across m files" with the file list.
> WW-007: bundle/split round trips verified byte-identical (probe
> `/tmp/ww007.js`); no code change was needed.

> **Placement.** This chapter specifies the work process for workspaces whose
> notation is spread across more than one `.ddn` file: shared declarations in
> data/model files, one or more view files importing them, and several people
> owning different files. It builds on the runtime's existing multi-file
> workspace model (chapter 56 §X3 `import "…" as …;`, one workspace per import
> closure, `ws.entries()` enumeration, per-entry view lists) and the single-file
> bundle (`DDNLive.io.bundle`, B1-015). It adds designer UX only; it changes no
> grammar, no renderer behavior, and no conformance surface.
>
> **Boundary.** Live multi-user collaboration — presence, concurrent same-file
> editing, operational transform or merge, shared history — is Weaver's
> charter and is out of scope here. This chapter's multi-person story is
> **file-granular ownership**: people work in different files of one workspace
> and combine them through imports. The designer must never *block* later
> collaboration: every edit stays one atomic, file-scoped transaction.

## Terms

- **Data file** — a `.ddn` file holding shared declarations (elements,
  relations, `data` blocks, records) and no views, or only a primary view.
- **View file** — a `.ddn` file that imports one or more data files and
  declares views referencing the imported declarations, carrying its own
  `style {}`, publication settings, pins and projection bindings.
- **Owning file** — the file a declaration is written in. Every declaration
  has exactly one owning file; views reference, never re-declare.

## Requirements

### WW-001 — Workspace outline (Files drawer)

The Files drawer presents the workspace as an **import tree**, not a flat
list: the entry file at the root, imported files nested beneath their
importer, each file expandable to show its declared views. Each file node
shows a one-line role summary derived from parse facts — e.g. `3 views · 42
elements · 2 data blocks` or `data only`. Files that declare no view are
labelled as data files, not treated as errors.

`WW-AC-001`: given the standard two-file fixture (`model.ddn` +
`views/overview.ddn` importing it), the outline shows the import edge, the
per-file role summaries, and both views under the view file.

### WW-002 — Intent-based file creation

"New file" offers two intents beyond a blank file:

- **New data file** — creates a file with no view; offers to insert the
  matching `import "…" as …;` line into the current file (the existing
  `importLineFor` helper and confirm flow).
- **New view file** — creates a file that imports the current data file and
  declares one skeleton view referencing a chosen set of elements; opens that
  view.

Both intents must produce files that parse and render empty-state output
before any further editing (no half-written skeletons that trip validators).

`WW-AC-002`: each intent, committed and then re-opened from the workspace
outline, renders without diagnostics.

### WW-003 — New view from current data

From any view, a **New view…** command creates a view over the same
declarations: the author picks a name, a view kind / projection profile, and
a destination (this file or a new/existing view file). The result is a valid,
renderable view bound to the same data — for a data-bound projection, with
its binding stub declared and flagged incomplete per the constructive-validation
policy rather than silently omitted. The command must never require
hand-writing source to get a working second view.

`WW-AC-003`: from the fixture's graph view, create a chart view over the same
records in a new view file; the chart view renders (or renders with an
explicit INCOMPLETE badge per ch.12), the source graph view is byte-identical,
and undo restores the workspace.

### WW-004 — Data sheet (workspace data editing)

A **Data** body in the bottom Type sheet lists every `data` block in the
workspace, grouped by owning file, and edits records as a table through the
authoring layer — the same machinery as the chart/matrix/timeline sheets, at
the source level rather than bound to one projection. Adding a record writes
to the block's owning file regardless of which view is on screen. The sheet
header names the owning file so the write target is never ambiguous.

Editing data never changes view definitions; views bound to an edited block
re-render from the new values on commit.

`WW-AC-004`: with two views bound to one data block in different files, a
cell edit in the Data sheet writes exactly one change in the owning file and
both views reflect it after commit; the other file is byte-identical.

### WW-005 — View-specific standard values (This view's settings)

View-scoped standard values (publication profile, chrome, style/layout keys,
descriptor defaults) continue to write into the view declaration through the
existing authoring channels. The inspector/drawer surface for them gains
explicit provenance: each value is labelled **This view** (written in this
view's block), **Inherited** (from document/defaults), or **Session
preview** (not saved). An overridden value carries a **Reset to inherited**
action that removes exactly that key from the view block and nothing else.

`WW-AC-005`: set a view-level palette, verify the label reads "This view";
reset it, verify the key is removed, the inherited value applies, and the
rest of the view block is byte-identical.

### WW-006 — Cross-file awareness and write targeting

The status line names the file the next edit will write whenever the
selection's owning file differs from the file of the view on screen.
Destructive actions against shared declarations state their blast radius
before commit: **delete element** reports "used in n views across m files"
(with the existing used-in counting), and **rename / retype** offers the
cross-view impact note already required by VE-005.

`WW-AC-006`: deleting an element referenced by views in two other files shows
the count and file list in the confirm step; cancelling writes nothing.

### WW-007 — Interchange invariance

Splitting a single-file workspace into data + view files, and re-bundling a
multi-file workspace to one file, must both be lossless round trips through
the existing import/bundle machinery: declarations keep ids, views keep
bindings, diagnostics are unchanged. The designer offers **Download → single
file (entire workspace)** (already shipped, B1-015) as the interchange form;
nothing in this chapter introduces a project container, manifest, or lock
file.

`WW-AC-007`: fixture workspace → bundle → re-open → parse-equal diagnostics
and byte-identical renders for every view, in both directions.

## Explicitly out of scope

- Presence, live cursors, same-file concurrency, merges, history (Weaver).
- A new packaging/project format (WW-007 keeps the plain import closure).
- Grammar changes: if a workflow genuinely needs one (e.g. occurrence
  declarations), it goes through the notation amendment path, not this spec.

## Suggested implementation order

1. WW-003 + WW-005 (small, high value; both reuse existing channels).
2. WW-001 + WW-006 (outline UI + write-target surfacing).
3. WW-002 (intents on top of the outline).
4. WW-004 (largest piece; reuses the descriptor-form generator and the
   chart-sheet record editing against `data` blocks directly).
