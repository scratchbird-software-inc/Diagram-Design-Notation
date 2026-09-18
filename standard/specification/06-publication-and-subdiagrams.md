# DDN 0.3 — Publication, typography and linked diagrams

A publication specifies `size:figure|content|a4|letter`, optional width/height, paper orientation, margins, `fit:contain|none|reflow`, minimum text size, optional final `embedding_scale`, overflow policy and metric requirements. Unsupported pagination is rejected rather than emitting an incomplete first page.

## Actual behavior

`content` allocates a natural-size SVG artboard for drawing and legend. `figure` uses specified dimensions. A4/Letter use physical dimensions converted to CSS pixels; landscape swaps axes. `none` retains 1:1 drawing scale and fails on overflow when requested. `contain` uniformly fits, then checks the final minimum. `reflow` adjusts automatic grid columns for available width before routing and fitting; it is not an arbitrary-layout pagination engine.

Text-size checks include small field/legend/footer runs and an explicit embedding multiplier. Inline child text is checked again at its effective parent scale; an undersized child fails or warns under the selected policy. The parent cannot silently compress a readable child into illegible text and claim the original minimum.

## Measurement provenance

Font size is supported from 8–64px. The selected base scales cards, field rows, spacing and typography; it does not change data semantics. Browser rendering uses canvas measurement for the locally resolved font. Node rendering can use a pinned numeric measurement cache produced from installed fonts; no font files are distributed. Unknown runs use a conservative grapheme-based estimate and DDN-TW01. `metrics:required` rejects estimated metrics.

The supplied cache records font names/hashes, measurement engine and numeric run metrics. It is evidence for those runs/environment, not proof that an unrelated machine has the same fonts or glyph coverage. Unicode shaping/accessibility still require a deployment browser/font matrix. SVG remains text plus vector geometry, not an embedded font payload.

## Text, icons and looks

The look controls drawing execution, not semantic vocabulary. Classic is precise; handDrawn uses seeded rough geometry; neo uses clean accents/shadows. All retain stable port and marker semantics. Icons, arrowheads and cardinalities remain precise enough to interpret. Standard text and glyphs are fixed by the registry. Editorial font selection does not redefine the notation.

## References and inline views

Reference symbols target named view IDs. A static Markdown image cannot be assumed to expose clickable internal SVG links; a publisher should provide an ordinary adjacent link. Print references use stable figure names rather than source-authored page numbers. Inline views namespace SVG IDs, preserve child meaning and check their allocated size. Infinite inline recursion is rejected.

## Data protection

A public render first computes the explicit allowlist projection. The same projection is used by JSON export. Private source references, free-text metadata, unapproved fields, sample values, routes and nested embedded views are removed by that profile. Allowlisted names remain visible by design. A compiler does not discover sensitive content automatically or grant authorization; review the allowlists. The full source editor belongs in an authorized workspace.
