# 19. Quantitative and UTC date projections

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


**Scope:** native source-bound SVG marks and supplied-date schedules, plus an optional Vega-Lite export prototype. This is not a statistical package, accounting calculator, scheduling solver or general dashboard compositor.

## 19.1 Native chart bindings

`chart.basic@1` supports `bar`, `line`, `area`, `point`, `pie` and `donut`. It declares explicit record references and safe `x`/`y` property paths. `x_type` is category (default), number or date. The y values must be finite JavaScript numbers; numeric strings are not silently coerced. Bars and arcs currently use category x. Scatter/bubble uses numeric x; lines and areas support category, numeric or UTC date x.

Units are explicit. When `unit` is supplied, every included record must carry an exactly matching `x_record.unit`. No currency, unit or calendar conversion is inferred. Native numbers use IEEE-754 arithmetic; the display layer is not authoritative monetary or statutory arithmetic. Feed appropriately computed and approved values when needed.

`missing:error` is the default. `missing:skip` must be explicit and records the skipped source IDs in the projection plan. A valid projection cannot have zero points. Category/line coordinates must be unique unless an explicit aggregate is provided. Bar/pie/donut categories can use sum, count, min, max or mean. Aggregated marks retain every contributing ID. Count is dimensionless and cannot retain an input-currency label. Aggregates are bounded visual derivations, not silently rewritten business metrics.

## 19.2 Numeric geometry invariants

Bars use a zero baseline, including negative values. Line/area series use supplied order for categories and increasing x for numeric/time domains. Area fill is between the series and zero. Points use data-bound x/y; when a nonnegative `size` binding is declared, bubble AREA—not radius—is proportional to that value. A zero size has no visible disk. No force-based collision avoidance moves plotted points or changes encoded values.

Pie/donut values are nonnegative with a positive total. Sector angle is value/total times a full circle. A singleton emits a complete circle; zero values have no sector but remain in the explanatory list. `inner_radius` is a donut radius fraction from 0 up to but not including 0.9. ~~Multiple series, stacking, statistical intervals, histograms, log scales, geographic mapping, multi-axis policies and responsive dashboard composition are not implemented in this increment.~~ Multiple series, stacking (signed cumulative, percent, zero-fill) and histograms are implemented by `chart.quality@1` — chapter 22 (0.9 note: this closed the deferred quantitative scope; arcs stay single-series in `chart.basic@1` and reject series/stacking with `DDN-QC001`). Statistical intervals, log scales, geographic mapping, multi-axis policies and responsive dashboard composition remain out of scope (dashboards/responsive belong to Weaver).

Drawing style may affect the outer frame and typography. It MUST NOT roughen or jitter quantitative coordinates. A chart mark change reuses the same records and bindings and is offered only when compatible with the x type. The component disables free placement/routing/field-card controls because they have no valid meaning for this projection.

## 19.3 UTC date-only scope

The reference accepts real ISO date strings in YYYY-MM-DD form and validates the actual calendar date rather than accepting rollover. They are mapped to UTC midnight. ~~It does not yet accept zoned timestamps, business-day calendars, durations with DST effects, locale-specific date strings or fiscal calendars.~~ **0.8 amendment (0.9 closure, conservative):** ISO-8601 **zoned timestamps** (`YYYY-MM-DDTHH:MM[:SS]` with `Z` or an explicit `±HH:MM` offset) are accepted and **normalized to the instant's UTC calendar date** — these projections are date-scoped, so sub-day precision intentionally drops; painted output stays ISO/UTC and no locale-dependent formatting exists anywhere. A datetime **without** an offset is ambiguous and rejected (`DDN-PJ221` — never guessed from locale). `timeline.basic@1` gains an optional `fiscal_year_start` date annotation (`DDN-PJ222` if not a real ISO date) that is **carried, never computed** — there is no fiscal calendar arithmetic. Durations keep elapsed-time semantics (no wall-clock DST math). **Locale-specific date formats remain refused** (nondeterministic by construction). Business-day calendars stay out of scope.

`timeline.basic@1` binds records to start and end dates. The interval is end-exclusive `[start,end)`; end before start is an error. Equal dates produce a diamond milestone. Optional predecessor relationships must use `precede` or `analysis.precedes`, connect selected tasks, form an acyclic graph and satisfy finish-to-start under the supplied dates. No dates are automatically rescheduled to satisfy an invalid dependency.

Rendering a Gantt-style supplied-date schedule is distinct from critical-path calculation, float, calendars, resource leveling, finite-capacity scheduling and project execution. Those capabilities are not inferred from a valid picture. UML timing waveforms/state-duration tracks remain separate projection work; sequence-style interaction diagrams are covered by the `uml.sequence@1` profile (chapter 27).

## 19.4 Measurement, presentation and publication

Quantitative native SVG uses axes, ticks, source-bound marks, labels and a common DDN page composition stage. Content dimensions, font metrics and minimum final text are checked. Tiny fixed figures error or warn according to the explicit publication policy; no silent shrinking below the threshold. Automatic label optimization for hundreds of points and multi-page chart splitting are not provided. The live API's inherited resource limits apply.

Core named style/palette variants remain consistent. Series colors are a separate quantitative channel, not the semantic relationship-family palette. There is no arbitrary `fill` override in source that silently changes a model element's kind. Legends expose category/value semantics.

## 19.5 Optional Vega-Lite integration prototype

`workspace.exportVegaLite({entry,view,overrides})` creates a local-values Vega-Lite 6 specification for supported chart/time projections. Native chart outputs do not depend on Vega. Exported data retain source IDs and the view/profile identity. Timeline exports report omitted native dependency arrows and the native diamond-milestone treatment. They are not lossless DDN documents.

`adapters/vega-lite/adapter.mjs` demonstrates trusted host-supplied Vega/Vega-Lite modules and an AST expression interpreter, with external resource loading denied and temporary views finalized after SVG generation. Actual third-party execution was **not verified** here because package-registry/CDN access was unavailable. It is a prototype boundary, not a second claimed production renderer or an automatic library download mechanism.

The native marks (the six `chart.basic@1` marks plus the `chart.radar@1` radar polygon) and timeline were exercised directly through the DDN public runtime. Only the exported external-specification envelope is tested in the default suite. Pin and review compatible third-party versions, licensing and security policy before using the optional adapter.

Primary background references, checked 2026-09-08:
- Vega-Lite compilation: https://vega.github.io/vega-lite/usage/compile.html
- Vega SVG deployment and CSP alternatives: https://vega.github.io/vega/usage/
- Interpreter configuration: https://github.com/vega/vega/tree/main/packages/vega-interpreter

## Numerical range safeguards

Finite inputs are not sufficient when aggregation or an axis span overflows. Such plans are rejected before drawing. Axis interpolation uses normalized fractions before multiplication; extreme and very small tick values use scientific notation. This is finite binary floating-point visualization, not arbitrary-precision financial calculation.

### Explicit timeline calendars and timezones

A timeline projection may declare `timezone` and `calendar` explicitly:

```ddn
projection {
    kind: timeline;
    timezone: "America/Toronto";
    calendar: {kind: business, fiscal_start_month: 7,
               weekdays: [1,2,3,4,5], holidays: ["2026-10-12"]};
}
```

These opt-in settings extend the conservative UTC behavior above. Input remains
real ISO dates or ISO timestamps with `Z` or an explicit offset. A timezone does
not authorize naive datetime or locale-dependent parsing. Date-only values stay
on their supplied calendar date; timestamp instants are converted to the explicit
zone before deriving the displayed date. The default timezone is UTC, never the
machine setting. Conversions outside years 0000–9999 reject instead of emitting
malformed dates. UTC and `±HH:MM` fixed offsets need no timezone database. Named
zones use the browser's installed timezone rules through ECMA-402
[`Intl.DateTimeFormat`](https://tc39.es/ecma402/2025/#sec-intl-datetimeformat-constructor).
Consequently, historical named-zone results require compatible timezone data
across hosts; a DDN document does not embed a timezone database or fetch one.
Unavailable zones reject with `DDN-PJ224`.

Calendar kinds are `gregorian`, `fiscal`, and `business`. Fiscal years are labelled
by their starting year; `fiscal_start_month` is 1–12 (default 1), and quarters are
three calendar months from that month. Business weekdays use ISO numbers 1–7
(Monday–Sunday), defaulting to 1–5. Holidays are explicit distinct ISO dates;
no regional holiday service is consulted. Business counts use end-exclusive
intervals and count a supplied holiday only when it falls on a working weekday.
Malformed settings reject with `DDN-PJ223`. Holiday lists are bounded to 10,000
entries and calculated intervals to 366,000 days. Week counting is arithmetic. Working-day holidays are validated and sorted once
per plan; each interval counts them with two binary searches. Planning does not
iterate every elapsed day or reparse the holiday list for each task.

The timeline remains a date-scaled supplied schedule. Its plan and mark tooltip
expose calendar days, business days and fiscal period. When both endpoints are
zoned timestamps, they also expose elapsed hours between instants and wall-clock
hours between the local clock readings. These differ across DST transitions;
explicit input offsets distinguish repeated clock times. No schedule dates are
moved automatically. The older `fiscal_year_start` annotation remains independent
and does not silently become an arithmetic setting. Chart date axes retain their
existing UTC contract.
