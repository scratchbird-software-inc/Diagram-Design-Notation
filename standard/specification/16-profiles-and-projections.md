# 16. Profiles and projections — DDN 0.4 draft

> **Current 0.5 extension:** chapters 21–24 add quality profiles, matrix creation, multiseries/statistical transforms, rule/lifecycle checks and one-level composed views. This chapter retains the earlier basic profile scopes; broader options require their registered 0.5 profiles.


**Status: implemented reference subset for review, not an adopted external standard.** These rules add to the existing language. Existing 0.2/0.3 source is still accepted; no profile may silently reinterpret the original core kinds or connectors. The current runtime is 0.5.0-draft.1; this chapter establishes the retained basic 0.4 projection contract. Core notation retains its independent `ddn-core@0.3` identity; installed extension definitions have their own profile IDs.

## 16.1 Model, projection and scene

The model contains stable semantic elements, members and relationships. A named view selects from that model. Its projection determines whether the selected information becomes a graph, Chen diagram, relationship matrix, record table, panel composition, chart or supplied-date timeline. A scene is the resulting measured geometry. An occurrence is not a copy of a business entity.

Changing look, palette or display detail MUST NOT change semantic identities or assertions. Changing a chart mark MUST NOT change its source values. Matrix cells MUST retain their contributing relationship IDs. A Chen attribute oval MUST identify the original field. Page translation/scaling MUST NOT rewrite source coordinates. Date, numeric and matrix coordinates are determined by bindings, not free-node layout optimization.

The public `modelFingerprint` is a non-security fingerprint of the resolved semantic content. It is not a signature. The build manifests separately record SHA-256 digests. Different views can include different data modules, so not all views of a project necessarily have identical fingerprints. Equivalent ER/Chen and chart/table examples deliberately do.

## 16.2 Source grammar

The parser accepts a JSON-style quoted version and module identity followed by semicolons. Profile-defined dotted kind names MUST be quoted; references continue to use `@` and qualified identifiers.

```ddn
ddn "0.4";
module "example.review";
data model {
    object first "First observation" {
        kind: record;
        x_record: { month: "Jan", value: 420, unit: "CAD" };
    }
    object second "Second observation" {
        kind: record;
        x_record: { month: "Feb", value: 570, unit: "CAD" };
    }
}
format shared {
    projection monthly {
        kind: chart;
        profile: "chart.basic@1";
        records: [@model.first, @model.second];
        mark: bar;
        x: "x_record.month";
        y: "x_record.value";
        unit: "CAD";
    }
    publication screen { size: content; fit: none; }
}
view monthly {
    data: [@model];
    projection: @shared.monthly;
    publication: @shared.screen;
}
```

A reusable `projection` is a named declaration inside `format`, just like `layout`, `style` or `publication`. It can be referenced directly from `view` or through a `bundle`. A view-local `projection { ... }` block overrides the referenced projection's properties using the existing concern-resolution rules. The parser does not introduce a different statement keyword for every diagram kind.

Projection syntax in EBNF supplements the existing generic declaration grammar:

```text
ProjectionDefinition = "projection", Identifier, "{", Property*, "}" ;
ProjectionReference  = "projection", ":", Reference, ";" ;
ProjectionOverride   = "projection", "{", Property*, "}" ;
```

The implementation's semantic validator is authoritative for property applicability. Merely parsing a property does not make it valid for all projections. For instance, `mark` is not legal on a matrix. No filter or binding executes JavaScript, SQL, FEEL or another expression language.

## 16.3 Installed profiles

`profiles/catalogue.json` is the machine-readable profile catalogue. The shipped profiles are fixed trusted definitions bundled at build time. This release does NOT implement downloading or installing arbitrary user-defined plugin code from DDN source. Developers can extend the catalogue/source, rebuild the library and add fixtures. Unrecognized profile IDs and incompatible projection kinds are errors.

A profile describes a projection, eligible semantics, validation obligations, supported silhouettes, scope and exclusions. The profile library adds 42 kind definitions and 20 relationship definitions to the 152-kind/90-relation core without changing the latter's IDs. Three of the additional kind recipes are used by Chen-generated occurrences. An icon count is not a supported-diagram count.

The graph-projection profiles now include the C4-style set: `c4.context@1` (people and systems only, no internal structure), `c4.container@1` (containers, stores and queues inside one system boundary frame) and `c4.component@1` (components inside one container boundary frame), using the six `c4.*` kinds and the `c4.rel` verb. These are DDN profiles on the existing graph projection, not a claim of C4 specification conformance.

## 16.4 Explicit source collections and bindings

This increment uses explicit arrays of model references for rows, columns, records and panel items. They are not arbitrary SQL-like queries or named collection-expression syntax. Each array has 1–500 unique references. Every bound element must be present in the view selection. A missing or excluded record is an error, never an empty invented row.

Binding strings are dot-separated safe property paths such as `x_record.value`, or the special element properties `name`, `id`, `kind`. Reserved object-prototype names and expression characters are rejected. The binding obtains an own property value; it does not run getters or arbitrary code from source.

Record/table/time projections offer an optional equality or membership filter and stable ascending/descending sort. Filtering may not leave an empty result. Native support for general joins, pivots with arbitrary aggregation, computed business formulas or user code is not claimed. Matrices join only the expressly selected row/column identities through a declared relationship kind.

## 16.5 Coordinate policy

`graph` uses the existing positions, pins, patterns and router. `chen` creates a visual graph from the declared source structure, but this increment rejects occurrence-specific `place`, `route`, `frame` and `subdiagram` declarations for that generated graph. All other projection kinds are data-bound and reject those graph geometry declarations.

The viewer disables graph-only controls for data-bound projections. Selecting a page, font, look, palette or supported chart mark remains possible. Zoom only magnifies the completed SVG. Unsupported geometry overrides fail; the implementation never moves a value to make a prettier chart.

## 16.6 Publication and limits

Projection width and height hints accept finite 240–12,000px values. They are preferred working dimensions, not permission to crop contents. Native content measurement can enlarge matrix/panel/table layouts. The measured result has a 50,000px extent budget. The common publisher checks final page area and minimum text after scale, including `fit:none`. Automatic multi-sheet pagination is not implemented.

The public live API retains its existing 128 selected-element/384 visible-relation resource limit, which can be stricter than the internal planner's per-array limits. Matrix planning additionally limits 5,000 cells and 40 columns; record tables allow at most 30 columns. Limits are bounded synchronous work, not worker isolation or a hard wall-clock timeout.

## 16.7 Export authorization

View selection and `display` are NOT access control. The original core allowlist exporter remains supported for its existing graph domain. Profile-specific redacted projections, including quantitative/matrix/Chen and graphs using new extended kinds, fail closed with `DDN-PJ003`. They have not been qualified for complete occurrence/payload authorization closure. Supply a separately authorized source workspace instead. There is no fallback to an unredacted result.

No confidential source should be sent to an unauthorized browser. Full workspace ZIP/JSON downloads contain the supplied source, including material hidden from a particular view. SVG source IDs, labels, values and provenance can themselves be sensitive.

## 16.8 Conformance declaration

Support is tracked independently as render, source authoring, static validation, interchange and execution. The new native profiles are bounded reference implementations. There is no complete UML, SysML, BPMN, CMMN, DMN, ArchiMate, electrical, geographic or UI-prototype certification. The current scope tables and executable fixtures, not the shape catalogue alone, define what this draft implements.
