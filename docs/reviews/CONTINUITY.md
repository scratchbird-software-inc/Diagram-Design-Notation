# DDN review continuity

Updated: 2026-09-29.

## Active user intent

The user requested a review of `/home/dcalford/Sandbox/Diagram-Design-Notation/`, then a written report and retention of pertinent facts while they provide details for the next section of work. Review/reporting is authorized. Implementation, restructuring, a ScratchBird pilot, committing, and pushing have not been requested for this DDN task.

Read [the initial review](2026-09-29-initial-review.md) before planning further work. Incorporate the next user instructions; do not assume that every recommendation has been accepted.

## Facts to retain

- Reviewed working-tree HEAD: `1ff08fce7376ecbb654296e2b6dbccf5a4436f9f`. Pre-existing tracked and untracked changes were present. Recheck status before editing; preserve unrelated work.
- Root and notation package version: 0.7.0. Accepted source versions: 0.2, 0.3, 0.4, 0.5. Version layers are independent.
- `standard/` is the normative authority; implementation is in `notation/runtime/`. Proposed designer contracts are not automatically implemented APIs.
- The current visual designer is the unified tool in design mode (`/tools/index.html?mode=design`). The old `designer/` prototype is retired; its documentation retains proposals and historical material.
- Core design strengths: shared semantic model, stable identities, view/model separation, explicit relationships, documented validation boundaries, and explicit redacted exports. Hiding fields is not redaction.
- Documented live-view budgets: 128 elements / 384 relations. Composed dashboards: up to 12 children, one child-view level. Library workspace budgets: 2 million characters per file, 12 million total, 1,500 files.
- Verified documentation drift: standard index says chapters 00–26 but files extend to 48; index says 90 relationship verbs while base catalogue has 91. Base catalogue has 152 kinds / 118 facets. Do not treat these as expanded runtime totals.
- Parameterized fragments are deliberately deferred in `DDN-GAPS.md`; do not silently introduce textual substitution or change identity semantics.
- Six focused semantic checks passed. No full test run, browser usability evaluation, performance measurement, or security/conformance audit was performed.
- Main concerns are breadth versus workflow maturity, dense runtime source, documentation/status drift, onboarding across version layers, and unverified large-project workflows. These are not all demonstrated bugs.
- Proposed next experiment: a real ScratchBird subsystem across architecture, database, and sequence views, including realistic edits and diff review. This remains a recommendation awaiting the user's next details.

## Working preferences and boundaries

- Keep follow-up work focused on DDN; the preceding ScratchBird build and cleanup history is a separate task.
- The user previously reported limited remaining weekly tokens; avoid redundant broad rereads and unnecessary reports.
- This file is the durable continuity record. Do not imply that facts have been saved to a separate persistent-memory service.
