# DDN/DDNA 0.9 roadmap — candidate notation extensions

Status: candidate list, owner-approved for tracking. Nothing here is committed
for 0.9 scope until individually ratified. Items dispositioned "0.9" in the
closure audit (kimi-specification-workarea/ddn-opensource-closure-2026-10-05/02)
are marked [closure]; items from the 2026-10-06 designer sessions are marked
[designer].

## Scope rule — specification vs. reference-tool behavior

The DDN/DDNA specification covers only what is **portable**: what a .ddn file
can declare and how every conformant consumer must interpret it. Anyone may
write their own viewer, renderer, or generator; the conformance contract they
must satisfy is the grammar, the registry, and the chapter-58 vector corpus —
nothing more.

ddn-viewer and ddn-designer are reference implementations. Their UI behavior —
drawers, hover highlights, font/colour editors, colour history, session-preview
overrides, interaction gestures — is **not** specification and carries no
conformance weight. Session-preview cosmetics in particular are deliberately
non-portable: they are never serialized into .ddn source, and a third-party
tool owes them nothing.

Consequences for this roadmap:
- Items under "Portable …" sections below are **spec candidates**: if ratified,
  they enter the grammar/registry and every conformant consumer must honor them.
- Items marked "(designer)" in the closure-deferral list are **reference-tool
  work**: they may ship in ddn-designer without any spec change, and other
  tools may solve the same problem differently or not at all.
- Nothing about the reference tools' behavior may leak into the spec as a
  requirement (same guardrail as OWN-079/081 on the Weaver side).

## Portable text properties [designer]

Extend the notation so richer text styling survives in the .ddn file and
renders identically in every consumer (ddn-viewer, ddn-designer, Weaver).

- [x] Font weight per target (`bold` / numeric weight) beyond the fixed
      role-assigned weights — at minimum on element labels and header/footer runs
      (implemented 0.8.x amendment, spec ch. 04 §6A)
- [x] Italic (and bold-italic combination) as a first-class property
      (implemented 0.8.x amendment, spec ch. 04 §6A)
- [x] Strike-through text decoration
      (implemented 0.8.x amendment, spec ch. 04 §6A; `underline` reserved)
- [x] Small-caps font variant
      (implemented 0.8.x amendment, spec ch. 04 §6A)
- [x] Text colour as a portable property (currently session-preview CSS only)
      (implemented 0.8.x amendment as `color`, spec ch. 04 §6A)
- [x] Per-element font override (family/size/specials on one element, not only
      per-kind or view-wide) — implemented for decoration specials on the
      element label (0.8.x amendment, spec ch. 04 §6A); family and size stay
      role-based by design, per-kind stays tool-side session preview
- [x] Header/footer run decoration classes (runs currently bake weights per slot
      and are not individually addressable) — `ddn-run ddn-run-left|center|right`
      plus flat run text keys (implemented 0.8.x amendment, spec ch. 53 §53.1)
- [x] Decision: extend `style {}` with a `text {}` sub-grammar vs. per-property
      keys on elements/runs — one design, not piecemeal keys → **one vocabulary,
      three contexts**: `text { }` group on style and element declarations, the
      same five keys flat on run records (a run record is itself a text target)

Constraint: the renderer's `text()` painter currently accepts size/fill/numeric
-weight only, and measurement must consume the same properties (determinism,
OWN-080). Every addition needs measure-path support, not just paint support.

## Portable stroke / line properties [designer]

A coherent `stroke`/`line` property family on relations and element outlines.

- [x] Relation line: dash pattern, stroke weight, stroke colour (portable;
      colour is session-preview today) — `line { color, weight, dash }`
      (implemented 0.8.x amendment, spec ch. 04 §6B)
- [x] Element outline: stroke colour, weight, dash, corner treatment —
      `stroke { color, weight, dash, corners }` (implemented 0.8.x amendment;
      corners accepts only `round`, square reserved with DDN-LN05 because
      silhouette corner geometry is baked per kind)
- [x] Element fill colour portable (currently per-kind session preview) —
      flat `fill: color` on elements (implemented 0.8.x amendment)
- [x] Arrow/endpoint heads beyond registered marks (size, open/filled) — check
      against existing source_mark/target_mark grammar first → **decision:
      registered marks unchanged.** The mark grammar is a closed semantic
      keyword set (DDN114 contract); a size/open qualifier does not fit the
      bare-keyword (or compact bracket) form cleanly. Instead, endpoint heads
      now share the `line { }` pen — head stroke follows the line's colour
      and weight — which covers the "reads as one pen" demand without
      touching the semantic mark vocabulary.
- [x] Decide the serialization: `line {}` group on relations + `stroke`/`fill`
      keys on elements, aligned with the text-properties decision above →
      **one vocabulary, two contexts**: `line { }` on relations,
      `stroke { }` + flat `fill` on elements; no view-wide layer (colours are
      semantic per spec ch. 04 §5)

## Portable sizing / layout properties [designer]

- [x] Element size constraints per element (max_width/max_height/text_fit/
      min_font exist view-wide in `style {}`; per-element override path) —
      already portable since 0.8 (spec ch. 54 §54.1 element-level keys);
      the per-key resolution element > view > engine default is now pinned by
      spec ch. 04 §6C and `notation/tests/sizing-properties.js` (implemented
      0.8.x amendment). Designer Sizing-editor element targeting remains
      reference-tool wiring, a separate follow-up.
- [x] Content opacity / background opacity (view background carries opacity;
      per-element does not) — per-element `opacity` 0–1 as one SVG group
      opacity, paint-only, DDN-SZ01 (implemented 0.8.x amendment, spec
      ch. 04 §6C)

## Deferred from the 0.8 closure audit [closure]

Standard-revision items dispositioned 0.9 — see the closure pack for full
rationale:

- [x] Parameterized model fragments (`fragment name(…)`) + nested `use:` —
      implemented 0.8.x amendment (spec ch. 01 parameterized reuse): token-
      level substitution, DDN-FG01–FG06, cycle/depth guards, IR-equivalence
      fixtures; DDN-GAPS deferral closed 2026-10-06
- [x] Diff views (`diff: [@viewA, @viewB]`) — implemented 0.8.x amendment
      (spec ch. 55 §55.6): local-id matching, added/removed/changed/unchanged
      marking-convention paint + diff key, DDN-DF01–DF04, ch.58 vectors
      (diff-basic, reject-ddn-df03); DDN-GAPS deferral closed 2026-10-06.
      Designer diff UI remains reference-tool follow-up.
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
