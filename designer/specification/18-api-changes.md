# Required core/API extensions and compatibility plan

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Existing API is not enough for full visual construction
The audited helpers are useful but not a universal command system. This spec does not claim they already expose reconnection, explicit generic write targets or draft-profile inspection. The new editor may initially wrap them for its supported subset; production completeness requires the additions below.

| Proposed capability | Current seam | Required change |
|---|---|---|
| Typed creation destination | addElement/addRelation use `editor_data` | Add target data-block ID and property/template arguments to a noncommitting planner. |
| Atomic composite actions | applyEdits with expectedRevision | Public prepare/validate/commit that batches imports, definitions, occurrences, pins and rules. |
| Draft semantic model | parse/raw update plus strict build | Structured draft resolver with stable diagnostics and safe incomplete projection behavior. |
| Reconnect relation | no dedicated helper | Endpoint-aware patch planner with direction/member/profile checks and impact preview. |
| Per-property view overrides | runtime temporary overlay | Exact source-writer for local inherited profiles, with reset and provenance. |
| Duplicate occurrences | graph layout keyed by definition | Versioned occurrence and endpoint-occurrence representation; fallback is an explicit restriction. |
| Safe kind conversion | generic setProperty | Retention/migration plan with profile/reference/field compatibility tests. |
| Move/reparent field/definition | raw source edit | Stable identity and reference refactor across imports; comments preserved. |
| Selection/port geometry | scene field rows and nodes | Versioned screen-independent scene hit schema with contours and occurrence IDs. |
| Impact validation | current-view build | Dependency graph and validated closure with per-view result records. |
| Worker execution | render Promise calls sync backend | Serialize requests/results and cancel/terminate real worker generations. |

## Descriptor/package versions
Use `designer-ui@0.1` for this metadata proposal. Runtime remains 0.5.0-draft.2 in the prototype. Do not label the specification as DDN 0.6 until implementation and migration tests exist. Installed profile versions remain independent; a single generic editor can expose several profile variants.

## Source evolution
The core DDN declarations continue to own meanings. UI descriptors are separate installed JSON, not embedded arbitrary executable scripts. No new source syntax is necessary for a generic property inspector. An occurrence layer and first-class draft references may need syntax; keep them in separate RFCs with grammar and compatibility tests. A visual app's session JSON must never become required to interpret source semantics.

## Host contracts
The editor adapter accepts permitted write scopes and export policies from the host. Each command checks authorization at execution, not only palette construction. Callbacks include source diffs and exact revision, not the whole model by default. External files remain local until the user or host explicitly chooses a storage operation. Public reusable renderer API remains unchanged; adding an editor must not increase viewer payload requirements.

## Prototype boundary
The provided prototype uses current `DDNLive` actions for its functioning graph subset and limited runtime views for projected samples. Storyboard dialogs illustrate proposed richer flows. They are labeled as such. Do not ship the prototype as production or treat UI controls demonstrated without a corresponding source command as implemented model features.
