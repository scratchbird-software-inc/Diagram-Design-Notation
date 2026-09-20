# Commands, transactions and draft validation

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Authoritative edit path
All gestures and inspector edits call the same semantic command bus. No DOM/SVG mutation is a committed source edit. The command stages are **prepare → preview → validate → commit → render**. A command envelope identifies the base revision, exact view/selection/occurrence, intended scope, arguments and user-visible history label.

`prepare` resolves stable IDs, collects source ranges, computes touched files and dependencies, and constructs typed edits without changing the workspace. `preview` exposes an impact summary. `validate` checks input and policy at the required scope. `commit` compares expected revision/hash and applies all edits atomically; conflicts reject with a recomputable preview. A cancelled or failed command makes no history entry.

## Core command inventory
CreateDefinition; CreateOccurrence; AddMember; UpdateMember; MoveMember; UpdateProperty; ConvertKind; CreateRelation; ReconnectRelation; UpdateRelation; SetAttachmentPolicy; SetRoutePolicy; CreateScopeMembership; RemoveOccurrence; DeleteDefinition; DuplicateDefinitions; ReuseDefinition; ApplyLayout; Pin/Unpin; SetViewOverride; EditSharedFormat; BindProjection; EditRecord; SetMatrixCells; EditRuleSet; EditChildViews; RenameFile; MoveDefinition; ExportAuthorized. Their payload families are described in the machine-readable command contracts. `BindProjection`/`EditRecord` now have a machine-readable contract branch (`setProjectionBinding` in `contracts/command.schema.json`) and a prototype implementation (ED-003: `setChartMark`/`setChartBinding`/`editRecordValue` in `prototype/commands.js`); the public prepare/commit seam above remains proposed. `ReconnectRelation` likewise has a contract branch (`reconnectRelation`) and a prototype implementation (ED-008: `reconnectRelation`/`previewReconnect` in `prototype/commands.js`, wired to the edge-endpoint drag and the relation inspector); the public prepare/commit seam remains proposed. `CreateOccurrence`/`ReuseDefinition`/`RemoveOccurrence`/`SetViewOverride` now have prototype implementations through the occurrence addressing layer (ED-009: `Commands.occurrences` in `prototype/commands.js` — `addExistingToView`, `removeOccurrence`, `moveOccurrences`, `setViewOverride`, matching the contract branches of the same names), with explicit restriction/unsupported responses where the 0.5 runtime lacks the capability (one-appearance-per-view; no independent relation-hide); the public prepare/commit seam remains proposed.

The existing authoring functions are wrapped where sufficient. Commands with source dependencies require new planners; do not compose several committing helpers and call that atomic. A create-plus-pin gesture is one command. A property slider's many intermediate values are one command. A multi-row assignment fix is one batch.

Implementation status (ED-002): `SetMatrixCells` is exercised through the prototype's `setMatrixAssignments` command mapping (`prototype/commands.js`, contract payload `setMatrixAssignments`) with profile alphabet pre-checks and one-transaction batch commits; the public prepare/commit seam above remains proposed.

## Drafts without semantic corruption
The current runtime builds strict profile contracts during guided edits. Introduce a **draft inspection** path that preserves syntactically valid incomplete records and reports missing obligations. Hard failures include invalid references introduced by a reconnect, duplicate stable IDs, invalid property types, illegal filesystem paths and unauthorized writes. Soft draft issues include an unfinished flow path, missing decision branches, an unassigned RACI role or unchosen datatype.

The split must be documented per validator; do not blanket-demote every error. A new field may be undecided. A foreign reference must not target a nonexistent field unless the editor deliberately creates a typed unresolved reference record under an explicit new language contract. Temporary dangling connectors remain UI state and are never silently exported as valid relationships.

Draft visualization uses the same registered geometry and exposes an Incomplete badge/Problems list. If a projection cannot meaningfully render incomplete inputs, show its structured sheet and exact missing requirements—not fabricated chart values. Strict render/export remains unchanged. A draft preview export, if implemented, is explicitly watermarked and separately authorized; it is not the ordinary Publish result.

Implementation status (ED-010): the prototype's draft inspection path (`Commands.validate` + `Commands.classifyCode`) classifies every diagnostic — `incomplete` only under policy `design`, `error` otherwise — and never suppresses a code (ADR-07). A tolerant draft commit succeeds only when the sole failure is an `incomplete`-typed code; hard failures reject before staging. Strict render/export remains unchanged and the CLI reports the same codes (AUD-001's guard honored; covers VE-AC-006/007).

## Cross-view validation
Maintain an index from definitions and format policies to consuming views and child-view closures. A command may commit a draft but must update each affected view's status to stale/unvalidated. Review revalidates the affected closure. Deletion and kind conversion require a dependency check before commit. Public export validates its authorized dependency closure. Do not claim all-view validity from the current helper's current-view `build` call.

## History and recovery
One workspace history for both editors when attached to the same in-memory session. A source edit and a visual edit cannot be reordered across different revision bases silently. Undo is conditional on the exact source session or a reviewed rebase. Saving records a checkpoint; it does not erase history. Crash recovery is opt-in, versioned, and labeled browser-local. Recover before replacing the user's disk files; writes require explicit user consent.

## New public seam (proposed)
Expose `prepareCommand`, `validateDraft`, `inspectSelection`, `previewLayout` and `commitPrepared` through an editor-specific adapter. These names are proposed, not methods of the current runtime. The current `DDNLive` API remains supported and the editor must not depend on unversioned internal closures for source manipulation.
