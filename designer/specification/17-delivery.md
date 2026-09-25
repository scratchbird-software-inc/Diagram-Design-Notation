# Implementation milestones, acceptance and rollout

**DDN Designer specification 0.2.0 — proposed; baseline audited 0.7.0.**

## Work packages
**M0 — Contract and adapter spike.** Freeze runtime/hash, generate complete descriptors, expose selection/port geometry, demonstrate a command path that keeps source authoritative. Retain Studio compatibility tests. Compare the DDN-native SVG host and, only if useful, a diagram-js adapter against the same fixtures.

**M1 — Visual graph construction.** Blank project, palette search, click/drag/keyboard creation, explicit data write target, label/field editing, object/field connections, pin/resize/layout, draft states, undo and workspace save/open. This milestone is an alpha graph editor, not full Designer.

**M2 — Shared-model safety.** Add existing definitions, occurrence layer or explicit one-per-view restriction, safe reconnect, type conversion, scope membership, dependency-aware delete/copy, cross-view impact and review. Preserve unknown constructs and byte-exact unaffected source.

**M3 — Complete supported structured editors.** Data-bound chart/table/matrix/timeline bindings, causes, decision inputs/rules, lifecycle transitions, child views and profile properties. Provide template/positive/negative/round-trip/accessibility fixtures for every installed profile. Add all required descriptors, not just the demo palette.

**M4 — Production hardening and publication.** Worker cancellation and budgets, native browser matrix, keyboard/screen-reader testing, CSP/asset policies, authorized export closure, crash recovery and packaging. Independent code/security/usability review. Do not conflate this with the ERP's professional production approvals.

## Definition of done
Every normative requirement maps to an implementation component and acceptance test. Every UI control has a descriptor, exact serialization adapter and declared scope. Every palette item creates meaningful source. Every reconnect preserves source identity except for the explicit endpoint change. All supported scripts remain openable in Studio. Existing rendering regression tests remain green. New errors carry actionable messages. Review limitations are visible in product/help material.

The executable acceptance catalogue in this package is a plan, not a set of already passed production tests. Prototype checks are recorded separately. Historical core suite results are not rerun results unless explicitly recorded by the audit harness.

## Suggested review roles
A data modeler reviews shared definitions and field identities. A diagramming UX reviewer checks palette/inspector/connection efficiency. A language maintainer reviews commands, migrations and source spans. A frontend engineer reviews input/state/worker design. An accessibility specialist checks alternatives and focus. A security reviewer checks imports, draft recovery and exports. A technical writer validates terms and scope disclosures.

## Rollout
Ship Designer as an optional separate entry point behind a feature flag until M3. Keep the old Studio unchanged. A workspace version can add editor state while retaining DDN core compatibility; grammar changes such as occurrence declarations require a migration document and version negotiation. Old runtimes must reject unsupported syntax rather than silently flatten it.

Do not force a visual rewrite of user-authored code. Opening and cancelling save must have no source effects. A backup/export is available before intentional migration. Telemetry is opt-in and redacted; examples and samples remain local by default. User research should use the same canonical fixtures and include first-time authors as well as expert diagrammers.

## Test scenarios
Use the accounting model to catch field/port confusion, the purchasing flow to catch long-label detours, the domain example to catch premature datatype assignment, RACI to catch incomplete constructive validation, a dashboard to catch data-bound dragging, and shared views to catch accidental copies. Include Linux portal/local-server documentation in deployment tests rather than claiming injected HTML proves filesystem access.
