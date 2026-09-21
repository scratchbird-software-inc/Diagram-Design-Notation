# Styling rendered diagrams

B1-003 added stable CSS class hooks to every rendered diagram plus an
optional stylesheet, `notation/dist/ddn.css` (source:
`notation/studio/src/ddn.css`). The contract: **page CSS fills the gaps the
script left unset** — script-level presentation (format palette, look,
object/occurrence overrides) is emitted as inline SVG presentation attributes
and therefore always wins over page rules. No `!important` appears anywhere
in DDN output.

## Class hooks emitted by the renderer

Structural classes (present on every render):

| Class | On |
|---|---|
| `ddn-svg` | the root `<svg>` element |
| `ddn-node` | every object group (`<g>`), with `data-id="<element id>"` |
| `ddn-rel`, `ddn-relation` | every relation group |
| `ddn-label` | label text runs |
| `ddn-field` | field/compartment text runs |
| `ddn-mark` | quantitative chart marks (e.g. `ddn-mark-bar`) |
| `ddn-callout` | legend/callout furniture |

Semantic hooks (vary per diagram):

| Class pattern | Meaning |
|---|---|
| `ddn-view-<kind>` | projection kind of the view (`ddn-view-graph`, `ddn-view-chart`, …) |
| `ddn-profile-<profile-slug>` | resolved profile, e.g. `ddn-profile-ddn-1`, `ddn-profile-chart-basic-1` |
| `ddn-kind-<code>` | object kind code from the registry (`ddn-kind-tbl`, `ddn-kind-dom`, `ddn-kind-smp`, …) |
| `ddn-verb-<verb>` | relation verb (`ddn-verb-ref`, `ddn-verb-domain`, …) |
| `ddn-font-<hash>` | font-stack bucket used for the render |

The viewer (B1-007) builds its colour overrides on
`.ddn-kind-<code>`, `.ddn-verb-<verb>`, and `[data-ddn-id="<element id>"]`
attribute selectors.

## Per-kind typography CSS

B1-011 added per-kind font overrides in the viewer, emitted as viewer-page
rules of the form:

```css
.ddn-svg .ddn-kind-tbl text { font-family: "DejaVu Sans Mono", monospace; font-size: 20px; }
```

The family is always one of the four runtime stacks (`sans`, `serif`,
`mono`, `handwriting`) and the size 8–24 px. Unlike the global font-size
dropdown (which re-renders through the override channel and reflows the
layout), these rules are a stylesheet overlay: text is restyled in place and
long labels can overflow their shapes. To do the same in your own page,
target `.ddn-kind-<code> text` the same way.

## `ddn.css` custom properties

```css
:root {
  --ddn-font: "DejaVu Sans", Arial, sans-serif;
  --ddn-ink: #203047;
  --ddn-node-fill: #ffffff;
  --ddn-node-stroke: #285ea8;
  --ddn-label-color: var(--ddn-ink);
  --ddn-field-color: var(--ddn-ink);
  --ddn-rel-stroke: #285ea8;
  --ddn-mark-fill: #337db7;
}
```

The stylesheet maps them onto the structural classes:

```css
.ddn-svg   { font-family: var(--ddn-font); }
.ddn-node  { fill: var(--ddn-node-fill); stroke: var(--ddn-node-stroke); }
.ddn-rel   { stroke: var(--ddn-rel-stroke); }
.ddn-label { fill: var(--ddn-label-color); }
.ddn-field { fill: var(--ddn-field-color); }
.ddn-mark  { fill: var(--ddn-mark-fill); }
```

Include `ddn.css` on a page that embeds rendered SVG, then override the
properties — dark page chrome, brand palette — without touching the diagram
source:

```css
:root { --ddn-node-fill: #101820; --ddn-node-stroke: #6ab0ff; --ddn-ink: #dfe7f0; }
```

## Cascade rules, precisely

1. Script-level presentation (the view's format bundle, look/palette
   resolution, per-object overrides) is written as inline SVG presentation
   attributes. It always wins.
2. Your page rules (including `ddn.css`) only paint where the script left a
   property unset; classed groups inherit into descendants without inline
   attributes.
3. Specificity works normally within tier 2: `.ddn-kind-tbl` beats
   `.ddn-node`; `[data-ddn-id="model.order"]` beats both.

A runnable example ships in `website/examples/basics/58-css-hooks.ddn` +
`58-css-hooks.html`, and the class contract is pinned by
`notation/tests/css-classes.js`.
