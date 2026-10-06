# 53. Publication chrome: header/footer, page border, backgrounds, figure sets (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter's language constructs; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: draft for the 0.8 standard revision (source version `ddn "0.6";`).
This chapter extends chapter 06 (publication) and chapter 44 (view chrome).
Everything here is **page furniture**: chrome MUST NOT change model
semantics, layout, routing, or the `modelFingerprint`. A publication that
declares no 0.8 chrome property renders byte-identically to 0.7. Chapter 44's
`legend`/`title`/`footer` visibility switches still govern whether the
emission sites exist at all; this chapter defines what authored content they
carry.

## 53.1 Header and footer records (P1)

A `publication` gains optional `header { … }` and `footer { … }` groups.
Each holds up to three *runs* — `left`, `center`, `right` — and each run is a
record:

```ddn-0.8
format shared {
  publication filing {
    size: letter;
    orientation: portrait;
    margin: 18mm;
    header {
      left   { text: "$title"; size: 9pt; }
      right  { text: "CONFIDENTIAL — $date"; size: 8pt; }
    }
    footer {
      left   { text: "$view_id"; size: 8pt; }
      center { text: "FIG. $figure"; size: 10pt; font: serif; }
      right  { text: "Page $page"; size: 8pt; }
    }
  }
}
```

(0.8 syntax — requires `ddn "0.6";`: `header`/`footer` groups in `publication`.)

Run properties: `text` (string, required), `align` (`left|center|right`,
defaulting to the run's slot), `font` (family keyword as in `style.font`),
`size` (4–24 pt), and `lines` (integer 1–4; multi-line runs split `text` on
`\n`). Missing slots emit nothing and reserve nothing.

> **0.8 draft amendment (chapter 04 §6A):** a run additionally accepts the
> portable text-property vocabulary as flat keys — `weight` (`bold` or
> 100–900), `italic`, `decoration: strike|none`, `variant: small-caps|normal`,
> `color: #rgb|#rrggbb` — validated with the same `DDN-TX01`–`DDN-TX06`
> codes. The run record is itself a text target, so these ride flat rather
> than in a nested group. They resolve against the slot's baked weight
> (center 600, sides 400); view-wide `style.text` and element `text { }`
> never restyle page furniture. Every run's text carries the addressable
> classes `ddn-run ddn-run-left|center|right`, so hosting CSS can target
> individual slots without positional selectors.

**Variables**, resolved at publication time, per emitted page:

| Variable | Value |
|---|---|
| `$title` | `publication.title` if set, else the view label, else the view id |
| `$page` | 1-based page index within the publication set (§53.4) |
| `$date` | publication date, ISO `YYYY-MM-DD`, in the renderer's local timezone |
| `$view_id` | the view's source identifier |
| `$figure` | the view's 1-based index in its publication set (§53.4); equals `$page` in a single-view publication |

Unknown `$name` is `DDN-PB02`; a literal dollar sign is written `$$`.
Variables resolve to plain text before measurement — no nesting, no
expressions. `$date` output is **exempt** from the byte-stability promise of
chapter 51 §51.5; conformance vectors (chapter 58) pin `$date` to a fixed
value via the render option `publicationDate`.

Header/footer text participates in the existing minimum-text checks of
chapter 06 (it is a "footer run" for DDN071 purposes). Chrome bands reserve
space outside the drawing area; they never overlap drawing or legend.

## 53.2 Page border (P2)

```ddn-0.8
publication framed {
  size: a4;
  border { style: single; weight: 1pt; inset: 6mm; corner_marks: true; }
}
```

(0.8 syntax — requires `ddn "0.6";`: `border` group in `publication`.)

- `style: single | double | dashed` (required when `border` is present).
- `weight`: 0.25–8 pt, default 1 pt. `double` draws two rules at 2.5×weight
  total thickness.
- `inset`: distance from the paper edge, default 0; the border sits inside
  `margin` arithmetic independently — it neither shrinks nor grows the
  drawing area.
- `corner_marks: true` adds registration/crop corner marks outside the
  border; default `false`.

This is a **page** frame, distinct from a model `frame` element (chapter 15):
it carries no semantics, contains no members, and is unaffected by
`frame_overflow`. Invalid style/weight values are `DDN-PB03`.

## 53.3 Backgrounds and path-resolution rules (P3)

```ddn-0.8
publication branded {
  size: content;
  background { color: "#f7f4ee"; }
}
publication watermarked {
  size: letter;
  background { image: "wm-draft.png"; opacity: 0.15; }
}
publication graphpaper {
  size: content;
  background { pattern: "grid.svg"; opacity: 0.4; }
}
```

(0.8 syntax — requires `ddn "0.6";`: `background` group in `publication`.)

Exactly one of `color`, `image`, `pattern` per background group
(`DDN-PB04` otherwise). `opacity` 0–1, default 1. A background paints the
whole page behind drawing and chrome; it never intercepts hit-testing and
never changes measured bounds.

**Path resolution and security (normative):**

1. A bare filename (`"wm-draft.png"`) resolves in the same directory as the
   `.ddn` file that declares it.
2. A relative path (`"art/wm.png"`, `"../shared/wm.png"`) resolves relative
   to the declaring `.ddn` file's directory, and MUST resolve inside the
   workspace root; an escape outside the workspace root is `DDN-PB05`.
3. **Absolute paths and URLs are forbidden** (`/…`, `C:\…`, `https://…`,
   `data:`): `DDN-PB05`. This keeps documents portable and keeps renderers
   from making network fetches, per chapter 08.
4. Image formats: PNG and WebP only (`DDN-PB06` otherwise). A missing or
   undecodable image is `DDN-PB07` (error under `overflow: error` policy;
   warning plus plain background otherwise).
5. Patterns: SVG only, sanitized with the same rules as icon/art packs
   (chapter 49/50: no script, no `foreignObject`, no event handlers, no
   external references — internal `url(#…)` fragment references allowed).
   A pattern failing sanitization is `DDN-PB08`, never a render.
6. A `background` on a `view` overrides the referenced publication's for that
   view only; view-level backgrounds follow the same rules.

Rasters embedded in exported SVG are base64 data URIs of the resolved file;
the exported document is self-contained and never references the original
path.

## 53.4 Multi-view publication sets (P4)

One `.ddn` file may publish several views as one ordered figure set with
shared chrome:

```ddn-0.8
publication_set figures "Patent figures" {
  publication: @shared.filing;
  figures: [@fig1, @fig2, @fig3];
}
```

(0.8 syntax — requires `ddn "0.6";`: `publication_set` top-level declaration.)

Grammar supplement:

```text
PublicationSet = "publication_set", identifier, [ string ], block ;
```

- `figures` is an ordered array of 1–64 view references declared in the same
  workspace (`DDN-PB09` for a missing or non-view reference; the array must
  be non-empty). Order is authorial and stable; `$figure`/`$page` are the
  1-based positions.
- The set's `publication` supplies shared chrome (header/footer/border/
  background) to every figure. A figure's own view may still override
  individual concerns; the set cannot reach into a view's model selection.
- Rendering a set emits one SVG per figure, named `<entry>--<view_id>.svg`,
  plus a manifest JSON (`{ set, figures: [{view_id, file, figure, page}] }`)
  in declaration order. Determinism per chapter 51 holds per figure.
- CLI: `node notation/cli/cli.js publish <entry.ddn> --set figures --outdir out/`.
  A view belonging to two sets is legal; each set numbers independently.

## 53.5 Print-size lint (P5)

A check-time diagnostic family catches output that would be illegible at the
declared physical size, without waiting for render overflow:

- `DDN-PS01` (warning): any text run whose *effective* size at 1:1 print
  scale — declared size × `embedding_scale` × any `fit: contain` factor
  computable before routing — falls below `publication.minimum_text` (default
  8 pt). Message names the smallest offender and the implied minimum base
  font, mirroring the DDN071 remedy idiom.
- `DDN-PS02` (warning): any relation line weight below 0.5 pt effective, or
  any border/weight below 0.25 pt.
- `DDN-PS03` (info): declared `size` is a physical paper size but no
  `minimum_text` is declared; the default is being relied on.
- `DDN-PS04` (error): lint requested under `--strict-print` and any PS
  warning fired — the gate mode for filing workflows.

Print-size lint runs under `check` only; it never blocks or alters rendering,
and it never fires for `size: content` publications (no physical target).

## 53.6 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-PB01` | error | Malformed `header`/`footer` run (missing `text`, bad `align`/`font`/`size`/`lines`). |
| `DDN-PB02` | error | Unknown `$variable` in a chrome text string. |
| `DDN-PB03` | error | Invalid `border` style/weight/inset. |
| `DDN-PB04` | error | `background` declares more than one of color/image/pattern. |
| `DDN-PB05` | error | Forbidden path: absolute path, URL, `data:` URI, or workspace-root escape. |
| `DDN-PB06` | error | Unsupported background image format (not PNG/WebP) or pattern (not SVG). |
| `DDN-PB07` | error/warning | Background image missing or undecodable (severity follows `overflow` policy). |
| `DDN-PB08` | error | Background SVG pattern failed sanitization; message names the rejected construct. |
| `DDN-PB09` | error | `publication_set` figure reference missing, not a view, or array empty/too large. |
| `DDN-PS01` | warning | Effective text size below `minimum_text` at declared print size. |
| `DDN-PS02` | warning | Effective line weight below print floor. |
| `DDN-PS03` | info | Physical paper size with default `minimum_text`. |
| `DDN-PS04` | error | Strict-print gate: PS warnings promoted to failure. |
