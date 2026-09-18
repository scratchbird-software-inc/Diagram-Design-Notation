# DDN 0.5 — Executable capability matrix

`registry/capabilities.json` is generated from runtime constants. `tools/build-capabilities.js` is the sole producer of formatting enum lists. Documentation must not advertise an accepted value that has no implementation or explicit diagnostic.

| Area | Reference support | Important boundary |
|---|---|---|
| Language/reuse | UTF-8 labels, local imports, shared data/profiles/views, recursive fields | ASCII structural IDs; no remote fetching |
| Semantics | All registered relationship endpoint contracts; registered extension validation | Registry/schema subset, not arbitrary third-party schema code |
| Layout | auto, grid, manual, layered, strict tree, mindmap, grouped; pin-centred fit_grid, circular, radial, spanning_tree, organic | Deterministic bounded algorithms, not globally optimal packing |
| Routing | Obstacle-aware orthogonal routes, distinct tracks/ports, gaps/bridges, labels | Fail closed when search/clearance cannot be satisfied; bus graphs unsupported |
| Typography | Variable size, browser or pinned measurements, explicit fallback warnings | No universal font or browser certification |
| Publication | Content/fixed/paper sizing, overflow and embedding minimums | Automatic tiling/pagination unsupported |
| Export | Explicit object/field/property allowlists, SVG and JSON closure | Authorization and classification remain external; samples denied in public profile |
| Process contracts | Port/payload balance; bounded guards, branches and retries on supplied traces | Not a production orchestration runtime or BPMN certification |
| Assurance | Requirements, evidence, affinity, reconciliation, UI/report/custody obligations | Does not execute ERP, authenticate professional signoff, or run infrastructure drills |
| Editor | Full-source Studio, DDN/folder/ZIP/JSON local workspaces, undo/redo, validated label/kind/element/field/relation edits, drag-to-pin, live controls and policy-projected SVG | All grammar remains text-editable; not a dedicated graphical panel for every construct or a complete semantic refactoring engine |

## Quality projection additions

The core mechanisms above are shared with `fishbone.basic@1`, `matrix.heatmap@1`, `chart.quality@1`, `state.flat@1`, `decision.rules@1`, `panels.composed@1`, `uml.usecase@2`, `chen.binary@2` and `flow.documented@2`. These implement only the scopes in chapters 21–24. Guided matrix edits can create/delete relationships in shared source; rule evaluation is pure and typed; trace checks never execute actions; panels support one child-view level. Statistics use supplied values and declared finite arithmetic conventions. Numeric/date/cell coordinates are not subject to graph relocation.

## Verification reports

Current tests are `tests/core-report.json`, `validation/0.3-regressions.json`, the use-case/session reports, and `enterprise-review/validation/`. The original 0.2 failure evidence lives only under `history/0.2-enterprise/`. Tests corrected from old “unsupported” expectations now assert the implemented behavior; the original assertions remain in the historical Git baseline evidence where applicable.

The enterprise geometry scanner tests emitted SVG-scene coordinates independently of the router. No route-through-box, overlapping object, overlapping callout, independent collinear trunk, or callout-versus-unrelated-route hit is accepted in that corpus. This is corpus evidence, not a universal proof for all possible input graphs.

Browser tests must disclose whether they used normal navigation, file URLs or injected assets. A headless Chromium test is not a Firefox/Chrome/Linux packaging permission matrix. Casebook self-containment and the loopback server avoid the previously observed single-file portal problem without disabling browser security.

## Readiness gates

Reference-code corrections can be verified locally. External accounting/payroll/privacy policies, real operational drills, final applications/reports, independent evidence custody, specialized algorithms and professional signoff remain named gates. A renderer producing attractive output is not grounds to mark those gates accepted.
