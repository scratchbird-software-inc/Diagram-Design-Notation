# DDN verifier specification

## Responsibility and independence

The verifier determines whether supplied DDN information is consistent with the selected language, method, profile, purpose and lifecycle requirements. It is a pure computation service with optional worker execution. The same service serves the viewer, designer, standalone browser verifier and future command-line/server adapters.

Verification must not require an SVG renderer, DOM, browser layout, editor controls or a server. Semantic verification does not invoke rendering as a proxy for checking a model. Publication geometry/metrics checks may consume an explicit presentation measurement report; unavailable required metrics produce incomplete/unsupported publication evidence, never a fabricated pass.

The source-level API decodes files through the shared language service. The model-level entry point accepts an already decoded immutable snapshot without importing the source editor or reparsing text. Neither API modifies source, repairs values, changes status, allocates business facts or performs an automation described in the diagram.

## Inputs and outputs

A request contains a snapshot/source set, exact language/defaults version, qualified scope, purpose, requested check level, installed rule packs, input revision vector, resource budget and cancellation signal. A request may check one item, view, document or the active workarea. Dependencies required for that scope are part of the closure even when outside the viewport.

A report contains the request ID, input/base revision, semantic dependency fingerprint, rule/profile versions, scope, coverage, outcome, diagnostics, required missing information/capabilities, measured work statistics and review eligibility. Diagnostic locations identify source file/span plus semantic and occurrence IDs where available; multiple occurrences can point to the same underlying issue without inventing multiple semantic errors.

Outcomes are `valid`, `invalid`, `incomplete`, `unsupported`, `budget-exceeded`, `cancelled` or `stale`. Report coverage and applicability remain explicit. A structurally valid draft can have `outcome: valid` for the structural request and `reviewEligible: false`. `valid` never means an unrequested completeness or publication check passed.

An incomplete/cancelled/budget-limited computation retains its diagnostics and checked-coverage description but cannot claim complete success. Results for an old relevant dependency fingerprint are stale. A changed comment/source span can require relocating diagnostics without repeating unchanged semantic checks; the report's source locations must still identify the current text revision correctly.

## Verification stages

| Stage | Checks | Typical result for unfinished native ERD |
|---|---|---|
| Decode | Indentation, quotes, table rows, block boundaries, typed literals and version | Preserve broken source with localized diagnostics; do not guess structure |
| Structural | One active workarea, file-local names, includes, identities, schema shapes and reference ownership | Unnamed/title-only definitions are legal; unresolved references remain visible |
| Method/profile | Admitted roles, relation endpoint/member contracts, arity, hierarchy and selected algorithm constraints | Check supplied structure without requiring SQL fields/types |
| Semantic | Units, supplied values, domain/schema bindings, rules, data revisions and profile-specific mathematical constraints | Missing facts remain undecided; no zero or false substituted |
| Complete review | Purpose-specific required information, complete dependency coverage and current successful required rules | Conceptual title-only entity can be complete; a physical-schema purpose has additional requirements |
| Publication | Complete snapshot, output support/fidelity, required metrics/assets, reading bounds and selected disclosure policy | A draft can be labelled in an allowed output; partial/stale policy is explicit |

The checker separates supplied-but-invalid values from missing required information. Profile predicates can be evaluated at the earliest applicable stage, but acceptance always requires the full requested rule closure. Review status on an imported file is checked against current facts; it is never treated as evidence that a previous check passed.

## Rules and dependency coverage

A rule pack declares its ID/version, supported language/profile versions, applicable owners/roles, purpose/stage, static property read paths, dependency-discovery function, algorithm budget and deterministic result function. Rules are installed trusted code; source text may select a registered rule but cannot supply executable JavaScript. Expressions use their bounded registered language/engine contract.

Generated validators come from the reconciled schema/codex. Do not ship the expanded planning JSON files to every viewer, and do not compile schemas with runtime `eval` merely to validate a property. Build-time generated checks are shared by source and model APIs. Handwritten graph/geometry/mathematical rules remain separate functions with their own fixtures.

Cache by rule ID/version, purpose, scope and all relevant dependency revisions/fingerprints. Different views may require different checks of the same definition; cache keys include that context. Cached results from a partial source provider cannot satisfy a complete-scope request. Missing descriptors or unsupported metadata do not silently disappear from the coverage set.

Graph-wide constraints, such as a mind-map's unique root and absence of cycles, inspect the full selected graph. Culling and paging cannot turn a visible subset into evidence for a global property. An open local provider can make the whole scope available; a paged commercial provider must supply complete input or a separately identified trusted complete result. The report states which happened.

## Lifecycle checks

A transition request includes before/after state, current report, affected scope, acceptance event if applicable and caller capabilities. Draft → In-progress is one-way. In-progress → In-review and In-review → Accepted require current complete verification; Accepted needs date/time/user. Reopening Accepted requires authority and preserves history. The verifier reports eligibility; the designer command service performs the state change.

Status and evidence validity remain independent. A live data update may make an Accepted item stale without changing its stored state. Authority decisions are supplied by the application; the offline verifier can validate the declared identity/event shape and available local policy, but cannot prove a remote user's identity from a file alone.

The exact transition matrix follows the consolidated language policy:

| From | Permitted destination | Required condition |
|---|---|---|
| Draft | In-progress | Explicit user action; no return to Draft |
| In-progress | In-review | Current complete verification for the selected purpose/scope |
| In-review | In-progress | Explicit reopening before protected semantic edits |
| In-review | Accepted | Current complete verification plus acting user/date/time |
| Accepted | In-review | Authorized reopening plus current complete verification |
| Accepted | In-progress | Authorized reopening; incomplete content allowed afterward |

No shortcut to Accepted or direct Draft-to-In-review transition is added. Re-selecting the current state is a no-op and cannot manufacture a new acceptance. Reopening moves the prior acceptance to history and clears the current acceptance slot. Protected shared-content edits require reopening each affected protected scope; occurrence display does not create an independent acceptance owner.

## Cancellation and limits

All potentially large loops/graph searches support cooperative budget checks. Count visited records, evaluated expressions, graph-search work and elapsed slices. Budgets are operation/capability limits, not silent truncation of semantic facts. Return `budget-exceeded` with the stage and unfinished coverage if a limit is reached.

The standalone verifier can run on the compute worker or through a DOM-free cooperative executor. Cancellation preserves the input and returns a terminal result exactly once. Semantic results must be identical between execution modes for the same versions/inputs/budgets; timing statistics may differ. Global mathematical checks cannot report success after a partial incremental update without proving the dependency closure.

## Browser utility shell

The verifier's standalone HTML shell offers file selection/drop/paste, explicit entry-file selection when needed, scope/purpose/check-level controls, progress/cancel, a filterable diagnostic list and JSON/Markdown report downloads. It can display source excerpts with locations. A diagram preview is optional and loads the viewer only when requested.

The shell opens local sources without a web server and checks included files from the selected file map. It never fetches a missing file or profile from a network automatically. It preserves supplied source data even when decoding fails, and clearly distinguishes malformed input from a missing optional rule pack.

## Acceptance scenarios

VF01–VF13 cover DOM-free execution, source/model equivalence, syntax and semantic diagnostics, partial drafts, precise staged validity, all retained profile rules, complete versus visible scope, invalidation, stale result rejection, lifecycle eligibility, budget/cancel behavior, unknown packs and publication evidence without rendering-based semantic verification.
