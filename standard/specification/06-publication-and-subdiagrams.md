# DDN 0.3 — Publication, typography and linked diagrams

A publication specifies `size:figure|content|a4|letter`, optional width/height, paper orientation, margins, `fit:contain|none|reflow`, minimum text size, an optional pre-fit `content_scale`, optional final `embedding_scale`, overflow policy and metric requirements. Unsupported pagination is rejected rather than emitting an incomplete first page.

> **0.8 draft amendment:** chapter 53 extends `publication` with header/footer records and variables, a page-level border, backgrounds with workspace-relative path rules, multi-view publication sets and print-size lint; chapter 54 extends measurement with text-fit modes and font pins; chapter 04 §6A adds portable text properties (weight/italic/strike/small-caps/colour) on style, elements and chrome runs. All additions are page furniture gated on source version `ddn "0.6";`; publications declaring no 0.8 property render as specified here, byte-identically. This chapter additionally gains `content_scale` (below) — a drawing-scale key, not page furniture.

## Actual behavior

`content` allocates a natural-size SVG artboard for drawing and legend. `figure` uses specified dimensions. A4/Letter use physical dimensions converted to CSS pixels; landscape swaps axes. `none` retains 1:1 drawing scale and fails on overflow when requested. `contain` uniformly fits, then checks the final minimum. `reflow` adjusts automatic grid columns for available width before routing and fitting; it is not an arbitrary-layout pagination engine.

Text-size checks include small field/legend/footer runs and an explicit embedding multiplier. Inline child text is checked again at its effective parent scale; an undersized child fails or warns under the selected policy. The parent cannot silently compress a readable child into illegible text and claim the original minimum.

## Content scale (0.8 amendment)

`publication` gains an optional `content_scale` key: a plain ratio (not a length) in `[0.25, 4]`, default `1`; anything else is `DDN046` at build time, with renderer backstops `DDN070` (graph) and `DDN-PJ063` (data/geo projections). It grows or shrinks the **laid-out drawing** — element geometry and every font role together, uniformly — *before* the fit calculation, answering the "tighten a sparse diagram / enlarge a dense one" need that page size and `embedding_scale` do not address.

Normative interaction rules:

1. Placement and routing are unaffected: they work in unscaled world space. `content_scale` applies at the same point contain scaling does — the page-composition transform — so it never changes layout, routing, or the `modelFingerprint`.
2. `fit: contain` computes its factor against the scaled drawing (`scale = min(1, availW/(W·cs), availH/(H·cs)) · cs`), so a drawing enlarged past the page is contained exactly as a naturally larger drawing would be. The DDN071 minimum-text check operates on the final scale (contain factor × `content_scale`); its remedy arithmetic names the implied base font accordingly.
3. `fit: none` renders at exactly `content_scale`; DDN074 overflow rules apply to the **scaled** drawing size.
4. `size: content` wraps the scaled drawing (the artboard grows/shrinks with it).
5. `embedding_scale` stays declaration-only: it never alters geometry or fonts and composes multiplicatively only in the lint/enforcement math (DDN071, DDN-PS01/PS02). Its range is unified across all renderers at `0 < embedding_scale ≤ 4` (`DDN070` graph; `DDN-PJ062` projections/geo — the former 100 ceiling in the projection renderers was undocumented and is withdrawn).

The graph renderer's scene records the final page scale (contain × `content_scale`) as `scene.scale`; `scene.drawingBounds` stays in unscaled world units. Print-size lint (chapter 53 §53.5) reads `scene.scale`, so its effective-size math composes `content_scale` automatically.

## Measurement provenance

Font size is supported from 8–64px. The selected base scales cards, field rows, spacing and typography; it does not change data semantics. Browser rendering uses canvas measurement for the locally resolved font. Node rendering can use a pinned numeric measurement cache produced from installed fonts; no font files are distributed. Unknown runs use a conservative grapheme-based estimate and DDN-TW01. `metrics:required` rejects estimated metrics.

The supplied cache records font names/hashes, measurement engine and numeric run metrics. It is evidence for those runs/environment, not proof that an unrelated machine has the same fonts or glyph coverage. Unicode shaping/accessibility still require a deployment browser/font matrix. SVG remains text plus vector geometry, not an embedded font payload.

## Text, icons and looks

The look controls drawing execution, not semantic vocabulary. Classic is precise; handDrawn uses seeded rough geometry; neo uses clean accents/shadows. All retain stable port and marker semantics. Icons, arrowheads and cardinalities remain precise enough to interpret. Standard text and glyphs are fixed by the registry. Editorial font selection does not redefine the notation.

## References and inline views

Reference symbols target named view IDs. A static Markdown image cannot be assumed to expose clickable internal SVG links; a publisher should provide an ordinary adjacent link. Print references use stable figure names rather than source-authored page numbers. Inline views namespace SVG IDs, preserve child meaning and check their allocated size. Infinite inline recursion is rejected.

## Data protection

A public render first computes the explicit allowlist projection. The same projection is used by JSON export. Private source references, free-text metadata, unapproved fields, sample values, routes and nested embedded views are removed by that profile. Allowlisted names remain visible by design. A compiler does not discover sensitive content automatically or grant authorization; review the allowlists. The full source editor belongs in an authorized workspace.

The redacted allowlist profile also offers a `sql` export format (`export { mode: redacted; format: sql; … }`). It emits `CREATE TABLE` DDL for allowlisted `kind: table` objects: allowlisted fields become `TEXT` columns in declaration order (v1 claims no datatype mapping), a `PRIMARY KEY` line is emitted only when the author allowlisted the `key` property, and a `FOREIGN KEY … REFERENCES` line is emitted only for `kind: ref` relations whose `enforcement` is exactly `database` and whose field-level endpoints are both allowlisted. Everything else in the allowlist is reported with a `-- skipped: <id> (<reason>)` comment; relations touching non-allowlisted records stay invisible. Table/column identifiers are snake_case-normalized names; collisions after normalization fail with `DDN-PJ092`, and an allowlist containing no table objects fails with `DDN-PJ088`. SQL is emitted only through `DDNExport.serialize` under the same allowlist gate as JSON — there is no direct dump API. The output is synthetic illustrative DDL, not a deployable schema.
