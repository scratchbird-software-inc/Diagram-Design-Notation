# 54. Text fit: modes, two-pass re-layout and font pinning (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter's language constructs; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: draft for the 0.8 standard revision (source version `ddn "0.6";`).
This chapter supersedes no 0.5 rule: elements that declare no text-fit mode
behave exactly as in 0.7 (fixed-size boxes, `size: content` measurement).
The chapter defines how boxes adapt to their text, what happens when they
cannot, and how font metrics are pinned so the result is reproducible.

## 54.1 Text-fit modes (T1)

`text_fit` is a property of an element declaration, and of a profile or
format bundle as a default:

```ddn-0.8
object summary "Quarterly summary" {
  kind: note;
  text_fit: wrap;
  max_width: 320px;
}
object badge "OK" {
  kind: note;
  text_fit: grow;
  max_width: 240px;
  max_height: 120px;
}
object tight "A rather long legend label" {
  kind: term;
  text_fit: shrink;
  min_font: 9px;
}
```

(0.8 syntax — requires `ddn "0.6";`: `text_fit`, `max_width`, `max_height`, `min_font`.)

| Mode | Behavior |
|---|---|
| `wrap` (default when a width constraint exists) | Width fixed at declared/measured width; text wraps; the box **grows downward** to fit. |
| `grow` | Box expands with content in both axes until `max_width` is hit, then wraps; growth stops at `max_height`. |
| `shrink` | Font steps down in fixed decrements (1 px per step) from the base size to the declared `min_font` floor; first size that fits wins. |

- `max_width` / `max_height`: 40–4000 px. Bounds over the drawing extent
  budget (50,000 px, chapter 16) are `DDN-TF02`.
- `min_font`: 6–64 px, must be ≤ the effective base font (`DDN-TF03`).
- `shrink` with no `min_font` uses the absolute floor 8 px. `shrink` never
  falls below the floor: residual overflow is diagnosed (§54.3), never
  silently clipped.
- Precedence: element > profile/bundle default > mode inferred from width
  constraint > legacy fixed box. A bundle `text_fit` applies only to elements
  that declare no mode.
- Changing `text_fit` changes geometry, not semantics: `modelFingerprint`,
  endpoints and relation identities are unchanged. Pins (`place`) freeze the
  box origin; growth extends away from the pinned corner per the element's
  anchor rules.

## 54.2 Two-pass measure → resize → re-layout (T3)

The render pipeline gains a bounded adaptation loop:

1. **Measure** all text with the active metric source (§54.4).
2. **Resize** boxes per their mode and bounds (§54.1).
3. **Re-layout**: placement, port reservation and routing re-run with the new
   boxes, exactly as if the author had declared the new sizes.
4. If any box changed size in step 3's re-measure (e.g. a wrap decision
   shifted by a scaled gap), run **one** more pass — measure, resize,
   re-layout.
5. Stop. The pipeline runs **at most two passes**; it is not a fixpoint
   solver. Any text still overflowing its box after pass two is a residual
   overflow and is diagnosed (§54.3). Under `layout { quality: warn; }` the
   render proceeds with the box at its bounded size and the text clipped at
   the box edge with a visible ellipsis marker, never with invisible text;
   under the default `quality: error` the render is refused with the
   `DDN-LW07`/`DDN-LW08` error instead.

Two passes are sufficient for every convergent case in the reference corpus;
the cap exists so pathological oscillation (grow → route detour → shrink)
terminates deterministically. `scene.layout.textFit` records passes run,
resized element ids, and per-pass size deltas.

## 54.3 Overflow diagnostics (T2)

Residual overflow is reported at **render time** (the two-pass pipeline of
§54.2 runs inside the render phase; `check` alone never raises these codes):

- `DDN-LW07` (warning): text exceeds its box after both passes in `wrap` or
  `grow` mode; message names the element, the overflow in px, and the
  bounding property, e.g. "element `summary` overflows by 18px vertically —
  raise `max_height` (currently 120px) or shorten the label."
- `DDN-LW08` (warning): `shrink` hit `min_font` and still overflows; message
  names the floor and the smallest fitting size if one exists above the
  absolute floor.
- Severity follows `layout { quality: … }` (chapter 05): under the default
  `quality: error`, `DDN-LW07`/`DDN-LW08` are raised as errors and the render
  is refused — no SVG is produced and no ellipsis marker is painted. Only
  under `quality: warn` do they downgrade to warning diagnostics; that is
  also the only configuration in which the clipped-text ellipsis marker of
  §54.2 appears.

## 54.4 Font and metric pinning (T4)

Byte-stable rendering requires a pinned metric environment. 0.8 formalizes
the 0.5 measurement cache (chapter 06) as a *font pin*:

```ddn-0.8
format shared {
  style pinned { font: sans; font_pin: "metrics-2026-09.json"; }
}
```

(0.8 syntax — requires `ddn "0.6";`: `font_pin` on a style.)

- `font_pin` names a metrics file resolved by the same path rules as
  backgrounds (chapter 53 §53.3: relative to the declaring `.ddn`, inside
  the workspace, no absolute paths or URLs — `DDN-PB05` family applies).
- The pin file records, per font stack: family names, per-run widths for the
  corpus of measured strings, the measurement engine and version, and a
  SHA-256 of the producing font files. It is evidence for those runs, not
  proof another machine has the fonts (chapter 06, unchanged).
- With a pin active, **all** text measurement uses pinned values; unknown
  runs are `DDN-TF04` (error under `metrics: required`; the conservative
  grapheme estimate plus `DDN-TW01` otherwise). A pin whose recorded engine
  differs from the renderer's is `DDN-TF05` (warning; pin ignored).
- `font_pin` plus `metrics: required` is the reproducibility configuration:
  same source + same pin + same renderer ⇒ byte-identical SVG on any
  platform (chapter 51 §51.5). Conformance vectors (chapter 58) are authored
  under this configuration, or fall back to geometry-only hashes.

## 54.5 `size: content` as the documented default path (T5)

`size: content` remains the recommended default publication for authored
diagrams and is the skeleton default for new designer documents (chapter 57
§D2). The CLI render flag `--content-size` forces `size: content` for one
render without editing source — an override on the existing render-override
channel, never a source rewrite. Interaction with text fit: `size: content`
artboards grow with the final post-fit bounds (§54.2), so `wrap`/`grow`
results are always fully visible; print-size lint (chapter 53 §53.5) does not
fire on content-sized output.

## 54.6 Title wrapping norm (0.8 amendment)

> **0.8 draft amendment:** codifies and completes the title rule. Sources do
> not change; no new key is introduced. Plain card silhouettes already wrap
> (so most renders are byte-identical); the silhouette edge cases listed
> below change geometry and are re-recorded per case with justification.

**The element's title wraps based upon the size of the element it names.**
The title text measures against the element's laid-out width and wraps onto
as many lines as needed, breaking unbroken words by grapheme when a single
word exceeds the width; the element's **height grows** to hold the result.
The width never grows from title text. Formally:

1. Title measurement consumes the resolved text properties (chapter 04 §6A)
   exactly as today, and wrapping recomputes at the effective width after
   `text_fit` sizing (§54.1) and `content_scale` composition — order is:
   resolve width → wrap title (and fields) → grow height → apply `text_fit`
   bounds → diagnose residual overflow per §54.3.
2. The rule holds uniformly across silhouettes: plain cards (already
   wrapping, unchanged), profile silhouettes that proportion-wrap (compact
   shapes, unchanged), and the previously growing edge cases — circles
   (whose width followed height), small markers with the name painted below
   (pseudostates, initial/final, flow finals), and any path that measured
   the name into the width. These now wrap the name to at most the greater
   of the silhouette's registered minimum width and any authored
   `max_width`, growing height (or the below-glyph caption stack) instead.
3. A title that still cannot fit after the §54.2 loop is a residual
   overflow — diagnosed (§54.3), never silently clipped.

## 54.7 Field text: no-wrap default with visible clip (0.8 amendment)

> **0.8 draft amendment — behavior default change.** Until this amendment,
> field row text wrapped by default. The default is now **no-wrap with a
> visible clip**, with a per-field (and per-element default) opt-in to wrap.
> `text_wrap` is a 0.8 (0.6-dialect) property — below `ddn "0.6";` it is
> `DDN-V04`; sources declaring no `text_wrap` keep the new default
> (this is the deliberate default change — see the impact note below).

- `text_wrap: on | off` — field property (per field) and element property
  (per-element field default; per-key precedence field > element > off).
  `DDN-FL01` for any other value.
- **No-wrap (default):** a field row whose text exceeds the field box is
  **visibly clipped** at the box edge with an ellipsis marker — the §54.3
  residual-overflow convention: never invisible text, always a visible
  truncation signal. The full text remains in the model, in exports, and in
  the accessible label (`<title>` / `aria-label`). Height does not grow;
  one-line rows stay one line.
- **Wrap (`on`):** the legacy behavior — the field text wraps at the field
  box width and the row grows.
- The clip is a *rendering* behavior. Horizontal scrolling to either end of
  the full text while **editing** is a *designer* behavior (non-normative
  tool surface, chapter 57): the field editor accepts and scrolls the full
  text regardless of the painted clip; the clip never loses or rejects
  input.
- Detail lines under fields (domain/type rows, chapter 04) follow the same
  rule with the same key.
- Column cells under the §6D column model use the column's own rule
  (single-line clip per cell; columns do not wrap).

**Impact note (for the owner, per directive):** measured against the
0.8 vector corpus and the 277-figure patent-drafts corpus: core vectors —
0 figures with wrapped field rows (no change); patent corpus — **72 of
277 figures** contain at least one node with a currently-wrapped field row
and will change geometry under the new default (rows become one-line
clipped rows with ellipsis). Titles are unaffected in those figures
(they already wrap — 266/277 have wrapped titles that keep identical
geometry). Per-case re-recording justification lives with the vectors.

## 54.8 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-TF01` | error | Unknown `text_fit` mode; message lists `wrap\|grow\|shrink`. |
| `DDN-TF02` | error | `max_width`/`max_height` outside 40–4000 px or beyond the extent budget. |
| `DDN-TF03` | error | `min_font` out of range or above the effective base font. |
| `DDN-TF04` | error | Text run missing from an active `font_pin` under `metrics: required`. |
| `DDN-TF05` | warning | Pin/engine mismatch; pinned metrics ignored for this render. |
| `DDN-LW07` | warning | Residual text overflow after two passes (wrap/grow); message names the remedy. |
| `DDN-LW08` | warning | `shrink` reached `min_font` and still overflows. |
| `DDN-FL01` | error | `text_wrap` is not `on` or `off` (§54.7). |

`DDN-LW07/08` continue the existing layout-warning family (`DDN-LW01`–`LW06`).
