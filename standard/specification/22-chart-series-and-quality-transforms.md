# 22. Shared chart series, layers, and bounded quality transforms

**DDN 0.5.0-draft.1.** `chart.basic@1` remains unchanged for earlier single-series and arc examples. The additive `chart.quality@1` profile supplies explicit series, layered marks, and four named transforms. No JavaScript/SQL/FEEL expression evaluation or remote data loading is introduced.

## 22.1 Source contract

```ddn
projection {
    kind: chart;
    profile: "chart.quality@1";
    records: [@m.series.s0_0, @m.series.s0_1, @m.series.s1_0, @m.series.s1_1];
    x: "x_record.stage";
    y: "x_record.count";
    series: "x_record.series";
    mark: bar;
    arrangement: group;
    unit: "defects";
}
```

Records are distinct selected object references; maximum 1,000. `x` and `y` use the safe property-binding grammar from chapter 16, not arbitrary code. `y` must be a finite number. A present `unit` requires every input record's `x_record.unit` to match exactly. Missing/null values fail unless `missing: skip` explicitly excludes them. Excluded/skipped IDs remain in the plan. Numeric strings are not coerced. The runtime limits visible nodes/relationships and source size still apply before projection planning.

The optional filter supports explicit equality or set membership; order specifies a scalar binding and ascending/descending direction. Source ordering and stable identities break ties. A filter that removes all records fails rather than yielding a misleading successful empty picture.

## 22.2 Series and layers

| Property | Values / meaning |
|---|---|
| `transform` | `identity` (default), `histogram`, `pareto`, `waterfall`, `boxplot`. |
| `series` | Text property binding; absent means one series named Value. At most twenty series, text keys up to eighty characters. |
| `mark` | `bar`, `line`, `area`, `point`; `box` only with boxplot transform. |
| `arrangement` | `group`, `stack`, `percent`, `overlay`. Default group. |
| `x_type` | `category` (default), finite `number`, or validated ISO date-only `date`. |
| `layers` | Exactly one `{series, mark}` definition per series when supplied. |
| `aggregate` | `none`, `sum`, `count`, `min`, `max`, `mean` for duplicate series/coordinate rows. |
| `series_missing` | `gap` (default), `zero`, `error`. Zero-fill creates an explicitly synthetic mark with no invented contributor. |
| `target` | Optional finite value on the same y scale; percent target is in 0..100. |

All series in this slice share one y scale and unit. There is no general independent multi-axis chart. A mixed actual/target chart may use bars for Actual and a line for Target; neither is a presentation-only number. Duplicate series/coordinate pairs require an explicit aggregate. `count` cannot retain an input measure's unit as though counts were that measure.

Grouped bars receive separate category slots. Stacked bars/areas use signed cumulative offsets, with separate positive and negative accumulation. Percent stacks require nonnegative observations and a positive total at every category; their displayed y unit is percent while raw values remain inspectable. Stack/percent rejects incomplete series unless explicit zero-fill or complete data supplies all cells. Stacks must be all bars or all areas. Numeric/date x cannot be used for bars in this bounded implementation. Categorical domains have at most 200 positions; page width grows to retain minimum category spacing.

Line/area gaps are not bridged across missing observations. Layer identities, source contributors, raw value, normalized value and stack start/end are retained in scene marks. Quantitative coordinates remain exact under hand-drawn styling; only the chart furniture adopts the drawing treatment. Selecting free-node placement or dragging a mark as though it were a graph object is prohibited.

## 22.3 Histogram

```ddn
projection {
    kind: chart; profile: "chart.quality@1";
    records: [@m.measurements.m0_0, @m.measurements.m0_1];
    transform: histogram; mark: bar;
    y: "x_record.value"; unit: "mm";
    bins: [9.7, 9.9, 10.1, 10.3, 10.5, 11.3];
    normalize: density;
    outside: error;
}
```

Bins require two to 101 finite strictly increasing boundaries. Intervals are lower-inclusive/upper-exclusive, except the final bin includes its upper bound. Outside values fail by default; `outside: exclude` explicitly removes them and records their identities. At least one observation must remain in the bins. No automatic bin estimator is hidden in the renderer.

`normalize: count` draws frequency. `proportion` divides each count by the retained observation count. `density` additionally divides by bin width, so the sum of height × width is one. Counts and densities are different axes. Unequal bin widths are represented geometrically; raw counts are also available on marks. This normalization distinction follows the statistical distinction described by NIST [Q2].

A zero-count bin has no fake source record. Total overflow, nonpositive widths, no retained data and out-of-range values are explicit errors.

## 22.4 Pareto

`transform: pareto; mark: bar` aggregates nonnegative `y` by categorical `x`, sorts descending with stable ties, and computes cumulative totals and percentages. A positive total is required. The cumulative line's primary scale is the same total-valued axis as the bars; the right scale labels the equivalent percentages. There is no unrelated secondary numeric variable. Each cumulative marker records the contributors through that category.

The diagram does not infer that precisely 80% of an outcome is attributable to 20% of the categories. Its job is to expose the supplied descending distribution; ASQ describes the underlying descending-category chart purpose [Q3]. All quantities, labels and source identities remain inspectable.

## 22.5 Waterfall

`transform: waterfall; mark: bar` adds a `step` property binding. Every record supplies one of `delta`, `subtotal`, or `total`, and a finite `y` value. `baseline` defaults to zero.

A delta goes from the previous running value to `running + y`. A total/subtotal goes from zero to the current running value and must assert that same value in `y`; it does **not** add it again. Assertion tolerance is `max(1, abs(running)) × 1e-10`, reflecting the explicitly nonauthoritative finite-Number implementation. A mismatch fails. Records still define the order; neither names such as Total nor colours determine step type.

Each bar retains start, end, signed value, step role, its value source, and cumulative contributors. Adjacent connectors show the previous running level. The fixture totals 330 synthetic CAD after inspection 120, rework 180, scrap 70 and recovery -40. The asserted 300 subtotal is not a fifth change.

## 22.6 Box plots

`transform: boxplot; mark: box` groups observations by x. `quartiles: linear_r7` is the one supported method: for sorted values and probability p, interpolate at index `(n−1)p`. This is an explicitly selected convention, not a claim that every package uses the same quartiles.

`whiskers: minmax` reaches the minimum and maximum observations. `tukey_1_5` reaches the outermost observations within `Q1−1.5 IQR` and `Q3+1.5 IQR`, including fence ties. Points outside the fences are individual source-bound outlier marks. Both variants are related to the distinct presentations described by NIST [Q4], but this profile does not calculate statistical significance, confidence intervals or process-control capability.

The plot reports sample sizes, quartile method and whisker rule. It does not force zero onto a tightly clustered measurement scale; it includes the complete observed/outlier extent plus declared renderer padding. Single-value and tied samples produce degenerate boxes/whiskers, not division errors. Nonfinite derived quartiles, ranges or fences fail.

## 22.7 Radar/spider charts

```ddn
projection {
    kind: chart; profile: "chart.radar@1";
    records: [@facts.a1, @facts.a2, @facts.a3, @facts.n1, @facts.n2, @facts.n3];
    mark: radar;
    x: "x_record.criterion"; y: "x_record.score";
    series: "x_record.product"; unit: "points";
}
```

`mark: radar` arranges the distinct `x` categories as spokes at equal angles, starting at 12 o'clock and proceeding clockwise, in record order (no sorting). Four grid rings mark 25/50/75/100% of one shared `0 … max` scale computed over all points — per-axis normalization is deliberately not applied, so values on different spokes remain directly comparable. Each series (or the single implicit series when `series` is absent) is one closed polygon whose vertices sit at `radius × y / max` on each spoke, stroked in the registered palette with a 12% opacity fill; category labels sit outside the outer ring and the series legend matches the other chart families. A series with no observation on a spoke simply omits that vertex; no value is invented.

Radar requires categorical `x` (`DDN-PJ030` otherwise), rejects aggregation (`DDN-PJ031`), requires at least three distinct categories (`DDN-PJ071`), and requires every `y` to be a finite number greater than or equal to zero (`DDN-PJ072`). Radar has no faithful Vega-Lite mapping, so the optional adapter rejects it with `DDN-PJ070`; the native SVG projection is the render path. Unsupported: multi-axis scales and filled-curvature interpolation.

## 22.8 Funnel

```ddn
projection {
    kind: chart; profile: "chart.funnel@1";
    records: [@pipeline.s1, @pipeline.s2, @pipeline.s3, @pipeline.s4, @pipeline.s5];
    mark: funnel;
    x: "x_record.stage"; y: "x_record.value";
    unit: "deals";
}
```

`mark: funnel` draws one horizontal band per stage, stacked top to bottom in declaration order (after any `filter`/`order`); the category axis value (`x`) is the stage label and one record supplies one value per stage. All bands share equal heights (`plotH / N`) and are centered on one vertical axis. Band `i` is a trapezoid whose top edge width is `plotW × yᵢ / maxY` and whose bottom edge width is `plotW × yᵢ₊₁ / maxY` for `i < N − 1`; the final band's bottom edge is `max(24 × scale, topWidth × 0.35)` wide — a fixed, deterministic taper. Each band is filled from the registered palette and stroked with the surface colour, labels read `stage: value unit` (centered inside the band when it fits, otherwise to the right), and a footer states the stage count and total.

Funnel requires categorical `x` (`DDN-PJ030` otherwise), rejects any `series` binding (`DDN-PJ030`) and any aggregation (`DDN-PJ031`) — duplicate stage labels are rejected by the existing `DDN-PJ036` check since no aggregate is permitted. A funnel needs at least two distinct stages (`DDN-PJ073`) and every stage value must be a nonnegative number (`DDN-PJ107`); non-finite or missing values fail earlier with `DDN-PJ032`. Funnel has no faithful Vega-Lite mapping, so the optional adapter rejects it with `DDN-PJ070`; the native SVG projection is the render path. Limitations: per-stage conversion rates are not computed, and curved or necked funnel variants are unsupported.

## 22.9 Gauge/KPI dial

```ddn
projection {
    kind: chart; profile: "chart.gauge@1";
    records: [@sla.q1];
    mark: gauge;
    x: "x_record.kpi"; y: "x_record.value";
    unit: "%"; target: 95;
}
```

`mark: gauge` draws one semicircular 180° dial (from 180° at the left to 0° at the right) for a single percentage value. Four equal tick bands (0–25, 25–50, 50–75, 75–100) are drawn as concentric arc segments in registered palette order, tick labels 0/25/50/75/100 sit outside the arc, and a needle runs from the dial center at angle `π × (1 − y / 100)`. The center label reads the value plus `%` (plus `unit` when set and not already `%`), and the record's `x` value is rendered as the caption below the dial. When `target` (a plain number in 0..100) is set, a short radial tick is drawn on the outer arc at angle `π × (1 − target / 100)`.

Exactly one record must remain after any `filter` — the KPI — otherwise `DDN-PJ074` is raised before the duplicate-`x` grouping, so two same-`x` records also fail with `DDN-PJ074`. Both the value and `target` must be finite numbers in 0..100 (`DDN-PJ075`); non-finite or missing values fail earlier with `DDN-PJ032`. Gauge requires categorical `x` (`DDN-PJ030`), rejects any `series` binding (`DDN-PJ030`) and any aggregation other than `none` (`DDN-PJ031`).

`target` is the same chart property used by `chart.quality@1` (§22.1), where it is a numeric reference on the shared y scale. A gauge view bypasses the quality planner entirely (`chartRequested` returns false for `mark: gauge`), so gauge `target` keeps its own 0..100 dial semantics and never triggers a quality transform. Gauge has no faithful Vega-Lite mapping, so the optional adapter rejects it with `DDN-PJ070`; the native SVG projection is the render path. Unsupported: multi-needle dials, custom band colour thresholds, and full-circle dials.

## 22.10 Unsupported combinations and publication

Special transforms reject series/layer/arrangement, unrelated transform parameters, or aggregate settings that would be ignored. Boxplot requires box marks; histogram/Pareto/waterfall require bars. Chart-basic arc rendering remains available in the earlier profile. Arbitrary formulas, regression, statistical tests, logarithmic/independent axes and responsive business dashboards are not introduced here.

The page engine measures labels/legend rows, expands categorical spacing where required, and validates output size. A fixed page that cannot retain its minimum text size fails. Do not use browser zoom as proof that an exported PDF target is readable. Grouped legends and data labels retain unit and series meanings in all palettes. There is no global label-placement optimality guarantee for every possible dataset.

`DDN-QC001..022`, `DDN-Q001..005`, core publication diagnostics and capability errors report invalid bindings, parameters, units, aggregates, ranges and unsupported combinations. `tests/quality.js` includes exact bin counts, density integral, boundary inclusion, cumulative totals, stacks, R7 values, outliers, numeric-string rejection and source edits shared across tables/plots.

## Sources

References support background chart definitions, not approval of this implementation. Checked 2026-09-08.

[Q2] NIST histogram: https://www.itl.nist.gov/div898/handbook/eda/section3/histogra.htm

[Q3] ASQ Pareto: https://asq.org/quality-resources/pareto

[Q4] NIST box plot: https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm
