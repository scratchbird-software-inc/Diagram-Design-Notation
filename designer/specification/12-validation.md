# Review, diagnostics, shared impact and trust

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Validation is a user-visible model
Each file/view has independently reported states: editable draft; structurally valid; profile-incomplete; current-view checked; impacted views pending; published artifact matching a recorded revision. None of these is equivalent to approved production data architecture. A green indicator must include its validation scope and timestamp/revision.

## Severity and progression
Errors that threaten identity, reference integrity, safety or explicit policy block the proposed operation. Incomplete obligations remain visible while authoring. Geometry warnings include approximate fonts, remaining crossings, constrained labels, and infeasible page combinations. Professional business-policy findings remain external review gates. The UI must not collapse these into one green checkmark because SVG exists.

## Problems drawer
A diagnostic has stable code, severity, category, element/member/occurrence source, explanatory sentence, optional proposed fix, affected views and evidence. Clicking selects the implicated object and opens the relevant property section. Fix actions run normal previewed commands. Batch fixes show their source diffs and are undoable. Dismissing a UI notification does not waive a diagnostic; review dispositions are explicit records.

## Shared-impact preview
For a meaning-changing property, member deletion, reconnection or shared preset change, show:
1. The current source owner and whether it is writable.
2. Exact previous and proposed values/endpoints.
3. Counts and names of affected views and projections, with uncertainty if dependencies cannot be resolved.
4. Newly invalid or incomplete contracts.
5. Retained metadata, removed data, migrations and alternatives.

Default to This view for appearance changes. Default to shared definition for semantic changes, with the scope banner always visible. “Only here” for a semantic label does not create a fake local copy; it requires an explicitly supported occurrence label override and labels it as display-only.

## Review gates
Review may certify the diagram's structural/profile checks for a particular revision. It cannot approve tax/payroll policy, security effectiveness, database enforcement or external standards conformance merely by passing code. The existing nine enterprise assurance gates remain external. A diagnostic must never be hidden because a reviewer chose Hand-drawn or a different colour theme.

## Preview versus export
While a command or render is pending, retain the last successful diagram with a clear stale state. Disable export-as-current. Failed layout can preserve semantically valid source and show a recovery option without rolling back unrelated definitions. A rejected source command, by contrast, does not commit. The distinction is important when a user pins two objects in an infeasible arrangement.

## Routing regressions as trust cases
The reported Complete connector must remain short in its fixture, not merely crossing-free. Journal Line relations 11/12 must preserve field identity while improving allowed side/slot assignment. A preview must show that a suggested fix does not move pins or exchange fields. Measure route length, crossings, bend count, label clearance and semantic endpoint identity separately.

## Implementation status (ED-010, 2026-09-20)
The prototype implements the draft/published validation surface described in
this chapter (covers VE-AC-006/007):

- **Problems strip + drawer** (`prototype/body.html`, `app.js`): a collapsed
  strip left of the status bar reports error, incomplete and warning counts
  separately (zero classes hidden); expanding opens the navigable list grouped
  by severity, each row showing code, message and view. Clicking a row
  resolves the occurrence (ED-009), selects the implicated definition
  (`choose`) and opens the Meaning tab (`setTab('meaning')`). Dismissing the
  drawer never waives a diagnostic.
- **Severity classification map** (`Commands.classifyCode` in
  `prototype/commands.js`): the literal prefix map `DDN-PF`, `DDN-PJ016`,
  `DDN-QD0`, `DDN-QL` types profile-completeness codes as draft-scope
  `incomplete` under policy `design`; under policy `review` the same codes
  report as `error`. Everything else (parse/identity `DDN0xx`, authoring
  `DDN-E0xx`, unsafe binding `DDN-PJ004`, reference/scope `DDN-PJ007/008`) is
  always `error`. Pass-through renderer diagnostics keep their own severity
  (e.g. `DDN-W012`, `DDN-PJW01/02`, `DDN-LW01`). No code is ever dropped
  (ADR-07: separately typed, not suppressed).
- **`Commands.validate(D, ws, entry, {scope, policy})`**: `current-view`
  builds the active view in a scratch workspace and classifies
  `result.diagnostics` plus any thrown `DDNError`; `workspace` iterates
  `ws.entries()` × `ws.views(entry)` in a scratch workspace, recording one
  ch.12 status per view (`current-view checked`, `profile-incomplete`,
  `error`) plus the flat issue list. Nothing commits; strict render/export is
  untouched. Issues follow the change-plan diagnostic shape `{code, severity,
  message, subjectId?, viewId, occurrenceId?}`; subject issues carry an
  `occurrenceId` computed through `Commands.occurrences` and resolvable back
  to the same definition.
- **Incomplete badge + stale state**: when a committed draft's re-render fails
  with a completeness code, the canvas head gains an amber `INCOMPLETE` badge,
  the last good render stays dimmed behind, and export stays blocked by the
  existing `renderFailure` guard.
- **Pending-view bookkeeping**: after every commit all views except the active
  one are marked pending (`Commands.pendingViewsAfterCommit`; session scope,
  never persisted); the strip shows the pending count and "Revalidate
  workspace" re-checks every view and clears them per view.
- Draft commits: `createInView`/`removeOccurrence`/`setMatrixAssignments`
  accept a `tolerant` mode that lets an edit whose only failure is an
  `incomplete`-typed code commit (parse-only validation); hard failures still
  reject before staging (VE-007; AUD-001's guard honored).

Review dispositions and evidence attachments remain proposed.
