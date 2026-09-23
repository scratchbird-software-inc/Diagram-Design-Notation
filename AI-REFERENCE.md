# DDN (Diagram Design Notation) — AI Authoring Reference

**ScratchWeaver** — the Diagram Design Notation (DDN) toolkit from ScratchBird Software Inc. The language itself is named DDN (Diagram Design Notation); ScratchWeaver is the product (reference runtime, CLI, Studio, and dist bundles) described here.

Single self-contained reference for generating valid `.ddn` files. Derived entirely from the authoritative repository sources of DDN runtime **0.6.0-beta.1** (`notation/runtime/*`, `notation/cli/cli.js`, `notation/studio/src/api.js`) and standard **0.3/0.5** (`standard/grammar/ddn.ebnf`, `standard/specification/*`, `standard/registry/catalogue.json`, `standard/registry/profiles/catalogue.json`, `standard/registry/data-properties.json`). Vocabulary tables below are machine-extracted from those registry/runtime files, not paraphrased.

**Vocabulary counts (verified by extraction scripts against the registries):**
- Object kinds: **229 total** = 152 core (`registry/catalogue.json .kinds`) + 77 profile (`registry/profiles/catalogue.json .kinds`)
- Relationships (verbs): **122 total** = 91 core + 31 profile
- Diagram profiles: **73** (`profiles/catalogue.json .profiles`)
- Projection kinds: **11** (`graph`, `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`, `fishbone`, `decision`, `sequence`, `timing`)
- Endpoint marks: 12; object families: 12; relation families: 8; facets: 118; view types: 20; registered data properties: 99
- Diagnostic codes: **357** extracted from the runtime (reference runtime + Studio `src/`)

## 1. Purpose and the generate → check → fix loop

DDN is a text notation: one or more `module` sections per file; `data` blocks hold the model (objects, fields, relations); `format` blocks hold reusable presentation profiles; `view` blocks compose data + presentation into a renderable diagram. Everything is validated by a reference implementation.

**Workflow for an AI author:**
1. Write the `.ddn` file(s) per sections 2–4 of this document.
2. Validate with the reference CLI (section 7):
   `node notation/cli/cli.js check <file.ddn> --workspace <dir>`
   Success prints `{"status":"pass-core",...}` with any warnings. Failure prints one JSON diagnostic `{"code":"DDN###","message":"...","source":"...","offset":N}`.
3. Look the code up in the diagnostics table (section 8), fix the source, re-run. Iterate until clean. `check` runs the full semantic + profile validators; `render` additionally runs layout/routing/publication checks (DDN200–224, DDN-PJ060+), so **run `render` too** for graph views when feasible.
4. Common authoring pitfalls that produce errors: wrong endpoint kinds for a verb (see relation tables), missing `source_mark`/`target_mark` under `erd.crowfoot@1`, profile participant/verb restrictions (section 6), unquoted dotted kind names, `import` in an illegal position (DDN015), forgetting `data:` in a view (DDN041), property names outside the allowed set (DDN033), enum values outside `CHOICES` (DDN046).

## 2. File anatomy

### 2.1 Document header and module sections

```text
ddn "0.5";                          // version header; FIRST tokens of the file
import "shared.ddn" as shared;      // file-level imports, zero or more
module "shop.model";                // module section header; >= 1 per file
<top-level declarations>
module "shop.views";                // further sections (RFC-117 multi-module)
<top-level declarations>
```

- **Version header**: `ddn "<version>";` — accepted versions are exactly `"0.2"`, `"0.3"`, `"0.4"`, `"0.5"` (DDN012 otherwise). Write `"0.5"` for new files. `0.2` sources are accepted through a compatibility reader and add warning DDN-W012. All files are UTF-8 (reader accepts BOM and CRLF; formatter convention is LF, no BOM). A source file may be at most 2,000,000 characters (DDN001).
- **Module**: `module "<id>";` — the module is a stable namespace, not a file path. Id syntax: `/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/` (DDN013). Module identity must be unique across the whole workspace, whether the duplicate is another section of the same file or another file (DDN023). Declaration identities must be unique across sections (symbol keys are `module::path`; DDN024).
- **Imports**: `import "<path>" as <alias>;` — file-level only. Canonical position: before the FIRST module header. Legacy position (kept for existing single-module files): immediately after the FIRST module header, before that section's first declaration. Both sets merge into one file-level import list; alias uniqueness applies across the merged list (DDN014). An import anywhere else is DDN015. Older runtimes reject multi-section files cleanly with DDN010. Import paths must be workspace-relative POSIX paths: no scheme (`http:`), no leading `/` or `\`, no `\`, and `..` may not escape the workspace root (DDN020).
- **Sibling visibility**: sections of the SAME file see each other through module-qualified references (`@shop.model.model`) with no import. Another file importing a multi-module file imports ALL its modules; `@alias.path` resolves against each section in order. When resolving a module-qualified sibling reference, module ids may themselves be dotted, so the resolver matches the LONGEST module-id prefix first.
- **Bundling**: `node notation/cli/cli.js bundle <entry.ddn> --workspace . --out out.ddn` (or `DDNLive.io.bundle(files, entry)`) merges a workspace into one self-contained multi-module file: header carries the maximum language version in use; entry file's module(s) first, remaining modules sorted by module id; section bodies are original source text minus header lines (comments/formatting preserved); imports between bundled files are dropped and `@alias.path` references through them are canonicalized to module-qualified sibling references; imports to files outside the bundle set are kept at the top with warning DDN-W013; conflicting external alias or uncanonicalizable reference → DDN-W014. Rendering every view of a bundle is byte-identical to rendering the original workspace.

### 2.2 Comments, identifiers, strings, values

- Comments: `// line` and `/* block */` (blocks do NOT nest; unterminated → DDN002).
- Identifiers: ASCII `[A-Za-z_][A-Za-z0-9_-]*`. A quoted label is never identity. An explicit `uid: "..."` property preserves identity across refactoring (workspace-unique; DDN026 on collision).
- Strings: JSON-style double-quoted with JSON escapes; no raw newline (DDN003); surrogate pairs must be valid (DDN004). **Profile-defined dotted kind names and profile ids MUST be quoted** (`kind: "c4.system";`, `profile: "chart.basic@1";`) because `.`/`@` are not identifier characters. Plain core keywords (`table`, `assoc`) are written unquoted.
- Numbers: finite (DDN005); quantities are number+unit with no space: lengths `px|pt|mm|cm|in`, temporal `ms|s|min|h|d|`, `%`. Geometry contexts reject temporal units (DDN032). Internal geometry is px (pt = 96/72 px, mm = 96/25.4 px, cm = 96/2.54 px, in = 96 px).
- Atoms: `true`, `false`, `null`, plus explicit modeling states `missing`, `undecided`, `not_applicable`, `conflicting`. A quoted `"undecided"` is a string, not a state assertion.
- Records: `{ key: value, ... }` — entries separated by `,` or `;`, trailing separator allowed; keys are identifiers or strings; `__proto__`/`prototype`/`constructor` are reserved (DDN008); duplicate keys rejected (DDN011). Arrays: `[ v, v, ]` trailing comma allowed. Max nesting depth 80 (DDN007).
- Properties end in `;`. Blocks may carry an optional trailing `;`.

### 2.3 References

`@a.b.c` resolves a declaration path. Resolution order: (1) first segment matching a file-level import alias → resolve remainder in the imported file's modules (each section in order); (2) longest-prefix module-qualified sibling section in the same file; (3) progressively outer scopes of the referencing declaration within the same module. Unresolved → DDN031. References may point at objects, fields, ports, views, format declarations, etc. depending on context.

## 3. Declarations and property contracts

Top level of a module: exactly `data`, `format`, `view` declarations (anything else → DDN025).

### 3.1 `data <id> ["label"] { … }` — the model

Members (children that are not groups):
- `object <id> ["label"] { … }` — a model element. Optional `kind:` property picks a registry kind (default `object`); any reserved data property (section 4.8) or registered `x_*` extension property may be set.
- `domain <id> ["label"] { … }` — semantic domain (default kind `domain`).
- `sample <id> ["label"] { … }` — bound example records; requires `columns: [@field-ref, …]` (each must resolve to a `field`, DDN052) and `rows: [[…], …]` with row width equal to column count (DDN053); missing either → DDN051.
- `flow <id> ["label"] { … }` — element with default kind `pipeline`.
- `assertion <id> ["label"] { … }` — element with default kind `observation`.
- `relation <id> ["label"] @source -> @target { … }` — a relationship. Header endpoints are legal ONLY on relations (DDN055). Endpoints may be elements or members (fields/ports): `@object.field`. The verb is the `kind:` property (default `assoc`), resolved by keyword, lowercase code, or alias (unknown → DDN056).

Groups inside objects (and fields): `fields { field <id> ["label"] {…}; … }` (recursive — a field may contain its own `fields` group; nothing else is legal inside a field, DDN042) and `ports { port <id> ["label"] {…}; … }`. Unknown groups → DDN900. Nested field identity is independent of its visible label: resolved children carry their own ids, parent ids, depth and dotted paths; `@model.customer.contacts.value` is a legal relation endpoint.

Only `object`/`domain`/`sample`/`flow`/`assertion`/`relation` may appear in data (DDN042). Relations belong to data, never to a format override; a renderer never invents a relation because two shapes touch.

### 3.2 `format <id> ["label"] { … }` — reusable presentation declarations

Named declarations: `notation`, `style`, `layout`, `display`, `publication`, `legend`, `validation`, `export`, `projection`, `keyset`, and `bundle` (a bundle references one declaration of each concern by `@ref`). Example:

```text
format styles {
    notation core;
    style classic;
    layout wires { algorithm: grid; gap: 80px; }
    display detailed;
    publication screen { size: content; width: 1360px; height: 860px; margin: 30px; overflow: warn; }
    legend words { mode: text; width: 280px; }
    bundle technical { notation: @core; style: @classic; layout: @wires; display: @detailed; publication: @screen; legend: @words; }
}
```

### 3.3 `view <id> ["label"] { … }` — the composition point

A view references one or more data blocks and a presentation, adds selection and local geometry:

```text
view overview "Title" {
    data: [@model];                    // REQUIRED: array of refs to data blocks (DDN041)
    format: @shared.styles.technical;  // optional: ref to a bundle
    layout: @formats.dataflow;         // optional: direct ref to any concern declaration
    projection { kind: chart; profile: "chart.basic@1"; records: [@model.a, @model.b]; mark: bar; x: "x_record.month"; y: "x_record.value"; }
    layout { direction: down; }        // view-local override group (merges over referenced)
    select: all;                       // or [@a, @b]; default: all elements
    exclude: [@c];
    description: "…";
    spacing: loose;                    // tight|normal|loose|expanded; view wins over bundle
    place @model.customer { at: [0px, 0px]; }
    route @model.r1 { via: [[100px, 200px]]; source_side: east; }
    frame boundary "Boundary" { scope: @model.sys; members: [@model.a, @model.b]; }
    subdiagram detail { view: @detailView; mode: reference; }
}
```

**Resolution order (weakest → strongest):** language defaults → referenced bundle → directly referenced concern (`layout: @x`) → view-local override group (`layout { … }`). Conflicting identities fail rather than last-import-wins. `format:` must reference a `bundle` (DDN043); a concern reference must point at a declaration of that concern type (DDN044).

View-level property keys allowed (DDN033 for anything else not starting `x_`): `projection, data, format, notation, style, layout, display, publication, legend, select, exclude, description, uid, validation, export, spacing`. View children may additionally be `place`, `route`, `frame`, `subdiagram` declarations and override groups named after the concerns (`projection`, `style`, `layout`, …). Any other child → DDN900.

**Selection**: `select: all` (default) or an explicit array of element refs; refs must resolve to in-scope elements (DDN057). `exclude` removes occurrences. A relation is visible when both endpoints are selected unless `display.relations: none`.

**`place`** (optional hints; omit for automatic layout): properties `at: [x, y]` (quantity pair), `size: [w, h]`. Placement targets must be selected (DDN062). Hard pins must not overlap (DDN204).

**`route`** (optional per-relation geometry, view-specific; never changes endpoints): `via: [[x,y],…]` hard waypoints; `source_side`/`target_side` in `east|west|north|south`; `source_fraction`/`target_fraction` in (0,1) for unbound body anchors (cannot replace a field/port endpoint, DDN-I030); `callout: [x,y]` label position; `policy: strict|repair`; `routing: orthogonal|straight|curved`; `curve: bezier|rounded`; `curve_tension` (0,1]; `curve_radius` (>0, ≤1000px). Route targets must be visible relations (DDN063). `route_policy: repair` (default) recomputes an unsafe `via` hint with info diagnostic DDN-LW02; `strict` rejects it (DDN073 non-orthogonal / DDN213 unsafe).

**`frame`**: `scope:` (ref to the boundary element, optional), `members: [@…]` (refs), `at`, `size`, `label`, `dimension`, plus profile flags like `x_region: true`, `x_pool: true` (extension props on frames pass through). Frame-vs-member geometry follows `layout.frame_overflow` (`expand` default, `confine`; RFC-118): under `expand` the frame rect grows to enclose members at the standard padding (a declared `at`/`size` rect that already fits is unchanged); under `confine` a declared `at`+`size` frame is fixed and unpinned members are clamped into its interior.

**`subdiagram`**: `view:` (must resolve to a view, DDN064), `mode: reference|inline` (DDN900 otherwise), `at`, `size`, `label`, `binding`, `uid`. `reference` links; `inline` embeds the child's own selection/presentation — inline recursion or depth > 6 → DDN065.

**`legend` / `keyset`**: numbered mode assigns callout numbers via `keys: { "<relation-id-or-local-name>": n }`; ambiguous/unknown keys → DDN058, non-positive-integer numbers → DDN059, duplicate numbers → DDN060. `mode: numbers` requires a visible legend placement (DDN047) and a number for EVERY visible relation (DDN061); shared `keyset` declarations preserve numbers across views. Numbers identify relations; they are not time order.

**`validation { mode: sketch|logical|strict; unknown_extensions: warn|error; }`** — `logical` (default): unregistered `x_*` extensions and unknown semantic properties are preserved with warnings (DDN-W103/DDN-W106); `strict`: unregistered extensions (DDN103) and unknown semantic properties (DDN106) fail; sketch-mode endpoint kind mismatches defer to warnings (DDN-W102).

### 3.4 Full property key whitelist per declaration type (from `DDN.PROPERTIES`; unknown keys → DDN033; `x_*` always allowed)

```json
{
 "projection": [
  "kind",
  "profile",
  "write_data",
  "rows",
  "columns",
  "relation",
  "value",
  "duplicates",
  "panels",
  "records",
  "mark",
  "x",
  "y",
  "x_type",
  "size",
  "unit",
  "aggregate",
  "start",
  "end",
  "label",
  "dependencies",
  "width",
  "height",
  "filter",
  "order",
  "missing",
  "inner_radius",
  "values",
  "effect",
  "encoding",
  "series",
  "series_missing",
  "arrangement",
  "transform",
  "layers",
  "bins",
  "normalize",
  "outside",
  "whiskers",
  "quartiles",
  "step",
  "baseline",
  "target",
  "open",
  "high",
  "low",
  "close",
  "inputs",
  "outputs",
  "hit_policy",
  "coverage",
  "analysis_budget",
  "traces"
 ],
 "notation": [
  "registry"
 ],
 "style": [
  "look",
  "theme",
  "font",
  "font_size",
  "seed",
  "roughness",
  "hachure"
 ],
 "layout": [
  "algorithm",
  "auto_place",
  "center",
  "grid_step",
  "optimize",
  "endpoint_ordering",
  "frame_overflow",
  "direction",
  "routing",
  "curve",
  "curve_tension",
  "curve_radius",
  "crossings",
  "gap",
  "columns",
  "port_clearance",
  "object_clearance",
  "edge_clearance",
  "junctions",
  "shared_segments",
  "row_gap",
  "route_policy",
  "quality",
  "root",
  "hierarchy",
  "group_by"
 ],
 "display": [
  "fields",
  "kind",
  "maturity",
  "badges",
  "relations",
  "samples",
  "datatypes",
  "domains",
  "depth"
 ],
 "publication": [
  "size",
  "width",
  "height",
  "margin",
  "orientation",
  "fit",
  "minimum_text",
  "overflow",
  "title",
  "caption",
  "embedding_scale",
  "metrics"
 ],
 "legend": [
  "mode",
  "placement",
  "width",
  "keys",
  "keyset",
  "scope"
 ],
 "validation": [
  "mode",
  "unknown_extensions"
 ],
 "export": [
  "mode",
  "elements",
  "fields",
  "properties",
  "include_samples",
  "identifier_mode",
  "title",
  "format"
 ],
 "bundle": [
  "projection",
  "notation",
  "style",
  "layout",
  "display",
  "publication",
  "legend",
  "validation",
  "export",
  "spacing"
 ],
 "view": [
  "projection",
  "data",
  "format",
  "notation",
  "style",
  "layout",
  "display",
  "publication",
  "legend",
  "select",
  "exclude",
  "description",
  "uid",
  "validation",
  "export",
  "spacing"
 ],
 "place": [
  "at",
  "size"
 ],
 "route": [
  "via",
  "source_side",
  "target_side",
  "callout",
  "policy",
  "source_fraction",
  "target_fraction",
  "routing",
  "curve",
  "curve_tension",
  "curve_radius"
 ],
 "subdiagram": [
  "view",
  "mode",
  "at",
  "size",
  "label",
  "binding",
  "uid"
 ],
 "frame": [
  "scope",
  "members",
  "at",
  "size",
  "label",
  "dimension"
 ],
 "junction": [
  "at",
  "relations",
  "network"
 ],
 "keyset": [
  "keys",
  "scope"
 ]
}
```

### 3.5 Resolved-profile defaults (from `DDN.DEFAULTS`; every view resolves to this full set, overridden per the resolution order above)

```json
{
 "projection": {
  "kind": "graph",
  "profile": "ddn@1"
 },
 "notation": {
  "registry": "ddn-core@0.3"
 },
 "style": {
  "look": "classic",
  "theme": "default",
  "font": "sans",
  "font_size": {
   "$quantity": 16,
   "unit": "px"
  },
  "seed": 42
 },
 "layout": {
  "algorithm": "auto",
  "auto_place": true,
  "center": "content",
  "grid_step": {
   "$quantity": 32,
   "unit": "px"
  },
  "optimize": "crossings",
  "endpoint_ordering": "optimize",
  "frame_overflow": "expand",
  "direction": "right",
  "routing": "orthogonal",
  "curve": "bezier",
  "curve_tension": 0.5,
  "curve_radius": {
   "$quantity": 32,
   "unit": "px"
  },
  "crossings": "gap",
  "gap": {
   "$quantity": 100,
   "unit": "px"
  },
  "row_gap": {
   "$quantity": 100,
   "unit": "px"
  },
  "columns": 3,
  "object_clearance": {
   "$quantity": 16,
   "unit": "px"
  },
  "edge_clearance": {
   "$quantity": 12,
   "unit": "px"
  },
  "port_clearance": {
   "$quantity": 28,
   "unit": "px"
  },
  "route_policy": "repair",
  "quality": "error",
  "root": null,
  "group_by": "none"
 },
 "display": {
  "fields": "names",
  "kind": "icon_token",
  "maturity": "token",
  "badges": "tokens",
  "relations": "between_selected",
  "samples": "show",
  "domains": "hide",
  "datatypes": "hide",
  "depth": 32
 },
 "publication": {
  "size": "figure",
  "width": {
   "$quantity": 1280,
   "unit": "px"
  },
  "height": {
   "$quantity": 800,
   "unit": "px"
  },
  "margin": {
   "$quantity": 32,
   "unit": "px"
  },
  "fit": "contain",
  "minimum_text": {
   "$quantity": 8,
   "unit": "pt"
  },
  "overflow": "error"
 },
 "legend": {
  "mode": "text",
  "placement": "right",
  "width": {
   "$quantity": 310,
   "unit": "px"
  },
  "keys": {}
 },
 "validation": {
  "mode": "logical",
  "unknown_extensions": "warn"
 },
 "export": {
  "mode": "full",
  "elements": [],
  "fields": null,
  "properties": [],
  "include_samples": false,
  "identifier_mode": "opaque",
  "title": "Published data view",
  "format": "json"
 }
}
```

### 3.6 Enumerated values (from `DDN.CHOICES`; anything else → DDN046)

```json
{
 "projection": {
  "kind": [
   "graph",
   "chen",
   "matrix",
   "panels",
   "table",
   "chart",
   "timeline",
   "fishbone",
   "decision",
   "sequence",
   "timing"
  ]
 },
 "style": {
  "look": [
   "classic",
   "handDrawn",
   "neo"
  ],
  "theme": [
   "default",
   "neutral",
   "dark",
   "night",
   "forest",
   "base"
  ],
  "font": [
   "sans",
   "serif",
   "mono",
   "handwriting"
  ]
 },
 "layout": {
  "algorithm": [
   "auto",
   "grid",
   "manual",
   "layered",
   "tree",
   "mindmap",
   "grouped",
   "fit_grid",
   "circular",
   "radial",
   "spanning_tree",
   "organic"
  ],
  "center": [
   "pins",
   "content"
  ],
  "optimize": [
   "crossings",
   "none"
  ],
  "endpoint_ordering": [
   "optimize",
   "preserve"
  ],
  "frame_overflow": [
   "expand",
   "confine"
  ],
  "direction": [
   "right",
   "down",
   "left",
   "up"
  ],
  "routing": [
   "orthogonal",
   "straight",
   "curved"
  ],
  "curve": [
   "bezier",
   "rounded"
  ],
  "crossings": [
   "gap",
   "bridge",
   "square_bridge"
  ]
 },
 "display": {
  "fields": [
   "names",
   "none"
  ],
  "kind": [
   "text",
   "icon_token",
   "icon",
   "none"
  ],
  "maturity": [
   "token",
   "none"
  ],
  "badges": [
   "tokens",
   "none"
  ],
  "relations": [
   "between_selected",
   "none"
  ],
  "samples": [
   "show",
   "hide"
  ],
  "domains": [
   "show",
   "hide"
  ],
  "datatypes": [
   "show",
   "hide"
  ]
 },
 "legend": {
  "mode": [
   "numbers",
   "text",
   "tokens"
  ],
  "placement": [
   "right",
   "bottom",
   "none"
  ]
 },
 "publication": {
  "size": [
   "figure",
   "content",
   "a4",
   "letter"
  ],
  "fit": [
   "contain",
   "none",
   "reflow"
  ],
  "overflow": [
   "error",
   "warn"
  ]
 },
 "validation": {
  "mode": [
   "sketch",
   "logical",
   "strict"
  ],
  "unknown_extensions": [
   "warn",
   "error"
  ]
 },
 "export": {
  "mode": [
   "full",
   "redacted"
  ],
  "identifier_mode": [
   "opaque",
   "preserve"
  ],
  "format": [
   "json",
   "sql"
  ]
 }
}
```

Additional validated ranges (all → DDN046 on violation): `font_size` 8–64px; `grid_step` 8–512px; `roughness` 0–3 finite; `hachure` boolean; `seed` integer 0..4294967295; `columns` integer 1..100; `display.depth` integer 0..64; `route_policy` `repair|strict`; `quality` `error|warn`; `object_clearance`/`edge_clearance`/`port_clearance`/`gap`/`row_gap` ≥ 0; `junctions` may only be `explicit`; `shared_segments` may only be `forbidden` (declared bus membership comes from the `network.*` profiles, not routing); `publication.metrics` `required|allow_estimated`; `publication.margin` ≥ 0; `publication.orientation` `portrait|landscape`; `publication.title`/`caption` strings. `notation.registry` must be `"ddn-core@0.2"` or `"ddn-core@0.3"` (DDN045). `spacing` (view/bundle level) must be `tight|normal|loose|expanded` (DDN033).

**`algorithm: auto`** resolves through the placement layer to `layered`; `spanning_tree` maps to the tree pattern; `fit_grid`, `circular`, `radial`, `organic` are pin-preserving pattern placements (`ddn-patterns.js`). Native `layoutNodes` implements `grid`, `manual`, `layered`, `tree`, `mindmap`, `grouped` directly (DDN203 for anything unknown at that layer). `tree` requires a strict single-parent hierarchy (DDN201 on multiple parents/cycles; DDN202 root outside selection); optional `root: @ref` and `hierarchy: [verb,…]` restrict which relations form the hierarchy. `grouped` groups by `group_by` property path (default `kind`) then grids each group. When `algorithm` is `auto|fit_grid|circular|radial|spanning_tree|organic` and no `center` was specified, `center` defaults to `pins` (otherwise `content`).


## 4. Complete vocabulary (machine-extracted)

Every value below was extracted programmatically from `standard/registry/catalogue.json` (version 0.3.0-draft.1) and `standard/registry/profiles/catalogue.json` (runtime 0.6.0-beta.1). Use these EXACT keywords. Aliases and lowercase registry codes are also accepted by the resolver (`DDN.kindEntry`/`DDN.relationEntry` match keyword, lowercase code, or alias).

### 4.1 Core object kinds (152)

`shape` is the registered default presentation (card = rectangular card; activity = rounded card; frame; note = folded annotation; sample = grid; port; cylinder etc.). `defaults` is the registry's documentation-only per-kind default property object: the renderer NEVER applies it implicitly; authoring tools merge it before explicit properties (explicit wins) and write it into source.

| keyword | name | shape | family | aliases | defaults |
|---|---|---|---|---|---|
| object | Unspecified object | card | concept | obj | {} |
| entity | Business entity / concept | card | concept | ent | {} |
| rel | Relationship concept | card | concept | - | {} |
| domain | Semantic domain | card | concept | dom | {} |
| term | Glossary term | card | concept | - | {} |
| enumeration | Enumeration / code set | card | concept | enum | {} |
| rule | Business rule | card | concept | - | {} |
| unit | Unit / quantity definition | card | concept | - | {} |
| aggregate | Aggregate definition | frame | concept | agg | {} |
| context | Bounded context | frame | concept | ctx | {} |
| binding | Representation binding | card | concept | bind | {} |
| identity | Business identity definition | card | concept | key | {} |
| table | Table | card | sql | tbl | {} |
| view | View | card | sql | viw | {} |
| materialized_view | Materialized view | card | sql | mvi | {} |
| foreign_table | Foreign / external table | card | sql | ftb | {} |
| function | Function | card | sql | fun | {} |
| procedure | Procedure | card | sql | prc | {} |
| trigger | Trigger | card | sql | trg | {} |
| sequence | Sequence / identity generator | card | sql | seq | {} |
| sql_domain | SQL domain | card | sql | sdm | {} |
| sql_type | SQL user-defined type | card | sql | typ | {} |
| constraint | Constraint | card | sql | con | {} |
| index | Index | card | sql | idx | {} |
| synonym | Synonym / database alias | card | sql | syn | {} |
| opr | Operator | card | sql | - | {} |
| pkg | Package / module | card | sql | - | {} |
| ext | Database extension | card | sql | - | {} |
| qry | Query definition | card | sql | - | {} |
| pol | Database policy object | card | sql | - | {} |
| pub | Replication publication | card | sql | - | {} |
| sub | Replication subscription | card | sql | - | {} |
| dataset | Logical dataset | card | data | dst | {} |
| record | Record / payload shape | card | data | rec | {} |
| field | Field / attribute / property | card | data | fld | {} |
| collection | Document collection | card | data | col | {} |
| document | Embedded document / object | card | data | doc | {} |
| array | Array / ordered collection | card | data | arr | {} |
| map | Map / dictionary | card | data | - | {} |
| set | Set / unordered collection | card | data | - | {} |
| variant | Union / structural variant | card | data | var | {} |
| graph | Property graph / graph dataset | card | data | grf | {} |
| graph_node | Graph node type | card | data | nod | {} |
| graph_edge | Graph edge type | card | data | edg | {} |
| key_value | Key-value collection | card | data | kvs | {} |
| wide_column | Wide-column family | card | data | wcf | {} |
| time_series | Time-series dataset | card | data | tsr | {} |
| file | File / file object | card | data | fil | {} |
| file_set | File set / table-format dataset | card | data | fls | {} |
| bucket | Object-storage bucket | card | data | buk | {} |
| manifest | Manifest / data-file metadata | card | data | man | {} |
| search_index | Search index / collection | card | data | src | {} |
| vector | Vector collection / index | card | data | vec | {} |
| blob | Blob / binary asset | card | data | bin | {} |
| tensor | Tensor / multidimensional array | card | data | ten | {} |
| rdf | RDF dataset / named graph | card | data | - | {} |
| fact | Fact representation | card | analytics | fct | {} |
| dimension | Dimension representation | card | analytics | dim | {} |
| bridge | Bridge representation | card | analytics | brg | {} |
| cube | Cube / analytic model | card | analytics | cub | {} |
| semantic_model | Semantic model | card | analytics | sem | {} |
| metric | Metric definition | card | analytics | met | {} |
| report | Report | card | analytics | rpt | {} |
| dashboard | Dashboard | card | analytics | dsh | {} |
| data_product | Data product | card | analytics | dpr | {} |
| feature | Feature definition / feature view | card | analytics | ftr | {} |
| model_artifact | Model artifact | card | analytics | mlm | {} |
| export | Extract / export definition | card | analytics | exp | {} |
| api | Data API / interface | card | interface | - | {} |
| endpoint | Endpoint / port definition | card | interface | ept | {} |
| topic | Topic / retained event channel | card | interface | top | {} |
| queue | Queue | card | interface | que | {} |
| message | Message / event schema | card | interface | msg | {} |
| command | Command schema | card | interface | cmd | {} |
| consumer_group | Consumer group | card | interface | cgr | {} |
| subscription | Subscription | card | interface | sbs | {} |
| schema_registry | Schema registry | card | interface | schr | {} |
| connector | Connector definition | card | interface | cnx | {} |
| webhook | Webhook definition | card | interface | whk | {} |
| federation | Federation / query interface | card | interface | fed | {} |
| activity | Activity / transformation | activity | activity | act | {} |
| pipeline | Pipeline / workflow | activity | activity | pip | {} |
| job | Job definition | activity | activity | - | {} |
| run | Run / execution instance | activity | activity | - | {} |
| schedule | Schedule / timer | activity | activity | scd | {} |
| application | Application / data service | card | activity | app | {} |
| query_operation | Query / read operation | activity | activity | qop | {} |
| write_operation | Write / mutation operation | activity | activity | wop | {} |
| checkpoint | Checkpoint / progress marker | card | activity | chk | {} |
| test | Validation / test execution | activity | activity | tst | {} |
| manual_activity | Manual data-handling activity | activity | activity | hum | {} |
| gateway | Decision / routing activity | activity | activity | gat | {} |
| catalog | Catalog / metastore | frame | namespace | cat | {} |
| database | Database | frame | namespace | db | {} |
| schema | SQL schema | frame | namespace | scm | {} |
| keyspace | Keyspace | frame | namespace | ksp | {} |
| namespace | Generic namespace | frame | namespace | nsp | {} |
| workspace | Project / workspace | frame | namespace | prj | {} |
| folder | Folder / prefix | frame | namespace | dir | {} |
| registry | Metadata registry | frame | namespace | reg | {} |
| cloud | Cloud provider / cloud scope | frame | deployment | cld | {"location":"cloud"} |
| cloud_account | Cloud account / subscription | frame | deployment | acc | {} |
| region | Region / geography | frame | deployment | rgn | {} |
| zone | Availability / fault zone | frame | deployment | az | {} |
| site | Local site / data centre | frame | deployment | site | {} |
| network | Network / connectivity zone | frame | deployment | net | {} |
| cluster | Cluster | frame | deployment | clu | {} |
| service | Database / storage service instance | frame | deployment | srv | {} |
| host | Host / machine / VM | frame | deployment | host | {} |
| container | Container / process instance | frame | deployment | ctr | {} |
| volume | Volume / tablespace / filegroup | frame | deployment | vol | {} |
| device | Edge device / sensor | frame | deployment | dev | {} |
| environment | Environment | frame | deployment | env | {} |
| security_zone | Security / trust zone | frame | deployment | secz | {} |
| partition_rule | Partitioning rule | card | distribution | prl | {} |
| partition | Logical partition | card | distribution | par | {} |
| shard | Shard | card | distribution | shd | {} |
| placement | Placement binding | card | distribution | plc | {} |
| replica | Replica / deployed copy | card | distribution | rpl | {} |
| replica_set | Replica set / replication group | card | distribution | rps | {} |
| colocation | Co-location group | frame | distribution | cog | {} |
| cache | Cache representation | card | distribution | cac | {"role":"cache"} |
| log | Durable log / journal | card | distribution | log | {} |
| router | Router / placement directory | card | distribution | bal | {} |
| snapshot | Data snapshot | card | temporal | snp | {"temporal":"snapshot"} |
| backup | Backup artifact | card | temporal | bak | {} |
| archive | Archive dataset | card | temporal | arc | {"role":"archive"} |
| timeline | Timeline / version branch | card | temporal | tln | {} |
| recovery | Recovery plan / recovery point | card | temporal | rcp | {} |
| window | Time window / watermark definition | card | temporal | win | {} |
| history | History representation | card | temporal | hst | {"temporal":"event_history"} |
| retention | Retention / expiry definition | card | temporal | ret | {} |
| organization | Organization / party | card | governance | org | {} |
| team | Team / owner group | card | governance | team | {} |
| role | Role / principal | card | governance | - | {} |
| dct | Data contract | card | governance | - | {} |
| gpo | Governance policy | card | governance | - | {} |
| qlr | Quality assertion | card | governance | - | {} |
| slo | Service-level objective / agreement | card | governance | - | {} |
| entl | Entitlement / grant | card | governance | - | {} |
| cls | Classification definition | card | governance | - | {} |
| prv | Provenance record | card | governance | - | {} |
| dcl | Deletion / legal-hold instruction | card | governance | - | {} |
| note | Note / explanation | note | evidence | note | {} |
| sample | Sample-data grid | sample | evidence | smp | {} |
| fixture | Test fixture / expected output | sample | evidence | fix | {} |
| decision | Decision record | note | evidence | dec | {} |
| issue | Open question / issue | note | evidence | iss | {} |
| observation | Observation / evidence | note | evidence | obs | {} |
| change | Change / migration proposal | note | evidence | chg | {} |
| saved_view | Diagram / saved view | frame | evidence | vie | {} |
| extension | Extension / unknown-kind fallback | note | evidence | extn | {} |

### 4.2 Profile object kinds (77)

Profile kinds carry a `silhouette` drawn by the profile renderer and a core `fallback` kind used for colour/fill derivation. Referenced in source as quoted strings, e.g. `kind: "flow.start";`.

| keyword | name | silhouette | core fallback | family | code |
|---|---|---|---|---|---|
| flow.start | Start | terminal | activity | activity | START |
| flow.end | End | terminal | activity | activity | END |
| flow.process | Process | rect | activity | activity | PROCESS |
| flow.decision | Decision | diamond | activity | activity | DECISION |
| flow.io | Input / output | parallelogram | activity | activity | IO |
| flow.document | Document | document | activity | activity | DOCUMENT |
| flow.subprocess | Predefined process | subprocess | activity | activity | SUBPROCESS |
| dfd.process | Data process | round | activity | data | PROCESS |
| dfd.store | Data store | store | dataset | data | STORE |
| dfd.external | External participant | rect | application | data | EXTERNAL |
| uml.class | Class | rect | application | concept | CLASS |
| uml.interface | Interface | rect | application | concept | INTERFACE |
| uml.package | Package | package | application | concept | PACKAGE |
| uml.component | Component | component | application | concept | COMPONENT |
| uml.actor | Actor | actor | application | concept | ACTOR |
| uml.usecase | Use case | ellipse | application | concept | USECASE |
| req.requirement | Requirement | rect | record | governance | REQUIREMENT |
| req.test | Verification case | round | record | governance | TEST |
| req.implementation | Implementation element | component | record | governance | IMPLEMENTATION |
| analysis.role | Responsible role | rect | team | governance | ROLE |
| analysis.task | Activity / task | round | activity | activity | TASK |
| chen.entity | Entity | rect | entity | concept | ENTITY |
| chen.attribute | Attribute | ellipse | entity | concept | ATTRIBUTE |
| chen.association | Relationship | diamond | entity | concept | ASSOCIATION |
| quality.effect | Effect under investigation | rect | object | concept | EFFECT |
| quality.category | Cause category | rect | object | concept | CATEGORY |
| quality.cause | Possible contributing cause | rect | object | concept | CAUSE |
| state.initial | Initial state marker | initial | object | concept | INITIAL |
| state.state | Lifecycle state | round | object | concept | STATE |
| state.final | Terminal state | final | object | concept | FINAL |
| rule.row | Decision rule | rect | object | concept | ROW |
| uml.subject | Use-case subject | rect | object | concept | SUBJECT |
| flow.connector | Connector | circle | activity | activity | CONNECTOR |
| flow.offpage | Offpage | offpage | activity | activity | OFFPAGE |
| flow.annotation | Annotation | bracket | activity | activity | ANNOTATION |
| flow.storage | Storage | cylinder | activity | activity | STORAGE |
| flow.forkjoin | Fork / join | rect | activity | activity | FORKJOIN |
| flow.objectnode | Object node | rect | record | data | OBJNODE |
| c4.person | Person | actor | role | governance | C4PERSON |
| c4.system | System | round | application | activity | C4SYSTEM |
| c4.container | Container (app/service) | rect | application | activity | C4CONTAINER |
| c4.store | Data store | cylinder | dataset | data | C4STORE |
| c4.queue | Queue/topic | rect | queue | interface | C4QUEUE |
| c4.component | Component | component | application | concept | C4COMPONENT |
| epk.event | Event | hexagon | object | concept | EVENT |
| epk.function | Function | round | activity | activity | FUNCTION |
| epk.connector | Connector | circle | gateway | governance | CONNECTOR |
| flow.gateway | Gateway | diamond | activity | activity | GATEWAY |
| cmmn.stage | Case stage | round | activity | activity | STAGE |
| cmmn.milestone | Case milestone | round | activity | activity | MILESTONE |
| cmmn.sentry | Case sentry | diamond | activity | activity | SENTRY |
| sysml.block | Block | rect | application | interface | BLOCK |
| sysml.constraint | Constraint block | rect | object | concept | CONSTRAINT |
| archi.business_actor | Business actor | actor | team | governance | BIZ_ACTOR |
| archi.business_role | Business role | round | team | governance | BIZ_ROLE |
| archi.business_process | Business process | round | activity | governance | BIZ_PROCESS |
| archi.business_service | Business service | round | application | governance | BIZ_SERVICE |
| archi.business_interface | Business interface | ellipse | application | governance | BIZ_INTERFACE |
| archi.application_component | Application component | component | application | interface | APP_COMPONENT |
| archi.application_service | Application service | round | application | interface | APP_SERVICE |
| archi.technology_node | Technology node | rect | host | deployment | TECH_NODE |
| archi.technology_service | Technology service | round | application | deployment | TECH_SERVICE |
| tree.gate | Logic gate | diamond | gateway | activity | GATE |
| tree.event | Basic event | circle | object | concept | EVENT |
| network.bus | Network bus | rect | network | deployment | BUS |
| network.switch | Network switch | rect | router | deployment | SWITCH |
| network.server | Network server | rect | host | deployment | SERVER |
| network.rack | Equipment rack | rect | device | deployment | RACK |
| ui.frame | Wireframe frame | rect | application | interface | UI_FRAME |
| ui.label | Wireframe label | rect | application | interface | UI_LABEL |
| ui.input | Wireframe input | rect | application | interface | UI_INPUT |
| ui.button | Wireframe button | round | application | interface | UI_BUTTON |
| ui.image | Wireframe image placeholder | rect | application | interface | UI_IMAGE |
| ui.checkbox | Wireframe checkbox | rect | application | interface | UI_CHECKBOX |
| ui.list | Wireframe list | rect | application | interface | UI_LIST |
| family.person | Family person | round | object | concept | PERSON |
| family.union | Partnership union | circle | object | concept | UNION |

### 4.3 Core relationships / verbs (91)

`pattern` is the SVG dash array (`""` = solid). `start`/`end` are default endpoint marks. `self`=allow_self, `member endpoints`=whether field/port-level endpoints are allowed (`member_endpoints: false` → object endpoints only, DDN102). Source/target columns list the endpoint-contract allowed kind keywords (`*` = any). Endpoint violations → DDN102 (or DDN-W102 for unspecified `object` kinds in non-strict modes). Unknown verb → DDN056.

Direction note: governance verbs `reports_to` and profile verb `analysis.decomposes` are parent→child (manager→report, deliverable→part) despite their English keyword reading; tree layouts root at the node with no incoming edge of that kind.

| keyword | verb | family | pattern | start | end | source kinds | target kinds | self | member endpoints |
|---|---|---|---|---|---|---|---|---|---|
| assoc | associated with | structural | "" | none | none | * | * | yes | yes |
| ref | references | structural | "" | none | none | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | yes | yes |
| emb | embeds | structural | "" | diamond | none | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | yes | yes |
| mem | has member | structural | "" | none | none | * | * | yes | yes |
| subtype | specializes | structural | "" | none | triangle | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | yes | yes |
| part | partitioned into | structural | "" | none | none | table, dataset, collection, file, file_set, bucket, replica, replica_set, shard, partition, cache, log, snapshot, backup, archive, history, database, service, host, cluster, key_value, wide_column, time_series, search_index, vector, topic | shard, partition | yes | yes |
| edge | graph edge connects | structural | "" | none | none | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | yes | yes |
| ident | identifies | structural | "" | none | none | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, object | yes | yes |
| same | same business identity | structural | "" | none | none | * | * | yes | yes |
| flow | transfers data to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| read | read produces input for | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, sample, fixture | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| write | writes output to | flow | "" | none | filled | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, sample, fixture | yes | yes |
| replicate | replicates to | flow | "" | none | filled | table, dataset, collection, file, file_set, bucket, replica, replica_set, shard, partition, cache, log, snapshot, backup, archive, history, database, service, host, cluster, key_value, wide_column, time_series, search_index, vector, topic | table, dataset, collection, file, file_set, bucket, replica, replica_set, shard, partition, cache, log, snapshot, backup, archive, history, database, service, host, cluster, key_value, wide_column, time_series, search_index, vector, topic | no | no |
| capture | captures changes into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| publish | publishes to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| deliver | delivers to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| extract | extracts into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| load | loads into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| sync | synchronizes toward | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| snapshot | copies snapshot to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| export | exports to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| import | imports into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| invalidate | invalidates cache via | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| delete | propagates deletion to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| replay | replays into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| restore | restores into | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| reject | routes rejected data to | flow | "" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| depends | depends on | dependency | "2 6" | none | open | * | * | yes | yes |
| calls | calls definition | dependency | "2 6" | none | open | * | * | yes | yes |
| queries | queries interface of | dependency | "2 6" | none | open | * | * | yes | yes |
| refresh | refresh depends on | dependency | "2 6" | none | open | * | * | yes | yes |
| lookup | looks up using | dependency | "2 6" | none | open | * | * | yes | yes |
| uses | uses resource | dependency | "2 6" | none | open | * | * | yes | yes |
| aliases | aliases | dependency | "2 6" | none | open | * | * | yes | yes |
| enforces | enforces constraint on | dependency | "2 6" | none | open | * | * | yes | yes |
| represents | represents | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| instance | instance of | mapping | "9 4 2 4" | none | open | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, catalog, database, schema, keyspace, namespace, workspace, folder, registry, cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, catalog, database, schema, keyspace, namespace, workspace, folder, registry, cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention | no | yes |
| domain | uses semantic domain | mapping | "9 4 2 4" | none | open | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation | domain | yes | yes |
| candidate | candidate domain match | mapping | "9 4 2 4" | none | open | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation | domain | yes | yes |
| binds | has representation binding | mapping | "9 4 2 4" | none | open | domain, binding | binding, sql_domain, sql_type, domain | yes | yes |
| placed | placed on | mapping | "9 4 2 4" | none | open | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, catalog, database, schema, keyspace, namespace, workspace, folder, registry, cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention | cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, database, namespace, volume, placement, replica_set, site | yes | no |
| namespace | member of namespace | mapping | "9 4 2 4" | none | open | * | catalog, database, schema, keyspace, namespace, workspace, folder, registry, bucket | yes | no |
| realizes | realizes partition | mapping | "9 4 2 4" | none | open | replica, table, file, service, database, instance | partition, shard, dataset, table | yes | yes |
| copyof | replica of | mapping | "9 4 2 4" | none | open | table, dataset, collection, file, file_set, bucket, replica, replica_set, shard, partition, cache, log, snapshot, backup, archive, history, database, service, host, cluster, key_value, wide_column, time_series, search_index, vector, topic | table, dataset, collection, file, file_set, bucket, replica, replica_set, shard, partition, cache, log, snapshot, backup, archive, history, database, service, host, cluster, key_value, wide_column, time_series, search_index, vector, topic | no | yes |
| coloc | co-located with | mapping | "9 4 2 4" | none | none | * | * | yes | yes |
| implements | implements | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| exposes | exposes interface | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| version | version of | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| supersedes | supersedes | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| compat | compatible with | mapping | "9 4 2 4" | none | open | * | * | yes | yes |
| bindfield | sample field binds to | mapping | "9 4 2 4" | none | open | sample, fixture | object, entity, rel, domain, term, enumeration, rule, unit, aggregate, context, binding, identity, table, view, materialized_view, foreign_table, function, procedure, trigger, sequence, sql_domain, sql_type, constraint, index, synonym, opr, pkg, ext, qry, pol, pub, sub, dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, api, endpoint, topic, queue, message, command, consumer_group, subscription, schema_registry, connector, webhook, federation | yes | yes |
| trigger | triggers | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| schedule | schedules | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| invoke | invokes execution | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| precede | must precede | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| gate | gates execution of | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| retry | retries | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| ack | acknowledges | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| cancel | cancels | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| failover | activates failover to | control | "10 6" | none | open | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, message, command, rule, decision, issue, schedule, gateway, observation, object, recovery, rule, decision | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device, cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, database, namespace, volume, placement, replica_set, site | yes | yes |
| derives | derives into | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| generates | generates | lineage | "10 4 2 4 2 4" | none | filled | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| consumed | used as input by | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, endpoint, api, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, pipeline, application, device | yes | yes |
| aggregates | aggregates into | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| joins | contributes to join result | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| filters | filters into | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| masks | masks into | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| train | trains | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | model_artifact, activity, pipeline, job | yes | yes |
| feature | computes feature into | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | yes | yes |
| report | contributes to report | lineage | "10 4 2 4 2 4" | none | filled | dataset, record, field, collection, document, array, map, set, variant, graph, graph_node, graph_edge, key_value, wide_column, time_series, file, file_set, bucket, manifest, search_index, vector, blob, tensor, rdf, fact, dimension, bridge, cube, semantic_model, metric, report, dashboard, data_product, feature, model_artifact, export, partition_rule, partition, shard, placement, replica, replica_set, colocation, cache, log, router, snapshot, backup, archive, timeline, recovery, window, history, retention, table, view, materialized_view, foreign_table, topic, queue, message, command, database, keyspace, schema, api, endpoint, pub, sub, activity, pipeline, job, run, schedule, application, query_operation, write_operation, checkpoint, test, manual_activity, gateway, service, connector, webhook, consumer_group, subscription, function, procedure, trigger, qry, device | report, dashboard, metric, data_product, semantic_model, export | yes | yes |
| owns | owned by | governance | "2 4 2 9" | none | open | * | organization, team, role, manual_activity | yes | yes |
| steward | stewarded by | governance | "2 4 2 9" | none | open | * | organization, team, role, manual_activity | yes | yes |
| operate | operated by | governance | "2 4 2 9" | none | open | * | organization, team, role, manual_activity | yes | yes |
| policy | governed by | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| contract | conforms to contract | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| grant | grants access to | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| class | classified as | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| resides | must reside within | governance | "2 4 2 9" | none | open | * | cloud, cloud_account, region, zone, site, network, cluster, service, host, container, volume, device, environment, security_zone, database, namespace, volume, placement, replica_set, site | yes | yes |
| retain | retained under | governance | "2 4 2 9" | none | open | * | retention, gpo, policy, dcl | yes | yes |
| hold | preserved under | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| quality | validated against | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| slo | subject to objective | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| consent | permitted under | governance | "2 4 2 9" | none | open | * | * | yes | yes |
| note | annotates | annotation | "1 5" | none | none | note, issue, observation, decision | * | yes | yes |
| example | illustrates | annotation | "1 5" | none | none | sample, fixture | * | yes | yes |
| evidence | supports assertion about | annotation | "1 5" | none | none | * | * | yes | yes |
| decision | records decision for | annotation | "1 5" | none | none | * | * | yes | yes |
| issue | questions | annotation | "1 5" | none | none | * | * | yes | yes |
| test | tests expectation for | annotation | "1 5" | none | none | * | * | yes | yes |
| appear | appearance of | annotation | "1 5" | none | none | * | * | yes | yes |
| reports_to | has direct report | governance | "" | none | none | organization, team, role, analysis.role | organization, team, role, analysis.role | no | no |

### 4.4 Profile relationships / verbs (31)

| keyword | verb | family | start | end | source kinds | target kinds | self | member endpoints |
|---|---|---|---|---|---|---|---|---|
| flow.next | Control passes to | control | none | filled | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage | no | no |
| dfd.data | Data transfer | data_flow | none | filled | dfd.process, dfd.store, dfd.external | dfd.process, dfd.store, dfd.external | no | no |
| uml.association | Association | structural | none | none | uml.class, uml.interface | uml.class, uml.interface | yes | no |
| uml.generalization | Generalization | structural | none | triangle | uml.class, uml.interface, uml.actor, uml.usecase | uml.class, uml.interface, uml.actor, uml.usecase | no | no |
| uml.realization | Realization | dependency | none | triangle | uml.class, uml.component | uml.interface | no | no |
| uml.dependency | Dependency | dependency | none | open | uml.class, uml.interface, uml.component, uml.package | uml.class, uml.interface, uml.component, uml.package | no | no |
| uml.uses | Participates in | structural | none | none | uml.actor | uml.usecase | no | no |
| uml.include | «include» | dependency | none | open | uml.usecase | uml.usecase | no | no |
| uml.extend | «extend» | dependency | none | open | uml.usecase | uml.usecase | no | no |
| req.satisfies | Satisfies | dependency | none | open | req.implementation | req.requirement | no | no |
| req.verifies | Verifies | dependency | none | open | req.test | req.requirement | no | no |
| req.derives | Derived from | dependency | none | open | req.requirement | req.requirement | no | no |
| analysis.assignment | Responsibility assignment | structural | none | none | analysis.task, activity, flow.process, flow.subprocess | analysis.role, team | no | no |
| analysis.access | Data access | structural | none | none | analysis.task, activity, application, flow.process, flow.subprocess | entity, table, record | no | no |
| analysis.precedes | Must finish before | control | none | open | analysis.task, activity, flow.process, flow.subprocess | analysis.task, activity, flow.process, flow.subprocess | no | no |
| quality.cause | Contributes to | structural | none | none | quality.category, quality.cause | quality.effect, quality.category, quality.cause | no | no |
| state.transition | Event transition | control | none | filled | state.initial, state.state | state.state, state.final | yes | no |
| flow.annotation | Annotates | annotation | none | none | flow.annotation | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage | no | no |
| flow.continues | Continues at | control | none | open | flow.offpage | flow.offpage | no | no |
| c4.rel | Uses / interacts with | dependency | none | open | c4.person, c4.system, c4.container, c4.store, c4.queue, c4.component | c4.person, c4.system, c4.container, c4.store, c4.queue, c4.component | no | no |
| analysis.decomposes | Decomposes into | structural | none | none | analysis.task | analysis.task | no | no |
| epk.next | Control passes to | control | none | filled | epk.event, epk.function, epk.connector | epk.event, epk.function, epk.connector | no | no |
| uml.message | Message | control | none | open | * | * | yes | no |
| uml.flow | Activity edge | control | none | filled | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.forkjoin, flow.objectnode, flow.gateway | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.forkjoin, flow.objectnode, flow.gateway | no | no |
| bpmn.messageflow | Message flow | control | none | open | flow.start, flow.end, flow.process, flow.subprocess, flow.gateway, analysis.task | flow.start, flow.end, flow.process, flow.subprocess, flow.gateway, analysis.task | no | no |
| sysml.flow | Item flow | flow | none | filled | * | * | no | yes |
| archi.rel | serves / relates to | structural | none | open | archi.business_actor, archi.business_role, archi.business_process, archi.business_service, archi.business_interface, archi.application_component, archi.application_service, archi.technology_node, archi.technology_service | archi.business_actor, archi.business_role, archi.business_process, archi.business_service, archi.business_interface, archi.application_component, archi.application_service, archi.technology_node, archi.technology_service | no | no |
| tree.input | has input | control | none | none | tree.gate | tree.gate, tree.event | no | no |
| network.attaches | attaches to | structural | none | none | * | * | no | yes |
| family.partner_of | partner of | structural | none | none | family.person | family.person, family.union | no | no |
| family.parent_of | parent of | lineage | none | filled | family.person, family.union | family.person | no | no |

### 4.5 Diagram profiles (73)

A profile is selected in a view's projection: `projection { kind: graph; profile: "c4.container@1"; }`. `kind` MUST equal the profile's registered projection (DDN-PF002); unknown profile → DDN-PF001. Per-profile enforced rules are in section 6.

| profile id | projection | diagram families | scope | validation | unsupported |
|---|---|---|---|---|---|
| ddn@1 | graph | DDN graph | Existing DDN notation | existing core contracts |  |
| flow.basic@1 | graph | Conventional flowchart, Accounting/audit flowchart | Start/end, process, decision, I/O, document and predefined process; named branches. | start has no incoming edge; end has no outgoing edge; decisions have >=2 distinct nonempty branch labels; every process reachable from a start and can reach an end | execution; complete standardized accounting symbol inventory |
| dfd.gane_sarson@1 | graph | Gane–Sarson DFD | Numbered three-compartment processes; open-ended stores and external entities. | data flows cannot directly connect two non-process elements; process has input/output; unique process numbers | method certification; automatic context balancing across arbitrary diagrams |
| dfd.yourdon@1 | graph | Yourdon-style DFD | Circular processes; parallel-line stores; rectangular external entities. | same structural checks as Gane–Sarson | complete SSADM lifecycle; method certification |
| uml.structure@1 | graph | UML class subset, UML package subset, UML component subset | Class/interface attribute and operation compartments; package tabs; component markers; generalization/dependency/realization. | profile endpoint restrictions; acyclic generalization; same-kind generalization; operation/attribute visibility enumeration | XMI; OCL; full UML type/parameter model; assembly interfaces; formal UML conformance |
| uml.usecase@1 | graph | Use-case diagram subset | Actors, use-case ellipses, associations, include/extend/generalization. | correct actor/use-case endpoints; acyclic include and generalization | extension-point model; full UML behavior semantics |
| requirements.basic@1 | graph | Requirements traceability | Requirement IDs/text, satisfies/verifies/derives links. | nonempty unique requirement codes; compatible verification/implementation endpoints | SysML conformance; evidence of operating effectiveness |
| chen.basic@1 | chen | Chen ER binary subset | Entity rectangles; field-derived attribute ovals with key underlining; binary association diamonds. | scalar attribute projection; binary association mapping with stable provenance | weak entities; n-ary association model; multivalued/derived attributes; faithful all-Chen conformance |
| matrix.raci@1 | matrix | RACI matrix | Rows/roles/cells derived from responsibility relations. | one A and at least one R per row; unique row/column assignment; allowed A/R/C/I values | automatic responsibility inference; complete role-specific workflow app |
| matrix.crud@1 | matrix | CRUD matrix | Processes by data objects; cells from access relations. | nonempty unique subset of C/R/U/D; no duplicate row/column records | database access discovery |
| matrix.relations@1 | matrix | Relationship matrix | Model-to-matrix projection with provenance. | unique row/column slots; explicit duplicate policy | arbitrary SQL pivots |
| panels.basic@1 | panels | SIPOC, SWOT, Business Model Canvas-style panels, Customer journey stages, Planning board | Span-aware fixed column panels containing shared model references. | positive grid spans; no overlapping panel slots; referenced elements exist | nested independent child projections; image-rich cells; responsive widget behavior |
| canvas.bmc@1 | panels | Business Model Canvas | Nine canonical Business Model Canvas blocks on a fixed 10-column grid; span-aware panels with shared model references. | all nine required block panels present (DDN-PJ080); existing panels grid checks (DDN-PJ020/PJ021/PJ009) | strategy evaluation; method certification; image-rich cells |
| canvas.lean@1 | panels | Lean Canvas | Nine canonical Lean Canvas blocks on a fixed 10-column grid; span-aware panels with shared model references. | all nine required block panels present (DDN-PJ080); existing panels grid checks (DDN-PJ020/PJ021/PJ009) | strategy evaluation; method certification; image-rich cells |
| canvas.pest@1 | panels | PEST analysis | Four macro-environment panels (political, economic, social, technological) in one strip. | all four required panels present (DDN-PJ081); existing panels grid checks | environmental/legal extension (use canvas.pestle@1); method certification |
| canvas.pestle@1 | panels | PESTLE analysis | Six macro-environment panels in two rows of three. | all six required panels present (DDN-PJ081); existing panels grid checks | method certification |
| canvas.porter5@1 | panels | Porter five forces | Center competitive-rivalry panel with the four surrounding force panels on a 3-column grid. | all five required panels present (DDN-PJ081); existing panels grid checks | force-weight scoring; method certification |
| canvas.empathy@1 | panels | Empathy map | Says/thinks/does/feels quadrants around a center persona panel; panel items are declared notes. | all five required panels present (DDN-PJ083); existing panels grid checks (DDN-PJ020/PJ021/PJ009) | sentiment inference; UX research method certification |
| canvas.scorecard@1 | panels | Balanced scorecard | Four perspective panels (financial, customer, internal process, learning & growth); each item list states declared objectives. | all four required panels present (DDN-PJ083); existing panels grid checks | KPI computation; target tracking; strategy execution |
| table.records@1 | table | Record table, Decision-table presentation | Typed field-key table bound to explicit records. | path safety; missing policy; record limit | FEEL; hit policy execution; automatic coverage |
| chart.basic@1 | chart | Bar/column, Line, Area, Scatter/bubble, Pie, Doughnut | Native SVG quantitative marks; numeric/categorical coordinates; record provenance. | finite numeric values; consistent units; explicit aggregation; nonnegative arcs; duplicate coordinates rejected | multi-axis; statistics; geo; radar; candlestick |
| chart.radar@1 | chart | Radar/spider | Categorical axes on radial spokes; one shared 0..max scale over all points; one polygon per series; record provenance. | at least 3 distinct categories (DDN-PJ071); finite numeric values, y >= 0 (DDN-PJ072); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031) | multi-axis scales; filled-curvature interpolation |
| chart.funnel@1 | chart | Funnel | Ordered stage bands; widths encode one value per stage; record provenance. | at least 2 distinct stages (DDN-PJ073); nonnegative stage values (DDN-PJ107); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate stage labels rejected (DDN-PJ036) | per-stage conversion rates; curved/necked funnel variants |
| timeline.basic@1 | timeline | Gantt supplied dates, Timeline, Calendar roadmap | UTC date intervals mapped to a fixed axis; milestones and dependency overlays. | valid ISO date-only; end>=start; acyclic dependencies; no model-position pins | scheduling; working calendars; resource leveling; critical-path computation; UML timing |
| fishbone.basic@1 | fishbone | Fishbone / Ishikawa | Cause-to-parent DAG projected onto a spine and measured branches; repeated occurrences retain source identity. | cause cycles, orphan edges, depth/occurrence bounds | causal inference; unbounded branch depth |
| matrix.heatmap@1 | matrix | Heatmap, Risk/priority matrix | Source-derived numeric, categorical or threshold cell encodings with visible missing state. | declared finite scales; typed values; unique cell | implicit ordinal arithmetic; automatic risk policy |
| chart.quality@1 | chart | Grouped/stacked bars, Percentage stacks, Multiseries lines and areas, Actual/target overlay, Histogram, Pareto, Waterfall, Box plot | Shared-scale series/layers and explicit bounded transformations with record provenance. | numeric domains, units, bin boundaries, totals, quartile/whisker conventions | authoritative decimal accounting; general statistical inference; multiple unrelated axes |
| state.flat@1 | graph | Flat lifecycle diagram, Trace validation | One initial state, explicit terminal states, events and typed guards; safe trace evaluator does not execute actions. | reachability, event determinism, terminal rules, trace legality | hierarchical/parallel states; SCXML/UML certification; timers and executable actions |
| decision.rules@1 | decision | Rule decision table | Typed conjunction predicates; unique/first/collect hit policies; bounded partition proof and evaluation. | domain types, overlaps, coverage, shadowing, budgets | FEEL; DMN interchange; unbounded analysis |
| panels.composed@1 | panels | Composed dashboard, Report review page | One level of child views, source mappings, scoped SVG IDs, preserved scales and publication checks. | span collisions; view cycles; child limits; text scale | recursive dashboards; responsive application widgets |
| uml.usecase@2 | graph | Use-case diagram | Adds subjects, extension-point targets, conditions and classifier generalization to the declared subset. | subject references; extension-point existence; condition declaration; acyclic generalization | complete UML behavioral semantics; formal standards certification |
| chen.binary@2 | chen | Binary Chen ER | Composite, derived/multivalued attributes, keys and partial keys, weak entities and identifying binary associations; min/max participant annotations. | field metadata; identifying owner references; participation bounds | n-ary relationships; lossless external format interchange |
| flow.documented@2 | graph | Documented flowchart, Cross-page flowchart | Adds on-page connectors, matched off-page continuations, storage and non-control annotations. | control reachability; annotation separation; continuation contracts | all accounting stencils; workflow execution |
| chart.gauge@1 | chart | Gauge/KPI dial | One percentage value on a semicircular dial with an optional target marker; record provenance. | exactly one record after filtering (DDN-PJ074); value and target finite numbers in 0..100 (DDN-PJ075); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030) | multi-needle dials; custom band colour thresholds; full-circle dials |
| chart.candlestick@1 | chart | Candlestick/OHLC | Supplied open/high/low/close per category or date; wick low-high, body open-close; record provenance. | finite numeric open/high/low/close on every record (DDN-PJ076); high >= low and open/close within [low, high] (DDN-PJ077); explicit x/open/high/low/close bindings (DDN-PJ030); category or date x; numeric x rejected (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate x/category rejected (DDN-PJ036) | intraday tick aggregation; volume columns; financial advice/computation |
| chart.treemap@1 | chart | Treemap | Hierarchical tiles from dotted category paths; slice-and-dice layout; area encodes one value; record provenance. | tile values nonnegative finite numbers (DDN-PJ078, DDN-PJ032); dotted paths of at most 3 levels (DDN-PJ030); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate full path rejected (DDN-PJ036) | squarified layout; zoomable/interactive drill-down; colour-encoded secondary measure |
| chart.sankey@1 | chart | Sankey/flow diagram | Explicit source→target flows; depth columns from pure sources; ribbon thickness encodes value; record provenance. Duplicate (source,target) pairs are allowed: ribbons stack in declaration order. | target is a property binding, not a numeric reference (DDN-PJ030); categorical x only (DDN-PJ030); no aggregation or series binding (DDN-PJ031, DDN-PJ030); endpoints are distinct nonempty category text (DDN-PJ032); flow values are positive finite numbers (DDN-PJ108, DDN-PJ032); flow graph is acyclic (DDN-PJ079) | cyclic flows; multi-port nodes; flow conservation auditing |
| c4.context@1 | graph | C4 system context | People and systems and their interactions; no internal structure, no field-level endpoints. | participants limited to c4.person and c4.system; c4.rel links only; no field-level (member) endpoints; no attribute fields on c4 kinds | automatic model discovery; C4 notation-brand compliance |
| c4.container@1 | graph | C4 container | Containers/stores/queues inside one system boundary frame. | participants limited to c4.container, c4.store, c4.queue plus boundary c4.system and external c4.person; c4.rel links only; exactly one frame scoped to a selected c4.system; members cover every selected interior node; no attribute fields on c4 kinds | multiple boundary systems per view; deployment mapping |
| c4.component@1 | graph | C4 component | Components inside one container boundary frame. | participants limited to c4.component plus boundary c4.container and external c4.person/c4.system/c4.store; c4.rel links only; exactly one frame scoped to a selected c4.container; members cover every selected interior node; no attribute fields on c4 kinds | code introspection; multiple boundary containers per view |
| org.tree@1 | graph | Organisation chart | Single-root reporting hierarchy of org/team/role participants, rendered with the native tree layout. | participants limited to organization, team, role, analysis.role (DDN-PF007); reports_to links only (DDN-PF007); reporting hierarchy is acyclic (DDN-PF004); exactly one root — one node with no incoming reports_to edge (DDN-PJ102); no node has multiple managers (DDN201, layout stage) | matrix organizations (multiple parents); dotted-line reports; HR-system synchronisation |
| wbs.tree@1 | graph | Work breakdown structure | Deliverable-oriented single-root decomposition tree of analysis.task nodes; top-down native tree layout. | participants limited to analysis.task (DDN-PF007); analysis.decomposes links only (DDN-PF007); decomposition is acyclic (DDN-PF004); exactly one root — one node with no incoming analysis.decomposes edge (DDN-PJ102); no node has multiple parents (DDN201, layout stage) | effort/cost rollups; Gantt conversion; resource assignment |
| mindmap.basic@1 | graph | Mind map | Single central topic with alternating left/right branches over concept-family nodes; native mindmap layout. | participants limited to object, entity, term, domain (DDN-PF007); assoc links only (DDN-PF007); layout algorithm must be mindmap (DDN-PF007); branch hierarchy is acyclic (DDN-PF004); exactly one root — one node with no incoming assoc edge (DDN-PJ102); no node has multiple parents; declared root must be a hierarchy root (DDN201, DDN202, layout stage) | free-floating secondary roots; cross-links between branches; node images/icons |
| concept.map@1 | graph | Concept map | Concept-family nodes joined by explicitly labelled structural links; labels are mandatory, not inferred. | participants limited to object, entity, term, domain (DDN-PF007); assoc and ref links only (DDN-PF007); every selected relation carries an explicit author-written label, not the verb default (DDN-PJ104) | label inference from endpoints; automatic layout to ontology standards; OWL/RDF export |
| epc.basic@1 | graph | Event-driven process chain (EPC) | Events and functions strictly alternating through and/or/xor connectors; control flow via epk.next. | participants limited to epk.event, epk.function, epk.connector (DDN-PF007); epk.next links only (DDN-PF007); events and functions must alternate; event-to-event and function-to-function edges are forbidden (DDN-PJ105); every epk.connector carries x_epc.operator of and/or/xor; x_epc.operator on a non-connector is forbidden (DDN-PJ106); EPC symbols have labels, not attribute compartments (DDN-PF003) | process simulation; BPMN interchange; connector fan-in/fan-out balancing rules |
| matrix.bcg@1 | matrix | BCG growth-share matrix | Two market-growth rows (high, low) by two relative-share columns (high, low); quadrant cells are declared relations with value-list content. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) | market-share computation; portfolio advice |
| matrix.ansoff@1 | matrix | Ansoff matrix | Market rows (existing, new) by product columns (existing, new); cells are declared strategy items. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) | strategy recommendation; market analysis |
| matrix.tows@1 | matrix | TOWS matrix | Internal rows (strength, weakness) crossed with external columns (opportunity, threat); cells are strategy notes. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) | SWOT inference; strategy recommendation |
| panels.journey@1 | panels | Customer journey map | Ordered phase columns; actions/touchpoints/opportunities lanes; one full-width emotions lane whose declared 1..5 values render as a straight-segment polyline. | phase grid contract (DDN-PJ085); emotion values in 1..5 (DDN-PJ084); existing panels grid checks | curve smoothing; per-channel heatmaps; automatic sentiment analysis; nested child views |
| matrix.storymap@1 | matrix | User story map | Ordered release rows (top = first release) by ordered backbone-activity columns; cells are declared analysis.task story objects with provenance. | cells reference selected analysis.task stories (DDN-PJ093); no story in two releases (DDN-PJ086); existing matrix checks | estimation/velocity math; backlog ranking; tracker synchronization |
| erd.crowfoot@1 | graph | Crow's-foot ERD | Entity/table graph where every ref/assoc relation carries explicit crow's-foot source_mark and target_mark cardinality (one, zeroone, many, zeromany). | every view relation is ref or assoc with both cardinality marks (DDN-PJ087); unknown mark strings remain DDN114; existing core contracts | min/max beyond the four marks (use source_min/target_max properties); identifying-relationship semantics (see chen.binary@2); schema generation without an allowlist (see RT-020) |
| panels.pyramid@1 | panels | Pyramid / hierarchy tiers | 3..5 horizontal bands stacked widest-at-bottom as trapezoid polygons; centered band labels; optional per-band side annotations from declared items. | band count 3..5 and contiguous one-column rows (DDN-PJ089); existing panels grid checks | 3D/pyramidal charts with values; auto-sizing from data; nested child views |
| panels.venn@1 | panels | Venn diagram (2 or 3 sets) | Two or three declared set panels; members declare x_sets; region labels show declared membership counts at fixed positions. | exactly 2 or 3 sets (DDN-PJ090); x_sets present and consistent with panel listings (DDN-PJ091); existing panels grid checks | 4+ sets; area-proportional geometry; item names inside regions (counts only in v1) |
| uml.sequence@1 | sequence | Sequence-style interaction | Participants in declaration order with lifelines; messages in declaration order with dashed returns and activation bars; record provenance. | message endpoints are selected participant objects (DDN-PJ110); participants without messages warn (DDN-PJW03) | combined fragments (alt/loop/opt); gates, creation/destruction and execution specifications; full UML conformance |
| uml.communication@1 | graph | Communication/collaboration-style interaction | Graph layout of interaction participants; author-declared message numbers on relation edges; replies dotted under their request. | every visible uml.message carries a well-formed x_message.seq (DDN-PJ111); reply numbering is dotted under the request (DDN-PJ111) | combined fragments; timing constraints; full UML conformance |
| uml.object@1 | graph | Object/instance snapshot | Record instances naming a classifier; slots rendered as field rows; plain assoc links between instances. | instance slots must exist on the classifier when the classifier declares fields (DDN-PJ112) | object identity semantics beyond labels; slot datatype checking; full UML conformance |
| state.composite@1 | graph | Hierarchical/composite state diagram | Composite states as frames containing substates; dashed parallel regions; boundary-crossing transitions with event/guard labels. | at most one initial state per region (DDN-PJ113) | trace evaluation (state.flat@1 only); history pseudostates; SCXML/UML conformance; timers and executable actions |
| uml.activity@1 | graph | Activity-style flow with partitions | Flow nodes plus fork/join bars and object nodes; swimlane partitions as view frames with declared node membership. | node in an unknown partition rejected (DDN-PJ114); fork/join counts must balance (DDN-PJ115) | interruptible regions; pins and parameter sets; full UML conformance |
| bpmn.basic@1 | graph | BPMN-style process collaboration | Pools and lanes as frames; typed start/end events; exclusive/parallel/inclusive gateways; dashed message flow allowed only across pools. Profile-level coverage, not BPMN conformance. | message flow within one pool rejected (DDN-PJ116); gateways declare their type (DDN-PJ117) | BPMN XML interchange; choreography and conversation diagrams; executable process semantics; full BPMN conformance |
| uml.timing@1 | timing | Timing/state-over-time diagram | One band per participant; state plateaus from declared time points; numeric time axis; supplied data only. | x_states present, well-formed and strictly chronological (DDN-PJ118) | duration and slew-rate annotations; clock/unit conversion; full UML conformance |
| uml.interaction_overview@1 | graph | Interaction overview | Flowchart of interaction steps; flow nodes may reference other workspace views and render a ref badge; targets are not expanded. | referenced views must exist in the workspace (DDN-PJ119) | inline expansion of referenced views; full UML conformance |
| cmmn.basic@1 | graph | CMMN-style case diagram | Stages as scoped frames of plan items; rounded milestones; entry/exit sentries on stage membership. Profile-level coverage, not CMMN conformance. | sentries must belong to a stage frame and declare entry/exit (DDN-PJ120) | CMMN XML interchange; case execution semantics; discretionary items; full CMMN conformance |
| sysml.bdd@1 | graph | Block definition-style view | Blocks and their associations. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121) | SysML XMI interchange; full SysML conformance; compartment typing beyond field rows |
| sysml.ibd@1 | graph | Internal block-style view | Blocks with declared border ports and typed item flows. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121) | SysML XMI interchange; full SysML conformance; flow property propagation |
| sysml.parametric@1 | graph | Parametric constraint view | Constraint blocks carrying formula text, each bound to exactly two endpoints. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121); constraints bind exactly two endpoints (DDN-PJ122) | equation solving or evaluation; SysML XMI interchange; full SysML conformance |
| archimate.basic@1 | graph | Layered enterprise-architecture overview | Fixed nine-kind business/application/technology vocabulary; family-palette layer colours; viewpoints as named views; serving links upward only. Profile-level coverage, not ArchiMate conformance. | relation layer pair must be legal per the fixed 3×3 table (DDN-PJ123) | ArchiMate exchange format; relationship derivation machinery; full ArchiMate conformance |
| pert.cpm@1 | graph | PERT/CPM critical-path view | Tasks with declared day estimates and finish-before dependencies; computed forward/backward pass; zero-slack critical path accented. | dependency cycles rejected (DDN-PJ124); every task carries a finite nonnegative x_estimate (DDN-PJ125) | resource leveling; calendar-aware scheduling; probabilistic (three-point) estimation |
| fault.tree@1 | graph | Fault tree | AND/OR gate decomposition of a top event into basic events; tree layout. | every gate declares and/or and has at least two inputs (DDN-PJ126) | probability quantification; minimal cut-set computation; reliability certification |
| event.tree@1 | graph | Event tree | Initiating event followed forward through gate branches to outcomes; tree layout. | every gate declares and/or and has at least two inputs (DDN-PJ126) | probability quantification; sequence branching fractions; reliability certification |
| network.basic@1 | graph | Network/bus overview | Bus segment with declared attachments; switch/server kinds; original DDN glyphs. | attachments target a bus or a port (DDN-PJ127) | routing-geometry bus/junction networks (DDN046 remains); vendor icon sets; auto-discovery/topology scanning |
| network.rack@1 | graph | Rack elevation | Rack frames with declared 1U slot numbers; devices pinned bottom-up. | attachments target a bus or a port (DDN-PJ127); slot numbers within rack height and unique per rack (DDN-PJ127) | exact 1U geometric rendering; weight/power/thermal planning |
| wireframe.ui@1 | graph | Low-fidelity UI wireframe | Fixed seven-control stencil as plain rect variants; nesting via scoped frames; classic look with neutral grey palette. | controls outside any ui.frame produce warning DDN-PJ128 | responsive behavior; real widget toolkit export; pixel-exact mockup fidelity; image fetching |
| family.tree@1 | graph | Family tree / genealogy | Persons with optional birth/death years; partnerships via partner links or small union join nodes; ancestors above descendants; acyclic lineage with at most two parents. | parent_of cycles rejected (DDN-PJ129); more than two parents rejected (DDN-PJ130) | GEDCOM or other external interchange; adoption/step-family nuance beyond the two-parent rule; records verification |

### 4.6 Endpoint marks (12; set via `source_mark:` / `target_mark:` on relations)

Structural participation marks (`one`, `zeroone`, `many`, `zeromany`, `diamond`, `triangle`) are allowed only on `structural`-family relations (DDN114). Unknown mark → DDN114.

| mark | name | meaning |
|---|---|---|
| none | Plain endpoint | No direction or multiplicity is asserted. |
| open | Open arrow | Direction of dependency, mapping, control or governance; read the verb. |
| filled | Filled arrow | Forward payload movement or forward derivation; line pattern disambiguates. |
| triangle | Hollow triangle | Generalization: points toward the more general type. |
| diamond | Filled diamond | Embedding: at the containing end, not at the child end. |
| one | Exactly one | Two bars: minimum one and maximum one. |
| zeroone | Zero or one | Circle plus bar: optional single participation. |
| many | One or more | Bar plus crow foot: mandatory plural participation. |
| zeromany | Zero or more | Circle plus crow foot: optional plural participation. |
| range | Explicit range | Numeric min..max replaces ambiguous or nonstandard multiplicity marks. |
| port | Port attachment | Attach to an identified interaction point or field, not arbitrary geometry. |
| junction | Explicit junction | A filled routing junction; crossing lines without a dot are not joined. |

### 4.7 Object families, relation families, maturity, view types

| family | meaning |
|---|---|
| concept | Meaning & domains |
| sql | SQL objects |
| data | Data structures |
| analytics | Analytics & products |
| interface | Interfaces & messaging |
| activity | Activities & execution |
| namespace | Namespaces |
| deployment | Deployment & location |
| distribution | Distribution & copies |
| temporal | Time & recovery |
| governance | Ownership & governance |
| evidence | Examples & evidence |

| relation family | meaning | default style |
|---|---|---|
| structural | Relations between structures or records; cardinality endpoints are permitted. | pattern "", colour #334155 |
| flow | Data moves in the arrow direction. Mechanism and guarantees are separate facets. | pattern "", colour #006D77 |
| dependency | Source requires or references target; this does not assert data transfer. | pattern "", colour #596579 |
| mapping | A labeled mapping such as instance-of, domain-use or placement. | pattern "", colour #285EA8 |
| control | Source activates, controls or gates target; not a payload flow. | pattern "", colour #8A5200 |
| lineage | Upstream source to derived result; the implementation path may be hidden. | pattern "", colour #86415D |
| governance | Responsibility or policy relation with a mandatory verb or registered discriminator. | pattern "", colour #526525 |
| annotation | Evidence or explanation attaches to an element; no execution is implied. | pattern "", colour #64748B |

| maturity code | name | meaning | colour |
|---|---|---|---|
| UNK | Undecided | No decision has been made about this facet. | #64748B |
| DRF | Draft | A proposed definition still being designed. | #986000 |
| REV | In review | A proposal being reviewed, not yet approved. | #704799 |
| APR | Approved | Approved design state; does not mean deployed or healthy. | #1E7047 |
| DEP | Deprecated | Still identifiable but discouraged for future use. | #9D4A29 |
| RET | Retired | Retired from intended use; retained history may still exist. | #596579 |
| REJ | Rejected | A rejected design alternative, not an operational failure. | #A52A35 |

The 20 standard view types (V01–V20, the intended diagram families of the core vocabulary):

| code | view type | intent |
|---|---|---|
| V01 | Whiteboard / conceptual sketch | Unspecified objects, named relations, notes and optional fields. |
| V02 | Conceptual ER / business information | Entities, meanings, business cardinality and bounded contexts. |
| V03 | Logical relational schema | Tables or relations, fields, keys and structural relationships. |
| V04 | SQL-object dependency | Views, routines, policies, indexes and their dependencies. |
| V05 | Document / nested / variant schema | Embedding, arrays, optional properties, variants and references. |
| V06 | Graph / key-value / wide-column | Graph edges, key/value shapes and access-key roles. |
| V07 | Domain discovery / type binding | Field occurrences, candidates, approved domains and platform bindings. |
| V08 | Namespace / catalog organization | Databases, schemas, names, aliases and registries. |
| V09 | Deployment / distribution topology | Instances, locations, fragments, replicas and placement mappings. |
| V10 | Data-flow / process decomposition | Sources, activities, stores, interfaces and balanced boundary ports. |
| V11 | Streaming / publication / integration | Channels, consumers, capture, transport, transformations and guarantees. |
| V12 | Lineage / provenance | Upstream inputs, activities, outputs, evidence and responsible agents. |
| V13 | Temporal / history / point-in-time | Time axes, versions, correction examples and retention scope. |
| V14 | Analytics / warehouse / semantic model | Fact grain, dimensions, metrics, products and consumption. |
| V15 | ML / vector / feature lineage | Training sources, features, embeddings, model artifacts and serving. |
| V16 | Governance / ownership / contract | Owners, policies, classifications, interfaces and obligations. |
| V17 | Security / residency / trust | Access scopes, boundaries, approved locations and protected flows. |
| V18 | Backup / recovery / continuity | Snapshots, backups, logs, recovery targets and failover activities. |
| V19 | Migration / evolution / target state | Observed and intended instances, version mappings and cutover flows. |
| V20 | Quality / examples / operational evidence | Sample grids, tests, SLOs, observations and unresolved questions. |

### 4.8 Registered data properties (99; chapter-10 contract vocabulary)

These are the reserved semantic property keys for elements/fields/ports/relations. Unknown non-`x_` keys are preserved with warning DDN-W106 (logical) or rejected DDN106 (strict). Boolean-ish properties `nullable`, `optional`, `allow_extra` must be boolean or an explicit state atom (DDN107); `presence` is `required|optional` or a state (DDN107); `domain` must resolve to a `domain` element (DDN108); `level` is `concept|definition|instance|fragment|copy` or a state (DDN109); field `shape` is `scalar|object|record|array|map|set|variant` (DDN112); `shape: variant` requires ≥2 distinct `variants` names plus an explicit `discriminator` (DDN113).

| property | targets | value shape | constraint |
|---|---|---|---|
| uid | element, field, port, relation | nonempty string | Workspace-unique stable identity; compare exactly, do not fetch it as a URL. |
| description | element, field, port, relation | string | Literal explanatory content, never executable markup. |
| aliases | element, field, port, relation | string[] | Alternative display/search names; do not introduce duplicate semantic identities. |
| kind | element | registered kind keyword | Canonical registry ID after alias resolution; display look cannot change it. |
| level | element | concept/definition/instance/fragment/copy | Omission is permitted in sketches; a view occurrence is not a data level. |
| maturity | element | draft/review/approved/deprecated/retired/rejected or undecided | Independent of style, runtime health and evidence. |
| meaning | element | string | Semantic definition; no implicit datatype selection. |
| workload | element | array of oltp/olap/mixed/streaming/batch | An explicitly mixed workload may carry multiple compatible values. |
| role | element | authoritative/derived/cache/archive/primary/follower | Include authority or replica scope where claimed; incompatible roles require distinct assertions. |
| location | element | local/cloud/edge | Applicable to deployment scopes and instances; not automatic placement for abstract concepts. |
| distribution | element | hash/range/list/composite/unpartitioned | Requires a declared partition policy before physical implementation claims. |
| representation | element | reference or structured record | Domain-to-platform representation, not a universal datatype. |
| shape | field | scalar/object/record/array/map/set/variant | Structural category; optional nested fields do not imply a separate stored object. |
| key | field | primary/candidate/business/partition/clustering | A shorthand single key role. Composite/multiple roles require referenced key definitions. |
| domain | field | reference to semantic domain | Established meaning binding, not a candidate suggestion or an SQL datatype. |
| datatype | field | string or representation binding reference | Physical profile interprets it; parser never assumes a vendor type universally exists. |
| presence | field | required/optional | Required presence and nullable values are independent. |
| nullable | field | boolean | True permits null; it does not mean the property can be absent. |
| min_items | field | nonnegative integer | Arrays/sets; must not exceed max_items when finite. |
| max_items | field | nonnegative integer or unbounded | Arrays/sets; is not maximum rows in a dataset. |
| ordered | field | boolean | A set defaults are not invented from examples; ordering scope must be explicit. |
| unique | field | boolean | State whether item identity/value uniqueness is intended; enforcement is separate. |
| default | field | literal or expression record | Record distinguishes a literal value from code; drawing never evaluates it. |
| generated | field | expression record | Name language, text and evaluation scope; no evaluation during rendering. |
| discriminator | field | field reference | Union variants must specify unique matching cases where closed/discriminated. |
| variants | field | reference[] | Each target is a shape definition; mutual recursion must be represented without infinite expansion. |
| allowed_values | domain, element | literal[] or enumeration reference | Exhaustive only when explicitly declared; never inferred from samples. |
| unit | domain, element | unit definition reference | Quantity meaning, conversion and precision are defined by the unit profile. |
| normalization | domain, element | rule reference or record | Does not silently transform identifiers or literal source sample values. |
| equality | domain, element | rule reference or string | Explicit comparison scope; physical collation binding can differ by platform. |
| platform | domain, element | string | Binding applicability, not a remote service to contact. |
| platform_version | domain, element | string | Physical profile version; cannot be replaced silently by latest. |
| precision | domain, element | nonnegative integer | Applicable representation specifies decimal/binary/significant-digit interpretation. |
| scale | domain, element | integer | Applicable numeric binding supplies units and valid range. |
| kind | relation | registered relation keyword | Normalizes to a fixed family, verb, orientation and compatible endpoints. |
| source_mark | relation | registered structural endpoint | Valid only where relation semantics permit participation or composition. |
| target_mark | relation | registered structural endpoint | At target B describes how many B instances per one A; never packet count. |
| enforcement | relation | database/application/expected/none or undecided | A drawn relation does not imply database enforcement. |
| scope | relation | string or reference | Authority, delivery, ordering or other qualifier's named scope. |
| source_min | relation | nonnegative integer | Structural participation lower bound at source; must not exceed finite source_max. |
| source_max | relation | nonnegative integer or unbounded | Explicit bounds supersede compact endpoint shorthand only consistently. |
| target_min | relation | nonnegative integer | Structural participation lower bound at target. |
| target_max | relation | nonnegative integer or unbounded | Explicit numeric limits must agree with compact displayed symbols. |
| capture | flow, relation | cdc/snapshot/polling/application/manual | Capture method is separate from transport and transformation. |
| transport | flow, relation | string or channel reference | For example kafka; no delivery guarantee is inferred from the name. |
| transformation | flow, relation | string or activity reference | An overview description should refine to activities when detailed validation is required. |
| cadence | flow, relation | continuous/batch/microbatch/on_demand | Schedule/timezone is additional when relevant. |
| delivery | flow, relation | requirement/evidence record or undecided | Delivery record fields required and verified remain independent assertions. |
| payload | flow, relation | shape reference | Payload identity/version, not a copy of the schema inside every connector. |
| ordering | flow, relation | scope record | Total/per-key/per-partition ordering must identify the relevant stream and key. |
| initial_load | flow, relation | flow/activity reference | Initial snapshot/catch-up coordination is not implied by CDC. |
| delete_handling | flow, relation | rule/reference | Explicit deletion/tombstone policy; drawing an arrow does not establish completeness. |
| retry | flow, relation | policy record/reference | Attempts, backoff and exhaustion target; not an execution loop inferred from geometry. |
| freshness | flow, relation | duration requirement/evidence record | Duration is measured relative to the declared clock and observation point. |
| temporal | element, flow | current/valid/recorded/bitemporal/event_history/snapshot | Temporal categories do not imply PITR or complete reconstructability. |
| time | element, flow | structured time-axis record | Keyed valid and recorded axes or overview descriptions; production requires field/system/interval details. |
| time.valid | element, flow | axis record | Contains start/end field refs, business clock, interval semantics and open-end representation. |
| time.recorded | element, flow | axis record | Contains start/end fields, named recording system and correction semantics. |
| time.retention | element, flow | duration or policy reference | Retention scope must identify which axes, rows, logs or snapshots it covers. |
| time.event | element, flow | field reference | Occurrence time; distinct from arrival and processing timestamps. |
| time.arrival | element, flow | field reference | Ingestion timestamp of a named system; not automatically business-valid time. |
| time.processing | element, flow | field reference | Processing timestamp tied to an execution/system. |
| snapshot_at | element, flow | timestamp or version reference | Consistency scope and source completeness must be explicit for recovery claims. |
| recovery_window | element, flow | interval/policy record | PITR scope, oldest/newest recoverable state, backup/log evidence. |
| provider | element | string | Provider identity; never infer region or capabilities from a logo. |
| region | element | reference or string | Scope within provider/account; not a globally unique bare region token. |
| environment | element | string/reference | Intended environment; production does not imply healthy. |
| partition_key | element | ordered field references | All fields belong to the partitioned definition or an explicit mapping. |
| partition_rule | element | rule reference/record | Hash/range/version and boundaries are explicit policy information. |
| replication_factor | element | positive integer | State whether the primary is counted and which fragment/set the count applies to. |
| replica_role | element | primary/follower/multiwriter | Belongs to a copy with named coordination scope and observation time when observed. |
| consistency | element | policy record | Scope must specify read/write/replication semantics rather than one unlabeled word. |
| residency | element | policy/reference | Allowed locations and evidence are separate; a frame alone is not proof. |
| owner | element, field, relation | responsible-party reference | Responsibility relationship, not physical containment. |
| classification | element, field, relation | classification reference/string | Inheritance only under an explicitly selected governance profile. |
| contract | element, field, relation | contract reference | Contract version and producer/consumer roles remain resolvable. |
| quality | element, field, relation | rule/assertion references | Validation result and requirement are independent. |
| dialect | element, field, relation | string | SQL dialect/platform profile; syntax is not executed by the renderer. |
| definition | element, field, relation | text/code-reference record | Explicit content/language; remote content is not fetched without resolver authority. |
| parameters | element, field, relation | parameter-definition references | Parameters are not mislabeled as storage columns. |
| refresh | element, field, relation | policy record | Materialized view refresh method, schedule and scope. |
| index_method | element, field, relation | string | Validated only against the selected platform/version profile. |
| mode | sample | synthetic/sanitized/observed/expected/counterexample | A sample's role controls validation expectations and disclosure rules. |
| columns | sample | ordered field references | Every entry resolves to a field identity, not a coincidental displayed name. |
| rows | sample | arrays of literal values | Each row has exactly columns.length cells. Null and missing stay distinct. |
| source | sample | evidence reference/string | Required for observed samples; no implicit authorization to publish the contents. |
| model_revision | sample | revision reference/string | The design context of the example, not the time in its data cells. |
| expected | sample | result/assertion references | Required when a sample is promoted to an executable test fixture. |
| subject | assertion | reference | Object, field, relation or other asserted subject. |
| property | assertion | property-path string | Resolvable in the selected property/extension profile. |
| value | assertion | typed value | Must match the property's applicable value contract when known. |
| state | assertion | known/undecided/not_applicable/conflicting | Absent is no assertion; hidden is only a view operation. |
| basis | assertion | intended/observed/inferred/measured/verified | Requirements and measurements never overwrite each other implicitly. |
| source | assertion | evidence reference/string | Mandatory for observed/measured/verified assertions. |
| observed_at | assertion | timestamp string | Explicit timezone/offset for absolute instants; never guessed from browser locale. |
| confidence | assertion | number in [0,1] or confidence scheme | Only meaningful with declared method; not a substitute for evidence. |
| direction | port | input/output/inout | Relation orientation still comes from the connector; direction restricts compatible use. |
| payload | port | shape reference | Names the contract at an interface. |
| binding | port | field/port/element reference | Balanced collapsed views map each external port to a real internal interface. |

### 4.9 Registered `x_*` extension properties (extension contracts, from `ddn-profiles.js` + core registry)

| extension | applies to | contract |
|---|---|---|
| `x_record` | object, relation | object, additional properties allowed (record/metadata payload, e.g. `{month, value, unit}`) |
| `x_story` | relation | object, requires `task`, additional properties allowed |
| `x_rule` | object, relation | object (decision-table rule: `{when: {...}, then: {...}}`) |
| `x_state` | object, relation | object (`{terminal: boolean}`; only on `state.*` kinds) |
| `x_transition` | object, relation | object (`{event, guard, actions}`) |
| `x_usecase` | object, relation | object (`subjects` refs / `extension_points` on objects; `extension_point`, `condition`|`condition_ref` on `uml.extend` relations) |
| `x_chen` | object, field, relation | object (Chen metadata; see section 6) |
| `x_continuation` | object, relation | object (`{key, side: in|out, page?}`) |
| `x_assignment` | relation | `{code: string(1..12)}` only |
| `x_category` | object | `{axis: string, level: string}` exactly |
| `x_member` | field | `{kind: attribute|operation, visibility: public|private|protected|package, static: bool, abstract: bool}` |
| `x_diagram` | object, relation | `{number?, owner?, code?, text?, branch?, stereotype?}` only |
| `x_epc` | object | `{operator: string}` (must be `and|or|xor` on `epk.connector`; forbidden elsewhere) |
| `x_sets` | object | array of 1..3 unique strings (venn membership) |
| `x_return` | relation | boolean (sequence/communication reply) |
| `x_message` | relation | `{seq: string}` (dotted-decimal sequence number) |
| `x_instance` | object | requires `classifier` (ref) |
| `x_partition` | object | `{lane: string}` exactly |
| `x_event` | object | `{type: none|message|timer|error}` |
| `x_gateway` | object | `{type: exclusive|parallel|inclusive}` |
| `x_states` | object | array of `{at: number, state: string}` (timing; strictly increasing `at`) |
| `x_subdiagram` | object | `{view: string}` (interaction-overview node → view id) |
| `x_sentry` | object | `{on: entry|exit}` |
| `x_estimate` | object | number (CPM duration in days) |
| `x_gate` | object | `{type: and|or}` |
| `x_rack` | object | `{units: int≥1, unit: int≥1}` |
| `x_birth` / `x_death` | object | integer years |
| `x_erp` | object (table), relation (ref) | ERP metadata: `primary_key`, `unique_keys` (field-local tuples, DDN110), `scope: company` requires `company_id`; relation side: `join_fields` naming target fields, `same_company`, `enforcement: database` requires same database on both ends (DDN116) |
| `x_workflow` | object | state machine contract: `states`, `initial`, `terminal[]`, `transitions[]` (`{id, from, to, event, guard?, max_visits?}`); validated per DDN130 (unique states, reachable, terminal states sink, same-event branches need distinct equality guards on one field, cycles need a `max_visits`-bounded edge) |
| `x_boundary` | object | DFD-style balanced boundary: `ports[]` + `bindings[]` mapping external↔internal ports 1:1 with matching `direction` and `payload` (DDN131–133) |
| `x_requirement` | object | `{id, owner, acceptance, state: proposed|required|accepted|rejected|waived, evidence[]}`; accepted/waived requires evidence referencing `x_evidence` elements (DDN134/135) |
| `x_evidence` | object | `{method, scope, observed_at, subject_hash, result: pass|fail|not_run, artifact_digest?}`; `pass` requires `artifact_digest` (DDN136) |
| `x_affinity` | object | `{rules: [{left, right, op: eq}], enforcement: database|command|reconciliation}` (DDN137) |
| `x_reconciliation` | object | `{owner, idempotency_key, states: [pending, accepted, rejected, compensated], timeout, compensation, evidence}` (DDN138) |
| `x_custody` | object | requires `anchor_authority`, `key_custodian`, `retention_policy`, `hold_policy`, `independent_evidence` (DDN139) |
| `x_constraint` | object | `{unique: [[f,…]], non_overlap: {partition_by, from, to, bounds: half_open}, immutable_when: <guard>, enforcement: database|command|reconciliation|fixture_only}` (DDN140) |
| `x_ui` | object | `{bindings: [{control, field}] (unique control, existing field), commands: [{id, authorization, validation, concurrency, failure, audit}]}` (DDN141) |
| `x_report` | object | `{grain, cutoff, reconciliation, columns: [{name, sources: [field refs], aggregation: none|sum|count|min|max|average}]}` (DDN142) |

Unregistered `x_*` keys: preserved with warning DDN-W103 in logical mode; error DDN103 in strict mode or with `validation.unknown_extensions: error`. The extension-schema vocabulary is a small explicit subset (const/enum/type/required/properties/additionalProperties/min/max/length/items/allOf/anyOf/oneOf), not full JSON Schema; violations fail DDN105.

## 5. Projections (view-level `projection` blocks)

`projection.kind` values: `graph` (default), `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`, `fishbone`, `decision`, `sequence`, `timing` (anything else → DDN-PJ001). Every projection property must be legal for its kind — no silently ignored settings (DDN-PJ005). Allowed keys per kind (`ddn-projection-data.js supported`):

```json
{"graph":["kind","profile","inputs","analysis_budget","traces"],"fishbone":["kind","profile","width","height","effect","relation"],"decision":["kind","profile","width","height","records","inputs","outputs","hit_policy","coverage","analysis_budget","filter","order"],"chen":["kind","profile","width","height"],"matrix":["kind","profile","width","height","write_data","rows","columns","relation","value","duplicates","encoding"],"table":["kind","profile","width","height","records","columns","filter","order","missing"],"panels":["kind","profile","width","height","columns","panels","value"],"chart":["kind","profile","width","height","records","mark","x","y","x_type","size","unit","aggregate","filter","order","missing","inner_radius","series","series_missing","arrangement","transform","layers","bins","normalize","outside","whiskers","quartiles","step","baseline","target","open","high","low","close"],"timeline":["kind","profile","width","height","records","start","end","label","dependencies","filter","order"],"sequence":["kind","profile","width","height"],"timing":["kind","profile","width","height"]}
```

Common rules: `width`/`height` hints 240..12000 px (DDN-PJ006); measured result extent ≤ 50000 px (DDN-PJ060); reference arrays hold 1..500 unique refs (DDN-PJ009); every bound element must be in the data scope (DDN-PJ007) AND selected in the view (DDN-PJ008); binding strings are dot-separated safe property paths like `x_record.value`, or the special element properties `name`, `id`, `kind` (unsafe paths → DDN-PJ004); filters are `{key, op: eq|in, value}` only (DDN-PJ011); ordering is `{key, direction: asc|desc}` (DDN-PJ011); filtering may not empty the selection (DDN-PJ012). **All non-graph/chen projections are data-bound**: they reject `place`/`route`/`frame`/`subdiagram` geometry and any retained layout state (DDN-PJ002, DDN-PJ051), and cannot combine with interaction (`x_interaction`) layout.

Per-kind summary:

- **graph**: the default. `profile: "ddn@1"` plain DDN, or any graph profile id from the table in 4.5 (section 6 lists enforced rules). `inputs`/`analysis_budget`/`traces` are legal only with `profile: "state.flat@1"` (DDN-Q005) or `pert.cpm@1` CPM enrichment.
- **chen**: `profile: "chen.binary@1"` (scalar subset) or `"chen.binary@2"` (extended). Projects entity objects and binary object-level `assoc`/`ref` relations into Chen occurrences (attribute ovals, association diamonds). Requires only `entity` nodes and binary non-member `assoc`/`ref` edges (DDN-PJ050); the scalar subset also rejects nested/repeated fields. Emits info DDN-PJW01.
- **matrix**: `rows` + `columns` (1..500 refs each; ≤5000 cells, ≤40 columns — DDN-PJ013), `relation` = a registered relationship keyword (DDN-PJ014), `value` = binding for cell text, `duplicates: error|join` (`join` only on `matrix.relations@1`, `matrix.bcg@1`, `matrix.ansoff@1`, `matrix.tows@1`, `matrix.storymap@1` — RACI/CRUD require one assignment per cell), optional `encoding` (numeric/category/bands with explicit domain/values/boundaries + labels; palette `blue|diverging`; DDN-QM001/QM002). Cells are relations row→column of the declared kind. Quadrant profiles (`matrix.bcg@1` growth×share high/low, `matrix.ansoff@1` market×product existing/new, `matrix.tows@1` internal strength/weakness × external opportunity/threat) require rows/columns to be exactly the named categories via `x_category` (DDN-PJ082). `matrix.raci@1` rows need exactly one `A`, ≥1 `R`, only R/A/C/I (DDN-PJ016); `matrix.crud@1` values are distinct C/R/U/D letters (DDN-PJ017); `matrix.storymap@1` uses `assoc` cells carrying `x_story.task` refs to `analysis.task` (DDN-PJ014/PJ093), one cell per story per release (DDN-PJ086).
- **table**: `records` + `columns: [{key, label}]` (1..30, unique — DDN-PJ018); `missing: error|blank` (DDN-PJ019); values must be scalar.
- **panels**: `columns` 1..12, `panels: [{id, title, row, column, rowspan?, colspan?, items?, view?}]` (1..80 panels, no overlaps — DDN-PJ020/PJ021). Canvas profiles require fixed panel sets (DDN-PJ080/081/083): `canvas.bmc@1` = kp, ka, kr, vp, cr, ch, cs, cost, rev; `canvas.lean@1` = problem, solution, keymetrics, uvp, unfair, channels, segments, cost, revenue; `canvas.pest@1` = political, economic, social, technological; `canvas.pestle@1` adds legal, environmental; `canvas.porter5@1` = entrants, supplier, rivalry, buyer, substitutes; `canvas.empathy@1` = says, thinks, persona, does, feels; `canvas.scorecard@1` = financial, customer, internal, learning. `panels.journey@1`: 2..8 phase columns; row 0 = `phase-<slug>` panels; rows 1..3 = `actions|touchpoints|opportunities-<phase>`; row 4 = single full-width `emotions` panel whose items carry `x_record.phase` + `x_record.value` in 1..5 (DDN-PJ084/PJ085). `panels.pyramid@1`: 3..5 bands, single column, contiguous rows (DDN-PJ089). `panels.venn@1`: 2..3 sets; item membership via `x_sets` must match panel listing (DDN-PJ090/PJ091). `panels.composed@1`: panels with `view:` embed child views (one level only, ≤12 children, child ≤128 elements/384 relations — DDN-QP001..003).
- **chart**: marks `bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey` (DDN-PJ030); `x_type: category|number|date`; explicit `x` and `y` bindings (candlestick uses `open/high/low/close`); `y` must be finite numeric, no string coercion (DDN-PJ032); date x must be real ISO `YYYY-MM-DD` (DDN-PJ033); `aggregate: none|sum|count|min|max|mean` on category bars/arcs only (DDN-PJ031); duplicate categories require an aggregate (DDN-PJ036); `missing: error|skip` (DDN-PJ019); `unit` requires matching `x_record.unit` on every record (DDN-PJ034); `inner_radius` 0..0.9 exclusive. Mark-specific: point requires x_type number; pie/donut/bar/radar/funnel require categorical x; radar ≥3 categories, series key ≤80 chars (DDN-PJ071/072/030); funnel ≥2 distinct stages, no series, nonnegative (DDN-PJ073/PJ107); gauge exactly one record, value 0..100, optional numeric `target` 0..100 (DDN-PJ074/075); candlestick high≥low and open/close within [low,high], x not number (DDN-PJ076/077); treemap dotted paths ≤3 levels, nonnegative, no aggregation/series (DDN-PJ078/PJ031); sankey categorical endpoint text x + `target` binding, positive values, acyclic (DDN-PJ108/PJ079).
  - **chart.quality@1** (and any chart with series/arrangement/transform/layers/bins/normalize/whiskers/quartiles/step/target, except gauge/sankey) adds: `transform: identity|histogram|pareto|waterfall|boxplot` (DDN-QC001), quality marks `bar|line|area|point|box`; histogram needs 2..101 increasing `bins`, `normalize: count|proportion|density`, `outside: error|exclude` (DDN-QC010/QC011); pareto needs nonnegative values with positive total (DDN-QC012); waterfall needs a `step` binding (`delta|subtotal|total`) and declared totals must match cumulative deltas (DDN-QC013/QC014); boxplot quartiles `linear_r7`, whiskers `tukey_1_5|minmax` (DDN-QC015); multi-series: ≤20 series × ≤200 categories, `arrangement: group|stack|percent|overlay`, one `layers` entry per series with mark bar|line|area|point, stacked/percent all-bars-or-areas, `series_missing: gap|zero|error`, duplicates need aggregate (DDN-QC020/QC021/QC022).
- **timeline**: `records` with `start`/`end` ISO date bindings (end ≥ start, DDN-PJ040); optional `dependencies` refs to visible `precede`/`analysis.precedes` relations that must not contradict dates (DDN-PJ041/PJ042) and must be acyclic (DDN-PJ043); `label` binding optional.
- **sequence** (`uml.sequence@1`): participants = selected object declarations in declaration order (lifelines); messages = visible `uml.message` relations, ordered top-to-bottom in declaration order; `x_return: true` draws dashed return; endpoints must be selected objects (DDN-PJ110).
- **timing**: participants carry `x_states: [{at: finite number, state: nonempty string}, …]` with strictly increasing `at` (DDN-PJ118).
- **fishbone**: `effect` ref to a `quality.effect` element; `relation` = named cause relation; first-level ribs must be `quality.category` (1..12); acyclic, ≤4 cause levels, ≤250 occurrences, all selected cause relations connected (DDN-QF001..004).
- **decision**: `inputs: [{key, type: enum|boolean|number, values?|min/max?, nullable?, optional?}]` (1..8, DDN-QD001), `outputs: [1..20 keys]`, `records` = rule elements carrying `x_rule: {when, then}` where `when` predicates use `op: eq|in|interval|null|missing` within declared domains (DDN-QD002), every rule supplies every output (DDN-QD003); `hit_policy: unique|first|collect`, `coverage: complete|report|none`, `analysis_budget` 1..50000 (default 4096); overlap under `unique` → DDN-QD004; uncovered witness under `complete` → DDN-QD005; budget exceeded blocks proofs → DDN-QD008.
- **Vega-Lite adapter** (`DDNProjections.vegaLite`): chart/timeline only; radar/funnel/gauge/candlestick/treemap/sankey and quality transforms have no faithful mapping (DDN-PJ070).

## 6. Profile validation rules (enforced by `ddn-profiles.js` + `ddn-profile-quality.js`)

These are the executable checks where generators most often fail. `ns`/`es` below = selected elements / visible relations (both endpoints selected).

Global (all profiles):
- Unknown profile id → DDN-PF001. `projection.kind` ≠ profile's registered projection → DDN-PF002.
- `flow.*`, `uml.actor`, `uml.usecase`, `c4.*`, `epk.*` elements must NOT declare `fields` compartments (DDN-PF003).
- `uml.generalization`, `uml.include`, `req.derives` relations must be acyclic (DDN-PF004); generalization endpoints must share the same declared kind (DDN-PF005).
- `dfd.data` must involve a `dfd.process` on at least one side (DDN-PF006).
- `export.mode: redacted` with any profile-specific (dotted) kind → DDN-PJ003 (fail closed).
- `req.requirement` elements need unique `x_diagram.code` and nonempty `x_diagram.text` (DDN-PF014).

Per-profile:
- **flow.basic@1 / flow.documented@2 / uml.activity@1**: participants only `flow.*` kinds (DDN-PF007). Links: flow.basic only `flow.next`; uml.activity only `uml.flow`; flow.documented allows `flow.next`, `flow.annotation`, `flow.continues` (DDN-PX008). At least one `flow.start` and one `flow.end`; start has no incoming control; end has no outgoing (DDN-PF008). Every `flow.decision` needs ≥2 outgoing control edges with explicit, distinct, nonempty `x_diagram.branch` names (DDN-PF009). Every non-annotation symbol must be reachable from a start and reach an end (DDN-PF010). flow.documented@2 additionally: `flow.offpage` nodes need valid `x_continuation {key, side: in|out, page?}`, each key is exactly one out + one in pair joined by exactly one `flow.continues` edge, and the out node's only outgoing / in node's only incoming link is that `flow.continues` edge (DDN-PX008); every `flow.annotation` node needs an outgoing `flow.annotation` attachment.
- **dfd.***: only `dfd.*` participants and `dfd.data` links (DDN-PF011); every `dfd.process` has unique nonempty `x_diagram.number` and at least one input and one output (DDN-PF012/013).
- **org.tree@1**: participants `organization|team|role|analysis.role`; links only `reports_to`; acyclic (DDN-PF004); exactly one root (DDN-PJ102); multiple parents fail at layout (DDN201).
- **wbs.tree@1**: participants only `analysis.task`; links only `analysis.decomposes`; acyclic; exactly one root (DDN-PJ102).
- **mindmap.basic@1**: participants `object|entity|term|domain`; links only `assoc`; `layout.algorithm` MUST be `mindmap`; acyclic; exactly one root.
- **concept.map@1**: participants `object|entity|term|domain`; links only `assoc|ref`; EVERY selected relation needs an explicit author-written label different from the verb default (DDN-PJ104). No root/cycle constraints.
- **c4.context@1**: participants only `c4.person`, `c4.system`; links only `c4.rel`; no member (field/port) endpoints (DDN-PJ100). **c4.container@1**: participants `c4.person|c4.system|c4.container|c4.store|c4.queue`; links only `c4.rel`; requires EXACTLY ONE frame scoped to a selected `c4.system` boundary whose members cover every selected interior node (exterior: `c4.person`) (DDN-PJ101). **c4.component@1**: participants `c4.person|c4.system|c4.container|c4.store|c4.component`; same one-boundary rule with a `c4.container` frame (exterior: `c4.person`, `c4.system`, `c4.store`).
- **epc.basic@1**: participants `epk.event|epk.function|epk.connector`; links only `epk.next`; events and functions must strictly alternate (no event→event or function→function; DDN-PJ105); `epk.connector` must carry `x_epc.operator` of `and|or|xor`, and `x_epc.operator` on anything else is rejected (DDN-PJ106).
- **erd.crowfoot@1**: every visible relation must be `ref` or `assoc` and carry BOTH `source_mark` and `target_mark` from `one|zeroone|many|zeromany` (DDN-PJ087).
- **uml.usecase@2**: every selected `uml.usecase` names its subject boundary via `x_usecase.subjects` (refs to distinct `uml.subject` elements); `uml.extend` needs `x_usecase {extension_point}` naming an extension point declared on the target use case plus a `condition` string or `condition_ref` (exactly one form); include/extend endpoints must share a declared subject; a view frame scoped to a `uml.subject` must not contradict model membership (DDN-PX002/PX004/PX006).
- **chen.binary@1 / chen.binary@2**: entities only; weak entity (`x_chen.weak: true`) requires a distinct entity owner (`x_chen.owner`), a declared partial-key field, exactly one visible identifying relationship, and identifying relations must connect weak↔owner with the owner end at min 1/max 1; participation bounds `x_chen.from/to {min, max|many}` required on every relation under binary@2; composite attributes must match actual nested fields; key fields cannot be derived/multivalued; ownership must be acyclic (DDN-PX003/PX005/PX007).
- **uml.object@1**: instance objects carry `x_instance.classifier`; declared slots must exist on the classifier's fields (DDN-PJ112).
- **uml.communication@1**: every visible `uml.message` needs `x_message.seq` matching `^\d+(\.\d+)*$`; replies (`x_return: true`) must be dotted under their request (e.g. `2.1`); non-replies must be top-level numbers (DDN-PJ111).
- **state.flat@1**: only `state.initial|state.state|state.final` elements and object-level `state.transition` relations; exactly ONE initial marker, ≥1 terminal (`state.final` or `x_state.terminal: true`); no fields on states; initial has no incoming and exactly one outgoing transition, which is unconditional/action-free; every non-initial transition requires `x_transition.event`; terminal states have no outgoing transitions; every state reachable from initial and able to reach a terminal; same-event branching from a state requires guard `inputs` domains; optional `traces` are simulated (≤100 traces × ≤1000 events; each step must match exactly one transition — DDN-QL006; final state must equal `expected` — DDN-QL007). Codes DDN-QL001..QL007.
- **state.composite@1**: frames may be parallel regions (`x_region: true`); at most ONE `state.initial` per region, and per composite frame unless its members are fully covered by declared regions (DDN-PJ113). Transitions render event/guard labels from `x_transition`.
- **uml.activity@1** (in addition to flow rules): partition lanes — `x_partition.lane` must name an existing frame id or name (DDN-PJ114); `flow.forkjoin` bars: fork count (≥2 outgoing) must equal join count (≥2 incoming) (DDN-PJ115).
- **bpmn.basic@1**: pools are frames with `x_pool: true`; `bpmn.messageflow` only across pools, never inside one pool or with both endpoints outside all pools (DDN-PJ116); every `flow.gateway` needs `x_gateway.type` of `exclusive|parallel|inclusive` (DDN-PJ117); gateways render prefixed X/+/O markers.
- **uml.interaction_overview@1**: nodes referencing sub-views via `x_subdiagram.view` must name an existing view (DDN-PJ119).
- **sysml.***: only `sysml.block` elements may declare `ports` groups (DDN-PJ121). **sysml.parametric@1**: every `sysml.constraint` is touched by exactly two visible relations (DDN-PJ122).
- **archimate.basic@1**: `archi.rel` endpoints must be among the nine registered `archi.*` kinds; layers business/application/technology; links go same-layer or upward (serving) only (DDN-PJ123).
- **cmmn.basic@1**: every `cmmn.sentry` must be a member of a frame scoped to a `cmmn.stage` and carry `x_sentry.on` of `entry|exit` (DDN-PJ120).
- **network.basic@1 / network.rack@1**: `network.attaches` must target a `network.bus` element or a port member (DDN-PJ127). Rack profile: within a frame scoped to a `network.rack`, member `x_rack.unit` must be an integer 1..`x_rack.units` of the rack and unique per rack (DDN-PJ127).
- **fault.tree@1 / event.tree@1**: every `tree.gate` declares `x_gate.type` of `and|or` and has ≥2 visible outgoing `tree.input` edges (DDN-PJ126).
- **family.tree@1**: `family.parent_of` edges acyclic (DDN-PJ129); a `family.person` has at most two distinct parents (DDN-PJ130); `x_birth`/`x_death` years render in labels.
- **wireframe.ui@1**: `ui.*` controls outside any `ui.frame` frame → warning DDN-PJ128.
- **pert.cpm@1**: tasks (`analysis.task`) need finite nonnegative `x_estimate` days (DDN-PJ125); `analysis.precedes` must be acyclic (DDN-PJ124); critical-path relations/labels are computed at render.

## 7. Validation workflow (CLI)

```
node notation/cli/cli.js <check|render|resolve|bundle> <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR]
```

- `--workspace DIR` (default `.`): ALL files (entry + transitive imports) must live under this directory; an entry outside → `Entry is outside workspace`; symlinks escaping it are rejected. Imports are resolved POSIX-relative to the importing file inside the workspace.
- `check`: parses entry + transitive imports, builds the IR (view = `--view`, else the first view of the entry file's first module), runs contracts + profile validation. Prints `{"status":"pass-core","view":…,"elements":N,"relations":N,"warnings":[…]}`. Exit code 1 with a JSON error `{code,message,source,offset}` on failure.
- `render`: additionally runs layout/routing/publication and writes/prints the SVG (needs `--out` or prints to stdout). Use it to catch geometry errors (DDN200–224) that `check` does not reach.
- `resolve`: prints the serialized resolved IR (JSON), honoring the `export` profile (redacted allowlist / SQL DDL).
- `bundle`: merges the workspace into one self-contained multi-module file (see 2.1).
- `DDNLive` in-browser equivalent: `api.parse`, `ws.resolve`, `ws.renderSync`.

Self-check recipe for an AI: write `file.ddn` (+ any imported files) into a fresh tmp dir, then
`node …/cli.js check /tmp/ws/file.ddn --workspace /tmp/ws && node …/cli.js render /tmp/ws/file.ddn --workspace /tmp/ws --out /tmp/ws/out.svg`.
For files declaring multiple views, repeat with `--view <name>` for each view.


## 8. Diagnostics (357 codes, machine-extracted from runtime + Studio sources)

`check`/`render` failures print one JSON error object; warnings/infos appear in `warnings`/`diagnostics`. Families: `DDN0xx` lexical/parse, `DDN01x–02x` imports/modules, `DDN03x–06x` build/semantics, `DDN07x` publication, `DDN1xx` contracts/extensions, `DDN13x–14x` process/governance contracts, `DDN15x` redacted export, `DDN2xx` layout/routing, `DDN900` unsupported constructs, `DDN-W…`/`DDN-LW…`/`DDN-PJW…`/`DDN-TW01`/`DDN-CW01` warnings/infos (`DDN-W901` is a reserved legacy warning), `DDN-E0xx` Studio authoring-edit / missing runtime bundle (`DDN-E010`), `DDN-IO…` Studio archive/workspace import-export I/O, `DDN-I…` interaction (experimental sequence-lane projection), `DDN-P…` retained placement, `DDN-PF…` profile validators, `DDN-PJ…` projection validators, `DDN-PX…` profile-completion contracts, `DDN-Q…`/`QC`/`QD`/`QF`/`QL`/`QM`/`QP` quality/decision/fishbone/lifecycle/matrix/panels validators, `LIVE…` in-browser API. How to fix: read the message (it names the offending element/relation/property); the section cross-references: parse errors → §2, build errors → §3, DDN050/056/102/114 → §4 vocabulary tables, DDN-PF/PJ/PX/Q* → §5/§6, DDN2xx → adjust `place`/`route` hints, spacing, or simplify the view (§3.3, §5 coordinate policy).

| code | severity | raised by | meaning (verbatim message template(s); concatenated +n parts are runtime values) |
|---|---|---|---|
| DDN-CW01 | warning/info | runtime/ddn-layout.js | Cubic corridor spline used to retain clearance or routing hints for |
| DDN-E001 | error | studio/src/authoring.js | Use a valid, nonreserved DDN identifier.<br>Data block name is required.<br>Label must be text up to 4096 characters.<br>Position must be finite, bounded world coordinates.<br>Unknown object kind.<br>Unknown relationship kind. |
| DDN-E002 | error | studio/src/authoring.js | Model identity is not in this workspace.<br>Definition not found.<br>Data block not found: <br>Data block name is ambiguous across the workspace:  ( blocks) |
| DDN-E003 | error | studio/src/authoring.js | The edited source does not import the target definition. Add the required import explicitly. |
| DDN-E004 | error | studio/src/authoring.js |  references depend on this definition. Remove/reassign them in source first, or hide its appearance. |
| DDN-E006 | error | studio/src/authoring.js | Selected object has no x_record value record<br>Not an assignment relationship<br>This view uses data-bound coordinates; edit the underlying values rather than pinning a mark. |
| DDN-E007 | error | studio/src/authoring.js | Matrix edit options require a boolean remove flag and optional id<br>Matrix changes need a matrix view and 1..100 cell operations<br>Cell editing requires an explicit extension-property value binding<br>New assignments require a shared data block selected by this view; supply projection.write_data explicitly<br>Invalid matrix operation<br>Cell outside bound matrix or duplicated in edit batch<br>A joined cell is not a single editable assignment<br>Cell value must be a finite scalar<br>Cell identifier already exists |
| DDN-E010 | error | studio/src/api.js | Vega-Lite export is provided by ddn-projections.js; load it after ddn-core.js and ddn-graph.js.<br>Interaction validation is provided by ddn-graph.js; load it after ddn-core.js.<br>Renderer registration needs a projection kind name and a render function.<br>No renderer registered for projection kind "<br>Projection |
| DDN-E011 | error | studio/src/authoring.js | replaceData records must be an array of plain objects.<br>Record values must be finite scalars, or arrays/plain objects of them.<br>Data block  declares no records; its field shape cannot be inferred.<br>Data block  declares  record(s); an empty replacement would erase its declared field shape.<br>Every record must carry the same keys as the first existing record of :  |
| DDN-I001 | error | runtime/ddn-interaction.js | Unsupported interaction projection |
| DDN-I002 | error | runtime/ddn-interaction.js | Interaction 0.1 requires a right-hand numbered relationship key |
| DDN-I003 | error | runtime/ddn-interaction.js | A nonempty x_sequence is required |
| DDN-I004 | error | runtime/ddn-interaction.js | Select explicit participant objects with x_protocol_role |
| DDN-I005 | error | runtime/ddn-interaction.js | Interaction must contain between 1 and 500 exchanges |
| DDN-I006 | error | runtime/ddn-interaction.js | Missing or duplicate step identity |
| DDN-I007 | error | runtime/ddn-interaction.js | display_order must be a unique positive integer |
| DDN-I008 | error | runtime/ddn-interaction.js | Every after entry must reference an exchange in the same sequence<br>Duplicate predecessor |
| DDN-I009 | error | runtime/ddn-interaction.js | Every exchange endpoint must have a selected participant lane |
| DDN-I010 | error | runtime/ddn-interaction.js | Unsupported message form |
| DDN-I011 | error | runtime/ddn-interaction.js | This scenario uses phases A through D |
| DDN-I012 | error | runtime/ddn-interaction.js | Payload must reference an in-scope message or record contract |
| DDN-I013 | error | runtime/ddn-interaction.js | Internal events are same-participant invoke relationships |
| DDN-I014 | error | runtime/ddn-interaction.js | Network/local payload exchanges retain the core flow relationship |
| DDN-I015 | error | runtime/ddn-interaction.js | reply_to must identify another exchange |
| DDN-I016 | error | runtime/ddn-interaction.js | A reply must reverse the correlated request endpoints |
| DDN-I017 | error | runtime/ddn-interaction.js | Each exchange requires an explicit unique callout key |
| DDN-I018 | error | runtime/ddn-interaction.js | Cycle in protocol predecessor graph |
| DDN-I019 | error | runtime/ddn-interaction.js | display_order conflicts with an explicit predecessor |
| DDN-I020 | error | runtime/ddn-interaction.js | A response must causally follow its request |
| DDN-IO01 | error | studio/src/io.js | Select at least one source file.<br>No DDN source files were found. |
| DDN-IO02 | error | studio/src/io.js | Unsafe ZIP path or symbolic link.<br>Sources outside workspace manifest root. |
| DDN-IO03 | error | studio/src/io.js | Duplicate archive path: <br>Two selected files have the same path:  |
| DDN-IO04 | error | studio/src/io.js | Decompression size limit exceeded.<br>Archive exceeds 16 MB.<br>Archive entry or total size limit exceeded.<br>Too many selected files.<br>Workspace JSON exceeds 16 MB.<br>Source size limit exceeded. |
| DDN-IO05 | error | studio/src/io.js | ZIP uncompressed size mismatch.<br>Invalid ZIP end directory.<br>Split, ZIP64, excessive or invalid archives are unsupported.<br>Invalid central directory.<br>Truncated ZIP filename.<br>Encrypted or unsupported compressed ZIP entry.<br>Invalid local ZIP header.<br>ZIP local header mismatch.<br>ZIP CRC or size check failed: <br>Unexpected directory data.<br>Invalid UTF-8 workspace JSON.<br>Source is not valid UTF-8: <br>Multiple workspace manifests. |
| DDN-IO08 | error | studio/src/io.js | Downloads require a browser document. |
| DDN-IO09 | error | studio/src/io.js | This browser cannot read compressed ZIP entries. Extract the archive and use Open folder, or use a workspace JSON file.<br>Raw DEFLATE is unavailable. Extract the ZIP and open its DDN files. |
| DDN-I021 | error | runtime/ddn-interaction.js | x_phases must be a nonempty subset of A, B, C, D |
| DDN-I022 | error | runtime/ddn-interaction.js | The selected phases contain no exchanges |
| DDN-I023 | error | runtime/ddn-interaction.js | row height must be between 60px and 160px |
| DDN-I024 | error | runtime/ddn-interaction.js | Too many participant lanes for the page width |
| DDN-I025 | error | runtime/ddn-interaction.js | Interaction page needs at least ${needed}px height; split phases or enlarge page |
| DDN-I026 | error | runtime/ddn-interaction.js | Experimental interaction typography remains 16px; variable fonts are supported by the native core view renderer<br>Smallest interaction labels are 11px; this minimum is unsupported |
| DDN-I027 | error | runtime/ddn-interaction.js | The explanatory note must be text |
| DDN-I028 | error | runtime/ddn-interaction.js | Unknown interaction metadata property |
| DDN-I030 | error | runtime/ddn-layout.js | }); if(!directions[side])throw Object.assign(new Error('Invalid endpoint side '+side),{code:'DDN-I030'}); const fixed=frac!==undefined//!!portOf<br>}); const fixed=frac!==undefined//!!portOf(n,ep)//hint.via!==undefined; if(!groups.has(key))groups.set(key,[]); groups.get(key).push({item,wh<br>].includes(e.code))throw e;} return false; } for(let sweep=0;sweep<8&&telemetry.trials<limit;sweep++){ const conflicts=incidents(best);if(!confl<br>DDN223<br>A visual anchor fraction must be strictly between 0 and 1 and cannot override a field/port endpoint |
| DDN-I031 | error | runtime/ddn-interaction.js | Curved routing belongs to the ordinary graph projection; the experimental interaction profile uses fixed participant lanes. No silent geometry fallback. |
| DDN-I032 | error | runtime/ddn-interaction.js | Experimental interaction publication has no approved payload/occurrence redaction closure; use an explicitly allowlisted ordinary graph view. No SVG is emitted. |
| DDN-IW01 | warning/info | runtime/ddn-interaction.js | Experimental interaction projection validates declared predecessor/correlation metadata. It does not validate cryptographic security, real network behavior or full UML sequence semantics. |
| DDN-LW01 | warning/info | runtime/ddn-layout.js | Directed cycles retained as same-rank strongly connected groups; no model edge reversed. |
| DDN-LW02 | warning/info | runtime/ddn-layout.js | Recomputed unsafe route hint |
| DDN-LW03 | warning/info | runtime/ddn-layout.js | severity:'warning',message}); return {routes,crossings,labels,diagnostics,quality}; } function routing(nodes,rels,profiles,hints={},labelMeasure,Erro |
| DDN-LW04 | warning/info | runtime/ddn-layout.js | Deterministic congestion retry selected routing strategy |
| DDN-LW05 | warning/info | runtime/ddn-placement.js | ${best.crossings.length} disconnected crossings remain after bounded routing; rendered with ${p.layout.crossings}. |
| DDN-LW06 | warning/info | runtime/ddn-placement.js | Larger graph: native obstacle routing runs, but expensive whole-graph crossing trials are skipped. |
| DDN-P002 | error | runtime/ddn-placement.js | Retained layout state has an invalid format or belongs to another view.<br>Invalid retained world coordinates. |
| DDN-P003 | error | runtime/ddn-placement.js | No space for a new element without moving retained positions: |
| DDN-P004 | error | runtime/ddn-placement.js | Measured element lies outside a fixed frame: |
| DDN-PF001 | error | runtime/ddn-profiles.js | Unknown or uninstalled diagram profile |
| DDN-PF002 | error | runtime/ddn-profiles.js | p.profile+' requires projection '+profile.projection+', not '+p.kind); for(const n of ir.elements){ if(n.kind.startsWith('flow.')&&n.fields.length) |
| DDN-PF003 | error | runtime/ddn-profiles.js | Flowchart symbols have labels, not attribute compartments<br>Actor/use-case symbol does not support attribute fields<br>C4 symbols have labels, not attribute compartments<br>EPC symbols have labels, not attribute compartments |
| DDN-PF004 | error | runtime/ddn-profiles.js | label+' contains a cycle');if(seen.has(id))return;active.add(id);for(const c of kids.get(id)//[])visit(c);active.delete(id);seen.add(id);}for(const id |
| DDN-PF005 | error | runtime/ddn-profiles.js | Generalization endpoints must have the same declared classifier kind |
| DDN-PF006 | error | runtime/ddn-profiles.js | A DFD transfer must involve a process; store/external shortcuts are invalid |
| DDN-PF007 | error | runtime/ddn-profiles.js | Flowchart projection accepts flow.* participants only<br>Flowchart projection accepts flow.next links only<br>Activity projection accepts uml.flow links only<br>org.tree@1 accepts organization, team, role, analysis.role participants only<br>org.tree@1 accepts reports_to links only<br>wbs.tree@1 accepts analysis.task participants only<br>wbs.tree@1 accepts analysis.decomposes links only<br>mindmap.basic@1 accepts object, entity, term, domain participants only<br>mindmap.basic@1 accepts assoc links only<br>mindmap.basic@1 requires layout algorithm mindmap<br>concept.map@1 accepts object, entity, term, domain participants only<br>concept.map@1 accepts assoc and ref links only<br>p.profile+' accepts '+ok.join(', ')+' participants only'); if(es.some(r=>r.kind!=='c4.rel'))fail('DDN-PF007',p.profile+' accepts c4.rel links only')<br>p.profile+' accepts c4.rel links only'); if(p.profile==='c4.container@1'//p.profile==='c4.component@1'){ const bkind=p.profile==='c4.container@1'<br>epc.basic@1 accepts epk.event, epk.function, epk.connector participants only<br>epc.basic@1 accepts epk.next links only |
| DDN-PF008 | error | runtime/ddn-profiles.js | Closed flowchart needs a start and an end<br>Start cannot have incoming control<br>End cannot have outgoing control |
| DDN-PF009 | error | runtime/ddn-profiles.js | Decision requires at least two explicitly named, distinct branches |
| DDN-PF010 | error | runtime/ddn-profiles.js | Every flowchart symbol must be reachable from a start and able to reach an end |
| DDN-PF011 | error | runtime/ddn-profiles.js | DFD profile requires dfd participants and dfd.data links |
| DDN-PF012 | error | runtime/ddn-profiles.js | DFD process number must be nonempty and unique |
| DDN-PF013 | error | runtime/ddn-profiles.js | DFD process needs input and output |
| DDN-PF014 | error | runtime/ddn-profiles.js | Requirement needs unique code and nonempty text |
| DDN-PI01 | warning/info | runtime/ddn-placement.js | Auto-placement paused; ${retained.length} free positions retained. New elements still need a seed position. |
| DDN-PJ001 | error | runtime/ddn-projection-data.js | Unsupported projection |
| DDN-PJ002 | error | runtime/ddn-profiles.js | Data-bound projections do not accept graph place/route/frame/subdiagram geometry; select a graph view<br>Cannot combine interaction and data-bound projections |
| DDN-PJ003 | error | runtime/ddn-profiles.js | Profile-specific redacted projection is not qualified; provide a separately authorized workspace<br>Redacted non-graph projections require a separately authorized input workspace; unsupported export fails closed |
| DDN-PJ004 | error | runtime/ddn-projection-data.js | }); if(['id','name','kind'].includes(path))return record[path]; let v=record.properties;for(const part of path.split('.')){if(v===null//typeof v!==' |
| DDN-PJ005 | error | runtime/ddn-projection-data.js | kind+' projection does not use '+k+'; no silent ignored settings'); for(const k of ['width','height'])if(p[k]!==undefined){const v=typeof p[k]==='num |
| DDN-PJ006 | error | runtime/ddn-projection-data.js | Projection |
| DDN-PJ007 | error | runtime/ddn-projection-data.js | Projection reference is outside its data scope: |
| DDN-PJ008 | error | runtime/ddn-projection-data.js | Projection binds an excluded/not-selected element: |
| DDN-PJ009 | error | runtime/ddn-projection-data.js | name+' needs 1..500 explicit references');const ns=a.map(x=>resolve(x));if(new Set(ns.map(n=>n.id)).size!==ns.length)fail('DDN-PJ009','Duplicate '+nam<br>Duplicate |
| DDN-PJ010 | error | runtime/ddn-projection-data.js | key+' must supply a scalar value',n);return v;}; const filtered=()=>{let ns=list(p.records,'records');if(p.filter){const{key,op,value}=p.filter;if(Ob |
| DDN-PJ011 | error | runtime/ddn-projection-data.js | Filter supports explicit eq or in only<br>Order needs key and asc/desc |
| DDN-PJ012 | error | runtime/ddn-projection-data.js | Projection selection is empty after filtering<br>No chart points remain |
| DDN-PJ013 | error | runtime/ddn-projection-data.js | Matrix limit: 5,000 cells and 40 columns |
| DDN-PJ014 | error | runtime/ddn-profiles.js | Matrix relation must name an installed relationship kind<br>Matrix needs a relation kind and a value binding<br>Unknown duplicate-cell policy<br>RACI/CRUD require one declared assignment per cell<br>matrix.storymap@1 uses assoc cell relations carrying x_story.task |
| DDN-PJ015 | error | runtime/ddn-projection-data.js | More than one assignment for the same row and column |
| DDN-PJ016 | error | runtime/ddn-projection-data.js | RACI row requires exactly one A, at least one R, and only R/A/C/I codes: |
| DDN-PJ017 | error | runtime/ddn-projection-data.js | CRUD value must contain distinct C/R/U/D letters |
| DDN-PJ018 | error | runtime/ddn-projection-data.js | Table needs 1..30 column bindings<br>Invalid/duplicate table column |
| DDN-PJ019 | error | runtime/ddn-projection-data.js | Table missing policy is error or blank<br>Missing table value<br>Table values must be scalar<br>Chart missing policy is error or skip |
| DDN-PJ020 | error | runtime/ddn-projection-data.js | Panels need 1..12 columns and 1..80 panels<br>Invalid panel grid span/ID |
| DDN-PJ021 | error | runtime/ddn-projection-data.js | Overlapping panel spans |
| DDN-PJ030 | error | runtime/ddn-projection-data.js | Supported marks: bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey<br>Radar spokes require categorical x (x_type must be category)<br>Funnel stages require categorical x (x_type must be category)<br>Funnel shows one stage per record; do not set series<br>Gauge caption requires categorical x (x_type must be category)<br>Gauge shows one value; do not set series<br>Candlestick requires categorical or date x (x_type must not be number)<br>Candlestick shows one candle per record; do not set series<br>Treemap paths require categorical x (x_type must be category)<br>Treemap tiles encode one value per record; do not set series<br>Sankey sources require categorical x (x_type must be category)<br>Sankey encodes flows between endpoints; do not set series<br>Sankey target is a property binding, not a numeric reference<br>x_type is category, number or date<br>Chart needs explicit x and y bindings<br>inner_radius is a radius fraction 0..0.9 exclusive<br>Radar series must be a nonempty text key of at most 80 characters<br>Scatter/bubble requires x_type:number<br>Bars, arcs, radar spokes and funnel stages currently require categorical x<br>Treemap paths have at most 3 levels |
| DDN-PJ031 | error | runtime/ddn-projection-data.js | Treemap tiles encode supplied values; aggregation is not available<br>Sankey flows encode supplied values; aggregation is not available<br>Unknown aggregate<br>Aggregation is available on category bars/arcs only |
| DDN-PJ032 | error | runtime/ddn-projection-data.js | Chart y must be finite numeric data; numeric strings are not coerced<br>Numeric x required<br>Category x must be text or number<br>Sankey endpoints are category text<br>Aggregate overflow<br>Quantitative axis range overflow<br>Quantitative x range overflow |
| DDN-PJ033 | error | runtime/ddn-projection-data.js | Date x must be a real ISO YYYY-MM-DD date |
| DDN-PJ034 | error | runtime/ddn-projection-data.js | Count is dimensionless; do not label it as currency or another input unit<br>Every record must declare matching x_record.unit: |
| DDN-PJ035 | error | runtime/ddn-projection-data.js | Point size must be a finite nonnegative value |
| DDN-PJ036 | error | runtime/ddn-projection-data.js | Duplicate x/category: supply an explicit aggregate or distinct coordinates |
| DDN-PJ037 | error | runtime/ddn-projection-data.js | Arcs require nonnegative values and a positive total |
| DDN-PJ040 | error | runtime/ddn-projection-data.js | Timeline needs real ISO date-only start/end with end >= start |
| DDN-PJ041 | error | runtime/ddn-projection-data.js | Timeline dependencies must be selected predecessor-to-successor links |
| DDN-PJ042 | error | runtime/ddn-projection-data.js | Finish-to-start dependency contradicts supplied dates |
| DDN-PJ043 | error | runtime/ddn-projection-data.js | Timeline dependency cycle |
| DDN-PJ050 | error | runtime/ddn-projections.js | Chen subset requires entity objects and binary object-level assoc/ref relationships<br>Chen scalar subset does not silently flatten nested or repeated fields |
| DDN-PJ051 | error | runtime/ddn-projections.js | Retained graph positions cannot override data-bound projection coordinates |
| DDN-PJ060 | error | runtime/ddn-projections.js | Projection extent exceeds bounded publication budget |
| DDN-PJ061 | error | runtime/ddn-projections.js | Page has no remaining drawing area |
| DDN-PJ062 | error | runtime/ddn-projections.js | embedding_scale must be a positive finite value <= 100 |
| DDN-PJ070 | error | runtime/ddn-projections.js | Quality transforms are native; this optional adapter does not silently flatten them<br>Vega-Lite adapter supports chart/timeline only<br>Radar, funnel, gauge, candlestick, treemap and sankey marks have no faithful Vega-Lite mapping in this adapter; use the native SVG projection |
| DDN-PJ071 | error | runtime/ddn-projection-data.js | Radar needs at least 3 distinct x categories (got |
| DDN-PJ072 | error | runtime/ddn-projection-data.js | Radar requires finite numeric y >= 0 per point; filter out or explicitly skip unusable records |
| DDN-PJ073 | error | runtime/ddn-projection-data.js | Funnel needs at least 2 distinct stages (categories); supply more records or use another mark |
| DDN-PJ074 | error | runtime/ddn-projection-data.js | Gauge requires exactly one record after filtering (the KPI); supply one record or filter to one |
| DDN-PJ075 | error | runtime/ddn-projection-data.js | Gauge value must be a finite number in 0..100<br>Gauge target must be a finite number in 0..100 |
| DDN-PJ076 | error | runtime/ddn-projection-data.js | Candlestick requires finite numeric open/high/low/close on every record |
| DDN-PJ077 | error | runtime/ddn-projection-data.js | Candlestick requires high >= low and open/close within [low, high] |
| DDN-PJ078 | error | runtime/ddn-projection-data.js | Treemap tile values must be nonnegative numbers; filter out or explicitly skip negative records |
| DDN-PJ079 | error | runtime/ddn-projection-data.js | Sankey flow graph contains a cycle |
| DDN-PJ080 | error | runtime/ddn-projection-data.js | panels:[['kp','KEY PARTNERS'],['ka','KEY ACTIVITIES'],['kr','KEY RESOURCES'],['vp','VALUE PROPOSITIONS'],['cr','CUSTOMER RELATIONSHIPS'],['ch','CHANNE<br>panels:[['problem','PROBLEM'],['solution','SOLUTION'],['keymetrics','KEY METRICS'],['uvp','UNIQUE VALUE PROPOSITION'],['unfair','UNFAIR ADVANTAGE'],[' |
| DDN-PJ081 | error | runtime/ddn-projection-data.js | panels:[['political','POLITICAL'],['economic','ECONOMIC'],['social','SOCIAL'],['technological','TECHNOLOGICAL']]},'canvas.pestle@1':{code:'DDN-PJ081',<br>panels:[['political','POLITICAL'],['economic','ECONOMIC'],['social','SOCIAL'],['technological','TECHNOLOGICAL'],['legal','LEGAL'],['environmental','EN<br>panels:[['entrants','THREAT OF NEW ENTRANTS'],['supplier','SUPPLIER POWER'],['rivalry','COMPETITIVE RIVALRY'],['buyer','BUYER POWER'],['substitutes',' |
| DDN-PJ082 | error | runtime/ddn-projection-data.js | p.profile+' '+side+' must be exactly the '+axis+' categories ['+levels.join(', ')+']'); const seen=new Set(); for(const el of els){const xc=el.p<br>p.profile+' '+side+' must declare x_category {axis:"'+axis+'",level} covering ['+levels.join(', ')+']; check '+el.name,el); seen.add(xc.level);}} |
| DDN-PJ083 | error | runtime/ddn-projection-data.js | panels:[['says','SAYS'],['thinks','THINKS'],['persona','PERSONA'],['does','DOES'],['feels','FEELS']]},'canvas.scorecard@1':{code:'DDN-PJ083',panels:[[<br>panels:[['financial','FINANCIAL'],['customer','CUSTOMER'],['internal','INTERNAL PROCESS'],['learning','LEARNING & GROWTH']]}}; const need=CANVAS[p.p |
| DDN-PJ084 | error | runtime/ddn-projection-data.js | emotion item |
| DDN-PJ085 | error | runtime/ddn-projection-data.js | panels.journey@1 needs 2..8 phase columns; got<br>panels.journey@1 row 0 must declare the phase panels (phase-<slug>) in column order; missing phase slug at column<br>panels.journey@1 phase slugs must be unique; duplicate "<br>panels.journey@1 row 0 must declare exactly the<br>panels.journey@1 lane "<br>panels.journey@1 row 4 must be the single full-width panel "emotions" (row:4, column:0, colspan:<br>panels.journey@1 has unexpected panel "<br>emotion item<br>emotion items must follow the declared phase order; |
| DDN-PJ086 | error | runtime/ddn-projection-data.js | Story placed in two releases:<br>Story placed twice: |
| DDN-PJ087 | error | runtime/ddn-profiles.js | erd.crowfoot@1 relations must be ref or assoc to carry crow\<br>Relation |
| DDN-PJ088 | error | runtime/ddn-export.js | }); const blocks=['-- DDN SQL DDL export · TEXT columns · declaration order · synthetic illustrative DDL, not a deployable schema']; const pushNote= |
| DDN-PJ089 | error | runtime/ddn-projection-data.js | panels.pyramid@1 needs 3..5 bands;<br>pyramid bands stack in one column (columns:1, column:0, rowspan:1, colspan:1)<br>pyramid band rows must be contiguous 0.. |
| DDN-PJ090 | error | runtime/ddn-projection-data.js | panels.venn@1 draws exactly 2 or 3 sets; |
| DDN-PJ091 | error | runtime/ddn-projection-data.js | venn membership of |
| DDN-PJ092 | error | runtime/ddn-export.js | }); tablesSeen.set(tname,n.id); const fields=n.fields.filter(f=>allowedFields.has(f.id)),colsSeen=new Map(),cols=[]; for(const f of fields){cons<br>});colsSeen.set(c,f.id);cols.push({id:f.id,col:c,primary:pkAllowed&&f.properties&&f.properties.key==='primary'});} tables.set(n.id,{name:tname,cols, |
| DDN-PJ093 | error | runtime/ddn-projection-data.js | Story map cells must reference analysis.task objects: |
| DDN-PJ100 | error | runtime/ddn-profiles.js | Context views show systems and people, not fields; remove member endpoints |
| DDN-PJ101 | error | runtime/ddn-profiles.js | p.profile+' requires exactly one frame scoped to a selected '+bkind+' boundary object whose members cover every selected interior node'); } } if(p |
| DDN-PJ102 | error | runtime/ddn-profiles.js | message);} if(p.profile==='org.tree@1'){ if(ns.some(n=>!['organization','team','role','analysis.role'].includes(n.kind)))fail('DDN-PF007','org.tree |
| DDN-PJ104 | error | runtime/ddn-profiles.js | concept.map@1 relations need an explicit domain label; " |
| DDN-PJ105 | error | runtime/ddn-profiles.js | EPC events and functions must alternate; connect |
| DDN-PJ106 | error | runtime/ddn-profiles.js | EPC connector must carry x_epc.operator of and, or or xor<br>x_epc.operator belongs on epk.connector nodes only |
| DDN-PJ107 | error | runtime/ddn-projection-data.js | Funnel stage values must be nonnegative numbers; filter out or explicitly skip negative records |
| DDN-PJ108 | error | runtime/ddn-projection-data.js | Sankey flows require positive values |
| DDN-PJ110 | error | runtime/ddn-projection-data.js | Sequence message |
| DDN-PJ111 | error | runtime/ddn-profile-quality.js | Message<br>Reply message<br>Non-reply message |
| DDN-PJ112 | error | runtime/ddn-profile-quality.js | Instance |
| DDN-PJ113 | error | runtime/ddn-profile-quality.js | Frame |
| DDN-PJ114 | error | runtime/ddn-profile-quality.js | Node |
| DDN-PJ115 | error | runtime/ddn-profile-quality.js | Fork/join imbalance: |
| DDN-PJ116 | error | runtime/ddn-profile-quality.js | Message flow |
| DDN-PJ117 | error | runtime/ddn-profile-quality.js | Gateway |
| DDN-PJ118 | error | runtime/ddn-projection-data.js | Timing participant |
| DDN-PJ119 | error | runtime/ddn-core.js | Interaction overview node |
| DDN-PJ120 | error | runtime/ddn-profile-quality.js | Sentry |
| DDN-PJ121 | error | runtime/ddn-profile-quality.js | Element |
| DDN-PJ122 | error | runtime/ddn-profile-quality.js | Constraint |
| DDN-PJ123 | error | runtime/ddn-profile-quality.js | Relation |
| DDN-PJ124 | error | runtime/ddn-quality-data.js | Dependency cycle reaches task |
| DDN-PJ125 | error | runtime/ddn-quality-data.js | Task |
| DDN-PJ126 | error | runtime/ddn-profile-quality.js | Gate |
| DDN-PJ127 | error | runtime/ddn-profile-quality.js | Attachment<br>Device<br>Devices |
| DDN-PJ128 | error | runtime/ddn-profiles.js | Control |
| DDN-PJ129 | error | runtime/ddn-profile-quality.js | Lineage cycle: |
| DDN-PJ130 | error | runtime/ddn-profile-quality.js | Person |
| DDN-PJW01 | warning/info | runtime/ddn-projections.js | severity:'info',message:(extended?'Extended binary Chen; ':'Chen scalar/binary subset; ')+ ' attribute and relationship occurrences are projections, n |
| DDN-PJW02 | warning/info | runtime/ddn-projections.js | Quantitative mark coordinates remain exact in every drawing style; styling does not change values. |
| DDN-PJW03 | warning/info | runtime/ddn-projections.js | Sequence participant |
| DDN-PUBLIC | warning/info | runtime/ddn-export.js | Allowlist projection. Source locations, free-text metadata, examples, and inline views removed. |
| DDN-PX001 | error | runtime/ddn-profile-quality.js | Unknown or malformed<br>terminal is boolean<br>x_state applies only to state kinds |
| DDN-PX002 | error | runtime/ddn-profile-quality.js | Use-case metadata has an incompatible owner<br>subjects must reference distinct uml.subject definitions<br>Extension points must be unique names on a use case |
| DDN-PX003 | error | runtime/ddn-profile-quality.js | Invalid Chen entity metadata<br>Weak entity requires a distinct entity owner<br>Weak entity requires a declared partial key<br>Only weak entities declare identifying owner<br>Chen field flags are booleans on entity fields<br>A partial key belongs to a weak entity and is not a full key<br>Key fields cannot be derived or multivalued<br>Composite declaration must match actual child fields |
| DDN-PX004 | error | runtime/ddn-profile-quality.js | Extend must name an extension point on its target use case<br>Extend requires a stated condition or condition definition<br>Use one condition form |
| DDN-PX005 | error | runtime/ddn-profile-quality.js | Chen associations are binary object-level assoc/ref<br>Participation is nonnegative min/max or max:many<br>identifying is boolean<br>Identifying association must connect the declared weak entity to its owner<br>Each weak instance has exactly one owner<br>Nonidentifying relationship cannot declare owner/weak roles |
| DDN-PX006 | error | runtime/ddn-profile-quality.js | Use case must name its subject boundary<br>Extend needs an extension point and condition<br>Include/extend endpoints must share a declared subject<br>View subject frame contradicts model membership |
| DDN-PX007 | error | runtime/ddn-profile-quality.js | Chen binary profile selects entities only<br>Nested Chen attribute requires composite metadata<br>Weak entity owner is absent from this view<br>Weak entity requires exactly one visible identifying relationship<br>Binary Chen relationship needs both min/max participation annotations<br>Cyclic identifying ownership |
| DDN-PX008 | error | runtime/ddn-profile-quality.js | Continuation needs key and in/out side<br>Continuation<br>Continuation ports contradict direction<br>Unsupported relationship in documented flowchart<br>Annotation needs an explicit attachment |
| DDN-Q001 | error | runtime/ddn-quality-data.js | label+' must be a finite number (no numeric-string coercion)',n);return v;}; const resolve=x=>{const id=typeof x==='string'?x:x?.$ref,n=nodes.get(id) |
| DDN-Q002 | error | runtime/ddn-quality-data.js | Missing or not-selected quality reference: |
| DDN-Q003 | error | runtime/ddn-quality-data.js | label+' needs 1..1000 references');const ns=a.map(resolve);if(new Set(ns.map(n=>n.id)).size!==ns.length)fail('DDN-Q003','Duplicate '+label+' record id<br>Duplicate<br>Empty record selection |
| DDN-Q004 | error | runtime/ddn-quality-data.js | Filter supports eq and in<br>Order direction is asc/desc<br>Sort keys must be supplied scalar values |
| DDN-Q005 | error | runtime/ddn-projection-data.js | Lifecycle properties require state.flat@1<br>Unknown or malformed |
| DDN-QC001 | error | runtime/ddn-quality-data.js | Unknown chart transform<br>Quality charts use bar, line, area, point or box marks; use chart.basic for arcs<br>missing must be error or skip<br>Chart requires y binding<br>k+' is only meaningful for '+t); if(tr!=='identity'&&(p.series//p.layers//p.arrangement))fail('DDN-QC001','This transform cannot be combined with ser<br>This transform cannot be combined with series/layers/arrangement<br>Box marks require boxplot transform<br>Transform/mark combination is invalid<br>This transform does not accept series_missing, target or x_type<br>Transforms define their own aggregation; aggregate is not accepted<br>Waterfall step labels are categorical |
| DDN-QC002 | error | runtime/ddn-quality-data.js | Every observation must declare matching x_record.unit:<br>Missing chart category/coordinate<br>Chart coordinate must be text or number<br>No observations remain |
| DDN-QC010 | error | runtime/ddn-quality-data.js | bins must contain 2..101 strictly increasing finite boundaries<br>Histogram normalization is count, proportion or density<br>outside is error or exclude |
| DDN-QC011 | error | runtime/ddn-quality-data.js | Observation outside declared histogram bounds<br>No observations inside histogram bounds |
| DDN-QC012 | error | runtime/ddn-quality-data.js | Pareto values must be nonnegative<br>Pareto cumulative percentage requires positive total |
| DDN-QC013 | error | runtime/ddn-quality-data.js | Waterfall requires a step binding (delta/subtotal/total)<br>Waterfall step must be delta, subtotal, or total |
| DDN-QC014 | error | runtime/ddn-quality-data.js | Declared total does not match cumulative changes; totals are not extra deltas |
| DDN-QC015 | error | runtime/ddn-quality-data.js | Supported quartiles: linear_r7; whiskers: tukey_1_5 or minmax |
| DDN-QC020 | error | runtime/ddn-quality-data.js | Invalid arrangement or x_type<br>Unknown aggregate<br>Count cannot retain an input measurement unit<br>series_missing is gap, zero or error<br>Series must have a nonempty text key of at most 80 characters<br>Date x must be a real ISO date |
| DDN-QC021 | error | runtime/ddn-quality-data.js | Percent target must be within 0..100<br>Quality chart limits: 20 series and 200 coordinates<br>Declare exactly one layer per series<br>Unknown series or unsupported layer mark<br>Bar series require categorical x<br>Stacked/percent layers must be all bars or all areas<br>target is a numeric reference on the shared y scale |
| DDN-QC022 | error | runtime/ddn-quality-data.js | Missing series/category observation<br>Duplicate series/category requires explicit aggregate<br>Stacks need complete data or explicit zero fill<br>Percent stack requires nonnegative values<br>Zero-total percent category has no defined percentages |
| DDN-QC099 | error | runtime/ddn-quality-render.js | }); const legendSlots=[];let legendX=100*s,legendY=54*s;if(tr==='identity')for(const layer of plan.layers){const ww=Math.min(W-155*s,Math.max(110*s,l<br>}); const fx=v=>xmax===xmin?left+pw/2:left+(v-xmin)/(xmax-xmin)*pw; const xc=x=>tr==='identity'&&plan.xType!=='category'?fx(plan.xType==='date'?Date |
| DDN-QD001 | error | runtime/ddn-quality-data.js | Declare 1..8 input domains<br>Invalid or duplicate input key<br>Input type is enum, boolean or number<br>nullable/optional must be boolean<br>Enum values must be distinct non-null finite scalars<br>Enum cannot declare numeric bounds<br>Numeric input requires finite closed min/max<br>Numeric domain cannot declare enum values<br>Boolean domain is false/true |
| DDN-QD002 | error | runtime/ddn-quality-data.js | when must be a conjunction record<br>Predicate references unknown input<br>Unsupported predicate operator<br>Extra predicate parameters<br>Equality value outside input domain<br>Membership values outside input domain or duplicate<br>Predicate uses an unavailable null/missing state<br>Invalid numeric predicate interval<br>Interval closure must be boolean |
| DDN-QD003 | error | runtime/ddn-quality-data.js | analysis_budget is 1..50000<br>hit_policy must be unique, first or collect<br>coverage is complete, report or none<br>outputs must name 1..20 distinct keys<br>Every rule must provide every scalar output |
| DDN-QD004 | error | runtime/ddn-quality-data.js | Overlapping rules<br>More than one matching rule |
| DDN-QD005 | error | runtime/ddn-quality-data.js | Uncovered input witness |
| DDN-QD006 | error | runtime/ddn-quality-data.js | Not a rule-based decision projection<br>Input must be a record<br>Unknown input<br>Input outside declared domain: |
| DDN-QD008 | error | runtime/ddn-quality-data.js | Rule proof budget exceeded ( |
| DDN-QF001 | error | runtime/ddn-quality-data.js | Fishbone requires a named cause-to-parent relation<br>Cause endpoints must be objects<br>Fishbone effect must use quality.effect<br>First-level ribs must be quality.category |
| DDN-QF002 | error | runtime/ddn-quality-data.js | Cause cycle |
| DDN-QF003 | error | runtime/ddn-quality-data.js | Fishbone limits: 4 cause levels and 250 occurrences<br>Fishbone needs 1..12 root categories |
| DDN-QF004 | error | runtime/ddn-quality-data.js | Selected cause relationships contain disconnected components |
| DDN-QL001 | error | runtime/ddn-quality-data.js | Flat lifecycle accepts only declared states and transitions<br>Lifecycle needs exactly one initial marker and at least one terminal state<br>Flat states do not contain nested fields/regions |
| DDN-QL002 | error | runtime/ddn-quality-data.js | Initial marker has no incoming and exactly one outgoing transition<br>Terminal state has an outgoing transition<br>Initial transition is unconditional and action-free<br>Noninitial transition requires an event<br>Actions must reference scoped definitions; they are not executed |
| DDN-QL003 | error | runtime/ddn-quality-data.js | Unreachable lifecycle state<br>State cannot reach a terminal outcome |
| DDN-QL004 | error | runtime/ddn-quality-data.js | Ambiguous event without declared guard domains |
| DDN-QL005 | error | runtime/ddn-quality-data.js | traces must be an array of at most 100 traces<br>Trace must contain up to 1000 events<br>Trace event name required<br>Trace event supports event and data only<br>Event data must be a record<br>Unknown trace input<br>Trace input outside domain |
| DDN-QL006 | error | runtime/ddn-quality-data.js | No unique permitted transition for |
| DDN-QL007 | error | runtime/ddn-quality-data.js | Trace final state differs from expected |
| DDN-QM001 | error | runtime/ddn-quality-data.js | Encoding mode is numeric, category or bands<br>Unknown registered cell palette<br>Numeric encoding needs an explicit finite increasing domain<br>Category encoding requires 1..12 distinct scalar values<br>Bands require strictly increasing finite boundaries<br>Each category/band needs its readable legend label<br>Conflicting encoding modes |
| DDN-QM002 | error | runtime/ddn-quality-data.js | Encoded cells require unique source assignment<br>Unmapped categorical cell<br>Encoded numeric cells must be numbers, not numeric strings<br>Cell is outside the declared domain<br>Cell is outside band boundaries |
| DDN-QP001 | error | runtime/ddn-core.js | Panel view must resolve to a named view<br>A child-view panel requires panels.composed@1 and cannot also contain items<br>Child view was not compiled |
| DDN-QP002 | error | runtime/ddn-core.js | Composed panels support one child-view level; recursive dashboards are not supported |
| DDN-QP003 | error | runtime/ddn-core.js | Child exceeds visible graph limits<br>At most twelve embedded child views are permitted |
| DDN-QP004 | error | runtime/ddn-projections.js | Child panels require the unified engine dispatcher |
| DDN-TW01 | warning/info | runtime/ddn-projections.js | Some projection text used estimated metrics. Browser-specific shaping is not certified.<br>Some text runs used estimated metrics; this is not a typography-certified publication. |
| DDN-W012 | warning/info | runtime/ddn-core.js | 0.2 source accepted through compatibility reader. Migrate headers and review new semantic/routing diagnostics. |
| DDN-W013 | warning/info | runtime/ddn-core.js | Bundle keeps imports of files outside the bundle set: |
| DDN-W014 | warning/info | runtime/ddn-core.js | Conflicting external import alias<br>Cannot canonicalize @ |
| DDN-W102 | warning/info | runtime/ddn-contracts.js | Endpoint-kind check deferred for sketch object |
| DDN-W103 | warning/info | runtime/ddn-contracts.js | Preserved unvalidated extension |
| DDN-W106 | warning/info | runtime/ddn-contracts.js | Unregistered semantic property |
| DDN-W108 | warning/info | runtime/ddn-contracts.js | Object-level domain association: no field binding inferred |
| DDN-W901 | warning/info | reserved legacy code (referenced by studio/src/component.js) | Legacy engine warning (approximate text metrics / incomplete global routing); Studio excludes it from the warning tally. Not raised by the current runtime. |
| DDN001 | error | runtime/ddn-core.js | Source exceeds demonstrator size limit |
| DDN002 | error | runtime/ddn-core.js | Unterminated block comment |
| DDN003 | error | runtime/ddn-core.js | String contains a raw newline<br>Unterminated string<br>Invalid JSON-style string escape |
| DDN004 | error | runtime/ddn-core.js | Unpaired Unicode surrogate |
| DDN005 | error | runtime/ddn-core.js | Nonfinite number |
| DDN006 | error | runtime/ddn-core.js | Unexpected character ${JSON.stringify(c)} |
| DDN007 | error | runtime/ddn-core.js | Maximum nesting exceeded |
| DDN008 | error | runtime/ddn-core.js | Reserved key |
| DDN010 | error | runtime/ddn-core.js | Expected ${value//type}; found ${t.value//t.type}<br>Expected record key<br>Expected a value<br>Missing closing brace |
| DDN011 | error | runtime/ddn-core.js | Duplicate property ${k.value}<br>Duplicate property ${t.value} |
| DDN012 | error | runtime/ddn-core.js | Unsupported language version ${version}; expected ${SOURCE_VERSIONS.join(', ')} |
| DDN013 | error | runtime/ddn-core.js | Invalid module identity |
| DDN014 | error | runtime/ddn-core.js | Duplicate import alias |
| DDN015 | error | runtime/ddn-core.js | Import must precede the first module header (or follow it in the legacy position before any declaration) |
| DDN020 | error | runtime/ddn-core.js | Imports must be workspace-relative POSIX paths<br>Import escapes workspace |
| DDN021 | error | runtime/ddn-core.js | Import cycle: |
| DDN022 | error | runtime/ddn-core.js | Missing workspace file |
| DDN023 | error | runtime/ddn-core.js | Duplicate module identity |
| DDN024 | error | runtime/ddn-core.js | Duplicate declaration |
| DDN025 | error | runtime/ddn-core.js | Top-level declaration must be data, format or view |
| DDN026 | error | runtime/ddn-core.js | Duplicate stable uid |
| DDN030 | error | runtime/ddn-core.js | Expected a reference |
| DDN031 | error | runtime/ddn-core.js | Unresolved reference @ |
| DDN032 | error | runtime/ddn-core.js | Expected length, not |
| DDN033 | error | runtime/ddn-core.js | Unknown ${n.type} property ${key}<br>Unknown spacing value |
| DDN040 | error | runtime/ddn-core.js | View not found: |
| DDN041 | error | runtime/ddn-core.js | View data must reference one or more data blocks |
| DDN042 | error | runtime/ddn-core.js | Unsupported data declaration<br>Nested fields accept only a fields block |
| DDN043 | error | runtime/ddn-core.js | format must reference a bundle |
| DDN044 | error | runtime/ddn-core.js | Expected ${type} profile, found ${def.type}<br>Expected keyset |
| DDN045 | error | runtime/ddn-core.js | Unknown notation registry |
| DDN046 | error | runtime/ddn-core.js | font_size must be between 8px and 64px<br>Unsupported ${cat}.${key}: ${p[cat][key]}<br>layout.auto_place must be boolean<br>layout.grid_step must be between 8px and 512px<br>style.roughness must be a number from 0 to 3<br>style.hachure must be boolean<br>style.seed must be an integer from 0 to 4294967295<br>layout.columns must be 1..100<br>display.depth must be 0..64<br>Invalid routing policy<br>Layout lengths cannot be negative:<br>Only explicit junction semantics are allowed<br>Shared network trunks require an adopted network profile; independent sharing is forbidden<br>metrics must be required or allow_estimated<br>Page margin must be nonnegative<br>Unknown page orientation<br>Publication<br>Unknown connector routing<br>Unknown curve family<br>curve_tension must be >0 and <=1<br>curve_radius must be >0 and <=1000px |
| DDN047 | error | runtime/ddn-core.js | Numbered relationships require a legend |
| DDN050 | error | runtime/ddn-core.js | Unknown object kind |
| DDN051 | error | runtime/ddn-core.js | Sample requires columns and rows |
| DDN052 | error | runtime/ddn-core.js | Sample columns must bind to fields |
| DDN053 | error | runtime/ddn-core.js | Sample row width does not match columns |
| DDN054 | error | runtime/ddn-core.js | Endpoint owner is outside the selected data modules<br>Relation endpoint is not a data element in scope |
| DDN055 | error | runtime/ddn-core.js | Only relations accept header endpoints<br>Relation requires two endpoints |
| DDN056 | error | runtime/ddn-core.js | Unknown relationship kind |
| DDN057 | error | runtime/ddn-core.js | View selection contains a non-element or out-of-scope element |
| DDN058 | error | runtime/ddn-core.js | Ambiguous legend key<br>Legend key refers to unknown relation |
| DDN059 | error | runtime/ddn-core.js | Callout numbers must be positive integers |
| DDN060 | error | runtime/ddn-core.js | Duplicate callout number |
| DDN061 | error | runtime/ddn-core.js | Missing explicit callout number for |
| DDN062 | error | runtime/ddn-core.js | Placement target is not selected |
| DDN063 | error | runtime/ddn-core.js | Route target is not visible |
| DDN064 | error | runtime/ddn-core.js | Subdiagram target must be a view |
| DDN065 | error | runtime/ddn-core.js | Recursive or excessive inline subdiagram expansion |
| DDN070 | error | runtime/ddn-render.js | Page has no usable drawing area<br>embedding_scale must be >0 and <=4 |
| DDN071 | error | runtime/ddn-projections.js | Projection text would fall below the final publication minimum<br>severity:p.publication.overflow==='error'?'error':'warning',message:'Smallest final text ${fontSize.toFixed(2)}px is below minimum ${minFont.toFixed(2 |
| DDN072 | error | runtime/ddn-render.js | Legend exceeds page height |
| DDN073 | error | runtime/ddn-layout.js | :'DDN213','Unsafe hard waypoint route: '+r.id); else repaired=true; } if(!points&&(hint.routing//p.routing)==='straight'){ const s={a:start,<br>DDN212<br>DDN-I030 |
| DDN074 | error | runtime/ddn-projections.js | Projection exceeds publication page; use content size or a larger page<br>Unscaled drawing exceeds publication area; choose reflow or a larger page<br>Unscaled drawing exceeds publication area |
| DDN076 | error | runtime/ddn-render.js | Inline child text is below final minimum; enlarge the child or link a detail view<br>Inline child rendered below configured minimum |
| DDN077 | error | runtime/ddn-projections.js | Required measured fonts unavailable for projection<br>Required measured fonts unavailable; supply text metrics or a browser provider |
| DDN078 | error | runtime/ddn-render.js | Subdiagram reference target must be a safe relative identifier:  |
| DDN099 | error | runtime/ddn-core.js | Load ddn-contracts.js before ddn-core.js<br>Load layout/text/export modules before rendering |
| DDN100 | error | runtime/ddn-contracts.js | No endpoint contract for |
| DDN101 | error | runtime/ddn-contracts.js | Missing |
| DDN102 | error | runtime/ddn-contracts.js | Unspecified<br>rel.kind+' cannot use '+n.kind+' as '+label,rel); } if(contract.member_endpoints===false&&ep.member)fail('DDN102',rel.kind+' requires object end<br>rel.kind+' requires object endpoints',rel); } if(contract.allow_self===false&&a.id===b.id)fail('DDN102',rel.kind+' requires distinct object identi<br>rel.kind+' requires distinct object identities',rel); const marks=['none','filled','open','diamond','triangle','one','zeroone','many','zeromany']; |
| DDN103 | error | runtime/ddn-contracts.js | Unregistered extension |
| DDN104 | error | runtime/ddn-contracts.js | key+' does not apply to '+target,item); const errors=schemaErrors(value,schema,item.id+'.'+key); if(errors.length)fail('DDN105',errors[0],item |
| DDN105 | error | runtime/ddn-contracts.js | errors[0],item); }else if(!reserved.has(key)){ if(mode==='strict')fail('DDN106','Unknown semantic property '+key,item); warn('DDN-W106','Un |
| DDN106 | error | runtime/ddn-contracts.js | Unknown semantic property |
| DDN107 | error | runtime/ddn-contracts.js | k+' must be boolean or explicit unknown state',item); if(item.properties?.presence!==undefined&&!['required','optional'].includes(item.properties.pr<br>presence must be required, optional, or an explicit state |
| DDN108 | error | runtime/ddn-contracts.js | domain must resolve to a semantic domain |
| DDN109 | error | runtime/ddn-contracts.js | Unknown modeling level |
| DDN110 | error | runtime/ddn-contracts.js | Key must contain fields<br>Duplicate key member<br>Key references missing field<br>Company-scoped entity requires company_id |
| DDN111 | error | runtime/ddn-contracts.js | Missing parent of nested field |
| DDN112 | error | runtime/ddn-contracts.js | Unsupported field shape |
| DDN113 | error | runtime/ddn-contracts.js | Variant requires at least two distinct named alternatives<br>Variant requires explicit discriminator name |
| DDN114 | error | runtime/ddn-contracts.js | Unknown endpoint mark<br>Structural participation markers do not apply to |
| DDN115 | error | runtime/ddn-contracts.js | Instance relation source must be an instance/copy when its level is asserted<br>Instance relation target must be a definition when its level is asserted |
| DDN116 | error | runtime/ddn-contracts.js | Join tuple names missing target field<br>Same-company comparison requires source company_id<br>Same-company reference must include company_id in target tuple<br>A cross-database reference cannot claim a local physical foreign key |
| DDN130 | error | runtime/ddn-contracts.js | n.id+': '+errors[0],n); } const bd=n.properties.x_boundary; if(bd){ const outer=Array.isArray(bd.ports)?bd.ports:[],maps=Array.isArray(bd.bin |
| DDN131 | error | runtime/ddn-contracts.js | Boundary must declare ports |
| DDN132 | error | runtime/ddn-contracts.js | Boundary port bound more than once:<br>Binding is not a declared boundary port<br>Boundary bindings must map this object port to a different object port<br>Binding must resolve to ports<br>Unbound boundary port |
| DDN133 | error | runtime/ddn-contracts.js | Boundary direction must be in or out<br>Boundary payload must identify an existing contract<br>Boundary direction mismatch<br>Boundary payload mismatch |
| DDN134 | error | runtime/ddn-contracts.js | Requirement needs id, owner, acceptance and explicit state |
| DDN135 | error | runtime/ddn-contracts.js | Accepted/waived requirement needs evidence references; prose approval is insufficient<br>Requirement evidence must refer to an evidence contract |
| DDN136 | error | runtime/ddn-contracts.js | Evidence requires method, scope, observation date, subject hash and outcome<br>Passing evidence requires an artifact digest |
| DDN137 | error | runtime/ddn-contracts.js | Affinity must list explicit field comparisons<br>Affinity requires existing fields and eq operator<br>Affinity must name enforcement responsibility |
| DDN138 | error | runtime/ddn-contracts.js | Cross-service contract requires owner, idempotency key and terminal-state vocabulary<br>Reconciliation requires timeout, compensation and evidence requirements |
| DDN139 | error | runtime/ddn-contracts.js | Custody declaration lacks |
| DDN140 | error | runtime/ddn-contracts.js | n.id+': '+bad[0],n);} const ui=n.properties.x_ui; if(ui){if(!Array.isArray(ui.bindings)//!ui.bindings.length//!Array.isArray(ui.commands))fail('DD |
| DDN141 | error | runtime/ddn-contracts.js | UI needs explicit field bindings and command contracts<br>UI binding requires a unique control and an existing field<br>UI command needs authorization, validation, concurrency, failure and audit contracts |
| DDN142 | error | runtime/ddn-contracts.js | Report needs grain, cutoff, columns and reconciliation<br>Report columns must bind existing source fields<br>Unknown report aggregation; register an algorithm contract |
| DDN150 | error | runtime/ddn-export.js | }); if(policy.include_samples)throw Object.assign(new Error('Public sample export needs a separately approved payload fixture; unsupported in redacte<br>}); project(ir); // authorization gate: throws DDN150-DDN154 on policy violations const allowed=new Set(policy.elements.map(ref)),allowedFields=new |
| DDN151 | error | runtime/ddn-export.js | }); const names=new Map(),alias=id=>{if(!names.has(id))names.set(id,policy.identifier_mode==='preserve'?id:'published::n'+String(names.size+1).padSta |
| DDN152 | error | runtime/ddn-export.js | }); const approved=[...ir.elements].filter(n=>allowed.has(n.id)&&n.type!=='sample'&&n.kind!=='sample'); approved.sort((a,b)=>a.id.localeCompare(b.id |
| DDN153 | error | runtime/ddn-export.js | }); return{id:alias(f.id),local:f.local,name:f.name,path:f.path,depth:f.depth,parent:f.parent?alias(f.parent):null,properties:props(f.properties)}; |
| DDN154 | error | runtime/ddn-export.js | }); const allowed=new Set(policy.elements.map(ref)),allowedFields=new Set(policy.fields.map(ref)),all=new Set(ir.elements.map(n=>n.id)); for(const i |
| DDN200 | error | runtime/ddn-layout.js | Automatic gaps must be at least 20px |
| DDN201 | error | runtime/ddn-layout.js | Tree hierarchy has multiple parents:<br>Tree hierarchy contains a cycle<br>Unreachable hierarchy cycle |
| DDN202 | error | runtime/ddn-layout.js | Layout root is outside selected view<br>Mind-map root must be a hierarchy root |
| DDN203 | error | runtime/ddn-layout.js | No native placement algorithm |
| DDN204 | error | runtime/ddn-layout.js | Conflicting hard placements:<br>Unable to honor pinned geometry<br>Pinned or retained placements overlap: |
| DDN211 | error | runtime/ddn-layout.js | Routing grid exceeds bounded capacity; split the view |
| DDN212 | error | runtime/ddn-layout.js | Endpoint clearance conflicts with another object:<br>No free endpoint escape corridor:<br>DDN215<br>DDN213 |
| DDN213 | error | runtime/ddn-layout.js | Unsafe hard waypoint route:<br>DDN214 |
| DDN214 | error | runtime/ddn-layout.js | Straight connector intersects an unrelated object; choose orthogonal routing<br>Straight connectors share a track; choose distinct ports or orthogonal routing<br>DDN215 |
| DDN215 | error | runtime/ddn-layout.js | No unambiguous orthogonal route within bounded search:<br>DDN216<br>No valid route under the authored constraints. |
| DDN216 | error | runtime/ddn-layout.js | Independent connector lanes overlap near an endpoint:<br>DDN217 |
| DDN217 | error | runtime/ddn-layout.js | No safe label on the authored hard route:<br>No collision-free relationship label position:<br>DDN218 |
| DDN218 | error | runtime/ddn-layout.js | quality.errors[0]); for(const message of quality.errors)diagnostics.push({code:'DDN-LW03',severity:'warning',message}); return {routes,crossings,lab<br>DDN220 |
| DDN220 | error | runtime/ddn-layout.js | DDN221<br>No checked curved route/label fits |
| DDN221 | error | runtime/ddn-layout.js | ].includes(e.code))throw e;last=e;failures.push({strategy:attempt,code:e.code,message:e.message});}last.attempts=failures;throw last; } function inspe<br>quality.errors[0]); return {...result,routes,crossings,labels,quality,curveTolerance:CURVE_TOLERANCE}; } return {crossingBridge,curvedRouting,flatte<br>DDN-I030 |
| DDN223 | error | runtime/ddn-layout.js | });const[l,r]=curveSplit(s,.5),mid=(lo+hi)/2;flat(l,segment,lo,mid,depth+1);flat(r,segment,mid,hi,depth+1);} commands.forEach((s,i)=>{if(!points.leng<br>].includes(e?.code); if(p.layout.optimize!=='none'&&(!lastError//eligible(lastError))){ const improves=r=>{if(!best)return true;const a=score(best) |
| DDN224 | error | runtime/ddn-render.js | Crossing jump obstructs an object or label; increase spacing or select crossings:gap |
| DDN900 | error | runtime/ddn-core.js | Unsupported view override group<br>Reference model does not implement group<br>Reference renderer supports reference and inline modes; balanced collapsed interfaces are specified separately<br>Reference renderer does not implement view declaration |
| LIVE-P001 | error | runtime/ddn-patterns.js | Pattern gap must be a length from 16 to 2000 CSS pixels.<br>grid_step must be a length from 8 to 512 CSS pixels.<br>Layout needs finite, positive measured rectangles.<br>Unsupported placement pattern: |
| LIVE-P002 | error | runtime/ddn-patterns.js | Placement search budget exhausted; split the view or relax fixed frames.<br>Organic placement is bounded to 4000 elements; split the view or choose another pattern. |
| LIVE-P003 | error | runtime/ddn-patterns.js | No available grid slot within the bounded placement search:<br>The requested ring cannot fit fixed frames or obstacles. Increase available space, reduce detail, or choose another pattern.<br>No legal slot in the requested graph layer:<br>No collision-free organic placement in the search budget: |
| LIVE-P004 | error | runtime/ddn-patterns.js | Measured element does not fit all fixed frames:<br>Pinned element is outside its fixed frame: |
| LIVE001 | error | studio/src/api.js | Presentation options must be a record.<br>Unsupported presentation option: |
| LIVE002 | error | studio/src/api.js | Unsupported ${k}: ${o[k]} |
| LIVE003 | error | studio/src/api.js | ${k} must be between ${min} and ${max}.<br>k+' must be boolean or null.'); if(o.relationRouting!=null){if(typeof o.relationRouting!=='object'//Array.isArray(o.relationRouting))fail('LIVE022',' |
| LIVE010 | error | studio/src/api.js | Invalid workspace DDN path:<br>Workspace must be a filename-to-DDN-source map.<br>DDN source must be text, at most 2,000,000 characters per file.<br>Imports must be workspace relative.<br>Import escapes workspace.<br>Expected a source changes map. |
| LIVE011 | error | studio/src/api.js | Workspace limit: 1,500 files and 12,000,000 source characters. |
| LIVE012 | error | studio/src/api.js | Missing entry:<br>Missing source file:<br>Missing source file.<br>File not found.<br>Missing edited file. |
| LIVE013 | error | studio/src/api.js | Live view limit: 128 elements and 384 relationships. Split the model into linked views. |
| LIVE014 | error | studio/src/api.js | Workspace name is required. |
| LIVE015 | error | studio/src/api.js | Unknown saved workspace format. |
| LIVE016 | error | studio/src/api.js | Workspace destroyed. |
| LIVE020 | error | studio/src/api.js | Interaction projection does not support<br>Interaction projection retains its fixed lanes and typography. |
| LIVE021 | error | studio/src/api.js | Requested mark is not supported by this projection/transform<br>This projection does not allow graph setting<br>Data-bound coordinates cannot be replaced with automatic graph placement |
| LIVE022 | error | studio/src/api.js | relationRouting must be a record keyed by verb or relation id.<br>relationRouting key is not a verb or relation in this view: |
| LIVE023 | error | studio/src/api.js | Unsupported relationRouting value for ${key}: ${value} |
| LIVE030 | error | studio/src/api.js | Source changed since this edit was prepared. |
| LIVE031 | error | studio/src/api.js | Overlapping or invalid text edits. |
| LIVE033 | error | studio/src/api.js | File is imported by: |
| LIVE034 | error | studio/src/api.js | Destination already exists. |

## 9. Embedding / runtime API summary

Runtime modules (`notation/runtime/`, real ES modules, no dependencies): cross-module wiring goes through an explicit module registry (`ddn-module-registry.js`: `publishNamespace`/`namespace`/`optionalNamespace`, one store per realm shared via `globalThis`), so script-tag, CJS `require`, ESM `import`, and `vm` consumers all find the same namespaces. Bundle entries publish the documented browser globals (DDNLive, DDNRender, …) from those namespaces; module code never reads host globals directly. Registry assets under `notation/runtime/assets/` (`catalogue.js`, `glyphs.js`, `profiles-catalogue.js`) are generated ESM (`tools/build-assets.js` from `standard/registry/` — do not hand-edit). Per-module contents:

| module | global | contents |
|---|---|---|
| ddn-contracts.js | DDNContracts | semantic/property/extension validation (`validate`, `schemaErrors`, workflow/guard evaluators) — load before ddn-core |
| ddn-profiles.js | DDNProfiles | profile catalogue merge (`registry(base)`) + profile validators (`validate`, `get`) |
| ddn-profile-quality.js | DDNProfileQuality | additive profile-completion validators |
| ddn-core.js | DDN | lex/parse/bundle/createWorkspace/build, `DEFAULTS`, `CHOICES`, `PROPERTIES`, `quantity`, `semanticJSON`, `DDNError`, VERSION 0.6.0-beta.1 |
| ddn-text.js | DDNText | text measurement (`FONTS` roles, `setMetrics`, `setProvider`, grapheme wrap) |
| ddn-shapes.js | DDNShapes | silhouettes/anchors |
| ddn-sketch.js | DDNSketch | seeded hand-drawn stroke geometry (needed before render for `look: handDrawn`) |
| ddn-palette.js | DDNPalette | fixed themes/semantic colours (`themes`, `semantic`, `node`, `contrast`) |
| ddn-layout.js | DDNLayout | placement algorithms, port assignment, orthogonal + curved routing |
| ddn-patterns.js | DDNPatterns | pin-preserving pattern placements (fit_grid/circular/radial/organic) |
| ddn-placement.js | DDNPlacement | placement orchestration + retained `layoutState` |
| ddn-render.js | DDNRender | native SVG graph renderer (`render`) |
| ddn-engine.js | DDNEngine | projection renderer registry/dispatcher (`render`, `plan`, `registerProjectionRenderer`); profile-aware label enrichment (state transitions, communication seq numbers, BPMN gateway marks, CPM, family years) |
| ddn-projection-data.js | DDNProjectionData | typed projection plans (`plan`, `get`, `supported`) |
| ddn-quality-data.js | DDNQualityData | quality/lifecycle/decision/fishbone/CPM plan builders |
| ddn-quality-render.js | DDNQualityRender | native quality/matrix renderers |
| ddn-projections.js | DDNProjections | data-bound SVG projections (`render`, `vegaLite`) |
| ddn-interaction.js | DDNInteraction | experimental interaction/sequence-lane profile |
| ddn-export.js | DDNExport | allowlist export: `project(ir)`, `serialize(ir)` (JSON or SQL DDL) |
| ddn-defaults.js | DDNDefaults | read-only per-kind defaults: `use(registry)`, `forKind(idOrKeyword[, registry])` → deep copy of the kind's `defaults` object (`{}` when absent) |

Distribution bundles (`notation/dist/`, built with Rollup via `tools/build-sdk.js` / `npx rollup -c tools/rollup.config.mjs`; entries in `tools/rollup/entries/`). Each bundle ships: a readable browser IIFE `.js` (identical globals/load-guards to the historical concatenated builds), a minified `.min.js` with `.min.js.map` (terser), an ES module build, and TypeScript declarations `.d.ts` (CJS) + `.d.mts` (ESM). For the four modular bundles the ESM build is `ddn-<name>.mjs` with sibling-bundle imports that resolve relative to `dist/`; the all-in-one ESM entry is `ddn.mjs` (there is no `ddn.global.mjs`). The bundles: `ddn-core` = defaults/quality-data/projection-data/profile-quality/profiles/contracts/core/patterns/export/engine — parse/build/validate/export plus the workspace API, no rendering; `ddn-graph` = core + palette/text/sketch/shapes/layout/placement/render + interaction — the graph renderer, registers the `graph` projection kind; `ddn-quality` = graph + quality renderers (quality charts, decision tables, fishbone) — registers the `fishbone` and `decision` kinds, which compose through ddn-projections; `ddn-projections` = graph + data-bound projections (chart/matrix/panels/timeline/table/sequence/timing/chen); `ddn.global.js` = everything in one file. The all-in-one ESM entry is `ddn.mjs` (types `ddn.d.mts`); `notation/package.json` exposes the bundles through an `exports` map — `"."` → `dist/ddn.mjs` (import) / `dist/ddn.global.js` (require), plus `"./core"`, `"./graph"`, `"./projections"`, `"./quality"` → the matching `.mjs`/`.js` with per-format `types` — and declares `sideEffects: ["dist/*.js"]` so bundlers tree-shake the ESM builds while preserving the IIFE guard side effects. `ddn.css` = optional CSS custom-property hook stylesheet. `DDNEngine` maps projection kinds to bundles: graph→ddn-graph.js; chart/matrix/panels/timeline/table/sequence/timing/chen→ddn-projections.js; fishbone/decision→ddn-quality.js (loaded alongside ddn-projections). Missing bundle → DDN-E010 naming the bundle to load.

Core API essentials:
- `DDN.parse(text, name)` → `{version, module, imports, sections: [{module, declarations}], declarations, …}` (throws `DDNError`).
- `DDN.build(files, entry, viewName, registry)` → `{ir, workspace}`; `files` is `{path: sourceText}`; runs all validators, throws `DDNError`.
- `DDN.bundle(files, entry)` → `{text, diagnostics}` self-contained multi-module file.
- `DDNExport.serialize(ir)` → JSON string (or SQL DDL when `export.format: sql`).
- `DDN.semanticJSON(ir)` → canonical semantic payload (basis of `modelFingerprint`).

Live API (`DDNLive`, `notation/studio/src/api.js`): `DDNLive.createWorkspace({filename: text})` → workspace with `entries()`, `views(entry)`, `analyze(file)`, `resolve(entry, view)`, `inspect(entry, view)` (capabilities/profiles/fingerprint/dependencies), `renderSync({entry, view, overrides, layoutState})` → `{svg, scene, diagnostics, layoutState, modelFingerprint, capabilities, keys, sourceMap, …}`, `render` (async alias), `exportModel`, `exportVegaLite`, `evaluateDecision`, `simulateLifecycle`, `projectionPlan`, `updateFiles`, `applyEdits` (structured text edits), `snapshot`, undo/redo, `subscribe`. Module-level: `DDNLive.parse`, `DDNLive.lex`, `DDNLive.bundle(files, entry)` (also exposed as `io.bundle`), `DDNLive.registerWorkspace(id, files)`, `DDNLive.fromSnapshot`, `DDNLive.defaults.forKind`, `DDNLive.kinds`/`relations` (id/label/code lists), `DDNLive.glyphs.forKind(kindId)`.

**Overrides channel** (`renderSync` `overrides` record; unknown keys → LIVE001, bad values → LIVE002/003). Keys and allowed values: `endpointOrdering: source|optimize|preserve`; `placement: source|auto|grid|manual|fit_grid|circular|radial|layered|tree|spanning_tree|mindmap|grouped|organic`; `center: source|pins|content`; `theme: source|default|base|neutral|dark|night|forest`; `look: classic|handDrawn|neo`; `font: source|sans|serif|mono|handwriting`; `routing: source|orthogonal|straight|curved|rounded` (`rounded` = curved + rounded corners); `crossings: source|gap|bridge|square_bridge`; `fields: source|names|none`; `domains`/`datatypes: source|show|hide`; `labels: source|numbers|text|tokens`; `kind: source|icon_token|icon|text|none`; `page: source|content|web|a4-landscape|a4-portrait|letter-landscape|letter-portrait|custom`; `mark: source|bar|line|area|point|pie|donut` (chart only, capability-dependent); numeric ranges: `width`/`height` 400..32000, `roughness` 0..3, `fontSize` 8..64, `gridStep` 8..512, `depth` 0..64 (integer), `curveTension` 0..1, `curveRadius` 0..512; booleans: `autoPlace`, `hachure`; `relationRouting`: record keyed by verb or relation id (relation id wins over verb) with values `orthogonal|straight|curved|rounded` (LIVE022/023). Data-bound/chen projections reject graph controls (LIVE021); sequence/interaction projections retain fixed lanes and typography (LIVE020). Live view limit: 128 elements / 384 relations (LIVE013); workspace limit 1,500 files / 12M chars (LIVE011).

CSS hooks on rendered SVG: root `ddn-svg ddn-view-<kind> ddn-profile-<slug>`; nodes `ddn-node ddn-kind-<code>` + `data-ddn-id`; relations `ddn-rel ddn-verb-<slug>`; `ddn-field`, `ddn-label`, `ddn-panel`, `ddn-frame`, `ddn-mark ddn-mark-<type>`. Slugs lowercase with non-alphanumeric runs collapsed to dashes.


## 10. Worked examples (all verified with `cli.js check`)

Each example below was extracted and passes `node notation/cli/cli.js check <f> --workspace <tmpdir>` (with `shared.ddn` alongside where imported). Comments annotate the language features.

### 10.1 Graph / crow's-foot ERD (`erd.crowfoot@1`)

```ddn
ddn "0.5";                              // version header (newest source dialect)
module "ddn.examples.crows-foot";

import "shared.ddn" as shared;          // file-level import, legacy position (after FIRST header, before first declaration)

// erd.crowfoot@1: every ref/assoc relation MUST carry source_mark + target_mark
// from one|zeroone|many|zeromany (else DDN-PJ087).
data sales {
    object customer "Customer" {
        kind: table;                    // core kind keyword, unquoted
        fields {
            field customer_id { key: primary; }
            field display_name;
        }
    }
    object purchase "Purchase" {
        kind: table;
        fields {
            field purchase_id { key: primary; }
            field customer_id;
        }
    }
    object line "Invoice line" {
        kind: table;
        fields { field line_id { key: primary; } }
    }
    // relation <id> "<label>" @from -> @to { kind: <verb>; ... }
    relation r_places "places" @customer -> @purchase {
        kind: ref;
        source_mark: one;               // crow's-foot cardinality (structural verbs only)
        target_mark: zeromany;
        enforcement: database;
    }
    // member (field-level) endpoints:
    relation r_customer_fk "purchase customer" @purchase.customer_id -> @customer.customer_id {
        kind: ref;
        source_mark: zeromany;
        target_mark: one;
        enforcement: database;
    }
}

view erd "Synthetic sales / crow's-foot ERD" {
    data: [@sales];                     // required: array of data-block refs
    format: @shared.styles.technical;   // ref to a bundle declaration in the imported file
    projection { kind: graph; profile: "erd.crowfoot@1"; }   // profile id is dotted: quote it
    publication { size: content; fit: none; overflow: error; }
}
```

`shared.ddn` (the imported file, shown once; reused by 10.2/10.3/10.4):

```ddn
ddn "0.5";
module "ddn.examples.shared";

format styles {
    notation core;
    style classic;
    layout wires { algorithm: grid; gap: 80px; }
    display detailed;
    display compact { fields: none; maturity: none; badges: none; }
    publication screen { size: content; width: 1360px; height: 860px; margin: 30px; overflow: warn; }
    legend words { mode: text; width: 280px; }
    bundle technical {
        notation: @core;
        style: @classic;
        layout: @wires;
        display: @detailed;
        publication: @screen;
        legend: @words;
    }
}
```

### 10.2 Flow / pipeline graph (plain `ddn@1` profile, numbered legend)

```ddn
ddn "0.5";
module "ddn.examples.flow";
import "shared.ddn" as shared;

data model {
    object source "Operational customer" { kind: table; workload: [oltp]; role: authoritative; }
    object capture "Capture changes" { kind: activity; }
    object events "customer.changed" { kind: topic; }
    object history_job "Build history" { kind: activity; }
    object history "Customer history" { kind: history; workload: [olap]; temporal: bitemporal; }
    relation r1 @source -> @capture { kind: captures_changes_into; capture: cdc; }
    relation r2 @capture -> @events { kind: publishes_to; transport: kafka; }
    relation r3 @events -> @history_job { kind: delivers_to; scope: "history consumer"; }
    relation r5 @history_job -> @history { kind: write; }
}
view flow "Capture, transport and transformation" {
    data: [@model];
    format: @shared.styles.technical;
    display: @shared.styles.compact;
    publication { width: 1550px; height: 1020px; }
    // numbered callout legend: every visible relation needs a unique positive number (DDN061)
    legend { mode: numbers; keys: { "r1": 1, "r2": 2, "r3": 3, "r5": 5 }; width: 300px; }
}
```

(For a strict flowchart, use `projection { kind: graph; profile: "flow.basic@1"; }` with only `flow.*` kinds and `flow.next` links, one `flow.start`, one `flow.end`, and `x_diagram.branch` labels on decision outlets — see §6.)

### 10.3 Sequence diagram (`uml.sequence@1`)

```ddn
ddn "0.5";
module "ddn.examples.sequence";

import "shared.ddn" as shared;

// uml.sequence@1: participants are lifelines in declaration order; uml.message
// relations are numbered top-to-bottom in declaration order. x_return draws a
// dashed return; a self-message loops on its own lane.
data flow {
    object customer_app "Customer app" { kind: "application"; }   // dotted/kind with no core keyword: quoted
    object checkout "Checkout" { kind: "service"; }
    object inventory "Inventory" { kind: "service"; }
    relation submit_order "Submit order" @customer_app -> @checkout { kind: "uml.message"; }
    relation reserve_stock "Reserve stock" @checkout -> @inventory { kind: "uml.message"; }
    relation reserve_stock_reply "Stock reserved" @inventory -> @checkout { kind: "uml.message"; x_return: true; }
    relation audit_log "Audit log" @checkout -> @checkout { kind: "uml.message"; }
    relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; }
}

view sequence "Synthetic order flow / sequence" {
    data: [@flow];
    format: @shared.styles.technical;
    projection { kind: sequence; profile: "uml.sequence@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
```

### 10.4 Hierarchical state machine (`state.composite@1`, frames + regions)

```ddn
ddn "0.5";
module "ddn.examples.hierarchicalstate";

import "shared.ddn" as shared;

// Composite state "Fulfillment" is a frame; two parallel regions (payment,
// packing) are x_region frames; each region gets at most one state.initial
// (DDN-PJ113). Transitions are state.transition relations with x_transition.event.
data order {
    object start "Start" { kind: "state.initial"; }
    object draft "Draft" { kind: "state.state"; }
    object fulfillment "Fulfillment" { kind: "state.state"; }
    object closed "Closed" { kind: "state.state"; }
    object done "Done" { kind: "state.final"; }

    object payment_initial "Payment start" { kind: "state.initial"; }
    object awaiting "Awaiting payment" { kind: "state.state"; }
    object paid "Paid" { kind: "state.state"; }
    object payment_final "Payment done" { kind: "state.final"; }

    object packing_initial "Packing start" { kind: "state.initial"; }
    object open "Open box" { kind: "state.state"; }
    object packed "Packed" { kind: "state.state"; }
    object packing_final "Packing done" { kind: "state.final"; }

    relation begin "begin" @start -> @draft { kind: "state.transition"; }
    relation submit "submit" @draft -> @fulfillment { kind: "state.transition"; x_transition: { "event": "submit" }; }
    relation pay "pay" @payment_initial -> @awaiting { kind: "state.transition"; }
    relation paid_ev "paid" @awaiting -> @paid { kind: "state.transition"; x_transition: { "event": "payment_received" }; }
    relation payment_end "payment end" @paid -> @payment_final { kind: "state.transition"; x_transition: { "event": "reconcile" }; }
    relation pack_start "pack start" @packing_initial -> @open { kind: "state.transition"; }
    relation packed_ev "packed" @open -> @packed { kind: "state.transition"; x_transition: { "event": "box_sealed" }; }
    relation packing_end "packing end" @packed -> @packing_final { kind: "state.transition"; x_transition: { "event": "label_printed" }; }
    relation ship "ship" @paid -> @closed { kind: "state.transition"; x_transition: { "event": "shipped" }; }
    relation finish "finish" @closed -> @done { kind: "state.transition"; x_transition: { "event": "archive" }; }
}

view lifecycle "Order lifecycle / composite states" {
    data: [@order];
    format: @shared.styles.technical;
    projection { kind: graph; profile: "state.composite@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    frame fulfillment "FULFILLMENT" { scope: @order.fulfillment;
        members: [@order.fulfillment, @order.awaiting, @order.paid, @order.open, @order.packed]; }
    frame payment "PAYMENT" { x_region: true;
        members: [@order.payment_initial, @order.awaiting, @order.paid, @order.payment_final]; }
    frame packing "PACKING" { x_region: true;
        members: [@order.packing_initial, @order.open, @order.packed, @order.packing_final]; }
}
```

(For a validated flat lifecycle use `profile: "state.flat@1"`: exactly one `state.initial` with a single unconditional outgoing transition, ≥1 terminal, full reachability — see §6.)

### 10.5 Matrix (`matrix.bcg@1`, data-bound)

```ddn
ddn "0.5";
module "ddn.examples.matrix-pack";

import "shared.ddn" as shared;

// Quadrant profiles fix the categories: bcg rows are growth high/low, columns
// share high/low, each declared via x_category {axis, level} (DDN-PJ082).
// Cells are assoc relations row -> column; the cell text comes from value: "name".
data axes {
    object g_high "Market growth: high" { kind: record; x_category: {axis: "growth", level: "high"}; }
    object g_low "Market growth: low" { kind: record; x_category: {axis: "growth", level: "low"}; }
    object s_high "Relative share: high" { kind: record; x_category: {axis: "share", level: "high"}; }
    object s_low "Relative share: low" { kind: record; x_category: {axis: "share", level: "low"}; }
}

data items {
    relation bcg_star "Sparkling tea" @axes.g_high -> @axes.s_high { kind: assoc; }
    relation bcq_question "Nitro kombucha" @axes.g_high -> @axes.s_low { kind: assoc; }
    relation bcg_cow "Classic cola" @axes.g_low -> @axes.s_high { kind: assoc; }
    relation bcg_dog "Diet cream soda" @axes.g_low -> @axes.s_low { kind: assoc; }
}

view bcg "Synthetic portfolio / BCG" {
    data: [@axes, @items];
    format: @shared.styles.technical;
    projection {
        kind: matrix; profile: "matrix.bcg@1";
        rows: [@axes.g_high, @axes.g_low];
        columns: [@axes.s_high, @axes.s_low];
        relation: "assoc";              // matrix cell relation kind (registered keyword)
        value: "name";                  // binding for the cell text
        duplicates: join;               // allowed on bcg (not on raci/crud)
    }
}
```

### 10.6 Self-contained multi-module file (RFC-117, no imports)

```ddn
ddn "0.5";

// One file, three module sections. Sibling sections reference each other by
// module-qualified id (@shop.data.records) with no import between them.

module "shop.model";

format styles {
    notation core;
    style classic;
    layout wires { algorithm: grid; gap: 80px; }
    display detailed;
    publication screen { size: content; width: 1360px; height: 860px; margin: 30px; overflow: warn; }
    legend words { mode: text; width: 280px; }
    bundle technical {
        notation: @core;
        style: @classic;
        layout: @wires;
        display: @detailed;
        publication: @screen;
        legend: @words;
    }
}

module "shop.data";

data records "Shop records" {
    object customer "Customer" {
        kind: table;
        role: authoritative;
        fields {
            field customer_id { key: primary; }
            field display_name;
        }
    }
    object order "Order" {
        kind: table;
        fields {
            field order_id { key: primary; }
            field customer_id;
            field ordered_at;
        }
    }
    relation order_customer "Customer places orders" @order.customer_id -> @customer.customer_id {
        kind: references;
        source_mark: zeromany;
        target_mark: one;
    }
    sample customers "Synthetic customers" {
        mode: synthetic;
        columns: [@customer.customer_id, @customer.display_name];   // bind field identities
        rows: [["C001", "Customer A"], ["C002", "Customer B"]];
    }
}

module "shop.views";

view overview "Self-contained / overview" {
    data: [@shop.data.records];
    format: @shop.model.styles.technical;
}

view compact "Self-contained / compact" {
    data: [@shop.data.records];
    format: @shop.model.styles.technical;
    display { fields: none; }           // view-local override over the bundle's display
}
```

Check with an explicit view: `cli.js check main.ddn --workspace <dir> --view overview` (and `--view compact`). Note: without `--view`, the CLI builds the first view of the entry file's FIRST module — this file's first module (`shop.model`) declares no view, so a bare `check` fails with DDN040 even though the file is valid.


## 11. Appendix — full grammar (standard/grammar/ddn.ebnf, verbatim)

```ebnf
(* DDN 0.5 syntactic core. Context and property restrictions are in spec/01-language.md.
   Whitespace/comments are skipped between terminals. All files are UTF-8.
   RFC-117: a file holds one or more module sections. File-level imports come
   before the first module header (canonical) or immediately after the FIRST
   header before its first declaration (legacy position, kept for existing
   single-module files); anywhere else an import is rejected (DDN015). *)
document       = "ddn", string, ";", { import }, section, { section } ;
section        = "module", string, ";", { top } ;
import         = "import", string, "as", identifier, ";" ;
top            = data | format | view ;
data           = "data", identifier, [ string ], block ;
format         = "format", identifier, [ string ], block ;
view           = "view", identifier, [ string ], block ;
block          = "{", { member }, "}", [ ";" ] ;
member         = property | declaration | targetDeclaration | group ;
property       = identifier, ":", value, ";" ;
declaration    = identifier, identifier, [ string ], [ endpoints ], ( block | ";" ) ;
targetDeclaration = ( "place" | "route" ), reference, block ;
group          = identifier, block ;
endpoints      = reference, "->", reference ;
reference      = "@", identifier, { ".", identifier } ;
value          = string | quantity | number | reference | atom | array | record ;
array          = "[", [ value, { ",", value }, [ "," ] ], "]" ;
record         = "{", [ entry, { ( "," | ";" ), entry }, [ "," | ";" ] ], "}" ;
entry          = ( identifier | string ), ":", value ;
atom           = identifier ;
quantity       = number, unit ;
unit           = "px" | "pt" | "mm" | "cm" | "in" | "ms" | "s" | "min" | "h" | "d" | "%" ;
identifier     = ( letter | "_" ), { letter | digit | "_" | "-" } ;
letter         = "A" … "Z" | "a" … "z" ;
digit          = "0" … "9" ;
number         = [ "-" ], ( "0" | nonzero, { digit } ), [ ".", digit, { digit } ], [ exponent ] ;
nonzero        = "1" … "9" ;
exponent       = ( "e" | "E" ), [ "+" | "-" ], digit, { digit } ;
string         = '"', { jsonStringCharacter | jsonEscape }, '"' ;
lineComment    = "//", { characterExceptLineEnd } ;
blockComment   = "/*", { characterExceptClosingComment }, "*/" ;
(* Strings use JSON escapes; surrogate pairs must be valid. Comments do not nest.
   The maximal-munch lexer recognizes -> before punctuation and adjacent numeric units.
   The generic declaration production is narrowed by legal child types in the specification.
   Endpoint syntax is legal only on relation declarations in the core. *)
```
