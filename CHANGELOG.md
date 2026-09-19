# Changelog

All notable changes to the Data Design Notation project are documented here.
Component-level history predating the monorepo import lives in
`notation/CHANGELOG.md` and `examples/use-cases/CHANGELOG.md`.

## [Unreleased]

- C4-style profile set (`c4.context@1`, `c4.container@1`, `c4.component@1`) with
  six profile kinds, the `c4.rel` verb, boundary frames, and
  `DDN-PJ100`/`DDN-PJ101` validation.

- Sankey diagrams via new profile `chart.sankey@1` (mark `sankey`, reusing the
  chart `target` property as a binding), with `DDN-PJ079`/`DDN-PJ108`
  validation.

- Treemaps via new profile `chart.treemap@1` (mark `treemap`), with
  `DDN-PJ078` validation.

- Candlestick/OHLC charts via new profile `chart.candlestick@1` (mark
  `candlestick`, new chart properties `open`/`high`/`low`/`close`), with
  `DDN-PJ076`/`DDN-PJ077` validation.

- Gauge/KPI dials via new profile `chart.gauge@1` (mark `gauge`), with
  `DDN-PJ074`/`DDN-PJ075` validation.

- Funnel charts via new profile `chart.funnel@1` (mark `funnel`), with
  `DDN-PJ073`/`DDN-PJ107` validation.

- Radar/spider charts via new profile `chart.radar@1` (mark `radar`), with
  `DDN-PJ071`/`DDN-PJ072` validation.

- Chrome/file:// fix: `index.html` and `standard/plates/index.html` are now
  single-file pages (runtime and plates inlined via
  `tools/build-standalone-pages.js`). Flatpak Chrome exposes only the opened
  file to the sandbox, which blocked the external `ddn.global.js` subresource
  ("DDNLive is not defined"); the inlined pages are immune. All linked
  standalone pages (gallery, Studio, designer prototype) were already
  self-contained. Verified in Chrome 151 and Chromium over `file://`.
- Standalone readiness: root `index.html` landing page with live in-browser
  render, `standard/plates/index.html` notation-plate browser, and
  `designer/prototype/standalone.html` single-file designer prototype
  (imported from the designer package, license header updated). Studio and
  gallery nav links retargeted to in-repo destinations; all entry pages
  verified over `file://` (headless Chromium: no console errors, all render).
- Repository created as the DDN open-source monorepo:
  - Imported DDN 0.5.0-draft.2 sources (notation runtime, CLI, Studio,
    specification, grammar, schemas, registry, examples) from the previous
    single-tree package.
  - Imported DDN Designer specification 0.1 (specification, contracts,
    prototype, research, design records, decisions) from its standalone
    package.
  - Relicensed MIT → GPL-2.0-or-later across imported sources.
  - Excluded generated corpora and prebuilt sites (field guide, enterprise
    review, rendered outputs, release evidence); available in the archived
    packages.
