# Optional Vega-Lite export/adapter prototype

The core browser library does **not** require Vega. It implements six bounded native chart marks and a UTC date-interval projection directly. `workspace.exportVegaLite(request)` additionally creates a local-values Vega-Lite 6 specification from the same validated bindings. Nine supplied views produce export specimens in `projections/rendered/`.

`adapter.mjs` is a host-injected integration prototype using Vega's documented AST interpreter path. It accepts trusted `vega`, `vegaLite` and `expressionInterpreter` modules supplied by the application, disallows resource loading, and finalizes the temporary view after exporting SVG. No packages, fonts or remote data are automatically downloaded.

**Evidence boundary:** DDN validates the source and exported specification envelope in its tests. Executing this adapter against the actual third-party libraries was not possible in the build environment: package-registry DNS failed and CDN retrieval was unavailable. No successful third-party render or complete CSP qualification is claimed. Pin and audit compatible library versions before deploying this optional adapter; do not put `unsafe-eval` into a policy as a workaround.

The export has native data values and source IDs, not exact native DDN geometry. The native timeline's dependency arrows and diamond milestones are intentionally reported as omissions. Looks, DDN page thresholds, interactive source selection, and exporter redaction are not inherited by this separate renderer. SVG must go through the host's usual security and instance-ID isolation handling. This is not a lossless model interchange format.

Primary documentation consulted 2026-09-08:
- Vega usage and CSP alternatives: https://vega.github.io/vega/usage/
- Vega-Lite compiler: https://vega.github.io/vega-lite/usage/compile.html
- AST interpreter configuration: https://github.com/vega/vega/tree/main/packages/vega-interpreter

Third-party code is not included in this directory; review the licenses of the versions your application installs. The original adapter code is MIT, as is the rest of this proposal's original implementation.
