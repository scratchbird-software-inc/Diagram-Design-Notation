# DDN/DDNA 0.9 roadmap — candidate notation extensions

Status: candidate list, owner-approved for tracking. Nothing here is committed
for 0.9 scope until individually ratified. Items dispositioned "0.9" in the
closure audit (kimi-specification-workarea/ddn-opensource-closure-2026-10-05/02)
are marked [closure]; items from the 2026-10-06 designer sessions are marked
[designer].

## Portable text properties [designer]

Extend the notation so richer text styling survives in the .ddn file and
renders identically in every consumer (ddn-viewer, ddn-designer, Weaver).

- [ ] Font weight per target (`bold` / numeric weight) beyond the fixed
      role-assigned weights — at minimum on element labels and header/footer runs
- [ ] Italic (and bold-italic combination) as a first-class property
- [ ] Strike-through text decoration
- [ ] Small-caps font variant
- [ ] Text colour as a portable property (currently session-preview CSS only)
- [ ] Per-element font override (family/size/specials on one element, not only
      per-kind or view-wide)
- [ ] Header/footer run decoration classes (runs currently bake weights per slot
      and are not individually addressable)
- [ ] Decision: extend `style {}` with a `text {}` sub-grammar vs. per-property
      keys on elements/runs — one design, not piecemeal keys

Constraint: the renderer's `text()` painter currently accepts size/fill/numeric
-weight only, and measurement must consume the same properties (determinism,
OWN-080). Every addition needs measure-path support, not just paint support.

## Portable stroke / line properties [designer]

A coherent `stroke`/`line` property family on relations and element outlines.

- [ ] Relation line: dash pattern, stroke weight, stroke colour (portable;
      colour is session-preview today)
- [ ] Element outline: stroke colour, weight, dash, corner treatment
- [ ] Element fill colour portable (currently per-kind session preview)
- [ ] Arrow/endpoint heads beyond registered marks (size, open/filled) — check
      against existing source_mark/target_mark grammar first
- [ ] Decide the serialization: `line {}` group on relations + `stroke`/`fill`
      keys on elements, aligned with the text-properties decision above

## Portable sizing / layout properties [designer]

- [ ] Element size constraints per element (max_width/max_height/text_fit/
      min_font exist view-wide in `style {}`; per-element override path)
- [ ] Content opacity / background opacity (view background carries opacity;
      per-element does not)

## Deferred from the 0.8 closure audit [closure]

Standard-revision items dispositioned 0.9 — see the closure pack for full
rationale:

- [ ] Parameterized model fragments (`fragment name(…)`) + nested `use:`
- [ ] Diff views (`diff: [@viewA, @viewB]`)
- [ ] Assertion evaluation (owner decision pending: 0.9 vs Weaver orchestration)
- [ ] Mermaid import (designer "Import…" command)
- [ ] Unicode identifiers (UAX #31 / UTS #39 profiles)
- [ ] Chen profile completions (pending owner: 0.9 vs close notation-only)
- [ ] Calendar/locale time semantics (pending owner)
- [ ] AUD-003 command set remainder (kind conversion, deep field
      reorder/reparent, multi-occurrence, typed scope membership) (pending owner)
- [ ] AUD-004 versioned occurrence contract (grammar RFC)
- [ ] Canvas multi-select gestures (designer)
- [ ] Attachment-policy editing + Reverse relation op (designer)
- [ ] Sheet residue: matrix row/col selectors + duplicate policy; chart.quality
      series/transform; decision input/output domain editing; timeline drag
- [ ] Descriptor fields: priority, batch applicability, destructive-change
      warning; continuous sliders; full impacted-scope preview
- [ ] Fixed-lane occurrence/payload export closure (ch. 11:33)
- [ ] Quantitative: multiple series, stacking (dashboards/responsive = Weaver)

## Explicitly NOT 0.9 (assigned elsewhere)

- PDF/PPTX export, storage, collaboration, undo/history/replay — Weaver
  (ch. 57 §57.6, OWN-079)
- DMN/decision evaluation — execution semantics, Weaver-side (display-only
  guardrail)
- Multi-sheet pagination/tiling, paged viewing — Weaver
