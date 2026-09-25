# 25. Diagram field guide and executable documentation

**Documentation edition: field-guide.1. Runtime: DDN 0.7.0.**

The field guide is the user-oriented counterpart to the language specification. A notation registry is not a tutorial, and a list of rendered files is not a diagram-type catalogue.

## Required chapter contract

Every supported diagram/use-case chapter supplies: a stable chapter ID; the diagram's purpose; why and when it is useful; required input information; a reading walkthrough; one real source workspace and selected view; a tested editable exercise; an authoring walkthrough; explicit profile and projection identity; scope and common mistakes; and background references where applicable.

The live diagram MUST use the same public `DDNLive` distribution as Studio. Changing an appearance control MUST re-render the source or alter viewport magnification as appropriate; it MUST NOT select a cached look-specific screenshot. A data exercise MUST edit the actual source and preserve contributing identities unless identity itself is intentionally edited.

Source files, format definitions and view references are shared. Each lesson loads its import closure; a paired view uses the union of both closures. A related view is not automatically a claim of semantic identity. The series, target and waterfall table comparisons in this edition use the actual records consumed by their charts.

## Inventory and support levels

The guide has 104 diagram/use-case chapters and 15 technique chapters. They cover all 24 installed profile versions and all nine projection families, plus the bounded interaction renderer. The full source index has 391 views. These counts describe this edition's curated coverage, not the number of all imaginable diagram types or an external-product parity score.

- **Native:** a directly implemented DDN capability within its declared limits.
- **Equivalent:** a constructive DDN teaching template for the same information; no external notation certification is implied.
- **Subset:** an explicitly bounded implementation of a wider diagram family.
- **Technique:** layout, routing, detail, palette or publication choices; not an additional diagram type.
- **Unsupported/limited appendix:** a gap and the closest honest alternative, not a fake supported diagram.

Chapter coverage is enumerated in `field-guide/catalogue.json`; profile/projection coverage is in `field-guide/coverage.json`. `field-guide/example-index.json` maps every current source view to a chapter or related family. The pre-existing Visual Paradigm comparison remains a dated historical assessment; this guide supplies current scope rather than rewriting its original evidence.

## Editing and file behavior

The reader can modify labels, fields, values, relationships and format/view declarations through the source pane. Unapplied drafts survive file changes. Applying invalid source retains the draft, marks the previous output as stale and disables current-SVG export. Guided edits use the public authoring/transaction API and can be undone. Navigation asks before discarding local changes.

The guide can open raw DDN files and source workspace ZIP/JSON. It can download the current raw DDN file, a complete dependency workspace ZIP, successful SVG, and decision/trace results. A single DDN file may not be self-contained: downloading a workspace preserves imports. Source workspaces are internal design material, not redacted publications.

The full Studio remains the richer environment for file renaming, creation/deletion, graphical pinning and workspace management. The field guide is an executable tutorial, not a second rendering implementation.

## Testing and regeneration

`npm run build:field-guide` creates the teaching templates, updates the shared source map, compiles chapter fixtures, tests source edits and byte-exact undo, and rebuilds the HTML/Markdown guide. `npm run test:field-guide` independently audits coverage and renders the complete catalogue. `npm run test:field-guide-browser` exercises real guide controls in an installed browser.

Each source exercise has before/after SVG hashes; examples keep source IDs and dependency paths. Warnings are preserved. The `Complete` purchasing connector remains subject to the original efficiency regression.

The website has a portable self-contained edition and per-chapter pages with readable static text. The portable edition has no external runtime/CSS/source/image requirement; its optional link to full Studio is not part of rendering. Only the active diagram and optional companion are mounted, rather than hundreds of hidden diagrams.

## Boundaries

A successful documentation fixture is not professional approval, a proof of globally optimal layout, deployed accounting/security behavior, or external standard conformance. Current browser/CSP/accessibility/font qualification and the prior production assurance gates remain separate. No confidential source should be delivered to a public viewer merely to hide it using presentation settings.
