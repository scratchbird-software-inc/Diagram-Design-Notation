# 21. Diagram file preview/apply and draft validation

Implemented 2026-10-09. This chapter defines the public SDK adapter, superseding
chapter 10's proposed method names. Package version remains 0.8.0; this adds no
source syntax and does not change the DDN 0.7 dialect defined in standard chapter
59. The public TypeScript declarations are `notation/studio/src/public.d.ts`.

## Scope

All operations read or change the in-memory DDN/DDNA/DDNN workspace. Applying a
plan does not write disk files, execute SQL, connect to a database, or deploy
anything. Procedure source is exact text for a separate database-reader project.
Raw source storage remains available for incomplete or syntactically invalid
work. Preview/apply adds a validated path; it is not a restriction on saving text.

## Public contract

```js
const editor = workspace.editor({canWrite: file => editableFiles.has(file)});
const plan = editor.preview({
  entry: 'project.ddn', view: 'overview', mode: 'design',
  expectedRevision: workspace.revision, label: 'Update procedure',
  operations: [{type: 'authoring', method: 'setDocument', args: [
    'project::model.procedure', {format: 'code', text: exactSource},
    {file: 'project.ddnn', documentId: 'procedure-source'}
  ]}]
});
// Show plan.changes, plan.diagnostics and plan.views before accepting the edit.
editor.apply(plan);
```

`workspace.editor(options)` creates a session-bound adapter. `canWrite(file)`
must return exactly true for every changed file, at both preview and apply time.
The default allows writes to this in-memory workspace. Hosts remain responsible
for supplying their authorized files; the SDK does not infer account permissions.

`preview(request)` accepts entry, exact view, optional expectedRevision, mode
(`design` by default, or `review`), optional history label, and 1–256 operations:

- `files`: a `changes` map containing replacement file text, including new files.
- `edits`: source spans using the existing `TextEdit` contract.
- `authoring`: a method name from `editor.methods` and its arguments after the
  workspace, entry and view arguments. Data arguments are copied, including
  undefined property values used by existing removal setters. Functions and
  other executable values are rejected.

The supported authoring operations are addElement, addField, addRelation,
setLabel, setProperty, setElementProperties, setComposition, setDocument, pin,
unpin, hide, addOccurrence, addRelationOccurrence, setOccurrencePresentation,
setViewProperties, setViewProfile and setMatrixCells. Creation retains the
existing editor_data destination; typed destination planning remains a separate
work item. No file deletion, rename planner, reconnect planner or arbitrary
callback command is added by this adapter.

All operations run on an isolated scratch workspace. Intermediate authoring
steps can be incomplete under the draft rules below, but cannot introduce hard
errors. File replacements can encode a larger simultaneous change. The final
candidate parses every file and validates every declared view, including child
closures. Existing hard errors in unrelated files also block this conservative
first implementation; no view is silently skipped or claimed valid.

A frozen `ddn-edit-plan@1` contains baseRevision, label, target, mode, status,
changes (file, exact before/after text and SHA-256 hashes), per-operation results,
diagnostics, and per-view validation statuses. `before: null` means a new file.
Results may contain scratch revisions; only apply's return is the live revision.
Preview creates no live notification, history entry or source mutation.

`apply(plan)` accepts only the original plan object from that adapter. Serialized,
cloned, forged, cancelled, already-applied or stale plans reject. Revision changes
invalidate the plan even when undo restores identical text. Apply checks file
policy again, revalidates the candidate, then changes all files as one history
entry and one notification. A failed action changes nothing; a no-op produces no
history. `cancel(plan)` releases that plan. There is no database transaction.

| Diagnostic | Recovery |
|---|---|
| LIVE030 | The workspace changed; preview the edit again. |
| LIVE050 | Correct the command envelope, operation count or unsupported method. |
| LIVE051 | The host does not authorize writes to the named file. |
| LIVE052 | Use the original unexpired plan from this adapter, or preview again. |
| DDN-DR01 | Use explicit draft preview, or rebuild strictly before publication. |

`validate(entry, view)` / `workspace.validateDraft` return status, diagnostics
and IR, or null IR after a hard error. Core callers can use `DDN.buildDraft`.
`previewLayout(plan)` renders the isolated candidate of an unexpired plan.
`previewLayout(entry, view)` / `workspace.previewDraft` return the same information plus SVG
and scene for supported graph previews. Other projections, including isometric
ones, return null picture/scene; their source and diagnostics remain available.

## Draft rules and publication

Only these validator sites currently report `incomplete`:

| Profile family | Requirement | Existing code |
|---|---|---|
| flow.basic@1, flow.documented@2, flow.iso5807@1, uml.activity@1/@2, sysml.activity@1 | Missing start or end | DDN-PF008 |
| Same | Fewer than two decision branches, or a missing/blank branch name | DDN-PF009 |
| Same | A control symbol is not yet reachable from start and end | DDN-PF010 |

Start incoming links, end outgoing links, duplicate branch names and invalid
branch value types remain hard errors, even where the diagnostic code is shared
with an incomplete requirement. Validation continues after collecting an
obligation, so a later hard error cannot be hidden by the first soft one. Syntax,
references, types, IDs, document integrity and all other profile obligations stay
strict. In particular, this implementation does not demote RACI, DFD or
quantitative projection validators. Further soft sites require individual review
and regression coverage. No blanket code-prefix classification is used.

Design mode accepts registered incomplete requirements. Review mode requires no
incomplete or hard diagnostics in any checked view. Draft IR is explicitly
marked and ordinary graph/engine rendering rejects it. Explicit draft previews
use existing geometry and have a visible DRAFT PREVIEW badge. Ordinary workspace
rendering and exports continue to perform strict builds. Draft previews do not
invent missing chart values or substitute a different profile.

## Source editor

The shipping tool's Source drawer provides **Preview edit**, a validation summary,
a sandboxed draft picture, **Apply preview**, and **Cancel preview**. Typing cancels
the displayed plan. Applying changes storage once; undo restores all changed
files. A changed workspace revision requires another preview. The main canvas
and ordinary exports remain strict. An incomplete preview remains visible in the
preview panel rather than being passed off as a publishable main-canvas image.
Existing raw Apply/live-apply and visual controls keep their previous behavior;
this does not claim all existing controls have migrated to the new adapter.

## Performance and boundaries

Draft validation adds an obligation collector to the normal builder; ordinary
strict builds retain their validation and rendering behavior. A plan retains a candidate workspace map plus before/after text and SHA-256
hashes for changed files. Unchanged source strings are shared; a retained stale
plan can keep its old candidate snapshot alive. Full notes are never truncated
for performance. Cancel or release unused plans. The adapter uses weak plan ownership and does
not maintain a growing hidden command log.

Every-view validation is intentionally conservative and scales with workspace
view count and imported content. Preview and apply each validate the candidate;
this is an explicit user action, not a per-keystroke renderer. Incremental
invalidation and worker command planning are subsequent optimizations. Existing
workspace source/size limits apply; live draft pictures retain the normal
visible-element and relationship limits.
