# 44. View chrome: legend, title and footer visibility

Status: implemented in runtime 0.6.0-beta.1 (B1-045). Source grammar remains
DDN 0.5; views that declare no chrome option render byte-identical SVG to
previous releases, and the use-cases manifest is unchanged.

Page chrome is presentation: the relationship key, the view title/header
block, and the footer line. None of it carries model facts — the same data
with the same semantics renders with or without it — so visibility is a
view-level option, not a renderer decision.

## Options (D2)

Three properties, available at three equivalent sites: as flat view-level
keywords, as properties of a `chrome` group inside a view, and as properties
of a named `chrome` declaration inside a `format` block (referenced directly
or through a `bundle`):

```
view embedded "Minimal chrome for embedding" {
    data: [@model];
    legend: off;          // auto | on | off   (default auto)
    title: off;           // on | off          (default on)
    footer: off;          // on | off          (default on)
}

format styles {
    chrome minimal { legend: off; title: off; footer: off; }
    bundle embed { chrome: @minimal; }
}
view card "Card" { data: [@model]; format: @styles.embed; }
view card2 "Card 2" { data: [@model]; chrome { legend: off; } }
```

- `legend: auto` applies the per-view-kind emission rule that predates this
  chapter (below). `on` pins today's emission explicitly, guarding the author
  against future heuristic changes; under the current rules `on` and `auto`
  emit identically for every view kind. `off` suppresses the legend and
  reclaims its reserved band.
- `title: off` suppresses the view title/header block (the
  `DDN / …` eyebrow line, the wrapped view title or `publication.title`
  override, the caption, and the look/theme tag) and its reserved band.
  `publication.title` / `publication.caption` keep their text-override
  meaning; this option only controls visibility (D2).
- `footer: off` suppresses the footer line (the
  `Same data · independent view …` / `One model · …` line and its page
  reservation).
- A flat `legend:` keyword whose value is one of the three chrome words is
  the chrome shorthand; a `legend: @reference` still names a legend profile.
  When a view uses the string shorthand, a bundle-level legend profile
  reference is not applied at that position (declare a `legend { … }` group
  for keys/mode alongside the shorthand).
- Numbered relationships need their key: `legend: off` with
  `legend { mode: numbers }` is the coded error `DDN047`, matching the
  existing `placement: none` rule.
- Invalid values are coded errors: `DDN-E018` for a flat keyword
  (`legend: sometimes`), `DDN046` for a `chrome` group/profile value outside
  the choice lists.

## Emission sites and the `auto` rule (D1 survey)

Every chrome emission site in the runtime is under option control:

- **Graph / chen views** (`ddn-render.js`): the `RELATIONSHIP KEY` block is
  emitted when `legend.placement` is not `none` and at least one relation is
  visible — independent of whether route labels already self-label the
  relations (that duplication is exactly what `legend: off` answers). The
  header block and the footer line were always emitted. `auto` = these rules.
- **Data-bound projections** (`ddn-projections.js`: chart, table, matrix,
  panels, timeline, fishbone, decision, sequence, timing): one shared page
  compositor emits the header (`DDN / 0.5 PROJECTION PREVIEW / …` plus the
  view title) and the footer (`One model · source-bound occurrences · …`).
  Relationship legends are already disabled for projected graph bodies.
- **Quality projections** (`ddn-quality-render.js`): the matrix encoding
  colour key (with the "Missing is not zero…" note) and the multi-series
  chart colour key (identity transform) are `legend`-governed chrome and are
  emitted whenever their data exists; `legend: off` suppresses them and their
  reserved rows.
- **Geographic views** (`ddn-geo.js`): the choropleth ramp key and the symbol
  size key are `legend`-governed; the page header/footer match the
  projection compositor. The in-drawing method caption
  ("Geographic projection: …") is content, not chrome, and stays.
- **Isometric views** (`ddn-iso.js`): the page header/footer match the
  projection compositor; isometric views emit no relationship legend.

The accessibility `<title>`/`<desc>` inside the SVG root are not chrome and
are always emitted; the `<desc>` sentence pointing at the adjacent legend is
dropped only when `legend: off` suppresses that legend.

## Tool overlay (D4)

The unified tool's appearance drawer carries a **Chrome** section — Legend,
Title block and Footer line selects with `As authored / on / off` — wired
through the same render-override channel as the detail and relation-label
controls (`setOptions` / workspace `overrides`). Override values are
validated (`LIVE002` for an unknown value), and `legend: off` against
numbered relationships is rejected with `LIVE021`, mirroring the source-level
`DDN047`. Overrides never rewrite the source; an exported SVG carries the
active presentation state per the existing override semantics.
