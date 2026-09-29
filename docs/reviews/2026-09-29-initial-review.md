# DDN initial review — 2026-09-29

## Assessment

DDN has a sound foundation worth developing. Its strongest feature is a shared semantic model with multiple diagram views, stable identities, explicit relationships, and presentation that does not redefine meaning. Its principal risk is expanding domain coverage faster than implementation, documentation, and everyday authoring workflows can mature.

This is an initial architectural and implementation review, not a release qualification, security audit, standards certification, or comprehensive usability evaluation. Recommendations below are proposals pending the owner's next requirements, not an approved implementation plan.

## Review baseline and scope

- Project: `/home/dcalford/Sandbox/Diagram-Design-Notation/`.
- HEAD observed: `1ff08fce7376ecbb654296e2b6dbccf5a4436f9f`.
- The working tree already contained modified runtime assets, generated distributions, documentation, tests, website files, and untracked examples. Findings describe the inspected working tree, not exclusively that commit. Existing changes were not altered.
- Reviewed root/package documentation, selected normative chapters, the designer status documentation, known deferrals, representative examples, runtime implementation samples, and core test code.
- Ran six focused semantic assertions successfully. Did not run the complete test suite, browser interaction tests, performance benchmarks, or a visual review of rendered output.
- This report and the accompanying continuity note are the only intended additions from the reporting task. No fixes, commit, or push were requested.

## Strengths and their evidence

### Shared model and stable identity

[The data model](../../standard/specification/02-data-model.md) distinguishes identity from labels, source models from view occurrences, and deployment copies from repeated visual appearances. Imports and selections do not duplicate model elements. This supports consistent architecture, database, and process documentation and could suit a ScratchBird pilot.

### Meaning is separate from presentation

[Views and reuse](../../standard/specification/03-views-and-reuse.md) separates data selection, notation, style, layout, display, publication, and export concerns. Explicit relationships remain authoritative; geometry does not create relationships. The focused checks confirmed that comments and a font-size change leave semantic JSON unchanged for the tested example.

### Honest boundaries around validation and disclosure

[Status and scope](../../standard/specification/00-status-and-scope.md) distinguishes reader, validator, renderer, publisher, and deployment assurance responsibilities. Passing logical checks is not a claim of production correctness or certification.

The view specification explicitly separates presentation hiding from public redaction. [The authorized-export example](../../website/examples/basics/14-authorized-export.ddn) demonstrates an allowlisted public projection. This is a useful design boundary; its existence is not evidence of an exhaustive security audit.

### Explicit limits and disciplined deferral

The root README documents bounded rendering and workspace budgets rather than promising unlimited diagrams. [DDN-GAPS.md](../../DDN-GAPS.md) explains why parameterized fragments are deferred: identifier substitution, source-span editing, and identity predictability need a defined contract and equivalence tests. Keeping that deferral is sensible until a concrete workflow requires it.

## Findings and concerns

| ID | Finding or concern | Evidence and qualification | Suggested response |
| --- | --- | --- | --- |
| R1 | Domain breadth creates a substantial maintenance burden. | The package exposes many diagram families and corresponding test suites. Breadth is observed; an inability to maintain it has not been demonstrated. | Prioritize complete architecture, database, and process/sequence workflows before adding families. Confirm priorities with the owner. |
| R2 | Dense handwritten runtime code makes review and modification harder. | Samples in `notation/runtime/ddn-core.js` and `ddn-layout.js` pack substantial parsing and routing logic into single lines. This is a maintainability judgment, not an identified functional failure. | Improve formatting and responsibility boundaries incrementally, preserving semantics and deterministic output with existing regression gates. |
| R3 | The standard index has demonstrable documentation drift. | `standard/README.md` lists chapters 00–26, but the specification includes chapter 48. It lists 90 relationship verbs; the inspected `standard/registry/catalogue.json` contains 91. Its 152-kind and 118-facet counts match that base catalogue. | Generate inventories from authoritative sources where practical and check documentation references in CI. Do not confuse base-catalogue counts with expanded runtime/profile counts. |
| R4 | Current product status is difficult to extract from accumulated history. | `designer/README.md` correctly says the prototype is retired and the unified tool's design mode ships, but retains extensive prototype history and proposed contracts. | Provide one concise implemented/proposed/retired capability map, with historical detail linked separately. |
| R5 | Suitability for large projects needs workflow evidence beyond per-view rendering. | Documented live-view limits are 128 elements and 384 relations; composed dashboards allow 12 child views at one child level. These can support decomposition, but this review did not measure navigation or editing across a large workspace. | Test discovery, cross-view identity, rename/refactor behavior, diagnostics, regeneration, and reviewable diffs using a real subsystem. Do not simply raise rendering limits. |
| R6 | Version and authority layers impose an onboarding cost. | Package version 0.7.0 coexists with accepted source versions 0.2–0.5, separately versioned registry/profiles, normative specifications, proposals, and older path references. Separate versioning is legitimate. | Add a short compatibility/authority guide and a single recommended starting workflow. |
| R7 | Broad profile coverage should remain distinct from standards conformance. | The reviewed scope and alignment documents already make bounded claims. This review did not independently compare implementation with external standards. | Preserve those qualifications in product copy and reports; associate each claimed capability with explicit supported semantics and evidence. |

## Verification performed

A small in-memory DDN 0.5 model was compiled with the current source runtime and base registry. Six assertions passed:

1. Two declared table objects resolve as two elements.
2. One declared reference resolves as one relationship.
3. Adding a comment preserves semantic JSON.
4. Changing view font size preserves semantic JSON.
5. An unresolved relationship endpoint is rejected with `DDN031`.
6. An unknown object kind is rejected with `DDN050`.

These checks did not establish full suite health, rendering determinism, source-edit round trips, export security, or UI quality. Existing test code was inspected, but existing reports were not treated as a fresh run.

## Proposed next evidence-gathering step

Subject to the owner's forthcoming details, use one ScratchBird subsystem as a pilot with a component view, a database view, and a request sequence sharing model identities where appropriate. Exercise realistic changes: rename an element, change a relationship, update an interface, regenerate affected views, and inspect source and output diffs.

Success should mean the model remains authoritative, views stay consistent, diagnostics point to actionable source locations, edits preserve unrelated authoring content, and navigation remains usable. Include a public export if disclosure is part of the intended workflow. Select actual acceptance criteria after the owner supplies the next section of work.

## Questions to resolve in the next section

- Who is the primary author: a source editor, visual editor user, agent, or a combination?
- Is the immediate deliverable documentation, an embedded diagram component, an editor, or a proposed standard?
- Which diagram families and cross-view workflows are essential first?
- What real model size, publication formats, collaboration patterns, and compatibility commitments must be supported?
- Which existing local changes belong to ongoing work and should form the next implementation baseline?

These are planning prompts, not blockers or a request to implement changes now.
