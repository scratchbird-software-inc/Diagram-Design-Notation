# DDN (Diagram Design Notation) — AI Authoring Reference

Single self-contained authoring specification. An AI given ONLY this file plus a natural-language diagram request must be able to produce correct, current-dialect `.ddn` source for any diagram the runtime supports. Derived entirely from the authoritative repository sources of DDN runtime **0.7.0** (`notation/runtime/*`, `notation/cli/cli.js`) and standard 0.3/0.5 (`standard/grammar/ddn.ebnf`, `standard/registry/*`); vocabulary and property tables are machine-extracted, not paraphrased. (DDN = the open-source language and project: reference runtime, CLI, free ddn-viewer and ddn-designer. ScratchWeaver sponsors the project; ScratchRobin owns backend evaluation (KEEL) — never in scope here.)

<!-- generated: do not edit (counts) -->
**Vocabulary counts (generated from the registries + runtime sources):**
- Object kinds: **374 total** = 152 core (`registry/catalogue.json .kinds`) + 222 profile (`registry/profiles/catalogue.json .kinds`)
- Relationships (verbs): **185 total** = 91 core + 94 profile
- Diagram profiles: **150** (`profiles/catalogue.json .profiles`)
- Projection kinds: **12** (`graph`, `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`, `fishbone`, `decision`, `sequence`, `timing`, `geo`)
- Endpoint marks: 12; object families: 12; relation families: 8; facets: 118; view types: 20; registered data properties: 108
- Diagnostic codes: **437** extracted from the runtime (reference runtime + Studio `src/`)
<!-- /generated (counts) -->

## 1. Purpose and the generate → check → fix loop

DDN is a text notation: one or more `module` sections per file; `data` blocks hold the model (objects, fields, relations); `format` blocks hold reusable presentation profiles; `view` blocks compose data + presentation into a renderable diagram. Everything is validated by a reference implementation.

**Workflow:**
1. Decide the diagram family with the decision guide (§6); write the `.ddn` file(s) per §2–§5.
2. Validate: `node notation/cli/cli.js check <file.ddn> --workspace <dir>` — success prints `{"status":"pass-core",...}`; failure prints one JSON diagnostic `{"code":"DDN###","message":"...","source":"...","offset":N}`.
3. Look the code up in §9 (FIX column), fix, re-run. Iterate until clean. `render` additionally runs layout/routing/publication checks (DDN200–224, DDN-PJ060+), so **run `render` too** for graph views when feasible.

### 1.1 AI authoring rules (normative DO / DON'T — known AI failure modes)

- DO use ONLY kind keywords, verb keywords, profile ids, property keys and enum values enumerated in §3–§5 tables. DON'T invent kinds, verbs, properties, or profiles — unknown ones fail (DDN056, DDN033, DDN046, DDN-PF001).
- DO quote dotted profile kinds/profile ids (`kind: "c4.system";`, `profile: "chart.basic@1";`). DON'T quote core keywords (`kind: table;`).
- DO omit properties whose default you want — omitted ≠ asserted: the runtime resolves defaults (§3.5); a property you did not write is never written into the model. DON'T restate defaults "for clarity"; it bloats source and can override a referenced bundle.
- DO treat the §3.5 defaults table as the effective configuration of every view, and the §3.4 whitelist as the ONLY legal property keys per declaration type.
- DO give every `view` a `data: [@…];` array (DDN041) and run both `check` and `render` before declaring done.
- DO model chart/table/geo/timeline data as `object … { kind: record; x_record: {…} }` elements (or a `records` block), bound explicitly via `records: [@…]`.
- DON'T write `place`/`route`/`frame`/`subdiagram` geometry in any non-graph/chen projection (DDN-PJ002) — those are data-bound.
- DON'T guess endpoint marks: structural marks (`one`, `zeromany`, …) only on structural-family relations, and `erd.crowfoot@1` requires BOTH marks on every relation (DDN-PJ087).
- DON'T put `import` anywhere except before the FIRST `module` header (or immediately after it, before that section's first declaration) — DDN015.
- DON'T write prose annotations as properties; use `description:` on a view or comments (`//`) outside declarations.
- DON'T assume a relation exists because shapes are near each other — every edge is an explicit `relation` declaration.
- DO check profile rules in §10 BEFORE choosing participant kinds/verbs; most first-attempt failures are DDN-PF/DDN-PJ/DDN-PX.

## 2. File anatomy

### 2.1 Document header and module sections

```text
ddn "0.5";                          // version header; FIRST tokens of the file
import "shared.ddn" as shared;      // file-level imports, zero or more
module "shop.model";                // module section header; >= 1 per file
<top-level declarations>
module "shop.views";                // further sections (multi-module)
<top-level declarations>
```

- **Version header**: `ddn "<version>";` — accepted versions are exactly `"0.2"`, `"0.3"`, `"0.4"`, `"0.5"` (DDN012 otherwise). Write `"0.5"` for new files. `0.2` sources are accepted through a compatibility reader and add warning DDN-W012. All files are UTF-8 (reader accepts BOM and CRLF; formatter convention is LF, no BOM). A source file may be at most 2,000,000 characters (DDN001).
- **Module**: `module "<id>";` — the module is a stable namespace, not a file path. Id syntax: `/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/` (DDN013). Module identity must be unique across the whole workspace (DDN023). Declaration identities must be unique across sections (symbol keys are `module::path`; DDN024).
- **Imports**: `import "<path>" as <alias>;` — file-level only. Canonical position: before the FIRST module header. Legacy position: immediately after the FIRST module header, before that section's first declaration. Both sets merge into one file-level import list; alias uniqueness applies across the merged list (DDN014). An import anywhere else is DDN015. Older runtimes reject multi-section files cleanly with DDN010. Import paths must be workspace-relative POSIX paths: no scheme (`http:`), no leading `/` or `\`, no `\`, and `..` may not escape the workspace root (DDN020).
- **Sibling visibility**: sections of the SAME file see each other through module-qualified references (`@shop.model.model`) with no import. Importing a multi-module file imports ALL its modules; `@alias.path` resolves against each section in order; module ids may be dotted, so the resolver matches the LONGEST module-id prefix first.
- **Bundling**: `node notation/cli/cli.js bundle <entry.ddn> --workspace . --out out.ddn` merges a workspace into one self-contained multi-module file (entry modules first, rest sorted by id; internal imports dropped, `@alias.path` canonicalized to sibling references; external imports kept with DDN-W013; conflicts → DDN-W014). Rendering every view of a bundle is byte-identical to rendering the original workspace.

### 2.2 Comments, identifiers, strings, values

- Comments: `// line` and `/* block */` (blocks do NOT nest; unterminated → DDN002).
- Identifiers: ASCII `[A-Za-z_][A-Za-z0-9_-]*`. A quoted label is never identity. An explicit `uid: "..."` property preserves identity across refactoring (workspace-unique; DDN026 on collision).
- Strings: JSON-style double-quoted with JSON escapes; no raw newline (DDN003); surrogate pairs must be valid (DDN004). **Profile-defined dotted kind names and profile ids MUST be quoted** (`kind: "c4.system";`, `profile: "chart.basic@1";`) because `.`/`@` are not identifier characters. Plain core keywords (`table`, `assoc`) are written unquoted.
- Numbers: finite (DDN005); quantities are number+unit with no space: lengths `px|pt|mm|cm|in`, temporal `ms|s|min|h|d`, `%`. Geometry contexts reject temporal units (DDN032). Internal geometry is px (pt = 96/72 px, mm = 96/25.4 px, cm = 96/2.54 px, in = 96 px).
- Colours: CSS colour strings (`"#B45309"`, named colours) wherever a colour property exists (`marker_color`, `pulse_color`, theme-driven styling otherwise).
- Atoms: `true`, `false`, `null`, plus explicit modeling states `missing`, `undecided`, `not_applicable`, `conflicting`. A quoted `"undecided"` is a string, not a state assertion.
- Records: `{ key: value, ... }` — entries separated by `,` or `;`, trailing separator allowed; keys are identifiers or strings; `__proto__`/`prototype`/`constructor` are reserved (DDN008); duplicate keys rejected (DDN011). Arrays: `[ v, v, ]` trailing comma allowed. Max nesting depth 80 (DDN007).
- Properties end in `;`. Blocks may carry an optional trailing `;`.

### 2.3 References

`@a.b.c` resolves a declaration path. Resolution order: (1) first segment matching a file-level import alias → resolve remainder in the imported file's modules (each section in order); (2) longest-prefix module-qualified sibling section in the same file; (3) progressively outer scopes of the referencing declaration within the same module. Unresolved → DDN031. References may point at objects, fields, ports, views, format declarations, etc. depending on context.

## 3. Declarations and property contracts

Top level of a module: exactly `data`, `format`, `view` declarations (anything else → DDN025).

### 3.1 `data <id> ["label"] { … }` — the model

Members (children that are not groups):
- `object <id> ["label"] { … }` — a model element. Optional `kind:` property picks a registry kind (default `object`); any reserved data property (§4.8) or registered `x_*` extension property may be set.
- `domain <id> ["label"] { … }` — semantic domain (default kind `domain`).
- `sample <id> ["label"] { … }` — bound example records; requires `columns: [@field-ref, …]` (each must resolve to a `field`, DDN052) and `rows: [[…], …]` with row width equal to column count (DDN053); missing either → DDN051.
- `flow <id> ["label"] { … }` — element with default kind `pipeline`.
- `assertion <id> ["label"] { … }` — element with default kind `observation`.
- `relation <id> ["label"] @source -> @target { … }` — a relationship. Header endpoints are legal ONLY on relations (DDN055). Endpoints may be elements or members (fields/ports): `@object.field`. The verb is the `kind:` property (default `assoc`), resolved by keyword, lowercase code, or alias (unknown → DDN056).

Groups inside objects (and fields): `fields { field <id> ["label"] {…}; … }` (recursive — a field may contain its own `fields` group; nothing else is legal inside a field, DDN042) and `ports { port <id> ["label"] {…}; … }`. Unknown groups → DDN900. Nested field identity is independent of its visible label: resolved children carry their own ids, parent ids, depth and dotted paths; `@model.customer.contacts.value` is a legal relation endpoint.

Compact authoring (purely additive — both forms desugar in the parser to the IDENTICAL canonical declarations; semantic model, rendered SVG and validation are indistinguishable):

- Typed declarations: any registry object-kind keyword may be the declaration keyword — `table customer "Customer" { … }` ≡ `object customer "Customer" { kind: table; … }`; aliases spell the same kind (`tbl`). Do NOT repeat `kind:` in the body (DDN011). Dotted kinds (`uml.actor`) are usable only through a registry `alias`; most have none — write `object x { kind: "dfd.process"; }`.
- Disambiguation: kind words are contextual (statement start + identifier). Structural keywords (`object`, `relation`, …) always keep their meaning, so `object table "…" { kind: table; }` still parses.
- Contextual members: inside `fields {}`/`ports {}` the member keyword may be omitted — `fields { id { key: primary; } name; }` ≡ the explicit form. Explicit `field`/`port` mixes freely.
- Verb relations: any registry relationship keyword may be the declaration keyword — `ref places "places" @customer [one] -> @purchase [zeromany] { enforcement: database; }` ≡ the canonical `relation … { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; }`. Brackets are optional per side; an OMITTED bracket omits the mark. Aliases work; extension verbs opt in via registry `alias`. Words registered as both kind and verb (`note`, `report`, …) are relations only when `@` endpoints follow.
- Named batches: `relations depends { enforcement: undecided; dep_a "a" @x -> @y; dep_b "b" @y -> @z { lane: hot; } }` expands to one canonical relation per entry (kind from the header; shared properties merge under per-entry ones). Identity is never positional. Anonymous arrow chains are NOT provided.
- View headers: `view erd: @sales as "erd.crowfoot@1";` ≡ `view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }`. Datasource is `@name` or `[@a, @b]`; an optional body merges like canonical properties. The profile string implies `projection.kind` (registry-verified); unknown/ambiguous profiles or a body `projection` after `as` are DDN-E015. Omitting `as` ≡ no projection block.
- Keyed tabular records: a `records` block declares column order once — `records metrics { columns: label, value, unit; label_column: label; row m1: "Alpha", 10, "ms"; }` — and each `row <id>:` ≡ `object <id> "<label>" { kind: record; x_record: {…} }`. Row values are scalar literals only; `label_column` supplies the display label (default: row id). Row ids are the keyed-refresh record keys; a column count mismatch is DDN-E016 naming row + counts; a row body carries extra PROPERTIES only. Canonical data members mix in freely.
- Reuse presets and fragments: top-level templates applied with `use: @name;` — `fields`/`ports` member groups, `relation_props` (relation bodies), `preset` (element/relation bodies and view flow blocks), `fragment` (include-by-reference data members). Expansion happens in workspace assembly and yields identities exactly as handwritten inline. Local properties override presets; conflicting presets are DDN-E017 unless resolved locally; preset-applied properties are ASSERTED, never omitted. `use:` inside a definition body, batch header or non-application context is DDN-E017.
- The normalizer never rewrites verbose↔compact; compactness is an author choice.

Only `object`/`domain`/`sample`/`flow`/`assertion`/`relation` (or compact equivalents) may appear in data (DDN042). Relations belong to data, never to a format override; a renderer never invents a relation because two shapes touch.

### 3.2 `format <id> ["label"] { … }` — reusable presentation declarations

Named declarations: `notation`, `style`, `layout`, `display`, `publication`, `legend`, `chrome`, `validation`, `export`, `projection`, `keyset`, and `bundle` (a bundle references one declaration of each concern by `@ref`). Example:

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

View-level property keys allowed (DDN033 for anything else not starting `x_`): `projection, data, format, notation, style, layout, display, publication, legend, chrome, title, footer, select, exclude, description, uid, validation, export, spacing`. View children may additionally be `place`, `route`, `frame`, `subdiagram`, `flow` declarations and override groups named after the concerns. Any other child → DDN900.

**Selection**: `select: all` (default) or an explicit array of element refs; refs must resolve to in-scope elements (DDN057). `exclude` removes occurrences. A relation is visible when both endpoints are selected unless `display.relations: none`.

**`place`** (optional hints; omit for automatic layout): properties `at: [x, y]` (quantity pair), `size: [w, h]`. Placement targets must be selected (DDN062). Hard pins must not overlap (DDN204).

**`route`** (optional per-relation geometry, view-specific; never changes endpoints): `via: [[x,y],…]` hard waypoints; `source_side`/`target_side` in `east|west|north|south`; `source_fraction`/`target_fraction` in (0,1) for unbound body anchors (cannot replace a field/port endpoint, DDN-I030); `callout: [x,y]` label position; `policy: strict|repair`; `routing: orthogonal|straight|curved`; `curve: bezier|rounded`; `curve_tension` (0,1]; `curve_radius` (>0, ≤1000px). Route targets must be visible relations (DDN063). `route_policy: repair` (default) recomputes an unsafe `via` hint with info diagnostic DDN-LW02; `strict` rejects it (DDN073 non-orthogonal / DDN213 unsafe).

**`frame`**: `scope:` (ref to the boundary element, optional), `members: [@…]` (refs), `at`, `size`, `label`, `dimension`, plus profile flags like `x_region: true`, `x_pool: true`. Frame-vs-member geometry follows `layout.frame_overflow` (`expand` default, `confine`): under `expand` the frame rect grows to enclose members at the standard padding (a declared `at`/`size` rect that already fits is unchanged); under `confine` a declared `at`+`size` frame is fixed and unpinned members are clamped into its interior.

**`subdiagram`**: `view:` (must resolve to a view, DDN064), `mode: reference|inline` (DDN900 otherwise), `at`, `size`, `label`, `binding`, `uid`. `reference` links; `inline` embeds the child's own selection/presentation — inline recursion or depth > 6 → DDN065.

**`legend` / `keyset`**: numbered mode assigns callout numbers via `keys: { "<relation-id-or-local-name>": n }`; ambiguous/unknown keys → DDN058, non-positive-integer numbers → DDN059, duplicate numbers → DDN060. `mode: numbers` requires a visible legend placement (DDN047) and a number for EVERY visible relation (DDN061); shared `keyset` declarations preserve numbers across views. Numbers identify relations; they are not time order.

**`chrome`**: page-chrome visibility, independent of the legend profile's content settings. Flat view-level keywords `legend: auto|on|off`, `title: on|off`, `footer: on|off` (a string `legend:` value is the chrome shorthand; `legend: @ref` still names a legend profile), or a `chrome { legend: …; title: …; footer: …; }` group / named `chrome` declaration. Defaults (`auto`/`on`/`on`): graph views show the relationship key whenever placement is not `none`; chart series colour keys, matrix encoding keys and geo choropleth/size keys show whenever their data exists; title header and footer lines always show. `off` suppresses and reclaims the reserved band. `legend: off` with `mode: numbers` → DDN047. Invalid flat values → DDN-E018; invalid group/profile values → DDN046.

**`validation { mode: sketch|logical|strict; unknown_extensions: warn|error; }`** — `logical` (default): unregistered `x_*` extensions and unknown semantic properties are preserved with warnings (DDN-W103/DDN-W106); `strict`: unregistered extensions (DDN103) and unknown semantic properties (DDN106) fail; sketch-mode endpoint kind mismatches defer to warnings (DDN-W102).

<!-- generated: do not edit (properties) -->
### 3.4 Full property key whitelist per declaration type (from `DDN.PROPERTIES` in `notation/runtime/ddn-core.js`; unknown keys → DDN033; `x_*` always allowed)

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
  "bin_count",
  "k",
  "others",
  "error",
  "trend",
  "inputs",
  "outputs",
  "hit_policy",
  "coverage",
  "analysis_budget",
  "x_completeness",
  "traces",
  "geography",
  "method",
  "graticule",
  "iso",
  "depth"
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
 "chrome": [
  "legend",
  "title",
  "footer"
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
  "chrome",
  "title",
  "footer",
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
  "chrome",
  "title",
  "footer",
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
 ],
 "flow": [
  "label",
  "steps",
  "marker",
  "marker_color",
  "marker_size",
  "speed",
  "rate",
  "uid"
 ],
 "architecture": [
  "files",
  "views",
  "description",
  "uid"
 ]
}
```
<!-- /generated (properties) -->

<!-- generated: do not edit (defaults) -->
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
 "chrome": {
  "legend": "auto",
  "title": "on",
  "footer": "on"
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
<!-- /generated (defaults) -->

<!-- generated: do not edit (enums) -->
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
   "timing",
   "geo"
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
   "organic",
   "ladder"
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
 "chrome": {
  "legend": [
   "auto",
   "on",
   "off"
  ],
  "title": [
   "on",
   "off"
  ],
  "footer": [
   "on",
   "off"
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
<!-- /generated (enums) -->

<!-- generated: do not edit (vocabulary) -->
## 4. Complete vocabulary (machine-extracted)

Every value below was extracted programmatically from `standard/registry/catalogue.json` (version 0.3.0-draft.1) and `standard/registry/profiles/catalogue.json` (runtime 0.7.0). Use these EXACT keywords. Aliases and lowercase registry codes are also accepted by the resolver (`DDN.kindEntry`/`DDN.relationEntry` match keyword, lowercase code, or alias).

### 4.1 Core object kinds (152)

`shape` is the registered default presentation (card = rectangular card; activity = rounded card; frame; note = folded annotation; sample = grid; port; cylinder etc.). Kinds may carry a documentation-only registry `defaults` property object: the renderer NEVER applies it implicitly; authoring tools merge it before explicit properties (explicit wins) and write it into source. Kinds with nonempty defaults: `cloud` {"location":"cloud"}; `cache` {"role":"cache"}; `snapshot` {"temporal":"snapshot"}; `archive` {"role":"archive"}; `history` {"temporal":"event_history"}. All other kinds default to `{}`.

| keyword | name | shape | family | aliases |
|---|---|---|---|---|
| object | Unspecified object | card | concept | obj |
| entity | Business entity / concept | card | concept | ent |
| rel | Relationship concept | card | concept | - |
| domain | Semantic domain | card | concept | dom |
| term | Glossary term | card | concept | - |
| enumeration | Enumeration / code set | card | concept | enum |
| rule | Business rule | card | concept | - |
| unit | Unit / quantity definition | card | concept | - |
| aggregate | Aggregate definition | frame | concept | agg |
| context | Bounded context | frame | concept | ctx |
| binding | Representation binding | card | concept | bind |
| identity | Business identity definition | card | concept | key |
| table | Table | card | sql | tbl |
| view | View | card | sql | viw |
| materialized_view | Materialized view | card | sql | mvi |
| foreign_table | Foreign / external table | card | sql | ftb |
| function | Function | card | sql | fun |
| procedure | Procedure | card | sql | prc |
| trigger | Trigger | card | sql | trg |
| sequence | Sequence / identity generator | card | sql | seq |
| sql_domain | SQL domain | card | sql | sdm |
| sql_type | SQL user-defined type | card | sql | typ |
| constraint | Constraint | card | sql | con |
| index | Index | card | sql | idx |
| synonym | Synonym / database alias | card | sql | syn |
| opr | Operator | card | sql | - |
| pkg | Package / module | card | sql | - |
| ext | Database extension | card | sql | - |
| qry | Query definition | card | sql | - |
| pol | Database policy object | card | sql | - |
| pub | Replication publication | card | sql | - |
| sub | Replication subscription | card | sql | - |
| dataset | Logical dataset | card | data | dst |
| record | Record / payload shape | card | data | rec |
| field | Field / attribute / property | card | data | fld |
| collection | Document collection | card | data | col |
| document | Embedded document / object | card | data | doc |
| array | Array / ordered collection | card | data | arr |
| map | Map / dictionary | card | data | - |
| set | Set / unordered collection | card | data | - |
| variant | Union / structural variant | card | data | var |
| graph | Property graph / graph dataset | card | data | grf |
| graph_node | Graph node type | card | data | nod |
| graph_edge | Graph edge type | card | data | edg |
| key_value | Key-value collection | card | data | kvs |
| wide_column | Wide-column family | card | data | wcf |
| time_series | Time-series dataset | card | data | tsr |
| file | File / file object | card | data | fil |
| file_set | File set / table-format dataset | card | data | fls |
| bucket | Object-storage bucket | card | data | buk |
| manifest | Manifest / data-file metadata | card | data | man |
| search_index | Search index / collection | card | data | src |
| vector | Vector collection / index | card | data | vec |
| blob | Blob / binary asset | card | data | bin |
| tensor | Tensor / multidimensional array | card | data | ten |
| rdf | RDF dataset / named graph | card | data | - |
| fact | Fact representation | card | analytics | fct |
| dimension | Dimension representation | card | analytics | dim |
| bridge | Bridge representation | card | analytics | brg |
| cube | Cube / analytic model | card | analytics | cub |
| semantic_model | Semantic model | card | analytics | sem |
| metric | Metric definition | card | analytics | met |
| report | Report | card | analytics | rpt |
| dashboard | Dashboard | card | analytics | dsh |
| data_product | Data product | card | analytics | dpr |
| feature | Feature definition / feature view | card | analytics | ftr |
| model_artifact | Model artifact | card | analytics | mlm |
| export | Extract / export definition | card | analytics | exp |
| api | Data API / interface | card | interface | - |
| endpoint | Endpoint / port definition | card | interface | ept |
| topic | Topic / retained event channel | card | interface | top |
| queue | Queue | card | interface | que |
| message | Message / event schema | card | interface | msg |
| command | Command schema | card | interface | cmd |
| consumer_group | Consumer group | card | interface | cgr |
| subscription | Subscription | card | interface | sbs |
| schema_registry | Schema registry | card | interface | schr |
| connector | Connector definition | card | interface | cnx |
| webhook | Webhook definition | card | interface | whk |
| federation | Federation / query interface | card | interface | fed |
| activity | Activity / transformation | activity | activity | act |
| pipeline | Pipeline / workflow | activity | activity | pip |
| job | Job definition | activity | activity | - |
| run | Run / execution instance | activity | activity | - |
| schedule | Schedule / timer | activity | activity | scd |
| application | Application / data service | card | activity | app |
| query_operation | Query / read operation | activity | activity | qop |
| write_operation | Write / mutation operation | activity | activity | wop |
| checkpoint | Checkpoint / progress marker | card | activity | chk |
| test | Validation / test execution | activity | activity | tst |
| manual_activity | Manual data-handling activity | activity | activity | hum |
| gateway | Decision / routing activity | activity | activity | gat |
| catalog | Catalog / metastore | frame | namespace | cat |
| database | Database | frame | namespace | db |
| schema | SQL schema | frame | namespace | scm |
| keyspace | Keyspace | frame | namespace | ksp |
| namespace | Generic namespace | frame | namespace | nsp |
| workspace | Project / workspace | frame | namespace | prj |
| folder | Folder / prefix | frame | namespace | dir |
| registry | Metadata registry | frame | namespace | reg |
| cloud | Cloud provider / cloud scope | frame | deployment | cld |
| cloud_account | Cloud account / subscription | frame | deployment | acc |
| region | Region / geography | frame | deployment | rgn |
| zone | Availability / fault zone | frame | deployment | az |
| site | Local site / data centre | frame | deployment | site |
| network | Network / connectivity zone | frame | deployment | net |
| cluster | Cluster | frame | deployment | clu |
| service | Database / storage service instance | frame | deployment | srv |
| host | Host / machine / VM | frame | deployment | host |
| container | Container / process instance | frame | deployment | ctr |
| volume | Volume / tablespace / filegroup | frame | deployment | vol |
| device | Edge device / sensor | frame | deployment | dev |
| environment | Environment | frame | deployment | env |
| security_zone | Security / trust zone | frame | deployment | secz |
| partition_rule | Partitioning rule | card | distribution | prl |
| partition | Logical partition | card | distribution | par |
| shard | Shard | card | distribution | shd |
| placement | Placement binding | card | distribution | plc |
| replica | Replica / deployed copy | card | distribution | rpl |
| replica_set | Replica set / replication group | card | distribution | rps |
| colocation | Co-location group | frame | distribution | cog |
| cache | Cache representation | card | distribution | cac |
| log | Durable log / journal | card | distribution | log |
| router | Router / placement directory | card | distribution | bal |
| snapshot | Data snapshot | card | temporal | snp |
| backup | Backup artifact | card | temporal | bak |
| archive | Archive dataset | card | temporal | arc |
| timeline | Timeline / version branch | card | temporal | tln |
| recovery | Recovery plan / recovery point | card | temporal | rcp |
| window | Time window / watermark definition | card | temporal | win |
| history | History representation | card | temporal | hst |
| retention | Retention / expiry definition | card | temporal | ret |
| organization | Organization / party | card | governance | org |
| team | Team / owner group | card | governance | team |
| role | Role / principal | card | governance | - |
| dct | Data contract | card | governance | - |
| gpo | Governance policy | card | governance | - |
| qlr | Quality assertion | card | governance | - |
| slo | Service-level objective / agreement | card | governance | - |
| entl | Entitlement / grant | card | governance | - |
| cls | Classification definition | card | governance | - |
| prv | Provenance record | card | governance | - |
| dcl | Deletion / legal-hold instruction | card | governance | - |
| note | Note / explanation | note | evidence | note |
| sample | Sample-data grid | sample | evidence | smp |
| fixture | Test fixture / expected output | sample | evidence | fix |
| decision | Decision record | note | evidence | dec |
| issue | Open question / issue | note | evidence | iss |
| observation | Observation / evidence | note | evidence | obs |
| change | Change / migration proposal | note | evidence | chg |
| saved_view | Diagram / saved view | frame | evidence | vie |
| extension | Extension / unknown-kind fallback | note | evidence | extn |

### 4.2 Profile object kinds (222)

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
| uml.enumeration | Enumeration | rect | application | concept | ENUMERATION |
| uml.package | Package | package | application | concept | PACKAGE |
| uml.component | Component | component | application | concept | COMPONENT |
| uml.node | Node | node3d | application | concept | NODE |
| uml.device | Device | node3d | application | concept | DEVICE |
| uml.executionenv | Execution environment | node3d | application | concept | EXECENV |
| uml.artifact | Artifact | artifact | application | concept | ARTIFACT |
| uml.collaboration | Collaboration | collab | application | concept | COLLAB |
| uml.metaclass | Metaclass | rect | application | concept | METACLASS |
| uml.stereotype | Stereotype | rect | application | concept | STEREOTYPE |
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
| state.history_shallow | Shallow history pseudostate | history | object | concept | HISTORY_S |
| state.history_deep | Deep history pseudostate | history | object | concept | HISTORY_D |
| state.junction | Junction pseudostate | junction | object | concept | JUNCTION |
| state.choice | Choice pseudostate | choice | object | concept | CHOICE |
| state.entrypoint | Entry point pseudostate | entrypoint | object | concept | ENTRYPT |
| state.exitpoint | Exit point pseudostate | exitpoint | object | concept | EXITPT |
| state.forkjoin | Fork/join synchronization bar | forkbar | object | concept | FORKJOIN |
| state.terminate | Terminate pseudostate | terminate | object | concept | TERMINATE |
| rule.row | Decision rule | rect | object | concept | ROW |
| uml.subject | Use-case subject | rect | object | concept | SUBJECT |
| flow.connector | Connector | circle | activity | activity | CONNECTOR |
| flow.offpage | Offpage | offpage | activity | activity | OFFPAGE |
| flow.annotation | Annotation | bracket | activity | activity | ANNOTATION |
| flow.storage | Storage | cylinder | activity | activity | STORAGE |
| flow.forkjoin | Fork / join | rect | activity | activity | FORKJOIN |
| flow.objectnode | Object node | rect | record | data | OBJNODE |
| flow.merge | Merge | diamond | activity | activity | MERGE |
| flow.sendsignal | Send signal | sendpent | activity | activity | SEND |
| flow.acceptsignal | Accept signal | acceptpent | activity | activity | ACCEPT |
| flow.timeevent | Time event | hourglass | activity | activity | TIMEEVT |
| flow.flowfinal | Flow final | flowfinal | activity | activity | FLOWFINAL |
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
| flow.intermediate | Intermediate event | intermediate | activity | activity | INTERMEDIATE |
| flow.dataobject | Data object | dataobject | object | data | DATAOBJECT |
| flow.datainput | Data input | datainput | object | data | DATAINPUT |
| flow.dataoutput | Data output | dataoutput | object | data | DATAOUTPUT |
| flow.datastore | Data store | cylinder | dataset | data | DATASTORE |
| flow.group | Group | groupbox | note | activity | GROUP |
| flow.choreotask | Choreography task | choreotask | activity | activity | CHOREOTASK |
| flow.conversation | Conversation | hexagon | activity | activity | CONVERSATION |
| flow.subconversation | Sub-conversation | hexagon | activity | activity | SUBCONVO |
| flow.callconversation | Call conversation | hexagon | activity | activity | CALLCONVO |
| cmmn.stage | Case stage | round | activity | activity | STAGE |
| cmmn.milestone | Case milestone | round | activity | activity | MILESTONE |
| cmmn.sentry | Case sentry | diamond | activity | activity | SENTRY |
| cmmn.caseplan | Case plan model | caseplan | activity | activity | CASEPLAN |
| cmmn.task | Task | rect | activity | activity | TASK |
| cmmn.humantask | Human task | rect | activity | activity | HUMANTASK |
| cmmn.processtask | Process task | rect | activity | activity | PROCESSTASK |
| cmmn.decisiontask | Decision task | rect | activity | activity | DECISIONTASK |
| cmmn.timerevent | Timer event listener | hourglass | activity | activity | TIMELISTENER |
| cmmn.userevent | User event listener | userevent | activity | activity | USERLISTENER |
| cmmn.casefile | Case file item | dataobject | object | activity | CASEFILE |
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
| sysml.testcase | Test case | rect | application | governance | TESTCASE |
| sysml.valuetype | Value type | rect | application | interface | VALUETYPE |
| sysml.interfaceblock | Interface block | rect | application | interface | INTERFACEBLOCK |
| sysml.flowspec | Flow specification | rect | application | concept | FLOWSPEC |
| dmn.decision | Decision | rect | application | governance | DMNDECISION |
| dmn.bkm | Business knowledge model | clippedcorner | application | governance | BKM |
| dmn.inputdata | Input data | round | application | data | INPUTDATA |
| dmn.knowledgesource | Knowledge source | document | application | evidence | KNOWLEDGESOURCE |
| dmn.decisionservice | Decision service | rect | application | governance | DECISIONSERVICE |
| soaml.participant | Participant | rect | application | interface | PARTICIPANT |
| soaml.agent | Agent | actor | application | interface | AGENT |
| soaml.serviceinterface | Service interface | rect | application | interface | SERVICEINTERFACE |
| soaml.servicecontract | Service contract | collab | application | concept | SERVICECONTRACT |
| soaml.capability | Capability | round | application | concept | CAPABILITY |
| soaml.message | Message type | document | application | data | SOAMLMESSAGE |
| soaml.milestone | Milestone | round | application | concept | SOAMLMILESTONE |
| uaf.capability | Capability | tag | application | concept | UAFCAPABILITY |
| uaf.enterprisegoal | Enterprise goal | round | application | governance | UAFENTGOAL |
| uaf.enterprisevision | Enterprise vision | document | application | governance | UAFENTVISION |
| uaf.strategicphase | Strategic phase | rect | application | concept | UAFSTRATPHASE |
| uaf.opperformer | Operational performer | rect | application | interface | UAFOPPERFORMER |
| uaf.opactivity | Operational activity | round | application | activity | UAFOPACTIVITY |
| uaf.opnode | Operational node | rect | application | interface | UAFOPNODE |
| uaf.opexchange | Operational exchange | document | application | data | UAFEXCHANGE |
| uaf.servicespec | Service specification | rect | application | interface | UAFSERVICESPEC |
| uaf.servicefunction | Service function | round | application | activity | UAFSERVICEFN |
| uaf.servicepolicy | Service policy | document | application | governance | UAFSERVICEPOLICY |
| uaf.system | System | rect | application | interface | UAFSYSTEM |
| uaf.systemfunction | System function | round | application | activity | UAFSYSTEMFN |
| uaf.implementer | Implementer | rect | application | interface | UAFIMPLEMENTER |
| uaf.person | Person | actor | application | governance | UAFPERSON |
| uaf.organization | Organization | rect | application | governance | UAFORGANIZATION |
| uaf.post | Post | rect | application | governance | UAFPOST |
| uaf.responsibility | Responsibility | round | application | governance | UAFRESPONSIBILITY |
| uaf.resourceperformer | Resource performer | rect | application | interface | UAFRESPERFORMER |
| uaf.resource | Resource | rect | application | interface | UAFRESOURCE |
| uaf.resourcefunction | Resource function | round | application | activity | UAFRESOURCEFN |
| uaf.technology | Technology | rect | application | interface | UAFTECHNOLOGY |
| uaf.securityelement | Security element | rect | application | governance | UAFSECELEMENT |
| uaf.securitycontrol | Security control | round | application | governance | UAFSECCONTROL |
| uaf.threat | Threat | rect | application | governance | UAFTHREAT |
| uaf.asset | Asset | round | application | governance | UAFASSET |
| uaf.project | Project | rect | application | activity | UAFPROJECT |
| uaf.projectmilestone | Project milestone | round | application | activity | UAFPROJMILESTONE |
| uaf.workpackage | Work package | rect | application | activity | UAFWORKPACKAGE |
| uaf.standard | Standard | document | application | governance | UAFSTANDARD |
| uaf.standardcollection | Standard collection | rect | application | governance | UAFSTDCOLLECTION |
| uaf.protocol | Protocol | document | application | governance | UAFPROTOCOL |
| uaf.actualresource | Actual resource | rect | application | interface | UAFACTRESOURCE |
| uaf.actualorganization | Actual organization | rect | application | governance | UAFACTORG |
| uaf.actualperson | Actual person | actor | application | governance | UAFACTPERSON |
| uaf.dictionaryentry | Dictionary entry | document | application | data | UAFDICTENTRY |
| uaf.archdesc | Architecture description | document | application | concept | UAFARCHDESC |
| uaf.viewpoint | Viewpoint | rect | application | concept | UAFVIEWPOINT |
| uaf.modelref | Model reference | rect | application | concept | UAFMODELREF |
| flow.manualinput | Manual input | manualinput | activity | activity | MANUALINPUT |
| flow.manualop | Manual operation | manualop | activity | activity | MANUALOP |
| flow.preparation | Preparation | hexagon | activity | activity | PREPARATION |
| flow.display | Display | display | activity | activity | DISPLAY |
| flow.delay | Delay | delay | activity | activity | DELAY |
| flow.loopstart | Loop start | hexagon | activity | activity | LOOPSTART |
| flow.loopend | Loop end | hexagon | activity | activity | LOOPEND |
| flow.isomerge | Merge | triangledown | activity | activity | ISOMERGE |
| flow.isoextract | Extract | triangleup | activity | activity | ISOEXTRACT |
| flow.card | Card | card | activity | activity | CARD |
| flow.collate | Collate | xellipse | activity | activity | COLLATE |
| flow.sort | Sort | barellipse | activity | activity | SORT |
| flow.parallelmode | Parallel mode | parallelmode | activity | activity | PARALLELMODE |
| epk.orgunit | Organizational unit | rect | application | governance | ORGUNIT |
| epk.role | Role | round | application | governance | EPKROLE |
| epk.infoobject | Information object | document | application | data | INFOOBJECT |
| epk.processlink | Process link | rect | application | activity | PROCESSLINK |
| msc.hmscref | HMSC reference | rect | application | concept | HMSCREF |
| idef0.activity | Activity box | rect | activity | activity | IDEFACTIVITY |
| petri.place | Place | circle | application | concept | PETRIPLACE |
| petri.transition | Transition | forkbar | application | activity | PETRITRANS |
| orm.entitytype | Entity type | ellipse | application | concept | ORMENTITY |
| orm.valuetype | Value type | ellipse | application | data | ORMVALUE |
| orm.facttype | Fact type | rect | application | concept | ORMFACT |
| vsm.process | Process | rect | application | activity | VSMPROCESS |
| vsm.customer | Customer / supplier | rect | application | governance | VSMCUSTOMER |
| vsm.control | Production control | rect | application | governance | VSMCONTROL |
| vsm.inventory | Inventory | triangledown | application | concept | VSMINVENTORY |
| vsm.supermarket | Supermarket | rect | application | concept | VSMSUPERMARKET |
| vsm.kaizen | Kaizen burst | burst | application | concept | VSMKAIZEN |
| vsm.operator | Operator | actor | application | governance | VSMOPERATOR |
| sdl.block | Block | rect | application | interface | SDLBLOCK |
| sdl.agent | Agent | rect | application | interface | SDLAGENT |
| sdl.signal | Signal | sendpent | application | concept | SDLSIGNAL |
| sdl.signalset | Signal set | rect | application | concept | SDLSIGNALSET |
| sdl.input | Input | acceptpent | application | activity | SDLINPUT |
| sdl.output | Output | sendpent | application | activity | SDLOUTPUT |
| sdl.task | Task | rect | application | activity | SDLTASK |
| sdl.save | Save | tag | application | activity | SDLSAVE |
| sdl.create | Create | rect | application | activity | SDLCREATE |
| sdl.procedure | Procedure | subprocess | application | activity | SDLPROC |
| sdl.timer | Timer | hourglass | application | activity | SDLTIMER |
| sdl.set | Timer set | rect | application | activity | SDLSET |
| sdl.reset | Timer reset | rect | application | activity | SDLRESET |
| fbd.block | Function block | rect | application | activity | FBDBLOCK |
| fbd.variable | Variable | rect | application | data | FBDVARIABLE |
| ladder.contact | Contact | rect | application | activity | LDCONTACT |
| ladder.coil | Coil | rect | application | activity | LDCOIL |
| ladder.label | Label | tag | application | data | LDLABEL |
| ladder.jump | Jump | rect | application | activity | LDJUMP |
| ladder.return | Return | rect | application | activity | LDRETURN |

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

### 4.4 Profile relationships / verbs (94)

| keyword | verb | family | start | end | source kinds | target kinds | self | member endpoints |
|---|---|---|---|---|---|---|---|---|
| flow.next | Control passes to | control | none | filled | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage, flow.manualinput, flow.manualop, flow.preparation, flow.display, flow.delay, flow.loopstart, flow.loopend, flow.isomerge, flow.isoextract, flow.card, flow.collate, flow.sort, flow.parallelmode | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage, flow.manualinput, flow.manualop, flow.preparation, flow.display, flow.delay, flow.loopstart, flow.loopend, flow.isomerge, flow.isoextract, flow.card, flow.collate, flow.sort, flow.parallelmode | no | no |
| dfd.data | Data transfer | data_flow | none | filled | dfd.process, dfd.store, dfd.external | dfd.process, dfd.store, dfd.external | no | no |
| uml.association | Association | structural | none | none | uml.class, uml.interface, uml.enumeration | uml.class, uml.interface, uml.enumeration | yes | no |
| uml.generalization | Generalization | structural | none | triangle | uml.class, uml.interface, uml.actor, uml.usecase, sysml.block, sysml.interfaceblock, sysml.valuetype | uml.class, uml.interface, uml.actor, uml.usecase, sysml.block, sysml.interfaceblock, sysml.valuetype | no | no |
| uml.realization | Realization | dependency | none | triangle | uml.class, uml.component, soaml.participant, soaml.serviceinterface, soaml.agent, soaml.serviceinterface, soaml.capability, soaml.servicecontract | uml.interface, soaml.serviceinterface, soaml.capability | no | no |
| uml.provided | Provides | structural | none | lollipop | uml.class, uml.component, soaml.participant, soaml.serviceinterface, soaml.agent, soaml.servicecontract | uml.interface, soaml.serviceinterface, soaml.capability | no | no |
| uml.required | Requires | structural | socket | none | uml.class, uml.component, soaml.participant, soaml.serviceinterface, soaml.agent, soaml.servicecontract | uml.interface, soaml.serviceinterface, soaml.capability | no | no |
| uml.deploy | Deploys | dependency | none | open | uml.artifact, uml.component, uml.node, uml.device, uml.executionenv | uml.node, uml.device, uml.executionenv | no | no |
| uml.manifest | Manifests | dependency | none | open | uml.artifact | uml.artifact, uml.component | no | no |
| uml.commpath | Connects | structural | none | none | uml.node, uml.device, uml.executionenv | uml.node, uml.device, uml.executionenv | no | no |
| uml.assembly | Assembles | structural | socket | lollipop | uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | no | yes |
| uml.delegation | Delegates | dependency | none | open | uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | yes | yes |
| uml.connector | Connects | structural | none | none | uml.class, uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | uml.class, uml.component, soaml.participant, soaml.serviceinterface, soaml.agent | no | yes |
| uml.link | Links | structural | none | none | record, uml.class, uml.interface, uml.enumeration, uml.collaboration | record, uml.class, uml.interface, uml.enumeration, uml.collaboration | no | no |
| uml.import | Imports | dependency | none | open | uml.package | uml.package, uml.class, uml.interface, uml.enumeration, uml.component | no | no |
| uml.access | Accesses | dependency | none | open | uml.package | uml.package, uml.class, uml.interface, uml.enumeration, uml.component | no | no |
| uml.merge | Merges | dependency | none | open | uml.package | uml.package | no | no |
| uml.extension | Extends | structural | none | filled_triangle | uml.stereotype | uml.metaclass | no | no |
| uml.application | Applies | dependency | none | open | uml.package | uml.package | no | no |
| uml.dependency | Dependency | dependency | none | open | uml.class, uml.interface, uml.component, uml.package, soaml.participant, soaml.serviceinterface, soaml.servicecontract, soaml.capability, soaml.message, soaml.agent, soaml.milestone | uml.class, uml.interface, uml.component, uml.package, soaml.participant, soaml.serviceinterface, soaml.servicecontract, soaml.capability, soaml.message, soaml.agent, soaml.milestone | no | no |
| uml.uses | Participates in | structural | none | none | uml.actor | uml.usecase | no | no |
| uml.include | «include» | dependency | none | open | uml.usecase | uml.usecase | no | no |
| uml.extend | «extend» | dependency | none | open | uml.usecase | uml.usecase | no | no |
| req.satisfies | Satisfies | dependency | none | open | req.implementation | req.requirement | no | no |
| req.verifies | Verifies | dependency | none | open | req.test | req.requirement | no | no |
| req.derives | Derived from | dependency | none | open | req.requirement | req.requirement | no | no |
| analysis.assignment | Responsibility assignment | structural | none | none | analysis.task, activity, flow.process, flow.subprocess | analysis.role, team | no | no |
| analysis.access | Data access | structural | none | none | analysis.task, activity, application, flow.process, flow.subprocess | entity, table, record | no | no |
| analysis.precedes | Must finish before | control | none | open | analysis.task, activity, flow.process, flow.subprocess, cmmn.task, cmmn.humantask, cmmn.processtask, cmmn.decisiontask, cmmn.stage, cmmn.milestone, cmmn.timerevent, cmmn.userevent, cmmn.casefile | analysis.task, activity, flow.process, flow.subprocess, cmmn.task, cmmn.humantask, cmmn.processtask, cmmn.decisiontask, cmmn.stage, cmmn.milestone, cmmn.timerevent, cmmn.userevent, cmmn.casefile | no | no |
| cmmn.dependency | Depends | dependency | none | open | cmmn.task, cmmn.humantask, cmmn.processtask, cmmn.decisiontask, cmmn.stage, cmmn.milestone, cmmn.timerevent, cmmn.userevent, cmmn.casefile, cmmn.sentry, analysis.task | cmmn.task, cmmn.humantask, cmmn.processtask, cmmn.decisiontask, cmmn.stage, cmmn.milestone, cmmn.timerevent, cmmn.userevent, cmmn.casefile, cmmn.sentry, analysis.task | no | no |
| cmmn.sentryref | Triggers | control | none | none | cmmn.timerevent, cmmn.userevent, cmmn.casefile | cmmn.sentry | no | no |
| quality.cause | Contributes to | structural | none | none | quality.category, quality.cause | quality.effect, quality.category, quality.cause | no | no |
| state.transition | Event transition | control | none | filled | state.initial, state.state, state.history_shallow, state.history_deep, state.junction, state.choice, state.entrypoint, state.exitpoint, state.forkjoin, sdl.input, sdl.output, sdl.task, sdl.save, sdl.create, sdl.procedure, sdl.set, sdl.reset | state.state, state.final, state.junction, state.choice, state.entrypoint, state.exitpoint, state.forkjoin, state.terminate, state.history_shallow, state.history_deep, sdl.input, sdl.output, sdl.task, sdl.save, sdl.create, sdl.procedure, sdl.set, sdl.reset | yes | no |
| flow.annotation | Annotates | annotation | none | none | flow.annotation | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.document, flow.subprocess, flow.connector, flow.offpage, flow.storage | no | no |
| flow.continues | Continues at | control | none | open | flow.offpage, flow.manualinput, flow.manualop, flow.preparation, flow.display, flow.delay, flow.loopstart, flow.loopend, flow.isomerge, flow.isoextract, flow.card, flow.collate, flow.sort, flow.parallelmode | flow.offpage, flow.manualinput, flow.manualop, flow.preparation, flow.display, flow.delay, flow.loopstart, flow.loopend, flow.isomerge, flow.isoextract, flow.card, flow.collate, flow.sort, flow.parallelmode | no | no |
| c4.rel | Uses / interacts with | dependency | none | open | c4.person, c4.system, c4.container, c4.store, c4.queue, c4.component | c4.person, c4.system, c4.container, c4.store, c4.queue, c4.component | no | no |
| analysis.decomposes | Decomposes into | structural | none | none | analysis.task | analysis.task | no | no |
| epk.next | Control passes to | control | none | filled | epk.event, epk.function, epk.connector, epk.orgunit, epk.role, epk.infoobject, epk.processlink | epk.event, epk.function, epk.connector, epk.orgunit, epk.role, epk.infoobject, epk.processlink | no | no |
| uml.message | Message | control | none | open | *, soaml.message, soaml.participant, soaml.serviceinterface | *, soaml.message, soaml.participant, soaml.serviceinterface | yes | no |
| uml.flow | Activity edge | control | none | filled | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.forkjoin, flow.objectnode, flow.gateway, flow.merge, flow.sendsignal, flow.acceptsignal, flow.timeevent, flow.flowfinal, flow.connector, flow.intermediate, flow.choreotask, flow.group, flow.subprocess, uaf.opactivity, uaf.servicefunction, uaf.systemfunction, uaf.resourcefunction | flow.start, flow.end, flow.process, flow.decision, flow.io, flow.forkjoin, flow.objectnode, flow.gateway, flow.merge, flow.sendsignal, flow.acceptsignal, flow.timeevent, flow.flowfinal, flow.connector, flow.intermediate, flow.choreotask, flow.group, flow.subprocess, uaf.opactivity, uaf.servicefunction, uaf.systemfunction, uaf.resourcefunction | no | yes |
| bpmn.messageflow | Message flow | control | none | open | flow.start, flow.end, flow.process, flow.subprocess, flow.gateway, analysis.task | flow.start, flow.end, flow.process, flow.subprocess, flow.gateway, analysis.task | no | no |
| bpmn.association | Associates | dependency | none | open | flow.dataobject, flow.datainput, flow.dataoutput, flow.datastore, flow.start, flow.intermediate, flow.end, flow.process, flow.subprocess, flow.gateway, flow.choreotask | flow.start, flow.intermediate, flow.end, flow.process, flow.subprocess, flow.gateway, flow.choreotask, flow.dataobject, flow.datainput, flow.dataoutput, flow.datastore | no | no |
| bpmn.conversationlink | Links | structural | none | none | uml.actor, flow.process, flow.subprocess | flow.conversation, flow.subconversation, flow.callconversation | no | no |
| sysml.flow | Item flow | flow | none | filled | * | * | no | yes |
| archi.rel | serves / relates to | structural | none | open | archi.business_actor, archi.business_role, archi.business_process, archi.business_service, archi.business_interface, archi.application_component, archi.application_service, archi.technology_node, archi.technology_service | archi.business_actor, archi.business_role, archi.business_process, archi.business_service, archi.business_interface, archi.application_component, archi.application_service, archi.technology_node, archi.technology_service | no | no |
| tree.input | has input | control | none | none | tree.gate | tree.gate, tree.event | no | no |
| network.attaches | attaches to | structural | none | none | * | * | no | yes |
| family.partner_of | partner of | structural | none | none | family.person | family.person, family.union | no | no |
| family.parent_of | parent of | lineage | none | filled | family.person, family.union | family.person | no | no |
| sysml.derive | «deriveReqt» | dependency | none | open | * | * | no | no |
| sysml.satisfy | «satisfy» | dependency | none | open | * | * | no | no |
| sysml.verify | «verify» | dependency | none | open | * | * | no | no |
| sysml.refine | «refine» | dependency | none | open | * | * | no | no |
| sysml.trace | «trace» | dependency | none | open | * | * | no | no |
| sysml.copy | «copy» | dependency | none | open | * | * | no | no |
| sysml.master | «master» | dependency | none | open | * | * | no | no |
| sysml.allocate | «allocate» | dependency | none | open | * | * | no | no |
| sysml.composition | Composes | structural | diamond | none | sysml.block, sysml.interfaceblock, sysml.valuetype, sysml.flowspec, sysml.constraint, req.requirement | sysml.block, sysml.interfaceblock, sysml.valuetype, sysml.flowspec, sysml.constraint, req.requirement | no | no |
| dmn.inforeq | Requires information | control | none | filled | * | * | no | no |
| dmn.knowledgereq | Requires knowledge | control | none | open | * | * | no | no |
| dmn.authorityreq | Has authority | control | circle | open | * | * | no | no |
| uaf.capabilitydependency | «capabilityDependency» | dependency | none | open | uaf.capability | uaf.capability | no | no |
| uaf.exhibits | «exhibits» | mapping | none | open | uaf.opperformer, uaf.opactivity, uaf.opnode, uaf.opexchange, uaf.resourceperformer, uaf.resource, uaf.resourcefunction, uaf.system, uaf.systemfunction, uaf.implementer, uaf.actualresource, uaf.servicespec | uaf.capability | no | no |
| uaf.mapsto | «mapsTo» | mapping | none | open | * | * | no | no |
| uaf.satisfiescapability | «satisfiesCapability» | dependency | none | open | * | uaf.capability | no | no |
| uaf.performs | «performs» | mapping | none | open | uaf.organization, uaf.post, uaf.person, uaf.actualorganization, uaf.actualperson, uaf.opperformer, uaf.resourceperformer, uaf.implementer, uaf.opnode | uaf.opactivity, uaf.systemfunction, uaf.resourcefunction, uaf.servicefunction | no | no |
| uaf.assignedto | «assignedTo» | structural | none | open | uaf.organization, uaf.post, uaf.person, uaf.actualorganization, uaf.actualperson | * | no | no |
| uaf.complieswith | «compliesWith» | dependency | none | open | * | uaf.standard, uaf.standardcollection, uaf.servicepolicy | no | no |
| uaf.mitigates | «mitigates» | dependency | none | open | uaf.securitycontrol | uaf.threat | no | no |
| uaf.milestonedependency | «milestoneDependency» | dependency | none | open | uaf.projectmilestone | uaf.projectmilestone, uaf.project | no | no |
| uaf.forecast | «forecast» | mapping | none | open | * | * | no | no |
| uaf.supports | «supports» | dependency | none | open | * | * | no | no |
| uaf.owns | «owns» | structural | none | open | uaf.organization, uaf.post, uaf.person, uaf.actualorganization, uaf.actualperson | * | no | no |
| epk.infoflow | Informs | flow | none | open | epk.infoobject, epk.function | epk.infoobject, epk.function | no | no |
| epk.assigned | Assigned to | structural | none | none | epk.orgunit, epk.role | epk.function, epk.orgunit, epk.role | no | no |
| epk.links | Links process | control | none | open | epk.processlink | epk.event, epk.function | no | no |
| idef0.flow | Flows | flow | none | filled | idef0.activity | idef0.activity | no | yes |
| idef0.call | Calls | flow | none | open | idef0.activity | idef0.activity | no | yes |
| petri.arc | Flows | flow | none | filled | petri.place, petri.transition | petri.place, petri.transition | no | no |
| petri.inhibitor | Inhibits | flow | none | circle | petri.place | petri.transition | no | no |
| petri.testarc | Reads | flow | none | open | petri.place, petri.transition | petri.place, petri.transition | no | no |
| orm.plays | Plays | structural | none | none | orm.facttype | orm.entitytype, orm.valuetype | no | yes |
| orm.subset | «subset» | structural | none | open | orm.facttype, orm.entitytype | orm.facttype, orm.entitytype | no | no |
| orm.equality | «equality» | structural | none | open | orm.facttype | orm.facttype | no | no |
| orm.exclusion | «exclusion» | structural | none | xcircle | orm.facttype | orm.facttype | no | no |
| vsm.material | Flows | flow | none | filled | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | no | no |
| vsm.push | Pushes | flow | none | filled | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | no | no |
| vsm.pull | Pulls | flow | none | open | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | no | no |
| vsm.einfo | Informs (electronic) | flow | none | open | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | no | no |
| vsm.minfo | Informs | flow | none | open | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | vsm.process, vsm.customer, vsm.control, vsm.inventory, vsm.supermarket, vsm.kaizen, vsm.operator | no | no |
| sdl.channel | Carries | control | none | open | sdl.block, sdl.agent, sdl.signal, sdl.signalset | sdl.block, sdl.agent, sdl.signal, sdl.signalset | no | yes |
| sdl.links | Links | flow | none | none | sdl.signal, sdl.signalset | sdl.block, sdl.agent | no | no |
| fbd.wire | Connects | flow | none | filled | fbd.block, fbd.variable | fbd.block, fbd.variable | no | yes |
| ladder.series | Wires in series | flow | none | none | ladder.contact, ladder.coil, ladder.label, ladder.jump, ladder.return, fbd.block, fbd.variable | ladder.contact, ladder.coil, ladder.label, ladder.jump, ladder.return, fbd.block, fbd.variable | no | yes |

### 4.5 Diagram profiles (150)

A profile is selected in a view's projection: `projection { kind: graph; profile: "c4.container@1"; }`. `kind` MUST equal the profile's registered projection (DDN-PF002); unknown profile → DDN-PF001. Per-profile enforced rules are in section 6. `use when` is the authoring-intent annotation (tools/ai-reference/profile-annotations.json; the generator fails if any profile lacks one).

| profile id | projection | use when | diagram families | scope | validation |
|---|---|---|---|---|---|
| ddn@1 | graph | Default free-form graph; any kinds/verbs; use when no stricter profile fits | DDN graph | Existing DDN notation | existing core contracts |
| flow.basic@1 | graph | Simple flowchart: start/end, process, decision branches, one path logic | Conventional flowchart, Accounting/audit flowchart | Start/end, process, decision, I/O, document and predefined process; named branches. | start has no incoming edge; end has no outgoing edge; decisions have >=2 distinct nonempty branch labels; every process reachable from a start and can reach an end |
| dfd.gane_sarson@1 | graph | Data-flow diagram (Gane-Sarson): processes, stores, externals, data flows | Gane–Sarson DFD | Numbered three-compartment processes; open-ended stores and external entities. | data flows cannot directly connect two non-process elements; process has input/output; unique process numbers |
| dfd.yourdon@1 | graph | Data-flow diagram (Yourdon): same model, Yourdon silhouettes | Yourdon-style DFD | Circular processes; parallel-line stores; rectangular external entities. | same structural checks as Gane–Sarson |
| uml.structure@1 | graph | UML class/structure diagram: classes, interfaces, inheritance, associations | UML class subset, UML package subset, UML component subset | Class/interface attribute and operation compartments; package tabs; component markers; generalization/dependency/realization. | profile endpoint restrictions; acyclic generalization; same-kind generalization; operation/attribute visibility enumeration |
| uml.structure@2 | graph | UML 2.5.1 class diagram: end labels, aggregation/composition, navigability, association classes, n-ary, gensets, templates, enumerations, provided/required | UML class diagram, UML package subset, UML component subset | uml.structure@1 plus UML 2.5.1 class notation: end roles/multiplicity/qualifiers (x_endlabels), aggregation/composition/navigability marks, association classes, n-ary junction (x_nary), generalization sets, templates, enumerations, provided/required interfaces, member adornments (x_member). | profile endpoint restrictions; acyclic, same-kind generalization; x_endlabels/multiplicity rules (DDN-PJ149); association class (PJ150); n-ary ends (PJ151); generalization sets (PJ152); template owner (PJ153); enumeration literals (PJ154) |
| uml.deployment@1 | graph | UML 2.5.1 deployment diagram: nodes/devices/execution environments, artifacts, deploy/manifest, communication paths with multiplicity | UML deployment diagram | UML 2.5.1 deployment diagrams: nodes/devices/execution environments (3D-box), artifacts (document icon), deploy/manifest dependencies, communication paths with multiplicity, node nesting via frames, deployed components. | profile endpoint restrictions (DDN102); commpath labels carry no qualifiers; nesting frames scope to node kinds (DDN-PJ164) |
| uml.composite@1 | graph | UML 2.5.1 component + composite structure: ports, assembly ball-and-socket, delegation, connectors, parts, collaborations | UML component diagram, UML composite structure diagram | UML 2.5.1 component + composite structure: ports on classifiers (SysML port machinery), assembly ball-and-socket connectors, delegation connectors, plain connectors with role names and multiplicity (x_endlabels), internal parts (x_part), collaboration occurrences (uml.collaboration). | assembly endpoints are components or ports of components; delegation starts at a port (DDN-PJ165); x_part owners and multiplicity form (DDN-PJ166) |
| uml.usecase@1 | graph | UML use-case diagram: actors, use cases, include/extend (basic) | Use-case diagram subset | Actors, use-case ellipses, associations, include/extend/generalization. | correct actor/use-case endpoints; acyclic include and generalization |
| requirements.basic@1 | graph | Requirements traceability: requirements, tests, implementations, derives/satisfies/verifies | Requirements traceability | Requirement IDs/text, satisfies/verifies/derives links. | nonempty unique requirement codes; compatible verification/implementation endpoints |
| chen.basic@1 | chen | Chen ER, scalar subset: flat entities, binary association diamonds only | Chen ER binary subset | Entity rectangles; field-derived attribute ovals with key underlining; binary association diamonds. | scalar attribute projection; binary association mapping with stable provenance |
| matrix.raci@1 | matrix | RACI responsibility matrix: exactly one A, >=1 R per row | RACI matrix | Rows/roles/cells derived from responsibility relations. | one A and at least one R per row; unique row/column assignment; allowed A/R/C/I values |
| matrix.crud@1 | matrix | CRUD matrix: which roles create/read/update/delete which entities | CRUD matrix | Processes by data objects; cells from access relations. | nonempty unique subset of C/R/U/D; no duplicate row/column records |
| matrix.relations@1 | matrix | Generic relationship matrix: any verb as cells between two element sets | Relationship matrix | Model-to-matrix projection with provenance. | unique row/column slots; explicit duplicate policy |
| panels.basic@1 | panels | Free dashboard grid: titled panels with item lists, no fixed panel set | SIPOC, SWOT, Business Model Canvas-style panels, Customer journey stages, Planning board | Span-aware fixed column panels containing shared model references. | positive grid spans; no overlapping panel slots; referenced elements exist |
| canvas.bmc@1 | panels | Business Model Canvas (9 fixed blocks) | Business Model Canvas | Nine canonical Business Model Canvas blocks on a fixed 10-column grid; span-aware panels with shared model references. | all nine required block panels present (DDN-PJ080); existing panels grid checks (DDN-PJ020/PJ021/PJ009) |
| canvas.lean@1 | panels | Lean Canvas (9 fixed blocks) | Lean Canvas | Nine canonical Lean Canvas blocks on a fixed 10-column grid; span-aware panels with shared model references. | all nine required block panels present (DDN-PJ080); existing panels grid checks (DDN-PJ020/PJ021/PJ009) |
| canvas.pest@1 | panels | PEST analysis canvas (political/economic/social/technological) | PEST analysis | Four macro-environment panels (political, economic, social, technological) in one strip. | all four required panels present (DDN-PJ081); existing panels grid checks |
| canvas.pestle@1 | panels | PESTLE analysis canvas (PEST + legal + environmental) | PESTLE analysis | Six macro-environment panels in two rows of three. | all six required panels present (DDN-PJ081); existing panels grid checks |
| canvas.porter5@1 | panels | Porter's five forces canvas | Porter five forces | Center competitive-rivalry panel with the four surrounding force panels on a 3-column grid. | all five required panels present (DDN-PJ081); existing panels grid checks |
| canvas.empathy@1 | panels | Empathy map canvas (says/thinks/does/feels + persona) | Empathy map | Says/thinks/does/feels quadrants around a center persona panel; panel items are declared notes. | all five required panels present (DDN-PJ083); existing panels grid checks (DDN-PJ020/PJ021/PJ009) |
| canvas.scorecard@1 | panels | Balanced scorecard canvas (financial/customer/internal/learning) | Balanced scorecard | Four perspective panels (financial, customer, internal process, learning & growth); each item list states declared objectives. | all four required panels present (DDN-PJ083); existing panels grid checks |
| table.records@1 | table | Plain data table: records as rows, bound columns | Record table, Decision-table presentation | Typed field-key table bound to explicit records. | path safety; missing policy; record limit |
| chart.basic@1 | chart | Core charts: bar/line/area/point/pie/donut with axes | Bar/column, Line, Area, Scatter/bubble, Pie, Doughnut | Native SVG quantitative marks; numeric/categorical coordinates; record provenance. | finite numeric values; consistent units; explicit aggregation; nonnegative arcs; duplicate coordinates rejected |
| chart.radar@1 | chart | Radar/spider chart: multivariate comparison across >=3 categories | Radar/spider | Categorical axes on radial spokes; one shared 0..max scale over all points; one polygon per series; record provenance. | at least 3 distinct categories (DDN-PJ071); finite numeric values, y >= 0 (DDN-PJ072); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031) |
| chart.funnel@1 | chart | Funnel chart: stage conversion with decreasing values | Funnel | Ordered stage bands; widths encode one value per stage; record provenance. | at least 2 distinct stages (DDN-PJ073); nonnegative stage values (DDN-PJ107); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate stage labels rejected (DDN-PJ036) |
| timeline.basic@1 | timeline | Timeline/Gantt: dated records with start/end and optional dependencies | Gantt supplied dates, Timeline, Calendar roadmap | UTC date intervals mapped to a fixed axis; milestones and dependency overlays. | valid ISO date-only; end>=start; acyclic dependencies; no model-position pins |
| fishbone.basic@1 | fishbone | Fishbone/Ishikawa: effect with categorized cause ribs | Fishbone / Ishikawa | Cause-to-parent DAG projected onto a spine and measured branches; repeated occurrences retain source identity. | cause cycles, orphan edges, depth/occurrence bounds |
| matrix.heatmap@1 | matrix | Numeric/category encoded matrix: colour-encoded cell values | Heatmap, Risk/priority matrix | Source-derived numeric, categorical or threshold cell encodings with visible missing state. | declared finite scales; typed values; unique cell |
| chart.quality@1 | chart | Quality/SPC charts: histogram/pareto/waterfall/boxplot transforms, multi-series | Grouped/stacked bars, Percentage stacks, Multiseries lines and areas, Actual/target overlay, Histogram, Pareto, Waterfall, Box plot | Shared-scale series/layers and explicit bounded transformations with record provenance. | numeric domains, units, bin boundaries, totals, quartile/whisker conventions |
| state.flat@1 | graph | Flat state machine: one initial, terminals, guarded transitions, trace simulation | Flat lifecycle diagram, Trace validation | One initial state, explicit terminal states, events and typed guards; safe trace evaluator does not execute actions. | reachability, event determinism, terminal rules, trace legality |
| decision.rules@1 | decision | Decision table (DMN-like): inputs, outputs, x_rule rows, hit policy | Rule decision table | Typed conjunction predicates; unique/first/collect hit policies; bounded partition proof and evaluation. | domain types, overlaps, coverage, shadowing, budgets |
| panels.composed@1 | panels | Composed dashboard: panels embedding child views (drill-down, one level) | Composed dashboard, Report review page | One level of child views, source mappings, scoped SVG IDs, preserved scales and publication checks. | span collisions; view cycles; child limits; text scale |
| uml.usecase@2 | graph | UML use-case with subject boundaries and extension-point contracts | Use-case diagram | Adds subjects, extension-point targets, conditions and classifier generalization to the declared subset. | subject references; extension-point existence; condition declaration; acyclic generalization |
| uml.usecase@3 | graph | UML use-case diagram with extension-point semantics: extend conditions on the label | UML use-case diagram | uml.usecase@2 plus: extend conditions on the label; extension-point existence (DDN-PX004). | subject naming (DDN-PX002/PX004/PX006) |
| chen.binary@2 | chen | Chen ER extended: weak entities, participation bounds, composite attributes | Binary Chen ER | Composite, derived/multivalued attributes, keys and partial keys, weak entities and identifying binary associations; min/max participant annotations. | field metadata; identifying owner references; participation bounds |
| flow.documented@2 | graph | Flowchart with off-page connectors and annotation notes attached | Documented flowchart, Cross-page flowchart | Adds on-page connectors, matched off-page continuations, storage and non-control annotations. | control reachability; annotation separation; continuation contracts |
| chart.gauge@1 | chart | Single-value gauge/KPI dial (0-100, optional target) | Gauge/KPI dial | One percentage value on a semicircular dial with an optional target marker; record provenance. | exactly one record after filtering (DDN-PJ074); value and target finite numbers in 0..100 (DDN-PJ075); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030) |
| chart.candlestick@1 | chart | Candlestick/OHLC chart for financial time series | Candlestick/OHLC | Supplied open/high/low/close per category or date; wick low-high, body open-close; record provenance. | finite numeric open/high/low/close on every record (DDN-PJ076); high >= low and open/close within [low, high] (DDN-PJ077); explicit x/open/high/low/close bindings (DDN-PJ030); category or date x; numeric x rejected (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate x/category rejected (DDN-PJ036) |
| chart.treemap@1 | chart | Treemap: hierarchical part-to-whole areas (<=3 levels) | Treemap | Hierarchical tiles from dotted category paths; slice-and-dice layout; area encodes one value; record provenance. | tile values nonnegative finite numbers (DDN-PJ078, DDN-PJ032); dotted paths of at most 3 levels (DDN-PJ030); categorical x only (DDN-PJ030); no aggregation (DDN-PJ031); no series binding (DDN-PJ030); duplicate full path rejected (DDN-PJ036) |
| chart.sankey@1 | chart | Sankey diagram: flow quantities between categorical nodes | Sankey/flow diagram | Explicit source→target flows; depth columns from pure sources; ribbon thickness encodes value; record provenance. Duplicate (source,target) pairs are allowed: ribbons stack in declaration order. | target is a property binding, not a numeric reference (DDN-PJ030); categorical x only (DDN-PJ030); no aggregation or series binding (DDN-PJ031, DDN-PJ030); endpoints are distinct nonempty category text (DDN-PJ032); flow values are positive finite numbers (DDN-PJ108, DDN-PJ032); flow graph is acyclic (DDN-PJ079) |
| c4.context@1 | graph | C4 system context: people and systems, no interior detail | C4 system context | People and systems and their interactions; no internal structure, no field-level endpoints. | participants limited to c4.person and c4.system; c4.rel links only; no field-level (member) endpoints; no attribute fields on c4 kinds |
| c4.container@1 | graph | C4 container diagram: one system boundary with containers/stores/queues | C4 container | Containers/stores/queues inside one system boundary frame. | participants limited to c4.container, c4.store, c4.queue plus boundary c4.system and external c4.person; c4.rel links only; exactly one frame scoped to a selected c4.system; members cover every selected interior node; no attribute fields on c4 kinds |
| c4.component@1 | graph | C4 component diagram: one container boundary with components | C4 component | Components inside one container boundary frame. | participants limited to c4.component plus boundary c4.container and external c4.person/c4.system/c4.store; c4.rel links only; exactly one frame scoped to a selected c4.container; members cover every selected interior node; no attribute fields on c4 kinds |
| org.tree@1 | graph | Org chart: single-rooted reports_to hierarchy | Organisation chart | Single-root reporting hierarchy of org/team/role participants, rendered with the native tree layout. | participants limited to organization, team, role, analysis.role (DDN-PF007); reports_to links only (DDN-PF007); reporting hierarchy is acyclic (DDN-PF004); exactly one root — one node with no incoming reports_to edge (DDN-PJ102); no node has multiple managers (DDN201, layout stage) |
| wbs.tree@1 | graph | Work breakdown structure: task decomposition tree | Work breakdown structure | Deliverable-oriented single-root decomposition tree of analysis.task nodes; top-down native tree layout. | participants limited to analysis.task (DDN-PF007); analysis.decomposes links only (DDN-PF007); decomposition is acyclic (DDN-PF004); exactly one root — one node with no incoming analysis.decomposes edge (DDN-PJ102); no node has multiple parents (DDN201, layout stage) |
| mindmap.basic@1 | graph | Mind map: radial assoc tree around one central topic | Mind map | Single central topic with alternating left/right branches over concept-family nodes; native mindmap layout. | participants limited to object, entity, term, domain (DDN-PF007); assoc links only (DDN-PF007); layout algorithm must be mindmap (DDN-PF007); branch hierarchy is acyclic (DDN-PF004); exactly one root — one node with no incoming assoc edge (DDN-PJ102); no node has multiple parents; declared root must be a hierarchy root (DDN201, DDN202, layout stage) |
| concept.map@1 | graph | Concept map: labelled assoc/ref propositions between concepts | Concept map | Concept-family nodes joined by explicitly labelled structural links; labels are mandatory, not inferred. | participants limited to object, entity, term, domain (DDN-PF007); assoc and ref links only (DDN-PF007); every selected relation carries an explicit author-written label, not the verb default (DDN-PJ104) |
| epc.basic@1 | graph | EPC process chain: strictly alternating events/functions with and/or/xor connectors | Event-driven process chain (EPC) | Events and functions strictly alternating through and/or/xor connectors; control flow via epk.next. | participants limited to epk.event, epk.function, epk.connector (DDN-PF007); epk.next links only (DDN-PF007); events and functions must alternate; event-to-event and function-to-function edges are forbidden (DDN-PJ105); every epk.connector carries x_epc.operator of and\|or\|xor; x_epc.operator on a non-connector is forbidden (DDN-PJ106); EPC symbols have labels, not attribute compartments (DDN-PF003) |
| matrix.bcg@1 | matrix | BCG growth-share portfolio quadrant (stars/cows/question marks/dogs) | BCG growth-share matrix | Two market-growth rows (high, low) by two relative-share columns (high, low); quadrant cells are declared relations with value-list content. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) |
| matrix.ansoff@1 | matrix | Ansoff market x product growth quadrant | Ansoff matrix | Market rows (existing, new) by product columns (existing, new); cells are declared strategy items. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) |
| matrix.tows@1 | matrix | TOWS/SWOT strategy quadrant (internal x external factors) | TOWS matrix | Internal rows (strength, weakness) crossed with external columns (opportunity, threat); cells are strategy notes. | exact quadrant category sets per axis (DDN-PJ082); existing matrix checks (DDN-PJ013/PJ014/PJ015) |
| panels.journey@1 | panels | Customer journey map: phases, actions/touchpoints/opportunities, emotion curve | Customer journey map | Ordered phase columns; actions/touchpoints/opportunities lanes; one full-width emotions lane whose declared 1..5 values render as a straight-segment polyline. | phase grid contract (DDN-PJ085); emotion values in 1..5 (DDN-PJ084); existing panels grid checks |
| matrix.storymap@1 | matrix | User story map: tasks as cells across releases | User story map | Ordered release rows (top = first release) by ordered backbone-activity columns; cells are declared analysis.task story objects with provenance. | cells reference selected analysis.task stories (DDN-PJ093); no story in two releases (DDN-PJ086); existing matrix checks |
| erd.crowfoot@1 | graph | Crow's-foot ERD: tables, fields, cardinality-marked references | Crow's-foot ERD | Entity/table graph where every ref/assoc relation carries explicit crow's-foot source_mark and target_mark cardinality (one, zeroone, many, zeromany). | every view relation is ref or assoc with both cardinality marks (DDN-PJ087); unknown mark strings remain DDN114; existing core contracts |
| panels.pyramid@1 | panels | Pyramid/hierarchy bands (3-5 stacked levels, e.g. DIKW, Maslow) | Pyramid / hierarchy tiers | 3..5 horizontal bands stacked widest-at-bottom as trapezoid polygons; centered band labels; optional per-band side annotations from declared items. | band count 3..5 and contiguous one-column rows (DDN-PJ089); existing panels grid checks |
| panels.venn@1 | panels | Venn diagram: 2-3 sets with membership-overlap items | Venn diagram (2 or 3 sets) | Two or three declared set panels; members declare x_sets; region labels show declared membership counts at fixed positions. | exactly 2 or 3 sets (DDN-PJ090); x_sets present and consistent with panel listings (DDN-PJ091); existing panels grid checks |
| uml.sequence@1 | sequence | UML sequence diagram: lifelines with ordered messages and returns | Sequence-style interaction | Participants in declaration order with lifelines; messages in declaration order with dashed returns and activation bars; record provenance. | message endpoints are selected participant objects (DDN-PJ110); participants without messages warn (DDN-PJW03) |
| uml.sequence@2 | sequence | UML 2.5.1 sequence diagram: fragments, gates, create/delete, synch/asynch, lost/found, activations, invariants, time/duration | UML sequence diagram | uml.sequence@1 plus UML 2.5.1 interaction notation: combined fragments (nested, guards — x_fragment), gates, create/delete, synch/asynch/reply/lost/found message sorts, authorable activations, time/duration constraints, state invariants. | message endpoints are selected participants (DDN-PJ110); empty lifelines warn (DDN-PJW03); fragment span rules (DDN-PJ155); sort/gate semantics (PJ156); invariants (PJ157); activations (PJ158); time/duration form (PJ159) |
| uml.communication@1 | graph | UML communication diagram: numbered messages between objects | Communication/collaboration-style interaction | Graph layout of interaction participants; author-declared message numbers on relation edges; replies dotted under their request. | every visible uml.message carries a well-formed x_message.seq (DDN-PJ111); reply numbering is dotted under the request (DDN-PJ111) |
| uml.communication@2 | graph | UML communication diagram with combined fragments and time/duration constraints | UML communication diagram | uml.communication@1 plus: x_fragment frames, {…} time/duration constraints on messages. | message numbering (DDN-PJ111); fragment refs resolve (DDN-PJ172) |
| uml.object@1 | graph | UML object diagram: instances with classifier-bound slots | Object/instance snapshot | Record instances naming a classifier; slots rendered as field rows; plain assoc links between instances. | instance slots must exist on the classifier when the classifier declares fields (DDN-PJ112) |
| uml.object@2 | graph | UML 2.5.1 object diagram: underlined instances, slot datatype checks, uml.link multiplicity | UML object diagram | uml.object@1 plus: underlined instance titles, slot datatype checks, uml.link multiplicity. | slot names on classifier (DDN-PJ112); slot datatype form (DDN-PJ170) |
| state.composite@1 | graph | Hierarchical state machine: composite states and parallel regions | Hierarchical/composite state diagram | Composite states as frames containing substates; dashed parallel regions; boundary-crossing transitions with event/guard labels. | at most one initial state per region (DDN-PJ113) |
| uml.statemachine@1 | graph | UML 2.5.1 state machine: entry/exit/do activities, internal transitions, history/junction/choice/entry-exit-point/fork-join/terminate pseudostates, trigger [guard] / effect, submachines, time events | UML state machine diagram | Full UML 2.5.1 state machines: flat/composite vocabulary plus entry/exit/do activities and internal transitions, history/junction/choice/entry-exit-point/fork-join/terminate pseudostates, trigger [guard] / effect labels, submachines, time events. | per-region single initial (DDN-PJ113); x_state owner/submachine rules (DDN-PJ160); pseudostate rules (DDN-PJ161); transition/time-trigger form (DDN-PJ162) |
| uml.activity@1 | graph | UML activity diagram: flows with partitions and fork/join bars | Activity-style flow with partitions | Flow nodes plus fork/join bars and object nodes; swimlane partitions as view frames with declared node membership. | node in an unknown partition rejected (DDN-PJ114); fork/join counts must balance (DDN-PJ115) |
| uml.activity@2 | graph | UML 2.5.1 activity diagram: decision/merge, pins + parameter sets/streaming, signals, time events, flow final, interruptible/structured regions, exception handlers | UML activity diagram | uml.activity@1 plus UML 2.5.1 activity notation: decision/merge distinction, pins with parameter sets and streaming (x_pin on ports), send/accept signal pentagons, time-event hourglass, flow final (⊗), interruptible regions with lightning edges, exception handlers, structured/expansion regions. | node in an unknown partition rejected (DDN-PJ114); fork/join counts must balance (DDN-PJ115); merge fans in ≥2, out exactly 1 (DDN-PJ167); interrupt/exception edge rules (DDN-PJ168); pins on action kinds only (DDN-PJ169) |
| bpmn.basic@1 | graph | BPMN collaboration: pools, typed gateways, cross-pool message flows | BPMN-style process collaboration | Pools and lanes as frames; typed start/end events; exclusive/parallel/inclusive gateways; dashed message flow allowed only across pools. Profile-level coverage, not BPMN conformance. | message flow within one pool rejected (DDN-PJ116); gateways declare their type (DDN-PJ117) |
| bpmn.process@1 | graph | Full BPMN 2.0.2 process/collaboration: all events (14 triggers, boundary), six gateways, activity markers, data objects, flow variants, pools/lanes | BPMN process diagram, BPMN collaboration diagram | Full BPMN 2.0.2 process and collaboration notation: complete event system (start/intermediate/end x 14 triggers, boundary interrupting/non-interrupting), six gateway types with true glyphs, call/ad-hoc/transaction/event subprocesses, loop/multi-instance/compensation markers, data objects/inputs/outputs/stores with associations, default/conditional sequence flows, pools and lanes incl. collapsed pools, group and annotation artifacts. | event trigger/position semantics (DDN-PJ175); gateway rules (DDN-PJ176); activity marker rules (DDN-PJ177); data association endpoints (DDN-PJ180); pool message flow (DDN-PJ116) |
| bpmn.choreography@1 | graph | BPMN choreography: participant-band tasks (x_bands), multi-instance bands, choreography gateways | BPMN choreography diagram | BPMN 2.0.2 choreography: choreography tasks with two or more participant bands (x_bands), multi-instance bands, choreography subprocesses and gateways, sequence flows between task bands. | choreography task bands (DDN-PJ178); event/gateway/activity rules (DDN-PJ175/PJ176/PJ177) |
| bpmn.conversation@1 | graph | BPMN conversation: conversation hexagon nodes linked to participants | BPMN conversation diagram | BPMN 2.0.2 conversation: conversation/sub-conversation/call-conversation hexagon nodes, conversation links to participants (pool machinery), participant bands. | conversation links connect participants to conversation nodes (DDN-PJ179) |
| uml.timing@1 | timing | UML timing diagram: state changes of participants over time | Timing/state-over-time diagram | One band per participant; state plateaus from declared time points; numeric time axis; supplied data only. | x_states present, well-formed and strictly chronological (DDN-PJ118) |
| uml.timing@2 | timing | UML 2.5.1 timing diagram: duration/slew annotations, constraints, compaction, lifeline messages | UML timing diagram | uml.timing@1 plus: duration/slew annotations, x_timeconstraint constraints, state compaction, lifeline messages. | x_states entries (DDN-PJ118); annotations/constraints/anchors (DDN-PJ173) |
| uml.interaction_overview@1 | graph | UML interaction overview: control flow whose nodes reference sub-views | Interaction overview | Flowchart of interaction steps; flow nodes may reference other workspace views and render a ref badge; targets are not expanded. | referenced views must exist in the workspace (DDN-PJ119) |
| uml.interaction_overview@2 | graph | UML interaction overview with inline expansion and interaction-use gates/arguments | UML interaction overview diagram | uml.interaction_overview@1 plus: inline expansion of referenced interactions; x_use gates/arguments. | referenced views resolve (DDN-PJ119); gates/arguments (DDN-PJ174) |
| uml.profile@1 | graph | UML 2.5.1 profile diagram: metaclasses, stereotypes, extension, application | UML profile diagram | UML 2.5.1 profile diagrams: uml.metaclass/uml.stereotype, uml.extension (filled triangle), uml.application («apply»). | extension endpoints stereotype → metaclass (DDN102) |
| cmmn.basic@1 | graph | CMMN case management: stages, milestones, entry/exit sentries | CMMN-style case diagram | Stages as scoped frames of plan items; rounded milestones; entry/exit sentries on stage membership. Profile-level coverage, not CMMN conformance. | sentries must belong to a stage frame and declare entry/exit (DDN-PJ120) |
| cmmn.complete@1 | graph | Full CMMN 1.1 case diagram: case plan container, typed tasks with decorators, event listeners, sentries with on/if-parts, planning tables, case files | CMMN case diagram | Full CMMN 1.1 notation: case plan model container, typed tasks (human/process/decision, blocking, discretionary), timer/user event listeners, stage variants, milestones, sentries with on-part/if-part and criterion attachment, plan-item decorators (required/repetition/manual activation/completion), case file items, planning tables, dependency and on-part connectors. | sentries belong to a stage frame and declare entry/exit (DDN-PJ120); x_cmmn owner/decorator rules (DDN-PJ181); sentry attachment and on-part references (DDN-PJ182); planning-table rules (DDN-PJ183); one case plan per view (DDN-PJ184) |
| sysml.bdd@1 | graph | SysML block definition diagram: blocks and their relationships | Block definition-style view | Blocks and their associations. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121) |
| sysml.ibd@1 | graph | SysML internal block diagram: blocks with ports and flows | Internal block-style view | Blocks with declared border ports and typed item flows. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121) |
| sysml.parametric@1 | graph | SysML parametric diagram: constraints each bound to exactly two relations | Parametric constraint view | Constraint blocks carrying formula text, each bound to exactly two endpoints. Profile-level coverage, not SysML conformance. | ports only on blocks (DDN-PJ121); constraints bind exactly two endpoints (DDN-PJ122) |
| archimate.basic@1 | graph | ArchiMate layered enterprise architecture (business/application/technology) | Layered enterprise-architecture overview | Fixed nine-kind business/application/technology vocabulary; family-palette layer colours; viewpoints as named views; serving links upward only. Profile-level coverage, not ArchiMate conformance. | relation layer pair must be legal per the fixed 3×3 table (DDN-PJ123) |
| pert.cpm@1 | graph | PERT/CPM network: estimated tasks, precedence, computed critical path | PERT/CPM critical-path view | Tasks with declared day estimates and finish-before dependencies; computed forward/backward pass; zero-slack critical path accented. | dependency cycles rejected (DDN-PJ124); every task carries a finite nonnegative x_estimate (DDN-PJ125) |
| fault.tree@1 | graph | Fault tree: top event decomposed through and/or gates | Fault tree | AND/OR gate decomposition of a top event into basic events; tree layout. | every gate declares and/or and has at least two inputs (DDN-PJ126) |
| event.tree@1 | graph | Event tree: initiating event fanned through and/or gates | Event tree | Initiating event followed forward through gate branches to outcomes; tree layout. | every gate declares and/or and has at least two inputs (DDN-PJ126) |
| network.basic@1 | graph | Network diagram: buses, switches, servers, attachments | Network/bus overview | Bus segment with declared attachments; switch/server kinds; original DDN glyphs. | attachments target a bus or a port (DDN-PJ127) |
| network.rack@1 | graph | Rack elevation: equipment placed at unique units inside racks | Rack elevation | Rack frames with declared 1U slot numbers; devices pinned bottom-up. | attachments target a bus or a port (DDN-PJ127); slot numbers within rack height and unique per rack (DDN-PJ127) |
| wireframe.ui@1 | graph | UI wireframe: frames, labels, inputs, buttons, lists | Low-fidelity UI wireframe | Fixed seven-control stencil as plain rect variants; nesting via scoped frames; classic look with neutral grey palette. | controls outside any ui.frame produce warning DDN-PJ128 |
| family.tree@1 | graph | Family/genealogy tree: parents, unions, birth/death years | Family tree / genealogy | Persons with optional birth/death years; partnerships via partner links or small union join nodes; ancestors above descendants; acyclic lineage with at most two parents. | parent_of cycles rejected (DDN-PJ129); more than two parents rejected (DDN-PJ130) |
| chart.histogram@1 | chart | Histogram: binned numeric distribution | Histogram | Equal-width binning of one numeric sample (x_type:number, measurement on x); bar heights are bin counts; record provenance per bin. | numeric finite measurements (DDN-PJ032); at least 2 observations (DDN-PJ135); bin_count is an integer 2..100 (DDN-PJ131); no y/series bindings (DDN-PJ134) |
| chart.density@1 | chart | Density curve: smoothed numeric distribution | Probability density | Gaussian kernel density of one numeric sample; Silverman bandwidth; fixed 81-point evaluation grid. | at least 2 observations (DDN-PJ135); zero-variance sample is UNKNOWN (DDN-PJ132); no y/series bindings (DDN-PJ134) |
| chart.qq@1 | chart | Q-Q plot: compare a sample against a theoretical distribution | Q-Q plot | Sample quantiles vs theoretical standard-normal quantiles (Acklam inversion); dashed reference through the quartile pair. | at least 2 observations (DDN-PJ135); zero-variance sample is UNKNOWN (DDN-PJ132); no y/series bindings (DDN-PJ134) |
| chart.quantiledot@1 | chart | Quantile dotplot: distribution as stacked quantile dots | Quantile dotplot | Up to 20 dots at equal-mass quantile positions of the sample; deterministic vertical stacking against overlap; stacking encodes nothing. | at least 2 observations (DDN-PJ135); no y/series bindings (DDN-PJ134) |
| chart.dotplot@1 | chart | Dot plot strip: individual numeric observations along an axis | Dot/strip plot | One dot per record at (category, value); tied values dodge sideways deterministically; horizontal displacement encodes nothing. | categorical x (DDN-PJ030); finite numeric y (DDN-PJ032); no series binding (DDN-PJ134) |
| chart.boxplot@1 | chart | Box plot: five-number summary per category | Box plot | Per-category five-number summary: R-7 quartiles, Tukey 1.5xIQR whiskers, outlier records drawn individually. | categorical x (DDN-PJ030); finite numeric y (DDN-PJ032); at most 40 categories (DDN-PJ135) |
| chart.violin@1 | chart | Violin plot: distribution density per category | Violin plot | Per-category mirrored Gaussian KDE with shared density scale; inner IQR bar and median dot. | at least 2 non-identical observations per category (DDN-PJ132); at most 40 categories (DDN-PJ135) |
| chart.beeswarm@1 | chart | Beeswarm: jittered individual points per category | Beeswarm | One dot per record; deterministic greedy non-overlap lanes widen each category swarm; displacement encodes nothing. | categorical x (DDN-PJ030); finite numeric y (DDN-PJ032); no series binding (DDN-PJ134) |
| chart.topk@1 | chart | Top-K bar chart: top categories plus an aggregated others bucket | Top-K bar chart | Categories ranked by value (desc, name asc, declaration order); top k kept, remainder merged into an Others bar unless others:false. | categorical x (DDN-PJ030); k integer 1..100 (DDN-PJ133); others boolean (DDN-PJ133); duplicate categories need an explicit aggregate (DDN-PJ036) |
| chart.tidytree@1 | chart | Tidy tree: node-link hierarchy layout | Tree diagram | Tidy tree of a dotted-path hierarchy (shared treemap paths); leaves take consecutive slots in declaration order, parents centre over children. | categorical dotted paths, at most 3 levels (DDN-PJ030); nonnegative finite values (DDN-PJ136, DDN-PJ032); no aggregation or series (DDN-PJ030, DDN-PJ031) |
| chart.radialtree@1 | chart | Radial tree: hierarchy fanned around a root | Radial tree | Tidy tree mapped to polar coordinates: leaf slots become equal angles, depth becomes radius. | as chart.tidytree@1 |
| chart.circlepack@1 | chart | Circle packing: nested circles for hierarchy | Circle packing | Nested circles; leaf area encodes value; deterministic descending-size ring packing of siblings; enclosing circles are padded approximations. | as chart.tidytree@1 |
| chart.sunburst@1 | chart | Sunburst: radial part-to-whole hierarchy rings | Sunburst | Radial partition: angle encodes value share within each parent, rings are hierarchy depth; zero-value leaves take no angle. | as chart.tidytree@1 |
| chart.packedbubble@1 | chart | Packed bubbles: flat groups of size-encoded circles | Packed bubble chart | Bubbles sized by value, grouped by first path segment in deterministic ring packing; group position encodes nothing. | as chart.tidytree@1 |
| chart.heatmap@1 | chart | Heatmap chart: category x category numeric cells | Heatmap | Category x (columns) x series (rows) grid; colour intensity encodes the numeric value on a shared linear scale; absent (column,row) pairs are empty, not zero. | series binding required (DDN-PJ137); unique value per (column,row) (DDN-PJ137); at most 60x60 cells (DDN-PJ135) |
| chart.densityheatmap@1 | chart | 2-D density heatmap of numeric point pairs | Density heatmap, 2D histogram | Numeric scatter binned into a bin_count x bin_count grid; intensity encodes bin counts. | x_type:number (DDN-PJ030); zero-range field is UNKNOWN (DDN-PJ132); bin_count integer 2..60 (DDN-PJ131) |
| chart.calendar@1 | chart | Calendar heatmap: daily values over weeks/months | Calendar view | One cell per day on a Monday-first UTC week grid; intensity encodes the daily value; days without records are blank. | x_type:date (DDN-PJ030); unique value per day (DDN-PJ137) |
| chart.parallelcoords@1 | chart | Parallel coordinates: multivariate numeric profiles | Parallel coordinates | One polyline per series across categorical axes; each axis normalized independently; constant axes and missing values are UNKNOWN, drawn at mid-height with a DDN-PJW04 warning. | series binding required (DDN-PJ137); at least 2 and at most 24 axes (DDN-PJ135); unique value per (series,axis) (DDN-PJ137) |
| chart.wordcloud@1 | chart | Word cloud: term weights as sized words | Word cloud | Font size encodes weight (square-root scale); deterministic Archimedean-spiral greedy placement using the shared text measurer; unplaceable words are omitted with a DDN-PJ137-free DDN-PJW04 warning. | distinct words (DDN-PJ137); positive finite weights (DDN-PJ138); at most 120 words (DDN-PJ135) |
| chart.arc@1 | chart | Arc diagram: nodes on a line, relations as arcs | Arc diagram | Endpoints on one axis ordered by total weight (desc); semicircular arcs between linked endpoints; arc thickness encodes the link value. | distinct nonempty category endpoints (DDN-PJ032); target is a property binding (DDN-PJ030); positive finite link values (DDN-PJ108); at most 200 nodes / 1000 links (DDN-PJ135) |
| chart.force@1 | chart | Force-directed graph: network layout by simulation | Force-directed network | Deterministic seeded Fruchterman-Reingold layout (fixed seed 0xB1024, 300 cooling iterations, same seed pattern as placement:organic); node radius encodes total weight; positions encode nothing else. | as chart.arc@1 |
| chart.edgebundle@1 | chart | Edge bundling: hierarchical network with bundled edges | Hierarchical edge bundling | Links between dotted-path endpoints routed through the least common ancestor of the hierarchy on a radial tidy layout; shared ancestors bundle related links; thickness encodes value. | endpoints are dotted paths of at most 3 levels (DDN-PJ030); positive finite link values (DDN-PJ108); at most 200 endpoints / 500 links (DDN-PJ135) |
| geo.choropleth@1 | geo | Choropleth map: regions coloured by a joined numeric value | Choropleth map | Region fills encode one numeric measure per region; regions join to records by feature id or name; record provenance. Requires the optional ddn-geo module. | declared geography (registered name/URL or inline GeoJSON record) (DDN-PJ144); known projection method (DDN-PJ143); scalar unique join keys (DDN-PJ145, DDN-PJ148); finite numeric values (DDN-PJ145); unmatched features/records reported, never silently dropped (DDN-PJW05) |
| geo.symbols@1 | geo | Symbol map: sized markers at lon/lat points | Symbol map, Proportional symbol map | Point symbols at declared lon/lat over a declared base map; optional size encoding; record provenance. Requires the optional ddn-geo module. | declared geography (DDN-PJ144); known projection method (DDN-PJ143); finite lon/lat in range (DDN-PJ146); finite symbol sizes (DDN-PJ146) |
| geo.outline@1 | geo | Outline map: geography only, no data binding | Base map, Projection comparison | Plain geography outline with optional graticule; projection-method comparison plates. Requires the optional ddn-geo module. | declared geography (DDN-PJ144); known projection method (DDN-PJ143) |
| sysml.requirements@1 | graph | SysML 1.6 requirements diagram: requirement id/text compartments, test cases, seven requirement dependencies, containment, allocation | SysML requirements diagram | SysML 1.6 requirements diagram: requirements with id/text compartments, test cases, «deriveReqt»/«satisfy»/«verify»/«refine»/«trace»/«copy»/«master» dependencies, composition containment. | requirement codes unique + text nonempty (DDN-PF014); dependency endpoint rules (DDN-PJ185) |
| sysml.bdd@2 | graph | SysML 1.6 BDD: block compartments with units, composition/generalization, value types, interface blocks, flow specifications | SysML block definition diagram | sysml.bdd@1 plus SysML 1.6 BDD notation: block compartments (values/parts/references/operations/constraints) via x_block, «block» keyword, composition and generalization between blocks, value types, interface blocks, flow specifications. | ports on block-family kinds (DDN-PJ121 @2 set); x_block compartment rules (DDN-PJ186); composition/generalization endpoint kinds (DDN-PJ190); x_unit resolves in the units registry (DDN-PJ188) |
| sysml.ibd@2 | graph | SysML 1.6 IBD: proxy/full/conjugated port glyphs, multiplicity, nested ports, flow properties, item flows | SysML internal block diagram | sysml.ibd@1 plus SysML 1.6 port notation: proxy/full/conjugated port glyph variants, port multiplicity, nested ports (x_port), flow properties with direction on interface blocks and flow specifications. | ports on block-family kinds (DDN-PJ121 @2 set); x_port typing/nesting rules (DDN-PJ187); item flow endpoints (DDN-PJ191) |
| sysml.parametric@2 | graph | SysML 1.6 parametric: constraints bind one or more endpoints, parameter compartment display | SysML parametric diagram | sysml.parametric@1 with the two-binding limit relaxed: constraints bind one or more endpoints; constraint parameters display as a compartment. | ports on block-family kinds (DDN-PJ121 @2 set); constraints bind at least one endpoint (DDN-PJ189) |
| sysml.package@1 | graph | SysML package diagram: packages with import/access/merge (thin over UML package machinery) | SysML package diagram | SysML 1.6 package diagram: uml.package vocabulary with uml.import/uml.access/uml.merge; thin profile over the UML package machinery. | package/profile relation contracts (DDN102 endpoint kinds) |
| sysml.usecase@1 | graph | SysML use case diagram (rebadge of uml.usecase@3) | SysML use case diagram | SysML 1.6 use case diagram: rebadge of the uml.usecase@3 machinery (subjects, extension points, include/extend, generalization). | uml.usecase@3 rules apply (DDN-PX002/PX004/PX006) |
| sysml.activity@1 | graph | SysML activity diagram (rebadge of uml.activity@2) plus rate/probability/continuous edge annotations | SysML activity diagram | SysML 1.6 activity diagram: rebadge of the uml.activity@2 machinery plus SysML edge annotations — x_flow rate/probability/continuous on activity edges; streaming pins via x_pin. | uml.activity@2 rules apply; x_flow owner/shape rules (DDN-PJ191) |
| sysml.sequence@1 | sequence | SysML sequence diagram (rebadge of uml.sequence@2) | SysML sequence diagram | SysML 1.6 sequence diagram: rebadge of the uml.sequence@2 interaction machinery (fragments, gates, message sorts, constraints). | uml.sequence@2 rules apply |
| sysml.statemachine@1 | graph | SysML state machine diagram (rebadge of uml.statemachine@1) | SysML state machine diagram | SysML 1.6 state machine diagram: rebadge of the uml.statemachine@1 machinery (regions, pseudostates, triggers/guards/effects, submachines). | uml.statemachine@1 rules apply |
| dmn.drd@1 | graph | DMN 1.4 DRD: decision/BKM/input-data/knowledge-source/decision-service nodes, three requirement connectors, decision-table binding, boxed-expression presentation (FEEL never evaluated) | DMN decision requirements diagram | DMN 1.4 DRD notation: decision, business knowledge model (clipped corner), input data (rounded), knowledge source (document), decision service (band form); information/knowledge/authority requirement connectors; decision nodes bind decision-table views via x_subdiagram; boxed-expression presentation via x_boxed. NO expression language: FEEL is a host-application (backend) capability, not notation. | x_subdiagram on DMN nodes references a decision view (DDN-PJ192); x_boxed contract shape (DDN-PJ193); requirement connector endpoints (DDN-PJ194) |
| soaml.services@1 | graph | SoaML 1.0.1: participants/interfaces/contracts, «Service»/«Request» ports, assembly conformance PJ195–PJ197 with x_compatibility §6.4.15 modes | SoaML service architecture / service contract | Full SoaML 1.0.1 notation: participants and agents with «Service»/«Request» port decorations (conjugated interfaces), service interfaces and contracts (collaboration glyph with provider/consumer role rows), capabilities, message types, milestones, contract-typed assembly/delegation connectors with service↔request conformance, choreography binding to UML sequence or state machine views. | «Service»/«Request» port pairing with interface-type match (DDN-PJ196), extended to the four ServiceChannel compatibility modes via x_compatibility (same/specialization/realization/operation-coverage); x_service/x_contract owner rules (DDN-PJ195); choreography binding (DDN-PJ197); registry endpoint contracts (DDN102) |
| uaf.strategic@1 | graph | UAF Strategic: capabilities (tag), enterprise goals/vision, strategic phases, capability dependencies | UAF Strategic domain view | UAF Strategic domain: capabilities (tag), enterprise goals/vision, strategic phases; capability dependencies, exhibits, maps-to. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.operational@1 | graph | UAF Operational: performers, nodes, activities, exchanges; performs/assignment | UAF Operational domain view | UAF Operational domain: operational performers/nodes/activities and exchanges; performs and assignment relations. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.services@1 | graph | UAF Services: service specifications, functions, policies over SoaML machinery | UAF Services domain view | UAF Services domain: service specifications, service functions, service policies — over the SoaML machinery. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.systems@1 | graph | UAF Systems: systems, system functions, implementers | UAF Systems domain view | UAF Systems domain: systems, system functions, implementers. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.personnel@1 | graph | UAF Personnel: persons, organizations, posts, responsibilities | UAF Personnel domain view | UAF Personnel domain: persons, organizations, posts, responsibilities. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.resources@1 | graph | UAF Resources: resource performers, resources, functions, technologies | UAF Resources domain view | UAF Resources domain: resource performers, resources, resource functions, technologies. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.security@1 | graph | UAF Security: elements, controls, threats, assets; mitigation | UAF Security domain view | UAF Security domain: security elements, controls, threats, assets; mitigation. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.projects@1 | graph | UAF Projects: projects, milestones, work packages; milestone dependencies | UAF Projects domain view | UAF Projects domain: projects, milestones, work packages; milestone dependencies. Roadmap presentations use the timeline projection. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.standards@1 | graph | UAF Standards: standards, collections, protocols; compliance and forecast | UAF Standards domain view | UAF Standards domain: standards, collections, protocols; compliance and forecast. Forecast tables use the table projection. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.actualresources@1 | graph | UAF Actual Resources: actual resources, organizations, persons | UAF Actual Resources domain view | UAF Actual Resources domain: actual resources, organizations, persons. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.dictionary@1 | graph | UAF Dictionary: dictionary entries; tabular dictionary via table projection | UAF Dictionary domain view | UAF Dictionary domain: dictionary entries; the dictionary table uses the table projection. | registry endpoint contracts for the domain vocabulary (DDN102) |
| uaf.summary@1 | graph | UAF Summary & Overview: architecture descriptions, viewpoints, model references; OV-1 pictograms via frames | UAF Summary & Overview domain view | UAF Summary & Overview domain: architecture descriptions, viewpoints, model references; OV-1-style pictograms via frames and notes. | registry endpoint contracts for the domain vocabulary (DDN102) |
| flow.iso5807@1 | graph | ISO 5807 (1985) full flowchart symbol set: manual input/op, preparation, display, delay, loop limits, merge/extract, card, collate, sort, parallel mode | ISO 5807 flowchart | Full ISO 5807 (1985) flowchart symbol set: the flow.basic@1 vocabulary plus manual input, manual operation, preparation, display, delay, loop start/end, merge/extract, card, collate, sort and parallel mode. Closed flowchart structure rules as flow.basic@1 (start+end, flow.next links, named decision branches). | flowchart structure rules as flow.basic@1 (DDN-PF007–PF010); registry endpoint contracts (DDN102) |
| c4.deployment@1 | graph | C4 deployment view: rebadge of uml.deployment@1 (3D nodes, artifacts, deploy paths) | C4 deployment diagram | C4 deployment view: rebadge of the uml.deployment@1 machinery — nodes/devices/execution environments as 3D boxes, artifacts, deploy/manifest dependencies, communication paths with multiplicity, node nesting via frames. | uml.deployment@1 rules apply (nesting frames scope to node kinds, DDN-PJ164); registry endpoint contracts (DDN102) |
| c4.dynamic@1 | graph | C4 dynamic view: rebadge of uml.communication@2 (numbered messages) | C4 dynamic diagram | C4 dynamic view: rebadge of the uml.communication@2 machinery — numbered messages (x_message.seq ordering), combined fragments, time/duration constraints. | uml.communication@2 rules apply (message numbering, DDN-PJ111; fragments/constraints, DDN-PJ172); registry endpoint contracts (DDN102) |
| epc.complete@1 | graph | Full EPC: alternation/connectors plus org units, roles, info objects, process links, fan-balancing | Event-driven process chain (EPC), full | Full EPC notation: epc.basic@1 alternation/connectors plus organizational units and roles (lanes via frames), information objects/documents, process-link symbols, and split/join fan-balancing validation. | participants limited to the epk.* vocabulary (DDN-PF007); alternation (DDN-PJ105) and connector operator (DDN-PJ106) as epc.basic@1; split/join fan-balancing per operator (DDN-PJ199); registry endpoint contracts (DDN102) |
| msc.basic@1 | sequence | MSC (Z.120): rebadge of uml.sequence@2 — lost/found, create/stop, coregions, invariants with setting/guarding role, HMSC refs with x_subdiagram binding + x_hmscref params; PJ119/PJ215 | MSC (ITU-T Z.120) message sequence chart | Full Z.120 MSC notation via the uml.sequence@2 machinery: lifelines, message sorts (incl. lost/found = message loss), create/stop (instance creation/destruction), combined fragments and coregions, gates, time/duration constraints, state invariants as inline expressions with the setting/guarding role split (x_invariant role), and HMSC references (msc.hmscref with x_subdiagram binding and x_hmscref actual parameter lists). | uml.sequence@2 rules apply (message sorts PJ156, invariants PJ157, fragments PJ155, constraints PJ159); HMSC reference must bind an existing view (DDN-PJ119); x_hmscref belongs to msc.hmscref (DDN-PJ215); registry endpoint contracts (DDN102) |
| idef0.basic@1 | graph | IDEF0 (IEEE 1320.1): activity boxes with side-typed ICOM ports, A-0 numbering, tunneled and call arrows | IDEF0 function model | IDEF0 (IEEE 1320.1) function modeling: activity boxes with side-typed ICOM ports (Inputs left, Controls top, Outputs right, Mechanisms bottom), A-0 context and decomposition node numbering, labeled flow arrows with fork/join, tunneled arrows (x_tunnel), and call arrows (idef0.call). | ICOM port type must match the port's declared side (DDN-PJ200); node numbers unique and decomposition-prefixed (DDN-PJ201); registry endpoint contracts (DDN102) |
| petri.basic@1 | graph | Petri nets (ISO/IEC 15909): places with tokens, transitions, weighted/inhibitor/test arcs, bipartite validation | Petri net | ISO/IEC 15909 Petri net notation: places (circles) with token counts, transitions (bars), weighted arcs, inhibitor arcs (open-circle end), test/read arcs (dashed), markings via records. Bipartite graph enforced: places connect only to transitions and vice versa. | bipartite graph: arcs only between a place and a transition (DDN-PJ202); arc weights and token counts are nonnegative integers (DDN-PJ203); registry endpoint contracts (DDN102) |
| orm.basic@1 | graph | ORM 2 (ISO/IEC 19507): entity/value types, role-box fact types, uniqueness/mandatory, constraint arcs, objectification | ORM 2 object-role model | ORM 2 (ISO/IEC 19507) notation: entity types (solid ellipses), value types (dashed ellipses), fact types as role-box predicate rows with uniqueness bars and mandatory dots, n-ary predicates, subset/equality/exclusion constraint arcs, value constraints, objectification, derivation text. No projection beyond graph. | roles live on fact types and play to entity/value types (DDN-PJ204); fact types carry at least one role box (DDN-PJ204); registry endpoint contracts (DDN102) |
| vsm.basic@1 | graph | Value stream mapping: process boxes with data rows, VA/NVA timeline ladder, inventory/push/pull/info arrows, supermarket, kaizen, operator | Value stream map | Value stream mapping (machinery): process boxes with data rows, the VA/NVA timeline ladder strip, inventory triangles, push/pull and material arrows, electronic/manual information arrows, supermarket, kaizen burst and operator glyphs — simple generic glyphs only; detailed industry icon artwork is a separate excluded task. | ladder values are nonnegative numbers on vsm.process (DDN-PJ205); registry endpoint contracts (DDN102) |
| sdl.basic@1 | graph | SDL (Z.100) structural: blocks/agents, gates, channels with signal lists (text or x_sdl references/NODELAY), signal/signalset vocabulary | SDL system/block diagram | SDL (ITU-T Z.100) structural level: block and agent kinds, channels with signal lists (text or x_sdl signal references, NODELAY flag), signal and signal-set vocabulary, gates as block ports. | channels connect blocks/agents or their signals (DDN102); gates are block ports (DDN102); x_sdl channel signal references resolve to sdl.signal (DDN-PJ215) |
| sdl.process@1 | graph | SDL (Z.100) process: rebadge of uml.statemachine@1 with SDL symbols (input/output flags, task, save, create, procedure), timers (sdl.timer + set/reset), priority/spontaneous/continuous/active markers | SDL process diagram | SDL (ITU-T Z.100) process level: state-machine machinery with SDL process symbols — start, state, input (accept flag, priority/spontaneous/continuous/active markers via x_sdl), output (send flag), decision, task, save, create, timer declarations (sdl.timer) with set/reset nodes; procedure references as subprocess silhouettes. | exactly one start symbol (DDN-PJ208); input/output/task/save/create/set/reset symbols have at least one outgoing transition (DDN-PJ208); x_sdl timer references, marker owners and channel signals (DDN-PJ215); registry endpoint contracts (DDN102) |
| fbd.basic@1 | graph | IEC 61131-3 FBD: blocks with name/type headers, typed pins, negation bubbles, type-checked wires | IEC 61131-3 function block diagram | IEC 61131-3 FBD: function blocks (rect with name/type header and typed pins), typed wire connections (BOOL/INT/DINT/REAL/TIME/STRING/WORD), negation bubbles on BOOL pins, feedback loops allowed. Ladder (LD) hosting follows in a later item. | negation only on BOOL pins (DDN-PJ209); wire endpoints' pin types must match (DDN-PJ210); registry endpoint contracts (DDN102) |
| ladder.basic@1 | graph | IEC 61131-3 LD: power rails, rungs (one data block each), NO/NC contacts, coils (normal/set/reset/negated), OR branches from topology, hosted FBD blocks, labels/jumps, rung layout algorithm | IEC 61131-3 ladder diagram | IEC 61131-3 LD: power rails, rungs (one data block per rung, declaration order top to bottom), NO/NC contacts, output coils (normal/set/reset/negated) right-aligned at the rail, parallel OR branches inferred from series topology, fbd.block/fbd.variable hosted on rungs, labels/jumps/returns. Dedicated rung layout algorithm (layout.algorithm: ladder). | each rung drives exactly one ladder.coil (DDN-PJ211); ladder.series endpoints stay within one rung (DDN-PJ212); ladder.jump targets a selected ladder.label (DDN-PJ213); the profile requires layout.algorithm: ladder (DDN-PJ214); registry endpoint contracts (DDN102) |

Each profile's declared exclusions live in its registry `unsupported` list (standard/registry/profiles/catalogue.json); the enforced rules are in section 10.

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
| dependency | Source requires or references target; this does not assert data transfer. | pattern "2 6", colour #596579 |
| mapping | A labeled mapping such as instance-of, domain-use or placement. | pattern "9 4 2 4", colour #285EA8 |
| control | Source activates, controls or gates target; not a payload flow. | pattern "10 6", colour #8A5200 |
| lineage | Upstream source to derived result; the implementation path may be hidden. | pattern "10 4 2 4 2 4", colour #86415D |
| governance | Responsibility or policy relation with a mandatory verb or registered discriminator. | pattern "2 4 2 9", colour #526525 |
| annotation | Evidence or explanation attaches to an element; no execution is implied. | pattern "1 5", colour #64748B |

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

### 4.8 Registered data properties (108; chapter-10 contract vocabulary)

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
| motion | relation | flow \| pulse \| none | Declarative SMIL animation of the relation route: flow travels markers along the route; pulse animates edge stroke colour/opacity; none renders a static edge. Renderer-emitted, deterministic, file://-safe. |
| marker | relation | circle \| square \| rect | Travelling marker shape for motion:flow and flow blocks. |
| marker_size | relation | length (px), >0 and <=128px | Travelling marker size in px. |
| marker_color | relation | colour string | Travelling marker colour; defaults to the relation colour (accent for flow blocks). |
| rate | relation | integer 1..32 | Markers in flight on the route; >1 is a staggered particle stream (traffic-style). Values beyond the 32 DOM-honest cap warn (DDN-W016) and clamp at render time. |
| speed | relation | length (px/s), >0 and <=10000 | Marker travel speed along the route; hop boundaries are route-length/speed derived. |
| pulse_color | relation | colour string | Pulse peak stroke colour for motion:pulse. |
| depth | object | length (px), 0..2000 | Per-element extrusion height for isometric views (optional ddn-iso module, B1-034): overrides the view-level projection depth for this object (chart record or graph node). Requires iso:true or a view-level depth; without the ddn-iso.js bundle the view renders flat with a coded diagnostic. |
| side | port, relation_endpoint | enum: north \| south \| east \| west | Declares the edge of the owner an endpoint attaches to; layout honors it as a side hint, never silently reassigns it. |
<!-- /generated (vocabulary) -->

### 4.9 Registered `x_*` extension properties (extension contracts, from `ddn-profiles.js` + core registry)

| extension | applies to | contract |
|---|---|---|
| `x_record` | object, relation | object, additional properties allowed (record/metadata payload, e.g. `{month, value, unit}`) |
| `x_story` | relation | object, requires `task`, additional properties allowed |
| `x_rule` | object, relation | object (decision-table rule: `{when: {...}, then: {...}}`) |
| `x_state` | object, relation | `{terminal?, entry?, exit?, do?, internal?, submachine?}` (`state.*` kinds only — DDN-PJ160) |
| `x_transition` | object, relation | `{event?, guard?: object|string, effect?, actions?}` — label `trigger [guard] / effect` (DDN-PJ162) |
| `x_usecase` | object, relation | object (`subjects` refs / `extension_points` on objects; `extension_point`, `condition`\|`condition_ref` on `uml.extend` relations) |
| `x_chen` | object, field, relation | object (Chen metadata; §10) |
| `x_continuation` | object, relation | object (`{key, side: in|out, page?}`) |
| `x_assignment` | relation | `{code: string(1..12)}` only |
| `x_category` | object | `{axis: string, level: string}` exactly |
| `x_member` | field | `{kind: attribute|operation|literal, visibility?, static?, abstract?, derived?, multiplicity?, modifiers?}` |
| `x_endlabels` | relation | `{source|target: {role?, multiplicity?, qualifier?}}` on uml.association/commpath (DDN-PJ149) |
| `x_association_class` | relation | `{class: @ref}` uml.class on an association (DDN-PJ150) |
| `x_nary` | relation | `{ends: [{element: @ref, role?, multiplicity?}]}` n-ary ends (DDN-PJ151) |
| `x_genset` | relation | `{name, disjoint?, complete?}` on uml.generalization (DDN-PJ152) |
| `x_template` | object | `{parameters: [string]}` on uml.class/interface (DDN-PJ153) |
| `x_part` | field | `{classifier?, multiplicity?}` — internal part row `role: Classifier [mult]` (DDN-PJ166) |
| `x_pin` | port | `{set?, streaming?}` — activity pin parameter set/streaming (DDN-PJ169) |
| `x_interrupt` / `x_exception` | relation | boolean — lightning-bolt activity edges (DDN-PJ168) |
| `x_activity` | object | `{call?, transaction?, adhoc?, event_subprocess?, collapsed?, markers?}` BPMN task decorations (DDN-PJ177) |
| `x_io` / `x_bands` | object | `{set?}` io-set badge / `[participant…]` choreography bands (DDN-PJ178/PJ180) |
| `x_cmmn` | object | `{discretionary?, nonblocking?, required?, repetition?, manual_activation?, completion?, collapsed?}` plan-item decorators (DDN-PJ181) |
| `x_planning` | object | `{items: [string]}` planning table on a stage/task (DDN-PJ183) |
| `x_fbd` | port | `{type: BOOL|INT|DINT|REAL|TIME|STRING|WORD, negated?}` — FBD pin typing; negation bubble on BOOL pins (DDN-PJ209/PJ210) |
| `x_contact` / `x_coil` / `x_jump` | object | `{form: no|nc}` / `{mode: normal|set|reset|negated}` / `{target: @label}` — ladder contact/coil/jump contracts (DDN-PJ211/PJ213) |
| `x_link` | relation | `{file, target}` — cross-file association metadata; resolves via architecture bases (DDN-PJ216), absent file → DDN-PJW07 note |
| `x_sdl` / `x_hmscref` / `x_compatibility` | object / object / relation | `{signals: [@…], nodelay?}` on sdl.channel, `{priority?, spontaneous?, continuous?, active?}` on sdl.input, `{timer, duration?}` on sdl.set/reset (DDN-PJ215) / `{params: […]}` HMSC reference parameters (DDN-PJ215) / `{mode: same|specialization|realization|operation-coverage}` SoaML ServiceChannel compatibility (DDN-PJ196) |
| `x_icon` | object | `{library, icon}` — icon-library binding; draws the sanitized library SVG in the node (DDN-PJ206/PJ207) |
| `x_vsm` | object | `{va?, nva?, unit?}` — VSM timeline-ladder values on process nodes (DDN-PJ205) |
| `x_role` | field | `{uniqueness?, mandatory?}` — ORM role-box decorations (bar over box, dot at row edge; DDN-PJ204) |
| `x_values` | object | `{values: [string]}` — ORM value constraint on value types |
| `x_objectified` / `x_derive` | object | `{name}` objectification frame / `{text}` italic derivation text (ORM) |
| `x_petri` | object/relation | `{tokens?: int≥0, weight?: int≥1}` — Petri markings on places, arc weights on arcs (DDN-PJ203) |
| `x_icom` | port | `{type: input|control|output|mechanism}` — IDEF0 ICOM port typing; must match the port's `side` (DDN-PJ200) |
| `x_idef0` | object | `{node: "A1"}` — IDEF0 node number; unique per view, decomposition-prefixed (DDN-PJ201) |
| `x_tunnel` | relation | `{start?, end?}` — IDEF0 tunneled arrow; open parenthesis at the tunneled end |
| `x_c4tag` | object | `{tags: [string]}` — C4 element tags, rendered as an italic [tag, …] chip under the node |
| `x_subdiagram` | object | `{view, display?: badge|inline|thumbnail, frozen?, snapshot?, snapshot_at?}` — drill-down: badge (default), live inline, shapes-detail thumbnail (text suppressed), or frozen stored snapshot refreshed only by host rewrite (DDN-PJ119/PJ174/PJ198) |
| `x_sentry` | object | `{on: entry|exit, attach?, on_part?, if_part?}` (B1-064: criterion attachment, on/if-parts; DDN-PJ182) |
| `x_block` | field | `{compartment: values|parts|references|operations|constraints}` — SysML block compartment row (DDN-PJ186) |
| `x_port` | port | `{type: proxy|full, conjugated?, multiplicity?, nested?}` — SysML port typing (DDN-PJ187) |
| `x_unit` | field | `{unit, quantity?}` — unit from `standard/registry/units.json`, renders `name: unit` (DDN-PJ188) |
| `x_flow` | relation | `{rate?, probability?, continuous?}` — SysML activity-edge annotations under sysml.activity@1 (DDN-PJ191) |
| `x_boxed` | object | `{form: literal|context|invocation|relation, text?, entries?}` — DMN boxed-expression presentation (text only, never evaluated; DDN-PJ193) |
| `x_service` | port | `{kind: service|request}` — SoaML «Service»/«Request» port badges (DDN-PJ195/PJ196) |
| `x_contract` | object | `{choreography?: @view}` — SoaML service-contract choreography binding (DDN-PJ197) |
| `x_pack` | object | `{visibility: public|private}` — packaged element +/− (DDN-PJ171) |
| `x_use` | object | `{arguments?, gates?}` — interaction-use detail (DDN-PJ174) |
| `x_timeconstraint` | object | `["{…}", …]` timing constraints (DDN-PJ173) |
| `x_diagram` | object, relation | `{number?, owner?, code?, text?, branch?, stereotype?}` only |
| `x_epc` | object | `{operator: string}` (must be `and|or|xor` on `epk.connector`; forbidden elsewhere) |
| `x_sets` | object | array of 1..3 unique strings (venn membership) |
| `x_return` | relation | boolean (sequence/communication reply) |
| `x_message` | relation | `{seq?, sort?, gate?, time?, duration?}` (seq enforced by uml.communication@1 DDN-PJ111) |
| `x_fragment` | relation | `{operator: alt|opt|loop|…|assert, operands: [{guard?, messages: [@msg…], fragments?}]}` on first covered uml.message (DDN-PJ155) |
| `x_invariant` | object | `[{after: @msg, label}]` lifeline state invariant (DDN-PJ157) |
| `x_activation` | object | `[{from: @msg, to: @msg}]` explicit execution bars (DDN-PJ158) |
| `x_instance` | object | requires `classifier` (ref) |
| `x_partition` | object | `{lane: string}` exactly |
| `x_event` | object | `{type: none|message|…|parallel_multiple, position?, interrupting?, on?}` on event kinds |
| `x_gateway` | object | `{type: exclusive|parallel|inclusive|complex|event|event_exclusive}` on flow.gateway |
| `x_states` | object | array of `{at: number, state: string}` (timing; strictly increasing `at`) |
| `x_fbd` | port | `{type: BOOL|INT|DINT|REAL|TIME|STRING|WORD, negated?}` — FBD pin typing; negation bubble on BOOL pins (DDN-PJ209/PJ210) |
| `x_contact` / `x_coil` / `x_jump` | object | `{form: no|nc}` / `{mode: normal|set|reset|negated}` / `{target: @label}` — ladder contact/coil/jump contracts (DDN-PJ211/PJ213) |
| `x_link` | relation | `{file, target}` — cross-file association metadata; resolves via architecture bases (DDN-PJ216), absent file → DDN-PJW07 note |
| `x_sdl` / `x_hmscref` / `x_compatibility` | object / object / relation | `{signals: [@…], nodelay?}` on sdl.channel, `{priority?, spontaneous?, continuous?, active?}` on sdl.input, `{timer, duration?}` on sdl.set/reset (DDN-PJ215) / `{params: […]}` HMSC reference parameters (DDN-PJ215) / `{mode: same|specialization|realization|operation-coverage}` SoaML ServiceChannel compatibility (DDN-PJ196) |
| `x_icon` | object | `{library, icon}` — icon-library binding; draws the sanitized library SVG in the node (DDN-PJ206/PJ207) |
| `x_vsm` | object | `{va?, nva?, unit?}` — VSM timeline-ladder values on process nodes (DDN-PJ205) |
| `x_role` | field | `{uniqueness?, mandatory?}` — ORM role-box decorations (bar over box, dot at row edge; DDN-PJ204) |
| `x_values` | object | `{values: [string]}` — ORM value constraint on value types |
| `x_objectified` / `x_derive` | object | `{name}` objectification frame / `{text}` italic derivation text (ORM) |
| `x_petri` | object/relation | `{tokens?: int≥0, weight?: int≥1}` — Petri markings on places, arc weights on arcs (DDN-PJ203) |
| `x_icom` | port | `{type: input|control|output|mechanism}` — IDEF0 ICOM port typing; must match the port's `side` (DDN-PJ200) |
| `x_idef0` | object | `{node: "A1"}` — IDEF0 node number; unique per view, decomposition-prefixed (DDN-PJ201) |
| `x_tunnel` | relation | `{start?, end?}` — IDEF0 tunneled arrow; open parenthesis at the tunneled end |
| `x_c4tag` | object | `{tags: [string]}` — C4 element tags, rendered as an italic [tag, …] chip under the node |
| `x_subdiagram` | object | `{view: string}` (interaction-overview node → view id) |
| `x_sentry` | object | `{on: entry|exit, attach?, on_part?, if_part?}` (DDN-PJ182) |
| `x_estimate` | object | number (CPM duration in days) |
| `x_gate` | object | `{type: and|or}` |
| `x_rack` | object | `{units: int≥1, unit: int≥1}` |
| `x_birth` / `x_death` | object | integer years |
| `x_erp` | object (table), relation (ref) | ERP metadata: `primary_key`, `unique_keys` (field-local tuples, DDN110), `scope: company` requires `company_id`; relation side: `join_fields` naming target fields, `same_company`, `enforcement: database` requires same database on both ends (DDN116) |
| `x_workflow` | object | state machine contract: `states`, `initial`, `terminal[]`, `transitions[]` (`{id, from, to, event, guard?, max_visits?}`); validated per DDN130 |
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

<!-- generated: do not edit (projection-kinds) -->
`projection.kind` values: `graph` (default), `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`, `fishbone`, `decision`, `sequence`, `timing`, `geo` (anything else → DDN-PJ001). Every projection property must be legal for its kind — no silently ignored settings (DDN-PJ005). Allowed keys per kind (`ddn-projection-data.js supported`):

```json
{
 "graph": [
  "kind",
  "profile",
  "inputs",
  "analysis_budget",
  "traces",
  "iso",
  "depth"
 ],
 "fishbone": [
  "kind",
  "profile",
  "width",
  "height",
  "effect",
  "relation"
 ],
 "decision": [
  "kind",
  "profile",
  "width",
  "height",
  "records",
  "inputs",
  "outputs",
  "hit_policy",
  "coverage",
  "analysis_budget",
  "filter",
  "order",
  "x_completeness"
 ],
 "chen": [
  "kind",
  "profile",
  "width",
  "height"
 ],
 "matrix": [
  "kind",
  "profile",
  "width",
  "height",
  "write_data",
  "rows",
  "columns",
  "relation",
  "value",
  "duplicates",
  "encoding"
 ],
 "table": [
  "kind",
  "profile",
  "width",
  "height",
  "records",
  "columns",
  "filter",
  "order",
  "missing"
 ],
 "panels": [
  "kind",
  "profile",
  "width",
  "height",
  "columns",
  "panels",
  "value"
 ],
 "chart": [
  "kind",
  "profile",
  "width",
  "height",
  "records",
  "mark",
  "x",
  "y",
  "x_type",
  "size",
  "unit",
  "aggregate",
  "filter",
  "order",
  "missing",
  "inner_radius",
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
  "bin_count",
  "k",
  "others",
  "error",
  "trend",
  "iso",
  "depth"
 ],
 "timeline": [
  "kind",
  "profile",
  "width",
  "height",
  "records",
  "start",
  "end",
  "label",
  "dependencies",
  "filter",
  "order"
 ],
 "sequence": [
  "kind",
  "profile",
  "width",
  "height"
 ],
 "timing": [
  "kind",
  "profile",
  "width",
  "height"
 ],
 "geo": [
  "kind",
  "profile",
  "width",
  "height",
  "records",
  "mark",
  "x",
  "y",
  "value",
  "size",
  "unit",
  "filter",
  "order",
  "missing",
  "geography",
  "method",
  "graticule"
 ]
}
```
<!-- /generated (projection-kinds) -->

Common rules: `width`/`height` hints 240..12000 px (DDN-PJ006); measured result extent ≤ 50000 px (DDN-PJ060); reference arrays hold 1..500 unique refs (DDN-PJ009), except chart/table `records: []` which declares an intentional empty state (empty plot with axes for bar/line/area/point; header-only table; DDN-PJ009 otherwise); every bound element must be in the data scope (DDN-PJ007) AND selected in the view (DDN-PJ008); binding strings are dot-separated safe property paths like `x_record.value`, or the special element properties `name`, `id`, `kind` (unsafe paths → DDN-PJ004); filters are `{key, op: eq|in, value}` only (DDN-PJ011); ordering is `{key, direction: asc|desc}` (DDN-PJ011); filtering may not empty the selection (DDN-PJ012). **All non-graph/chen projections are data-bound**: they reject `place`/`route`/`frame`/`subdiagram` geometry and any retained layout state (DDN-PJ002, DDN-PJ051).

Per-kind summary:

- **graph**: the default. `profile: "ddn@1"` plain DDN, or any graph profile id from §4.5 (§10 lists enforced rules). `inputs`/`analysis_budget`/`traces` are legal only with `profile: "state.flat@1"` (DDN-Q005) or `pert.cpm@1` CPM enrichment.
- **chen**: `profile: "chen.basic@1"` (scalar subset) or `"chen.binary@2"` (extended). Projects entity objects and binary object-level `assoc`/`ref` relations into Chen occurrences (attribute ovals, association diamonds). Requires only `entity` nodes and binary non-member `assoc`/`ref` edges (DDN-PJ050); the scalar subset also rejects nested/repeated fields. Emits info DDN-PJW01.
- **matrix**: `rows` + `columns` (1..500 refs each; ≤5000 cells, ≤40 columns — DDN-PJ013), `relation` = a registered relationship keyword (DDN-PJ014), `value` = binding for cell text, `duplicates: error|join` (`join` only on `matrix.relations@1`, `matrix.bcg@1`, `matrix.ansoff@1`, `matrix.tows@1`, `matrix.storymap@1` — RACI/CRUD require one assignment per cell), optional `encoding` (numeric/category/bands with explicit domain/values/boundaries + labels; palette `blue|diverging`; DDN-QM001/QM002). Cells are relations row→column of the declared kind. Quadrant profiles (`matrix.bcg@1` growth×share high/low, `matrix.ansoff@1` market×product existing/new, `matrix.tows@1` internal strength/weakness × external opportunity/threat) require rows/columns to be exactly the named categories via `x_category` (DDN-PJ082). `matrix.raci@1` rows need exactly one `A`, ≥1 `R`, only R/A/C/I (DDN-PJ016); `matrix.crud@1` values are distinct C/R/U/D letters (DDN-PJ017); `matrix.storymap@1` uses `assoc` cells carrying `x_story.task` refs to `analysis.task` (DDN-PJ014/PJ093), one cell per story per release (DDN-PJ086).
- **table**: `records` + `columns: [{key, label}]` (1..30, unique — DDN-PJ018); `missing: error|blank` (DDN-PJ019); values must be scalar.
- **panels**: `columns` 1..12, `panels: [{id, title, row, column, rowspan?, colspan?, items?, view?}]` (1..80 panels, no overlaps — DDN-PJ020/PJ021). Canvas profiles require fixed panel sets (DDN-PJ080/081/083): `canvas.bmc@1` = kp, ka, kr, vp, cr, ch, cs, cost, rev; `canvas.lean@1` = problem, solution, keymetrics, uvp, unfair, channels, segments, cost, revenue; `canvas.pest@1` = political, economic, social, technological; `canvas.pestle@1` adds legal, environmental; `canvas.porter5@1` = entrants, supplier, rivalry, buyer, substitutes; `canvas.empathy@1` = says, thinks, persona, does, feels; `canvas.scorecard@1` = financial, customer, internal, learning. `panels.journey@1`: 2..8 phase columns; row 0 = `phase-<slug>` panels; rows 1..3 = `actions|touchpoints|opportunities-<phase>`; row 4 = single full-width `emotions` panel whose items carry `x_record.phase` + `x_record.value` in 1..5 (DDN-PJ084/PJ085). `panels.pyramid@1`: 3..5 bands, single column, contiguous rows (DDN-PJ089). `panels.venn@1`: 2..3 sets; item membership via `x_sets` must match panel listing (DDN-PJ090/PJ091). `panels.composed@1`: panels with `view:` embed child views (one level only, ≤12 children, child ≤128 elements/384 relations — DDN-QP001..003).
- **chart**: marks `bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey` plus the Category-2 pack `histogram, density, qq, quantiledot, dotplot, boxplot, violin, beeswarm, topk, tidytree, radialtree, circlepack, sunburst, packedbubble, heatmap, densityheatmap, calendar, parallelcoords, wordcloud, arc, force, edgebundle` (DDN-PJ030); overlays `error:"binding"` (I-beam error bars on bar/point, DDN-PJ141) and `trend:linear|loess` (least-squares / tricube loess span 0.3 on numeric point/line, DDN-PJ142); distribution marks bind only numeric x (no y/series, DDN-PJ134; bin_count integer, DDN-PJ131; zero-variance is UNKNOWN, DDN-PJ132; k/others for topk, DDN-PJ133; sample-size and grid caps, DDN-PJ135; hierarchy values nonnegative, DDN-PJ136; duplicate heatmap cells/calendar days/wordcloud words, DDN-PJ137; wordcloud weights positive, DDN-PJ138); `x_type: category|number|date`; explicit `x` and `y` bindings (candlestick uses `open/high/low/close`); `y` must be finite numeric, no string coercion (DDN-PJ032); date x must be real ISO `YYYY-MM-DD` (DDN-PJ033); `aggregate: none|sum|count|min|max|mean` on category bars/arcs only (DDN-PJ031); duplicate categories require an aggregate (DDN-PJ036); `missing: error|skip` (DDN-PJ019); `unit` requires matching `x_record.unit` on every record (DDN-PJ034); `inner_radius` 0..0.9 exclusive. Mark-specific: point requires x_type number; pie/donut/bar/radar/funnel require categorical x; radar ≥3 categories, series key ≤80 chars (DDN-PJ071/072/030); funnel ≥2 distinct stages, no series, nonnegative (DDN-PJ073/PJ107); gauge exactly one record, value 0..100, optional numeric `target` 0..100 (DDN-PJ074/075); candlestick high≥low and open/close within [low,high], x not number (DDN-PJ076/077); treemap dotted paths ≤3 levels, nonnegative, no aggregation/series (DDN-PJ078/PJ031); sankey categorical endpoint text x + `target` binding, positive values, acyclic (DDN-PJ108/PJ079).
  - **chart.quality@1** (and any chart with series/arrangement/transform/layers/bins/normalize/whiskers/quartiles/step/target, except gauge/sankey) adds: `transform: identity|histogram|pareto|waterfall|boxplot` (DDN-QC001), quality marks `bar|line|area|point|box`; histogram needs 2..101 increasing `bins`, `normalize: count|proportion|density`, `outside: error|exclude` (DDN-QC010/QC011); pareto needs nonnegative values with positive total (DDN-QC012); waterfall needs a `step` binding (`delta|subtotal|total`) and declared totals must match cumulative deltas (DDN-QC013/QC014); boxplot quartiles `linear_r7`, whiskers `tukey_1_5|minmax` (DDN-QC015); multi-series: ≤20 series × ≤200 categories, `arrangement: group|stack|percent|overlay`, one `layers` entry per series with mark bar|line|area|point, stacked/percent all-bars-or-areas, `series_missing: gap|zero|error`, duplicates need aggregate (DDN-QC020/QC021/QC022).
- **timeline**: `records` with `start`/`end` ISO date bindings (end ≥ start, DDN-PJ040); optional `dependencies` refs to visible `precede`/`analysis.precedes` relations that must not contradict dates (DDN-PJ041/PJ042) and must be acyclic (DDN-PJ043); `label` binding optional.
- **sequence** (`uml.sequence@1`): participants = selected object declarations in declaration order (lifelines); messages = visible `uml.message` relations, ordered top-to-bottom in declaration order; `x_return: true` draws dashed return; endpoints must be selected objects (DDN-PJ110).
- **timing**: participants carry `x_states: [{at: finite number, state: nonempty string}, …]` with strictly increasing `at` (DDN-PJ118).
- **fishbone**: `effect` ref to a `quality.effect` element; `relation` = named cause relation; first-level ribs must be `quality.category` (1..12); acyclic, ≤4 cause levels, ≤250 occurrences, all selected cause relations connected (DDN-QF001..004).
- **decision**: `inputs: [{key, type: enum|boolean|number, values?|min/max?, nullable?, optional?}]` (1..8, DDN-QD001), `outputs: [1..20 keys]`, `records` = rule elements carrying `x_rule: {when, then}` where `when` predicates use `op: eq|in|interval|null|missing` within declared domains (DDN-QD002), every rule supplies every output (DDN-QD003); `hit_policy: unique|first|collect`, `coverage: complete|report|none`, `analysis_budget` 1..50000 (default 4096); overlap under `unique` → DDN-QD004; uncovered witness under `complete` → DDN-QD005; budget exceeded blocks proofs → DDN-QD008.
- **geo** (optional ddn-geo module; `geo.choropleth@1`, `geo.symbols@1`, `geo.outline@1`): `geography` (registered name/URL or inline `@record` GeoJSON — DDN-PJ144), `method: mercator|equirectangular|albers|equalEarth` (default mercator; albers uses standard parallels 29.5°/45.5° and fits to latitudes −60..85; DDN-PJ143 on unknown), `mark: choropleth|symbol|outline` (default from profile), `graticule: true|false`. Choropleth binds `x` (join key → feature id or name, unique — DDN-PJ148; the shipped `assets/geo/world-110m.json` joins on the ISO 3166-1 numeric id as a string, e.g. `"840"`) + `value` (finite number — DDN-PJ145); unmatched features render neutral and unmatched records/features are reported via DDN-PJW05 (info). Symbol binds `x`=lon/`y`=lat in range, optional `size` (DDN-PJ146), radius sqrt-scaled. GeoJSON ingestion accepts Feature/FeatureCollection with Polygon/MultiPolygon/Point/MultiPoint (DDN-PJ147 on others); coordinates must be finite in-range pairs (DDN-PJ146); antimeridian crossings split the path instead of streaking. Rendering a geo view **without** ddn-geo.js yields the inline placeholder ("Map view requires ddn-geo.js") + coded DDN-E010 diagnostic; the CLI pre-loads it.
- **iso/depth** (optional ddn-iso module; graph and chart projections only): `iso: true|false` (default false) and `depth` (px quantity or number 0..2000, per-record `"x_record.field"` binding, or `@data.record.field` view binding — DDN-ISO151 on bad forms, DDN-ISO152 when the binding is not a finite 0..2000 number; `iso` non-boolean or on other kinds → DDN-ISO150). Charts: bar/pie/donut/area/treemap extrude (axes stay flat; other marks warn DDN-ISOW01 and render flat). Graphs with `iso: true`: nodes render as extruded prisms on an iso ground plane (per-object `depth:` overrides the view depth), relations are routed flat then projected onto the ground plane (never 3D routing); frames/subdiagrams omitted (DDN-ISOW02). Missing module: `iso: true` → visible placeholder "Isometric view requires ddn-iso.js" + coded DDN-E010; `depth` alone → flat render + DDN-E010 warning. Refresh transitions: `renderSync({isoFrom:{depths}})` after `replaceData` → one-shot 250 ms SMIL; `noMotion` strips it.
- **Vega-Lite adapter** (`DDNProjections.vegaLite`): chart/timeline only; radar/funnel/gauge/candlestick/treemap/sankey and quality transforms have no faithful mapping (DDN-PJ070).

## 6. Decision guide — user intent → projection kind / profile / marks

Read the request, find the closest intent row, then apply §10 profile rules. When the request names a standard notation (BPMN, C4, UML, …), use that profile directly.

| user intent | projection.kind | profile | marks / notes |
|---|---|---|---|
| org chart | graph | `org.tree@1` | `reports_to` edges, one root; `layout { algorithm: tree; root: @…; hierarchy: [reports_to]; }` |
| database schema / ERD | graph | `erd.crowfoot@1` | `table` kinds + `ref` with BOTH `source_mark`/`target_mark`; Chen style → kind chen, `chen.basic@1`/`chen.binary@2` |
| flowchart | graph | `flow.basic@1` | `flow.*` kinds, `flow.next`, one start/end, `x_diagram.branch` on decision outlets; annotations/off-page → `flow.documented@2` |
| data flow diagram | graph | `dfd.gane_sarson@1` / `dfd.yourdon@1` | `dfd.process/store/external` + `dfd.data`; unique `x_diagram.number` per process |
| BPMN process/collaboration | graph | `bpmn.basic@1` / `bpmn.process@1` | pools = `x_pool` frames, `x_gateway.type`, `bpmn.messageflow` across pools; process@1: full event system, 6 gateways, activity markers, data nodes, flow variants |
| BPMN choreography | graph | `bpmn.choreography@1` | `flow.choreotask` + `x_bands` participant bands |
| BPMN conversation | graph | `bpmn.conversation@1` | conversation hexagons + `bpmn.conversationlink` |
| process chain (EPC) | graph | `epc.basic@1` | alternating `epk.event`/`epk.function`, `x_epc.operator` on connectors |
| activity diagram / swimlanes | graph | `uml.activity@1` / `uml.activity@2` | `uml.flow`, `x_partition.lane` names a frame, fork=join bars; @2 : merge, pins (x_pin), signals/time events, flow final, interruptible/structured regions, exception handlers |
| state machine / lifecycle | graph | `state.flat@1` / `state.composite@1` / `uml.statemachine@1` | `state.*` + `x_transition.event`; regions = `x_region` frames; uml.statemachine@1: activities/internal/submachines, pseudostates, effects, time events |
| sequence diagram | sequence | `uml.sequence@1` / `uml.sequence@2` | declaration-order lifelines; @2 : fragments, gates, message sorts, `{…}` constraints, invariants, activations |
| communication | graph | `uml.communication@1` / `uml.communication@2` | `uml.message` + dotted `x_message.seq`; @2 : `x_fragment` frames, `{…}` constraints |
| interaction overview | graph | `uml.interaction_overview@1` / `uml.interaction_overview@2` | `x_subdiagram.view` refs; @2 : inline expansion, `x_use` gates/arguments |
| profile diagram | graph | `uml.profile@1` | `uml.metaclass`/`uml.stereotype`, `uml.extension` (filled triangle), `uml.application` |
| class diagram | graph | `uml.structure@1` / `uml.structure@2` | class/interface/enumeration, `x_member`; @2 : end labels, diamonds, association classes, n-ary, gensets, templates, provided/required |
| deployment diagram | graph | `uml.deployment@1` | node/device/executionenv 3D boxes, artifacts, deploy/manifest, commpaths + multiplicity; nesting = node-scoped frames  |
| component / composite structure | graph | `uml.composite@1` | ports on classifiers, `uml.assembly` (socket+lollipop), `uml.delegation`, `uml.connector` + `x_endlabels`, parts (`x_part`), `uml.collaboration`  |
| use cases | graph | `uml.usecase@1` / `uml.usecase@2` / `uml.usecase@3` | `uml.subject` boundaries + `x_usecase` (@2); @3: extend conditions on labels |
| object diagram | graph | `uml.object@1` / `uml.object@2` | `x_instance.classifier`; @2 : underlined titles, slot datatype checks, `uml.link` multiplicity |
| timing diagram | timing | `uml.timing@1` / `uml.timing@2` | `x_states` per participant; @2 : duration/slew, `x_timeconstraint`, compaction, lifeline messages |
| C4 architecture | graph | `c4.context@1` / `c4.container@1` / `c4.component@1` | exactly one boundary frame |
| system context/free architecture | graph | `ddn@1` | any kinds/verbs; no enforced profile rules |
| requirements traceability | graph | `requirements.basic@1` | `req.*` kinds/verbs, `x_diagram.code`+`text` |
| UAF (12 domains) | graph | `uaf.<domain>@1` ×12 | strategic/operational/services/systems/personnel/resources/security/projects/standards/actualresources/dictionary/summary vocabularies; stereotyped verbs (capabilityDependency, exhibits, mapsTo, performs, assignedTo, compliesWith, mitigates, milestoneDependency, forecast, supports, owns) — endpoint contracts DDN102; capability draws the `tag` silhouette |
| SoaML services | graph | `soaml.services@1` | participant/agent/serviceinterface/servicecontract/capability/message/milestone kinds, x_service port badges, x_contract choreography binding, assembly conformance (DDN-PJ195–PJ197) |
| C4 deployment/dynamic | graph | `c4.deployment@1` / `c4.dynamic@1` | rebadges of uml.deployment@1 / uml.communication@2 (PJW06); numbered messages required (PJ111); tag chips via x_c4tag |
| IEC 61131-3 FBD | graph | `fbd.basic@1` | blocks (datatype header) + variables, x_fbd pin types/negation, fbd.wire with type-match (PJ209/PJ210) |
| IEC 61131-3 LD | graph | `ladder.basic@1` | power rails + rungs (one data block per rung), contacts/coils (x_contact/x_coil), OR branches from series topology, hosted FBD blocks, labels/jumps (x_jump), layout algorithm `ladder`; PJ211–PJ214 |
| SDL | graph | `sdl.basic@1` / `sdl.process@1` | structural: blocks/agents, channels, signal/signalset, gate ports; process: uml.statemachine@1 rebadge with sdl.input/output (flags), task, save (tag), create (dashed), procedure (subprocess); PJ208 start/outgoing rules |
| Icon packs | (any) | `standard/registry/icon-packs/` (ddn-icon-pack@1, spec ch.49 + `icon-pack.schema.json`) + `x_icon` | packs bound to kinds (default) or per-node (x_icon); sanitization PJ207 (scripts/foreignObject/handlers/external refs rejected, 20 KiB cap); host packs via `registerIconPack(pack)`/`unregisterIconPack`/`hostIconPacks` (PJ206 manifest/duplicate, PJ207 unsafe); ships network-generic@1 (20, binds network.*), vsm-symbols@1 (16, binds vsm.*), pid-common@1 (36), electrical-common@1 (32) — common-practice artwork pending review — tabler-infra@1 (50, MIT) and iconoir-infra@1 (49, MIT) curated selections, plus generic-demo@1 |
| Value stream maps | graph | `vsm.basic@1` | process boxes (x_vsm va/nva ladder), inventory triangle, push/pull/material, einfo zigzag/minfo dashed, supermarket, kaizen burst, operator |
| ORM 2 | graph | `orm.basic@1` | entitytype/valuetype ellipses, facttype role-box rows (x_role), plays member endpoints, subset/equality/exclusion arcs, x_values/x_objectified/x_derive (PJ204) |
| Petri nets | graph | `petri.basic@1` | places (x_petri.tokens), transitions, petri.arc (weight), petri.inhibitor (circle end), petri.testarc (dashed); bipartite validation (PJ202) |
| IDEF0 | graph | `idef0.basic@1` | activity boxes with x_icom port typing + side contract, x_idef0 node numbering, idef0.flow/call arrows, x_tunnel tunneled arrows |
| MSC (Z.120) | sequence | `msc.basic@1` | rebadge of uml.sequence@2 (PJW06); msc.hmscref «ref» participants binding views via x_subdiagram (PJ119); coreg fragment operator; create/delete (start/stop), lost/found (message loss) sorts; inline expressions via x_invariant |
| Full EPC | graph | `epc.complete@1` | epk.event/function/connector + orgunit/role/infoobject/processlink; alternation PJ105, operator PJ106, split/join fan-balancing PJ199 |
| DMN DRD | graph | `dmn.drd@1` | decision/BKM/inputdata/knowledgesource/decisionservice kinds, inforeq/knowledgereq/authorityreq connectors, `x_subdiagram` binds decision-table views (DDN-PJ192), boxed expressions via `x_boxed`; FEEL never evaluated |
| SysML | graph | `sysml.bdd@1/@2` / `sysml.ibd@1/@2` / `sysml.parametric@1/@2` / `sysml.requirements@1` / `sysml.package@1` | @2: block compartments, port typing, relaxed parametric bindings |
| ArchiMate | graph | `archimate.basic@1` | `archi.*` kinds, same-layer or upward `archi.rel` |
| fault / event tree | graph | `fault.tree@1` / `event.tree@1` | `tree.gate` + `x_gate.type`, ≥2 `tree.input` |
| network / rack | graph | `network.basic@1` / `network.rack@1` | `network.attaches` to bus/ports; `x_rack.unit` unique per rack |
| family tree / genealogy | graph | `family.tree@1` | `family.parent_of` (acyclic, ≤2 parents), `x_birth`/`x_death` |
| work breakdown | graph | `wbs.tree@1` | `analysis.task` + `analysis.decomposes`, one root |
| mind map / brainstorm | graph | `mindmap.basic@1` | `layout.algorithm: mindmap` REQUIRED, one root, `assoc` only |
| concept map | graph | `concept.map@1` | EVERY relation needs an author-written label (DDN-PJ104) |
| wireframe / UI mock | graph | `wireframe.ui@1` | `ui.*` kinds; controls outside a `ui.frame` warn |
| PERT / critical path | graph | `pert.cpm@1` | `x_estimate` days on tasks, `analysis.precedes` acyclic |
| RACI / responsibility | matrix | `matrix.raci@1` | cells = `analysis.assignment` with `x_assignment.code`, one A per row |
| CRUD | matrix | `matrix.crud@1` | `analysis.access`, distinct C/R/U/D per cell |
| relationship matrix / heatmap | matrix | `matrix.relations@1` / `matrix.heatmap@1` | any verb; `encoding` for colour |
| BCG / Ansoff / TOWS quadrant | matrix | `matrix.bcg@1` / `matrix.ansoff@1` / `matrix.tows@1` | rows/columns fixed via `x_category` |
| story map | matrix | `matrix.storymap@1` | `assoc` cells with `x_story.task` |
| bar/line/area/scatter chart | chart | `chart.basic@1` | `mark: bar|line|area|point`; y numeric |
| pie / donut | chart | `chart.basic@1` | `mark: pie|donut`, categorical x, `inner_radius` for donut hole |
| radar / funnel | chart | `chart.radar@1` / `chart.funnel@1` | radar ≥3 categories; funnel ≥2 stages |
| KPI gauge | chart | `chart.gauge@1` | exactly one record, value 0..100, optional `target` |
| financial OHLC | chart | `chart.candlestick@1` | `open/high/low/close` bindings |
| hierarchy (treemap/sunburst/pack/tree) | chart | `chart.treemap@1`, `chart.sunburst@1`, `chart.circlepack@1`, `chart.tidytree@1`, `chart.radialtree@1`, `chart.packedbubble@1` | dotted-path x, nonnegative values |
| sankey / flow quantities | chart | `chart.sankey@1` | categorical x + `target` binding, acyclic |
| distribution (histogram/box/violin/…) | chart | `chart.histogram@1`, `chart.density@1`, `chart.qq@1`, `chart.quantiledot@1`, `chart.dotplot@1`, `chart.boxplot@1`, `chart.violin@1`, `chart.beeswarm@1`, `chart.topk@1` | numeric x only, no y/series |
| grid charts (heatmap/calendar/parallel/wordcloud) | chart | `chart.heatmap@1`, `chart.densityheatmap@1`, `chart.calendar@1`, `chart.parallelcoords@1`, `chart.wordcloud@1` | per-mark rules in §5 chart bullet |
| network charts (arc/force/edgebundle) | chart | `chart.arc@1`, `chart.force@1`, `chart.edgebundle@1` | relation-derived; see §5 |
| multi-series / SPC / pareto / waterfall / boxplot transform | chart | `chart.quality@1` | `series`+`arrangement`, `transform`, `layers` |
| timeline → gantt / schedule | timeline | `timeline.basic@1` | `start`/`end` ISO dates on records, optional `dependencies` |
| decision table | decision | `decision.rules@1` | `inputs`/`outputs` + `x_rule` records, `hit_policy` |
| fishbone / root-cause | fishbone | `fishbone.basic@1` | `quality.effect` + `quality.category` ribs via `quality.cause` |
| data table | table | `table.records@1` | `columns: [{key,label}]` |
| dashboard → panels + charts | panels | `panels.composed@1` | panels embed child chart/table/graph views via `view:`; item lists → `panels.basic@1` |
| canvas (BMC/Lean/PEST/Porter/empathy/scorecard) | panels | `canvas.*@1` | fixed panel id sets (§5 panels bullet) |
| journey map | panels | `panels.journey@1` | phase grid + emotions panel |
| pyramid / venn | panels | `panels.pyramid@1` / `panels.venn@1` | bands / `x_sets` membership |
| map: regional values | geo | `geo.choropleth@1` | `x` join key → feature id/name + `value` |
| map: points | geo | `geo.symbols@1` | `x`=lon, `y`=lat, optional `size` |
| map: plain outline | geo | `geo.outline@1` | geography only |
| isometric / 3D-look chart or diagram | graph or chart | any graph/chart profile | add `iso: true` + `depth` (ddn-iso module) |
| animated diagram | graph | any graph profile | `motion:` on relations + view `flow` trace blocks (§7.6) |
| refresh-ready dashboard | panels/chart | `panels.composed@1` + records blocks | `records` blocks give keyed `replaceData` (§7.4) |

## 7. Behaviours an author must know

### 7.1 Defaults and omitted ≠ asserted

Every view resolves to the full §3.5 default set; an omitted property takes the default (or inherits from the referenced bundle per §3.3) and is NEVER written into the model. Asserting pins it. So: omit everything you do not intend to change; a view-local group overrides a bundle for exactly the keys it names; compact forms never imply extra properties.

### 7.2 Identity, labels, uid

Identity is the declaration id (dotted path in its module), never the quoted label. Renaming a label changes no references; renaming an id breaks every `@ref`. `uid: "…"` pins identity across refactoring. Duplicate symbol keys fail (DDN024).

### 7.3 missing / null / undecided / not_applicable / conflicting

`null` = SQL-like UNKNOWN (a null-typed field accepts anything). `missing` = required but not supplied. `undecided` = open modeling decision. `not_applicable` = does not apply. `conflicting` = known disagreement. Unquoted atoms; quoted forms are plain strings. Charts: `missing: error|skip` (DDN-PJ019); tables: `missing: error|blank`.

### 7.4 Data refresh contract (keyed, transactional)

`ws.replaceData(name, records)` replaces a data block's records atomically: records carry the same field keys as the block's first record (DDN-E011); optional per-record `key` matches declaration ids (all-or-nothing; unknown key appends a declaration) — a `records` block's row ids ARE these keys, so author refresh-target data as `records` blocks. Without keys the match is positional. Values type-check against inferred field types; every workspace view is validated BEFORE commit; failure → `{committed:false}` with structured DDN-E012 diagnostics. Removing a view-referenced record is rejected. Selector views (`data: [@block]`) pick up additions automatically; explicit-binding views keep exactly their bound records and warn DDN-W015. Empty refresh is legal (subject to the removal rule); filter-to-empty fails DDN-PJ012.

### 7.5 Layout, routing, chrome, sizing

- Omit `place`/`route` for automatic layout; pin only to control geometry (`place.at`/`size`, `route.via`). Pins must not overlap (DDN204). `layout.algorithm` picks placement (§3.6); `direction` orients layered/tree; `spacing` scales gaps.
- Legends/title/footer chrome: §3.3 `chrome` bullet; numbered legends number relations, not time.
- Page/artboard: `publication { size: content|fixed; width/height; margin; fit; overflow: warn|error; minimum_text }`; result extent ≤ 50000 px.
- Text is measured with embedded font metrics; below `publication.minimum_text` DDN071 warns (or errors under `overflow: error`). Rule of thumb: labels ≤ ~30 chars, dense graphs ≥ 1200 px wide, prefer `size: content` so the page grows instead of shrinking text.

### 7.6 Motion and flow semantics (animation)

Relations accept motion properties: `motion: flow|pulse|none`, `marker: circle|square|rect`, `marker_size` (>0..128px), `speed` (px/s), `rate` (markers in flight; >32 warns DDN-W016 and clamps), `marker_color`, `pulse_color`. View-level `flow <id> "label" { steps: @a -> @b -> @c; … }` declares a multi-hop sequence: each hop must follow an existing VISIBLE relation in its declared direction (DDN-E013). Invalid values → DDN-E014. The SVG animates autonomously (SMIL); `noMotion` / `--no-motion` renders static for print.

### 7.7 Module requirements (iso / geo)

Geo views need the optional `ddn-geo.js` module and a registered geography (`assets/geo/world-110m.json`; CLI pre-registers it; or inline GeoJSON via `geography: @data.record`). Iso/depth needs `ddn-iso.js` (graph + chart only). Both degrade loudly without the module (placeholder + DDN-E010). Neither is inside `ddn.global.js`.

## 8. Optimization and size discipline

- Omit defaults (§7.1) — the shortest correct source is the best source.
- Use compact forms: typed declarations (`table customer {…}`), contextual members, verb relations (`ref places @a [one] -> @b [zeromany]`), view headers (`view erd: @sales as "erd.crowfoot@1";`).
- Use a `records` block for tabular data — one column declaration instead of `x_record` per row, and row ids double as `replaceData` keys.
- Use `preset`/`relation_props`/`fields` groups for repetition (≥3 similar declarations); `fragment` for reusable sub-models.
- Size limits: live views cap at **128 elements / 384 relations** (LIVE013); reference arrays ≤500; matrices ≤5000 cells / ≤40 columns; panels ≤80; chart series ≤20 × 200 categories; file ≤ 2M chars; extent ≤ 50000 px. Stay under them with `filter`/`order`, `select:`/`exclude:`, `subdiagram`/`panels.composed@1` child views (each child has its own budget), and linked views over one giant canvas.
- Canvas/routing hints: `layered; direction: down` for DAGs, `grid` for atlases, `tree`+`root`+`hierarchy` for hierarchies; raise `gap`/`row_gap` before pinning; use view-level `spacing`; prefer `route` hints over `place` pins when only crossings bother you.
- Split files when a workspace exceeds ~2–3 screens of source per concern (§12); ship one file via `bundle`.

<!-- generated: do not edit (diagnostics) -->
## 9. Diagnostics and error recovery (438 codes, machine-extracted from runtime + Studio sources; 124 carry a hand-authored FIX)

`check`/`render` failures print one JSON error object; warnings/infos appear in `warnings`/`diagnostics`. Families: `DDN0xx` lexical/parse, `DDN01x–02x` imports/modules, `DDN03x–06x` build/semantics, `DDN07x` publication, `DDN1xx` contracts/extensions, `DDN13x–15x` governance contracts / redacted export, `DDN2xx` layout/routing, `DDN900` unsupported constructs, `DDN-W…`/`DDN-LW…`/`DDN-PJW…`/`DDN-TW01`/`DDN-CW01` warnings/infos (`DDN-W901` reserved legacy), `DDN-E0xx` parse-form / missing runtime bundle errors, `DDN-IO…` Studio archive I/O, `DDN-I…` interaction, `DDN-P…` retained placement, `DDN-PF…` profile validators, `DDN-PJ…` projection validators, `DDN-PX…` profile-completion contracts, `DDN-Q…`/`QC`/`QD`/`QF`/`QL`/`QM`/`QP` quality/decision/fishbone/lifecycle/matrix/panels validators, `LIVE…` in-browser API. Recovery loop: read the message (it names the offending element/relation/property); apply the FIX column when present; otherwise use the section cross-references: parse errors → §2, build errors → §3, DDN050/056/102/114 → §4 vocabulary tables, DDN-PF/PJ/PX/Q* → §5/§6/§10, DDN2xx → adjust `place`/`route` hints, spacing, or simplify the view (§3.3, §8).

| code | severity | meaning (message template(s); runtime values concatenated between literal parts) | FIX (authoring recovery) |
|---|---|---|---|
| DDN-CW01 | warning/info | Cubic corridor spline used to retain clearance or routing hints for | - |
| DDN-E001 | error | Data block name is required.<br>Label must be text up to 4096 characters.<br>Position must be finite, bounded world coordinates.<br>Route hints need a {routing, curve?} record.<br>Unknown object kind.object  { kind: ; }fieldsfield<br>Unknown relationship kind.<br>Unknown view profile group:<br>Use a valid, nonreserved DDN identifier.<br>View profile group  needs a property record of at most 40 entries.<br>View profile writes need a {group: {key: value}} record. | - |
| DDN-E002 | error | Data block name is ambiguous across the workspace:  blocks)<br>Data block not found:<br>Definition not found.<br>Model identity is not in this workspace. | - |
| DDN-E003 | error | The edited source does not import the target definition. Add the required import explicitly. | - |
| DDN-E004 | error | references depend on this definition. Remove/reassign them in source first, or hide its appearance. | - |
| DDN-E005 | error | This declaration is expanded from the shared  definition @. Inspector edits never rewrite a shared definition: edit the definition in source, or declare the member locally at the application site. | - |
| DDN-E006 | error | Not an assignment relationship<br>Selected object has no x_record value record<br>This view uses data-bound coordinates; edit the underlying values rather than pinning a mark. | - |
| DDN-E007 | error | A joined cell is not a single editable assignment<br>Cell editing requires an explicit extension-property value binding<br>Cell identifier already exists<br>Cell outside bound matrix or duplicated in edit batch<br>Cell value must be a finite scalar<br>Invalid matrix operation<br>Matrix changes need a matrix view and 1..100 cell operations<br>Matrix edit options require a boolean remove flag and optional id<br>New assignments require a shared data block selected by this view; supply projection.write_data explicitly | - |
| DDN-E010 | error | Interaction validation is provided by ddn-graph.js; load it after ddn-core.js.<br>No renderer registered for projection kind "". It is provided by ; load it after ddn-core.js and ddn-graph.js. Inline placeholder rendered instead (optional module).<br>No renderer registered for projection kind "It is provided by ; load it after ddn-core.jsddn-graph.js and ddn-graph.js.No runtime bundle provides it.<br>Projection  is provided by ddn-quality.js; load it after ddn-core.js and ddn-graph.js.<br>Renderer registration needs a projection kind name and a render function.<br>Vega-Lite export is provided by ddn-projections.js; load it after ddn-core.js and ddn-graph.js.<br>depth is rendered by the optional ddn-iso.js module; it is not loaded, so the view rendered flat. Load ddn-iso.js after ddn-core.js and ddn-graph.js. | Load the named optional bundle: ddn-geo.js for geo views, ddn-iso.js for iso/depth (the CLI pre-loads both). |
| DDN-E011 | error | Data block  declares no records; its field shape cannot be inferred.<br>Duplicate record key:<br>Every record must carry the same keys as the first existing record of<br>Record key  collides with a non-record declaration in<br>Record key must be a valid, nonreserved DDN identifier.<br>Record keys are all-or-nothing: either every record carries key, or none does (order-sensitive positional refresh).<br>Record values must be finite scalars, or arrays/plain objects of them.<br>replaceData records must be an array of plain objects. | - |
| DDN-E012 | error | Record  field  must remain ; got . Refresh commits nothing.<br>View  still references record ; its removal is rejected transactionally. Refresh commits nothing. | - |
| DDN-E013 | error | Flow  hop  has no visible relation from ; steps must follow existing relations in their declared direction<br>Flow  needs at least two steps: @a -> @b -> …<br>Flow step is not a data element in scope: @<br>Flow step is not selected in this view: @ | Flow steps must follow existing visible relations in declared direction: add the missing relation or reorder steps (@a -> @b -> @c). |
| DDN-E014 | error | Unknown marker shape ; expected circle, square or rect<br>Unknown motion value ; expected flow, pulse or none<br>marker_size must be a length from >0 to 128px<br>must be a colour string<br>rate must be a positive integer (markers in flight)<br>speed must be a positive length (px/s) up to 10000 | Fix the motion property: motion flow\|pulse\|none; marker circle\|square\|rect; marker_size <=128px; speed <=10000; rate positive integer. |
| DDN-E015 | error | Ambiguous diagram profile ${JSON.stringify(profile)} in view header; the registry maps it to more than one projection kind — write the canonical projection block instead<br>Body projection block conflicts with the `as` profile in the view header; write either the header form or the canonical projection, not both<br>Body projection property conflicts with the `as` profile in the view header; write either the header form or the canonical projection, not both<br>Unknown diagram profile ${JSON.stringify(profile)} in view header; the header form derives projection.kind from the registry, so the profile must be registered (or write the canonical projection block) | - |
| DDN-E016 | error | A records block must declare columns before its first row<br>A records block requires a columns declaration<br>Row ${n.id} declares ${vals.length} value(s) but the records block declares ${columns.length} column(s) (${columns.join(', ')})<br>Row ${n.id}: a row body carries extra properties only; nested declarations are not supported<br>Row values must be scalar literals (string, number, quantity, boolean, null, missing, undecided, not_applicable, conflicting, or a bare word)<br>The columns declaration must precede every row of a records block<br>The label_column declaration must precede every row of a records block<br>label_column ${labelColumn} is not one of the declared columns (${columns.join(', ')}) | records row width must equal the columns count; the message names the row and expected/actual counts — fix the row's values. |
| DDN-E017 | error | A definition body cannot apply presets or fragments (use: is legal at application sites only)<br>Definition version must be an integer (documentary only; expansion ignores it)<br>Presets @ and @ conflict on property ; declare : … locally to resolve the conflict<br>Unknown preset or fragment @<br>is a  definition; a  group applies a  definition<br>is a  definition; a data block applies a fragment definition<br>is a  definition; property position applies a preset or relation_props definition<br>relation_props @ applies to relation declarations only<br>use: is legal only inside a data block (fragments), a fields/ports group (member groups), or an element/relation/flow body (property presets)<br>use: is not legal in a relations batch header; apply property presets inside each entry body<br>use: needs at least one preset or fragment reference | - |
| DDN-E018 | error | Unknown  chrome value ; expected | - |
| DDN-I001 | error | Unsupported interaction projection | - |
| DDN-I002 | error | Interaction 0.1 requires a right-hand numbered relationship key | - |
| DDN-I003 | error | A nonempty x_sequence is required | - |
| DDN-I004 | error | Select explicit participant objects with x_protocol_role | - |
| DDN-I005 | error | Interaction must contain between 1 and 500 exchanges | - |
| DDN-I006 | error | Missing or duplicate step identity | - |
| DDN-I007 | error | display_order must be a unique positive integer | - |
| DDN-I008 | error | Duplicate predecessorDDN-I009Every exchange endpoint must have a selected participant lanerequestresponsechallengeinternaleventDDN-I010Unsupported message form DDN-I011<br>Every after entry must reference an exchange in the same sequence | - |
| DDN-I009 | error | Every exchange endpoint must have a selected participant lane | - |
| DDN-I010 | error | Unsupported message form | - |
| DDN-I011 | error | This scenario uses phases A through D | - |
| DDN-I012 | error | Payload must reference an in-scope message or record contract | - |
| DDN-I013 | error | Internal events are same-participant invoke relationships | - |
| DDN-I014 | error | Network/local payload exchanges retain the core flow relationship | - |
| DDN-I015 | error | reply_to must identify another exchange | - |
| DDN-I016 | error | A reply must reverse the correlated request endpoints | - |
| DDN-I017 | error | Each exchange requires an explicit unique callout key | - |
| DDN-I018 | error | Cycle in protocol predecessor graph | - |
| DDN-I019 | error | display_order conflicts with an explicit predecessor | - |
| DDN-I020 | error | A response must causally follow its request | - |
| DDN-I021 | error | x_phases must be a nonempty subset of A, B, C, D | - |
| DDN-I022 | error | The selected phases contain no exchanges | - |
| DDN-I023 | error | row height must be between 60px and 160px | - |
| DDN-I024 | error | Too many participant lanes for the page width | - |
| DDN-I025 | error | Interaction page needs at least ${needed}px height; split phases or enlarge page | - |
| DDN-I026 | error | Smallest interaction labels are 11px; this minimum is unsupported | - |
| DDN-I027 | error | The explanatory note must be text | - |
| DDN-I028 | error | Unknown interaction metadata property | - |
| DDN-I030 | error | A visual anchor fraction must be strictly between 0 and 1 and cannot override a field/port endpoint<br>Invalid endpoint side | - |
| DDN-I031 | error | Curved routing belongs to the ordinary graph projection; the experimental interaction profile uses fixed participant lanes. No silent geometry fallback. | - |
| DDN-I032 | error | Experimental interaction publication has no approved payload/occurrence redaction closure; use an explicitly allowlisted ordinary graph view. No SVG is emitted. | - |
| DDN-IO01 | error | No DDN source files were found.<br>Select at least one source file. | - |
| DDN-IO02 | error | Sources outside workspace manifest root.<br>Unsafe ZIP path or symbolic link. | - |
| DDN-IO03 | error | Duplicate archive path:<br>Two selected files have the same path: | - |
| DDN-IO04 | error | Archive entry or total size limit exceeded.<br>Archive exceeds 16 MB.<br>Decompression size limit exceeded.<br>Source size limit exceeded.<br>Too many selected files.<br>Workspace JSON exceeds 16 MB. | - |
| DDN-IO05 | error | Encrypted or unsupported compressed ZIP entry.<br>Invalid UTF-8 workspace JSON.<br>Invalid ZIP end directory.<br>Invalid central directory.<br>Invalid local ZIP header.<br>Multiple workspace manifests.<br>Source is not valid UTF-8:<br>Split, ZIP64, excessive or invalid archives are unsupported.<br>Truncated ZIP filename.<br>Unexpected directory data.<br>ZIP CRC or size check failed:<br>ZIP local header mismatch.<br>ZIP uncompressed size mismatch. | - |
| DDN-IO08 | error | Downloads require a browser document. | - |
| DDN-IO09 | error | Raw DEFLATE is unavailable. Extract the ZIP and open its DDN files.<br>This browser cannot read compressed ZIP entries. Extract the archive and use Open folder, or use a workspace JSON file. | - |
| DDN-ISO150 | error | iso must be a boolean (iso: true\\|false)<br>iso/depth apply to graph and chart projections | - |
| DDN-ISO151 | error | Per-element depth on  must be a finite px quantity 0..2000<br>Per-record "x_record.field" depth binding applies to chart views; graph views take a constant or @data.record.field depth<br>depth is a px quantity, a number, an "x_record.field" per-record binding or @data.record.field<br>depth must be a finite number 0..2000 (px)<br>depth must be a finite px quantity 0..2000<br>depth per-record binding must be a property path like "x_record.load" | - |
| DDN-ISO152 | error | depth binding  must supply a finite number 0..2000<br>depth binding  must supply a finite number 0..2000 for every bound record<br>depth binding @ is outside the view data scope | - |
| DDN-ISOW01 | warning/info | depth on a graph view applies with iso: true; without it the view renders flat.<br>iso/depth extrusion is implemented for bar and area layers on quality charts; the  mark renders flat.<br>iso/depth extrusion is implemented for the bar, pie, donut, area and treemap marks; the  mark renders flat.<br>iso/depth extrusion is implemented for untransformed (identity) quality charts; the  transform renders flat. | - |
| DDN-ISOW02 | warning/info | Isometric graph views render nodes and relations on the ground plane; frames and subdiagrams are flat-view devices and are omitted here (never silently merged). | - |
| DDN-IW01 | warning/info | Experimental interaction projection validates declared predecessor/correlation metadata. It does not validate cryptographic security, real network behavior or full UML sequence semantics. | - |
| DDN-LW01 | warning/info | Directed cycles retained as same-rank strongly connected groups; no model edge reversed. | - |
| DDN-LW02 | warning/info | Ladder rung  contains a series cycle; column assignment is approximate.<br>Recomputed unsafe route hint | - |
| DDN-LW03 | warning/info | (no literal message) | - |
| DDN-LW04 | warning/info | Deterministic congestion retry selected routing strategy | - |
| DDN-LW05 | warning/info | ${best.crossings.length} disconnected crossings remain after bounded routing; rendered with ${p.layout.crossings}. | - |
| DDN-LW06 | warning/info | Larger graph: native obstacle routing runs, but expensive whole-graph crossing trials are skipped. | - |
| DDN-P002 | error | Invalid retained world coordinates.<br>Retained layout state has an invalid format or belongs to another view. | - |
| DDN-P003 | error | No space for a new element without moving retained positions: | - |
| DDN-P004 | error | Measured element lies outside a fixed frame: | - |
| DDN-PF001 | error | Unknown or uninstalled diagram profile | Unknown profile id: quote it exactly as listed in the profile table (e.g. "erd.crowfoot@1"), including the @version suffix. |
| DDN-PF002 | error | requires projection , not | projection.kind must equal the profile's registered projection column — check the profile table and fix kind or profile. |
| DDN-PF003 | error | Actor/use-case symbol does not support attribute fields<br>C4 symbols have labels, not attribute compartments<br>EPC symbols have labels, not attribute compartments<br>Flowchart symbols have labels, not attribute compartments | - |
| DDN-PF004 | error | contains a cycle | - |
| DDN-PF005 | error | Generalization endpoints must have the same declared classifier kind | - |
| DDN-PF006 | error | A DFD transfer must involve a process; store/external shortcuts are invalid | - |
| DDN-PF007 | error | Activity projection accepts uml.flow links only<br>Flowchart projection accepts flow.* participants only<br>Flowchart projection accepts flow.next links only<br>accepts  participants only<br>accepts c4.rel links only<br>concept.map@1 accepts assoc and ref links only<br>concept.map@1 accepts object, entity, term, domain participants only<br>epc.basic@1 accepts epk.event, epk.function, epk.connector participants only<br>epc.basic@1 accepts epk.next links only<br>epc.complete@1 accepts epk.next/infoflow/assigned/links links only<br>epc.complete@1 accepts the epk.* vocabulary only<br>mindmap.basic@1 accepts assoc links only<br>mindmap.basic@1 accepts object, entity, term, domain participants only<br>mindmap.basic@1 requires layout algorithm mindmap<br>org.tree@1 accepts organization, team, role, analysis.role participants only<br>org.tree@1 accepts reports_to links only<br>wbs.tree@1 accepts analysis.decomposes links only<br>wbs.tree@1 accepts analysis.task participants only | - |
| DDN-PF008 | error | Closed flowchart needs a start and an end<br>End cannot have outgoing control<br>Start cannot have incoming control | - |
| DDN-PF009 | error | Decision requires at least two explicitly named, distinct branches | - |
| DDN-PF010 | error | Every flowchart symbol must be reachable from a start and able to reach an end | - |
| DDN-PF011 | error | DFD profile requires dfd participants and dfd.data links | - |
| DDN-PF012 | error | DFD process number must be nonempty and unique | - |
| DDN-PF013 | error | DFD process needs input and output | - |
| DDN-PF014 | error | Requirement needs unique code and nonempty text | - |
| DDN-PI01 | info | Auto-placement paused; ${retained.length} free positions retained. New elements still need a seed position. | - |
| DDN-PJ001 | error | Unsupported projection | - |
| DDN-PJ002 | error | Cannot combine interaction and data-bound projections<br>Data-bound projections do not accept graph place/route/frame/subdiagram geometry; select a graph view | - |
| DDN-PJ003 | error | Profile-specific redacted projection is not qualified; provide a separately authorized workspace<br>Redacted non-graph projections require a separately authorized input workspace; unsupported export fails closed | - |
| DDN-PJ004 | error | namekindobjectstringT00:00:00Z | Unsafe binding path: use dot-separated safe paths like x_record.value, or the special names name/id/kind. |
| DDN-PJ005 | error | projection does not use ; no silent ignored settings | Remove projection keys that are not legal for this projection.kind — see the supported-keys table; nothing is silently ignored. |
| DDN-PJ006 | error | Projection  must be 240..12000 px | - |
| DDN-PJ007 | error | Projection reference is outside its data scope: | Every bound element (records/rows/columns/…) must belong to the view's data: scope — add the data block or fix the ref. |
| DDN-PJ008 | error | Projection binds an excluded/not-selected element: | - |
| DDN-PJ009 | error | An intentionally empty records declaration is supported for bar/line/area/point charts and tables only;  needs 1..500 explicit references<br>Duplicate  identity<br>Geo  needs 1..500 explicit record references<br>needs 1..500 explicit references | Reference arrays hold 1..500 unique refs; use records: [] only as the intentional chart/table empty state. |
| DDN-PJ010 | error | must supply a scalar value | - |
| DDN-PJ011 | error | A filter cannot apply to an intentionally empty records declaration<br>An order cannot apply to an intentionally empty records declaration<br>Filter supports explicit eq or in only<br>Order needs key and asc/descdesc | - |
| DDN-PJ012 | error | No chart points remain<br>Projection selection is empty after filtering | The filter emptied the selection: loosen filter criteria or add records; filters may not reduce to zero rows. |
| DDN-PJ013 | error | Matrix limit: 5,000 cells and 40 columns | - |
| DDN-PJ014 | error | Matrix needs a relation kind and a value binding<br>Matrix relation must name an installed relationship kind<br>RACI/CRUD require one declared assignment per cell<br>Unknown duplicate-cell policy<br>matrix.storymap@1 uses assoc cell relations carrying x_story.task | - |
| DDN-PJ015 | error | More than one assignment for the same row and column | - |
| DDN-PJ016 | error | RACI row requires exactly one A, at least one R, and only R/A/C/I codes: | - |
| DDN-PJ017 | error | CRUD value must contain distinct C/R/U/D letters | - |
| DDN-PJ018 | error | Invalid/duplicate table column<br>Table needs 1..30 column bindings | - |
| DDN-PJ019 | error | Chart missing policy is error or skip<br>Missing table value<br>Table missing policy is error or blank<br>Table values must be scalar | - |
| DDN-PJ020 | error | Invalid panel grid span/ID<br>Panels need 1..12 columns and 1..80 panels | - |
| DDN-PJ021 | error | Overlapping panel spans | - |
| DDN-PJ030 | error | Bars, arcs, radar spokes and funnel stages currently require categorical x<br>Calendar cells require date x (x_type must be date)<br>Calendar shows one value per day; do not set series<br>Candlestick requires categorical or date x (x_type must not be number)<br>Candlestick shows one candle per record; do not set series<br>Chart needs explicit x and y bindings<br>Density heatmap bins two numeric fields; set x_type:number<br>Density heatmap pools one scatter; do not set series<br>Funnel shows one stage per record; do not set series<br>Funnel stages require categorical x (x_type must be category)<br>Gauge caption requires categorical x (x_type must be category)<br>Gauge shows one value; do not set series<br>Heatmap columns require categorical x<br>Parallel-coordinates axes are categorical x values<br>Radar series must be a nonempty text key of at most 80 characters<br>Radar spokes require categorical x (x_type must be category)<br>Sankey encodes flows between endpoints; do not set series<br>Sankey sources require categorical x (x_type must be category)<br>Sankey target is a property binding, not a numeric reference<br>Scatter/bubble requires x_type:number<br>Supported marks: bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey, histogram, density, qq, quantiledot, dotplot, boxplot, violin, beeswarm, topk, tidytree, radialtree, circlepack, sunburst, packedbubble, heatmap, densityheatmap, calendar, parallelcoords, wordcloud, arc, force, edgebundle<br>Treemap paths require categorical x (x_type must be category)<br>Treemap tiles encode one value per record; do not set series<br>Word cloud sizes one word per record; do not set series<br>Word cloud words are categorical x values<br>encodes links between endpoints; do not set series<br>encodes one value per record; do not set series<br>endpoints require categorical x<br>groups require categorical x (x_type must be category)<br>inner_radius is a radius fraction 0..0.9 exclusive<br>measures one numeric sample; set x_type:number with x as the measurement binding<br>paths require categorical x (x_type must be category)<br>target is a property binding, not a numeric reference<br>treemapTreemapHierarchy paths have at most 3 levels<br>x_type is category, number or date | Pick a mark from the chart mark list; check mark-specific requirements (categorical vs numeric x, series rules) for the chosen mark. |
| DDN-PJ031 | error | Aggregation is available on category bars/arcs only<br>Distribution marks measure raw records; aggregation is not available<br>Sankey flows encode supplied values; aggregation is not available<br>Treemap tiles encode supplied values; aggregation is not available<br>Unknown aggregatecountDDN-PJ034Count is dimensionless; do not label it as currency or another input unitnonebarpiedonuttopkAggregation is available on category bars/arcs only<br>leaves encode supplied values; aggregation is not available<br>links encode supplied values; aggregation is not available | - |
| DDN-PJ032 | error | Aggregate overflowtreemaptreemapsankey<br>Category x must be text or number<br>Chart y must be finite numeric data; numeric strings are not coerced<br>Numeric x requireddateDDN-PJ033Date x must be a real ISO YYYY-MM-DD datestringnumberCategory x must be text or numberDDN-PJ034Every record must declare matching x_record.unit:<br>Quantitative axis range overflow<br>Quantitative x range overflow<br>sankeySankeyNetwork endpoints are distinct nonempty category text | y must bind finite numbers: fix the x_record payloads (real JSON numbers, not strings) or bind another key. |
| DDN-PJ033 | error | Date x must be a real ISO YYYY-MM-DD date | Date x values must be real ISO YYYY-MM-DD strings in x_record; fix the payloads or use x_type: category. |
| DDN-PJ034 | error | Count is dimensionless; do not label it as currency or another input unit<br>Every record must declare matching x_record.unit: | - |
| DDN-PJ035 | error | Point size must be a finite nonnegative value | - |
| DDN-PJ036 | error | Duplicate x/category: supply an explicit aggregate or distinct coordinates | - |
| DDN-PJ037 | error | Arcs require nonnegative values and a positive total | - |
| DDN-PJ040 | error | Timeline needs real ISO date-only start/end with end >= start | - |
| DDN-PJ041 | error | Timeline dependencies must be selected predecessor-to-successor links | - |
| DDN-PJ042 | error | Finish-to-start dependency contradicts supplied dates | - |
| DDN-PJ043 | error | Timeline dependency cycle | - |
| DDN-PJ050 | error | Chen scalar subset does not silently flatten nested or repeated fields<br>Chen subset requires entity objects and binary object-level assoc/ref relationships | - |
| DDN-PJ051 | error | Retained graph positions cannot override data-bound projection coordinates | - |
| DDN-PJ060 | error | Projection extent exceeds bounded publication budget | - |
| DDN-PJ061 | error | Page has no remaining drawing area | - |
| DDN-PJ062 | error | embedding_scale must be a positive finite value <= 100 | - |
| DDN-PJ070 | error | Quality transforms are native; this optional adapter does not silently flatten them<br>Radar, funnel, gauge, candlestick, treemap and sankey marks have no faithful Vega-Lite mapping in this adapter; use the native SVG projectionpiedonutarcdonut<br>Vega-Lite adapter supports chart/timeline only | - |
| DDN-PJ071 | error | Radar needs at least 3 distinct x categories (got ); supply more records or use another mark | - |
| DDN-PJ072 | error | Radar requires finite numeric y >= 0 per point; filter out or explicitly skip unusable records | - |
| DDN-PJ073 | error | Funnel needs at least 2 distinct stages (categories); supply more records or use another mark | - |
| DDN-PJ074 | error | Gauge requires exactly one record after filtering (the KPI); supply one record or filter to one | - |
| DDN-PJ075 | error | Gauge target must be a finite number in 0..100<br>Gauge value must be a finite number in 0..100 | - |
| DDN-PJ076 | error | Candlestick requires finite numeric open/high/low/close on every record | - |
| DDN-PJ077 | error | Candlestick requires high >= low and open/close within [low, high] | - |
| DDN-PJ078 | error | Treemap tile values must be nonnegative numbers; filter out or explicitly skip negative records | - |
| DDN-PJ079 | error | Sankey flow graph contains a cycle | - |
| DDN-PJ080 | error | KEY PARTNERSKEY ACTIVITIESKEY RESOURCESVALUE PROPOSITIONSCUSTOMER RELATIONSHIPSCHANNELSCUSTOMER SEGMENTScostCOST STRUCTURErevREVENUE STREAMScanvas.lean@1problemPROBLEMsolutionSOLUTIONkeymetricsKEY METRICSuvp<br>problemPROBLEMsolutionSOLUTIONkeymetricsKEY METRICSuvpUNIQUE VALUE PROPOSITIONunfairUNFAIR ADVANTAGEchannelsCHANNELSsegmentsCUSTOMER SEGMENTScostCOST STRUCTURErevenueREVENUE STREAMScanvas.pest@1politicalPOLITICALeconomicECONOMICsocialSOCIAL | - |
| DDN-PJ081 | error | entrantsTHREAT OF NEW ENTRANTSsupplierSUPPLIER POWERrivalryCOMPETITIVE RIVALRYbuyerBUYER POWERsubstitutesTHREAT OF SUBSTITUTEScanvas.empathy@1saysSAYSthinksTHINKSpersonaPERSONAdoesDOESfeelsFEELScanvas.scorecard@1financialFINANCIALcustomerCUSTOMERinternalINTERNAL PROCESSlearningLEARNING & GROWTH<br>politicalPOLITICALeconomicECONOMICsocialSOCIALtechnologicalTECHNOLOGICALcanvas.pestle@1politicalPOLITICALeconomicECONOMICsocialSOCIALtechnologicalTECHNOLOGICALlegalLEGALenvironmentalENVIRONMENTALcanvas.porter5@1entrants<br>politicalPOLITICALeconomicECONOMICsocialSOCIALtechnologicalTECHNOLOGICALlegalLEGALenvironmentalENVIRONMENTALcanvas.porter5@1entrantsTHREAT OF NEW ENTRANTSsupplierSUPPLIER POWERrivalryCOMPETITIVE RIVALRYbuyerBUYER POWERsubstitutesTHREAT OF SUBSTITUTES | - |
| DDN-PJ082 | error | must be exactly the  categories [<br>must declare x_category {axis:"",level} covering []; check | - |
| DDN-PJ083 | error | financialFINANCIALcustomerCUSTOMERinternalINTERNAL PROCESSlearningLEARNING & GROWTH<br>saysSAYSthinksTHINKSpersonaPERSONAdoesDOESfeelsFEELScanvas.scorecard@1financialFINANCIALcustomerCUSTOMERinternalINTERNAL PROCESSlearningLEARNING & GROWTH | - |
| DDN-PJ084 | error | emotion item  needs x_record.value in 1..5; got | - |
| DDN-PJ085 | error | emotion item  references unknown phase "<br>emotion items must follow the declared phase order;  (phase ) follows a later phase<br>panels.journey@1 has unexpected panel ""; the grid is phase headers, actions/touchpoints/opportunities lanes, and one emotions band<br>panels.journey@1 lane "" must declare panel "" at row , column ; one panel per phase per lane<br>panels.journey@1 needs 2..8 phase columns; got<br>panels.journey@1 phase slugs must be unique; duplicate "<br>panels.journey@1 row 0 must declare exactly the  phase panels (phase-<slug>) in column order<br>panels.journey@1 row 0 must declare the phase panels (phase-<slug>) in column order; missing phase slug at column<br>panels.journey@1 row 4 must be the single full-width panel "emotions" (row:4, column:0, colspan: | - |
| DDN-PJ086 | error | Story placed in two releases:  is in  and<br>Story placed twice:  appears in multiple cells of | - |
| DDN-PJ087 | error | Relation  needs _mark from one\\|zeroone\\|many\\|zeromany (crow's-foot cardinality); found no mark<br>erd.crowfoot@1 relations must be ref or assoc to carry crow's-foot cardinality;  is not structural | Under erd.crowfoot@1 every ref/assoc relation needs BOTH source_mark and target_mark from one\|zeroone\|many\|zeromany. |
| DDN-PJ088 | error | -- DDN SQL DDL export · TEXT columns · declaration order · synthetic illustrative DDL, not a deployable schemasamplesample | - |
| DDN-PJ089 | error | panels.pyramid@1 needs 3..5 bands;  declared<br>pyramid band rows must be contiguous 0.. from top to bottom<br>pyramid bands stack in one column (columns:1, column:0, rowspan:1, colspan:1) | - |
| DDN-PJ090 | error | panels.venn@1 draws exactly 2 or 3 sets;  declared | - |
| DDN-PJ091 | error | venn membership of  disagrees with its x_sets declaration<br>venn membership of  disagrees with its x_sets declaration (x_sets must be an array of 1..3 unique declared set ids) | - |
| DDN-PJ092 | error | Duplicate SQL identifier after snake_case normalization:<br>primary | - |
| DDN-PJ093 | error | Story map cells must reference analysis.task objects: | - |
| DDN-PJ100 | error | Context views show systems and people, not fields; remove member endpoints | - |
| DDN-PJ101 | error | requires exactly one frame scoped to a selected  boundary object whose members cover every selected interior node | - |
| DDN-PJ102 | error | org.tree@1organizationteamroleanalysis.roleDDN-PF007org.tree@1 accepts organization, team, role, analysis.role participants onlyreports_toDDN-PF007org.tree@1 accepts reports_to links onlyreports_toOrg chart | - |
| DDN-PJ104 | error | concept.map@1 relations need an explicit domain label; "" is only the verb default | - |
| DDN-PJ105 | error | EPC events and functions must alternate; connect  through a connector or the other symbol type | - |
| DDN-PJ106 | error | EPC connector must carry x_epc.operator of and, or or xor<br>x_epc.operator belongs on epk.connector nodes only | - |
| DDN-PJ107 | error | Funnel stage values must be nonnegative numbers; filter out or explicitly skip negative records | - |
| DDN-PJ108 | error | Network link values must be positive finite numbers | - |
| DDN-PJ110 | error | Sequence message  has a  endpoint that is not a selected object declaration: | - |
| DDN-PJ111 | error | Message  has malformed sequence number  (expected digits with optional dot segments)<br>Message  lacks a declared sequence number (x_message.seq)<br>Non-reply message  must carry a top-level number, got dotted<br>Reply message  must be numbered dotted under its request (e.g. 2.1), got | - |
| DDN-PJ112 | error | Instance  declares slot  not present on classifier | - |
| DDN-PJ113 | error | Frame  declares  initial states (); at most one initial state per region | - |
| DDN-PJ114 | error | Node  declares partition lane  but no frame of this view has that id or name | - |
| DDN-PJ115 | error | Fork/join imbalance:  fork(s) (>=2 outgoing uml.flow edges) versus  join(s) (>=2 incoming uml.flow edges); counts must match | - |
| DDN-PJ116 | error | Message flow  has both endpoints inside pool ; message flow is allowed only across pools<br>Message flow  has both endpoints outside every x_pool frame; message flow is allowed only across pools | - |
| DDN-PJ117 | error | Gateway  lacks a valid x_gateway.type (exclusive, parallel or inclusive) | - |
| DDN-PJ118 | error | Timing participant  has a malformed x_states entry at index : at must be a finite number and state a nonempty string<br>Timing participant  must carry x_states with at least one {at,state} entry<br>Timing participant  x_states entry at index  (at=) is not strictly after the previous entry (at= | - |
| DDN-PJ119 | error | Drill-down node  references unknown view<br>HMSC reference  references unknown view<br>IDEF0 node  references unknown decomposition view<br>Interaction overview node  references unknown view | - |
| DDN-PJ120 | error | Sentry  is not a member of any frame whose scope is a cmmn.stage; sentries belong on a stage border declared by frame membership<br>Sentry  lacks a valid x_sentry.on (entry or exit) | - |
| DDN-PJ121 | error | Element  (kind ) declares a ports group; under  only  elements declare ports | - |
| DDN-PJ122 | error | Constraint  is touched by  visible relation(s); a parametric constraint binds exactly two endpoints | - |
| DDN-PJ123 | error | Relation  (archi.rel) endpoint kind  is outside the nine registered archi.* kinds (endpoint layers nonenone<br>Relation  (archi.rel) links ; the fixed layer-pair table allows same-layer and upward (serving) links only | - |
| DDN-PJ124 | error | Dependency cycle reaches task | - |
| DDN-PJ125 | error | Task  needs a finite nonnegative x_estimate duration in days | - |
| DDN-PJ126 | error | Gate  has  visible tree.input edge(s) and declared type none; every gate must declare x_gate.type (and/or) and have at least two inputs | - |
| DDN-PJ127 | error | Attachment  targets unknown); a network.attaches relation must target a network.bus element or a port member<br>Device  declares rack slot unit  but rack  has no declared x_rack.unitsx_rack.units ; slot numbers must be >= 1 and within the rack height<br>Devices  and  both declare rack slot unit  in rack ; slot numbers must be unique per rack frame | - |
| DDN-PJ128 | warning/info | Control  is declared outside any ui.frame | - |
| DDN-PJ129 | error | Lineage cycle:  cannot be its own ancestor; family.parent_of edges must be acyclic | - |
| DDN-PJ130 | error | Person  has  distinct family.parent_of sources; at most two parents can be drawn faithfully — split extra parentage into separate unions/partners | - |
| DDN-PJ131 | error | Density heatmap bin_count is an integer 2..60<br>Histogram bin_count is an integer 2..100<br>bin_count is a histogram setting | - |
| DDN-PJ132 | error | Density heatmap of a zero-range field is UNKNOWN; both axes need spread<br>Density of a zero-variance sample is UNKNOWN; the kernel bandwidth is undefined<br>Q-Q spread of a zero-variance sample is UNKNOWN; the normal reference is undefined<br>Trend of a constant-x sample is UNKNOWN; the slope is undefined<br>Violin density of  is UNKNOWN: a kernel needs at least 2 non-identical observations per category | - |
| DDN-PJ133 | error | Top-K k is an integer 1..100<br>Top-K others is true or false | - |
| DDN-PJ134 | error | binds only the numeric measurement x; do not set y<br>draws one distribution per category; do not set series<br>pools one sample; do not set series | - |
| DDN-PJ135 | error | Edge bundling draws at most 200 endpoint paths; got<br>Edge bundling draws at most 500 links; got<br>Heatmap draws at most 60 columns and 60 rows<br>Parallel coordinates draw at most 24 axes<br>Parallel coordinates need at least 2 axes (distinct x categories); got<br>Trend overlays need at least 3 points; got<br>Word cloud places at most 120 words<br>draws at most 1000 links; got<br>draws at most 200 nodes; got<br>draws at most 40 categories; got<br>needs at least 2 finite observations; got | - |
| DDN-PJ136 | error | hierarchy values must be nonnegative numbers; filter out or explicitly skip negative records | - |
| DDN-PJ137 | error | Calendar has more than one value for day ; aggregate upstream or filter<br>Heatmap has more than one value for column , row ""; aggregate upstream or filter<br>Heatmap rows require a series binding (category text)<br>Parallel coordinates has more than one value for series "" on axis<br>Parallel coordinates require a series binding identifying each polyline<br>Word cloud has a duplicate word ; supply distinct words<br>heatmapHeatmap rowPolyline series must be a nonempty text key of at most 80 characters | - |
| DDN-PJ138 | error | Word cloud weights must be positive finite numbers | - |
| DDN-PJ141 | error | Error bar values must be finite nonnegative numbers (UNKNOWN is refused, never drawn as zero)<br>Error bars attach to raw records; aggregation is not available<br>Error bars overlay bar/point marks only<br>error is a property binding | - |
| DDN-PJ142 | error | Trend overlays need a point/line mark with x_type:number<br>trend is linear or loess | - |
| DDN-PJ143 | error | Unknown geo mark ""; use choropleth, symbol or outline<br>Unknown geo method ""; use<br>graticule must be a boolean | - |
| DDN-PJ144 | error | Geo projection needs a geography: a registered name/URL or an inline @record holding GeoJSON<br>GeoJSON FeatureCollection needs a features array<br>GeoJSON entry  is not a Feature with geometry<br>Geography "" is not registered in this host; call DDNGeo.registerGeography(name, geojson) first (the CLI pre-registers assets/geo/world-110m.json) or bind an inline @record<br>Geography is not valid JSON<br>Geography must be a GeoJSON object<br>Geography reference is outside the view data scope<br>registerGeography needs a name and a GeoJSON document | - |
| DDN-PJ145 | error | Choropleth binds x (region join key) and value (numeric measure)<br>Choropleth join key must be a scalar ( | - |
| DDN-PJ146 | error | GeoJSON coordinate outside longitude/latitude range: [<br>GeoJSON coordinates must be finite [lon, lat] pairs<br>Symbol coordinate outside lon ±180 / lat ±90: [<br>Symbol map binds x (longitude) and y (latitude) | - |
| DDN-PJ147 | error | Unsupported GeoJSON geometry ""; ddn-geo renders Polygon, MultiPolygon, Point and MultiPoint<br>geoPath renders Polygon and MultiPolygon geometry; "" is a point type | - |
| DDN-PJ148 | error | Duplicate choropleth join key " | - |
| DDN-PJ149 | error | Association-end multiplicity must be a UML multiplicity (1, 0..1, 0..*, 1..*, *); found "<br>x_endlabels (role/multiplicity/qualifier) apply to uml.association, uml.commpath, uml.connector and uml.link only, not | x_endlabels on uml.association/uml.commpath only; multiplicity must be a UML form (1, 0..1, 0..*, 1..*, *) |
| DDN-PJ150 | error | Association class cannot be an endpoint of its own association<br>Association class must name a uml.class, not<br>Association class reference does not resolve to a declared element<br>x_association_class applies to uml.association only, not | x_association_class needs a reference to a declared uml.class that is not an endpoint of its own association |
| DDN-PJ151 | error | N-ary association end does not resolve to a declared element<br>N-ary association ends must be classifiers (uml.class/uml.interface/uml.enumeration), not<br>N-ary association ends must be distinct;  appears twice<br>N-ary end multiplicity must be a UML multiplicity; found "<br>x_nary applies to uml.association only, not | x_nary needs at least three distinct classifier ends (uml.class/interface/enumeration) across anchors and x_nary.ends, each a UML multiplicity |
| DDN-PJ152 | error | Generalization set "" must share one target;  and  disagree<br>x_genset applies to uml.generalization only, not | x_genset is legal on uml.generalization only; all relations of a set (same name) must share one target classifier |
| DDN-PJ153 | error | x_template applies to uml.class/uml.interface only, not | x_template applies to uml.class/uml.interface only; move the parameter list to a classifier kind |
| DDN-PJ154 | error | uml.enumeration members must be x_member kind literal;  declares<br>x_member kind literal applies to uml.enumeration members only; | x_member kind literal belongs on uml.enumeration members only, and enumeration members must be literals (or plain fields) |
| DDN-PJ155 | error | Combined fragment nesting exceeds 8 levels at<br>Fragment  operand  messages are not contiguous in declaration order<br>Fragment  operands must partition one contiguous span<br>Fragment  operands overlap in declaration order<br>Fragment at  overlaps a sibling fragment span; nest strictly (inside one operand) or keep disjoint<br>Nested fragment at  escapes its operand span<br>x_fragment must anchor on the fragment's first covered message;  starts at row | Fragment operands: contiguous, non-overlapping, one span, anchored on the first covered message; nest strictly |
| DDN-PJ156 | error | Create message  must be the first message incident to its target participant<br>Gate on message  has no enclosing combined fragment; gates attach to a fragment frame<br>Lost/found message  must be self-anchored (@a -> @a); the free end carries the filled circle<br>Message  declares sort reply but x_return:false; reply and x_return are equivalent<br>Message  reaches  after its destruction at message row<br>Participant  is destroyed twice | x_message.sort rules: create = first message of target; delete ends the lifeline; lost/found self-anchored; reply = x_return:true; gates need a fragment |
| DDN-PJ157 | error | State invariant  must follow a message incident to that participant | State invariant after: must reference a visible message incident to that participant |
| DDN-PJ158 | error | Activation  must span from an earlier to a later message row<br>Activation  must span messages incident to that participant | Activation from:/to: must reference visible messages incident to the participant, earlier to later row |
| DDN-PJ159 | error | Message  must use constraint form {…}; found | time/duration annotations use UML constraint form, wrapped in braces: "{t..t+5}" |
| DDN-PJ160 | error | Submachine reference on  must resolve to a declared state.state<br>Submachine state  cannot invoke itself<br>x_state applies only to state kinds; | x_state applies to state kinds only; submachine must reference a distinct declared state.state |
| DDN-PJ161 | error | Choice pseudostate  needs at least two outgoing transitions<br>Entry/exit point  must be a member of a composite-state frame<br>History pseudostate  must be a member of a composite-state frame<br>Junction pseudostate  is a pass-through and needs incoming and outgoing transitions<br>Terminate pseudostate  cannot have outgoing transitions | Pseudostates: choice 2+ out, junction pass-through, terminate no outgoing, history/entry/exit points inside a composite frame |
| DDN-PJ162 | error | Time/change trigger  is malformed; use after(…), at(…) or when(…) | Time/change triggers use after(…), at(…) or when(…) with parentheses — fix the event text or drop the time-trigger prefix |
| DDN-PJ164 | error | Deployment nesting frames must scope to a node kind (uml.node/device/executionenv);  scopes to<br>Qualifiers are association-end notation; communication paths carry role/multiplicity only | Commpaths carry role/multiplicity only (no qualifiers); deployment nesting frames scope to node kinds |
| DDN-PJ165 | error | uml.assembly  endpoint must be a uml.component or a port of one; found port on<br>uml.assembly  member must be a port, not a field/part<br>uml.delegation must start at a declared port member of the boundary classifier | uml.assembly endpoints are components or their ports (fields are not ports); uml.delegation starts at a port member |
| DDN-PJ166 | error | Part multiplicity must be a UML multiplicity; found "<br>x_part fields belong to uml.class/uml.component/uml.collaboration owners; | x_part fields: uml.class/uml.component/uml.collaboration owners, UML multiplicity |
| DDN-PJ167 | error | Merge  needs at least two incoming edges and exactly one outgoing; found  in /  out | flow.merge needs ≥2 incoming uml.flow edges and exactly one outgoing |
| DDN-PJ168 | error | Exception edge  must target a handler action (flow.process); found unresolved<br>Interrupting edge  must start inside an interruptible activity region (a frame with x_interruptible: true) | x_interrupt edges start inside an x_interruptible frame; x_exception edges target a handler action (flow.process) |
| DDN-PJ169 | error | x_pin (parameter set/streaming) applies to pins on action kinds (flow.process/subprocess/objectnode); | x_pin (set/streaming) applies to ports on flow.process/subprocess/objectnode only |
| DDN-PJ170 | error | Slot  value  is not boolean as classifier field datatype requires<br>Slot  value  is not numeric as classifier field datatype  requires | Slot value must match the classifier field datatype (numeric/boolean scalar forms) |
| DDN-PJ171 | error | x_pack.visibility on  is meaningless: the element is not a member of any uml.package frame in this view | x_pack.visibility is meaningful only inside a uml.package frame — add the frame or drop the property |
| DDN-PJ172 | error | Communication fragment on  references a non-message or invisible relation:<br>Message  must use constraint form {…}; found | Communication fragments reference visible uml.message relations; time/duration use {…} form |
| DDN-PJ173 | error | State  annotations require uml.timing@2<br>Timing constraint on  must use {…} form; found<br>Timing lifeline messages require uml.timing@2<br>Timing message  endpoints must be timing participants<br>Timing message  needs x_message.at (a finite time point)<br>Timing state  must use constraint form {…}; found<br>x_timeconstraint requires uml.timing@2 | Timing annotations/constraints use {…} form; lifeline messages need x_message.at (finite) and participant endpoints |
| DDN-PJ174 | error | Drill-down child exceeds visible graph limits<br>Interaction overview child exceeds visible graph limits<br>Interaction overview inline expansion supports one level; nested expansions are not rendered<br>Interaction-use  declares duplicate gate names | Interaction-use gates must be uniquely named; inline expansion supports one level |
| DDN-PJ175 | error | Boundary event  must name x_event.on resolving to a task/subprocess<br>Non-interrupting applies to boundary or intermediate events;<br>Terminate trigger belongs on end events;<br>trigger belongs on boundary or end events;<br>x_event applies to event kinds (flow.start/intermediate/end); | x_event: event kinds only; terminate on end events; cancel/compensation on boundary/end; boundary events need x_event.on → task/subprocess |
| DDN-PJ176 | error | Event-based gateway  needs at least two outgoing sequence flows<br>Gateway type  requires a BPMN process/choreography/conversation profile | complex/event gateway types require a BPMN process/choreography/conversation profile; event-based gateways need ≥2 outgoing flows |
| DDN-PJ177 | error | Call/transaction are process-diagram activities, not choreography bands<br>x_activity markers apply to task/subprocess kinds; | x_activity markers apply to task/subprocess kinds; call/transaction are not choreography bands |
| DDN-PJ178 | error | Choreography task  needs at least two participant bands (x_bands)<br>x_bands applies to flow.choreotask only; | x_bands is flow.choreotask-only; a choreography task needs at least two participant bands |
| DDN-PJ179 | error | Conversation link  must target a conversation node | bpmn.conversationlink must target a flow.conversation/subconversation/callconversation node |
| DDN-PJ180 | error | Data association  connects two data nodes; one side must be an activity<br>Data association  needs a data node on one side and an activity on the other | bpmn.association needs a data node (dataobject/datainput/dataoutput/datastore) on one side and an activity on the other |
| DDN-PJ181 | error | Collapsed applies to stages;<br>Non-blocking applies to (human) tasks;<br>x_cmmn decorators apply to plan items (tasks/stages/milestones/sentries/listeners/case files); | x_cmmn decorators apply to plan items; non-blocking is human-task-only, collapsed is stage-only |
| DDN-PJ182 | error | Sentry  attachment must resolve to a plan item<br>Sentry  cannot attach to itself<br>Sentry on-part  must reference an event listener or case file item<br>Sentry on-part connector  must target a sentry | Sentry attach: must resolve to a plan item (not itself); on_part: references an event listener or case file; sentryref targets a sentry |
| DDN-PJ183 | error | Planning tables attach to stages or tasks; | Planning tables (x_planning) attach to stages or tasks only |
| DDN-PJ184 | error | A case view needs exactly one cmmn.caseplan container; found | A case view declares exactly one cmmn.caseplan container |
| DDN-PJ185 | error | must start at ; found unresolved<br>must target ; found unresolved | SysML requirement dependencies: derive/copy/master between requirements, verify from a test case, satisfy from a block |
| DDN-PJ186 | error | x_block compartments belong to sysml.block/sysml.interfaceblock fields; | x_block compartments apply to sysml.block/sysml.interfaceblock fields; compartment is values/parts/references/operations/constraints |
| DDN-PJ187 | error | Port  declares duplicate nested port names<br>Port  multiplicity must be a UML multiplicity; found<br>x_port typing applies to ports of block-family kinds; | x_port types ports of block-family kinds; multiplicity is UML form; nested port names unique |
| DDN-PJ188 | error | Field  declares quantity  but unit  is a  unit<br>Field  declares unit  which is not in the units registry (standard/registry/units.json) | x_unit must name a symbol in standard/registry/units.json and match its quantity kind |
| DDN-PJ189 | error | Constraint  binds no endpoint; a parametric constraint binds at least one | sysml.parametric@2: each constraint binds at least one endpoint (the exactly-two rule is sysml.parametric@1/DDN-PJ122) |
| DDN-PJ190 | error | Generalization  under  connects block-family kinds; found<br>sysml.composition  connects block-family kinds or requirements; found | Under sysml.* profiles composition/generalization connect block-family kinds |
| DDN-PJ191 | error | Item flow  must be a block-family element or one of its ports; found unresolved<br>x_flow (rate/probability/continuous) annotates uml.flow edges under sysml.activity@1;  under | sysml.flow endpoints are blocks or their ports (ibd@2); x_flow rate/probability/continuous annotate uml.flow under sysml.activity@1 |
| DDN-PJ192 | error | DMN node  binds view  which is a  projection; a dmn.decision binds a decision-projection (decision table) view<br>DMN node  references unknown view<br>x_subdiagram on  under dmn.drd@1; only dmn.* nodes bind views | x_subdiagram on a DMN node must name an existing decision-projection (decision table) view |
| DDN-PJ193 | error | x_boxed boxed-expression presentation applies to dmn.decision/dmn.bkm/dmn.decisionservice; | x_boxed is presentation-only text on dmn.decision/dmn.bkm/dmn.decisionservice |
| DDN-PJ194 | error | Authority requirement  flows from a knowledge source or decision; found<br>Information requirement  flows from input data/decision into a decision or decision service; found<br>Knowledge requirement  flows from a BKM into a decision/BKM/service; found | DMN requirement connectors: information from input data/decision, knowledge from a BKM, authority from a knowledge source or decision |
| DDN-PJ195 | error | x_contract (choreography binding) applies to soaml.servicecontract;<br>x_service port decorations apply to participant/service-interface kinds; | SoaML: x_service port badges belong to participant/service-interface kinds; x_contract to soaml.servicecontract |
| DDN-PJ196 | error | Connector  declares  compatibility but no  relation runs from  — no such interface elementan element named<br>Connector  declares operation-coverage compatibility but  provides no operation named  required by<br>Connector  declares operation-coverage compatibility; both interface types () must name interface elements in the model<br>Connector  joins two «serviceServiceRequest» ports; a «Service» port connects to a «Request» port<br>Connector  joins «Service»/«Request» ports of different interface types (); both sides type the same service interface<br>x_compatibility applies to assembly/delegation/connector relations; | SoaML: «Service»/«Request» pairing and interface compatibility — same-type default; x_compatibility modes (specialization/realization/operation-coverage) need matching model evidence |
| DDN-PJ197 | error | Service contract  binds view ); a choreography binds a uml.sequence@2 or uml.statemachine@1 view<br>Service contract  choreography binding must reference a different view (self-reference is not a choreography)<br>Service contract  references unknown choreography view | SoaML: a service contract's choreography binding must name an existing uml.sequence@2 or uml.statemachine@1 view |
| DDN-PJ198 | error | Drill-down children support one nesting level;<br>Drill-down node  cannot render its own view as a child<br>Frozen drill-down  requires a snapshot SVG payload<br>Frozen snapshot on  must be an SVG document (max 512 KiB)<br>frozen snapshots apply to display thumbnail;  declares display<br>snapshot_at must be a string timestamp | Drill-down: frozen needs display thumbnail plus an SVG snapshot (max 512 KiB); inline/thumbnail children nest one level and cannot self-bind |
| DDN-PJ199 | error | EPC fan-balancing:  split(s) (connector with >1 outgoing) versus  join(s) (>1 incoming); every split needs a matching join of the same operator | EPC fan-balancing: every connector split (>1 outgoing) needs a matching join (>1 incoming) of the same and/or/xor operator |
| DDN-PJ200 | error | ICOM  port  must sit on the  side of ; declared side is unset<br>IDEF0 port  lacks an ICOM type (input/control/output/mechanism)<br>x_icom port typing applies to idef0.activity ports; | IDEF0: ICOM port type must match the port side (input west, control north, output east, mechanism south); ports on idef0.activity need a type |
| DDN-PJ201 | error | IDEF0 activity  needs an x_idef0.node number like A1 or A21<br>IDEF0 child activity  numbers unset; decomposition of  must number under it (2, ...)<br>IDEF0 decomposition of  must target an idef0.basic@1 view<br>IDEF0 node number  is used by both  and | IDEF0: activities need a unique x_idef0.node number; a decomposition's children number under the parent node |
| DDN-PJ202 | error | Inhibitor arc  must start at a place and end at a transition<br>Petri net is bipartite:  connects ; arcs run only between a place and a transition | Petri nets are bipartite: arcs run only between a place and a transition; inhibitors start at a place |
| DDN-PJ203 | error | x_petri.tokens belongs on petri.place;<br>x_petri.weight applies to petri arcs; | Petri tokens belong on places, weights on arcs (both nonnegative integers) |
| DDN-PJ204 | error | ORM fact type  needs at least one role box (a fields group)<br>x_derive derivation text applies to orm.facttype;<br>x_objectified applies to orm.facttype;<br>x_role (uniqueness/mandatory) lives on orm.facttype role boxes;<br>x_values value constraints belong to orm.valuetype; | ORM 2: roles (uniqueness/mandatory) live on orm.facttype role boxes; fact types need at least one role box; value constraints on value types only |
| DDN-PJ205 | error | x_vsm ladder values belong to vsm.process nodes;<br>x_vsm on  needs at least one of va/nva | VSM: x_vsm ladder values belong to vsm.process nodes and need at least one of va/nva (nonnegative numbers) |
| DDN-PJ206 | error | Icon reference  is not in the icon libraries registry<br>objectIcon pack must be a JSON objectddn-icon-pack@1Icon pack format must be ddn-icon-pack@1; found nameversionlicenseattributionsourcestring | Icon reference must name a library and icon from the icon-libraries registry |
| DDN-PJ207 | error | (no literal message) | Icon assets are sanitized: no scripts, foreignObject, event handlers, external references (href/url/images), non-SVG payloads, or assets over 20 KiB |
| DDN-PJ208 | error | An SDL process diagram needs exactly one start symbol; found<br>SDL  symbol  needs at least one outgoing transition | SDL process diagrams: exactly one start symbol; input/output/task/save/create symbols need at least one outgoing transition |
| DDN-PJ209 | error | Negation bubbles apply to BOOL pins only;<br>x_fbd pin typing applies to fbd.block/fbd.variable pins; | FBD: x_fbd pin typing applies to fbd kinds; negation bubbles are BOOL-only |
| DDN-PJ210 | error | fbd.wire  connects ; wire endpoints must share a type | FBD: wire endpoints must share a pin type |
| DDN-PJ211 | error | Rung  drives  output coil(s); an IEC 61131-3 rung has exactly one ladder.coil<br>x_coil applies to ladder.coil;<br>x_contact applies to ladder.contact; | Ladder: each rung drives exactly one ladder.coil; x_contact/x_coil belong to ladder.contact/ladder.coil |
| DDN-PJ212 | error | ladder.series  crosses rungs (); series wiring stays within one rung | Ladder: ladder.series endpoints must belong to the same rung (data block) |
| DDN-PJ213 | error | ladder.jump  must target a ladder.label selected in this view<br>x_jump applies to ladder.jump; | Ladder: ladder.jump must target a selected ladder.label; x_jump belongs to ladder.jump |
| DDN-PJ214 | error | ladder.basic@1 requires layout { algorithm: ladder }; found | Ladder: ladder.basic@1 requires layout { algorithm: ladder } |
| DDN-PJ215 | error | A spontaneous transition (input none) takes no priority or continuous condition;<br>Channel  signal reference must resolve to an sdl.signal<br>Timer set/reset  must reference a declared sdl.timer<br>active() query on  must reference an sdl.timer<br>x_hmscref (reference parameter lists) applies to msc.hmscref;<br>x_sdl  does not apply to a channel relation;<br>x_sdl applies to SDL kinds;<br>x_sdl on relations belongs to sdl.channel;<br>x_sdl priority/spontaneous/continuous/active markers belong to sdl.input;<br>x_sdl signals/nodelay belong to sdl.channel relations;<br>x_sdl timer/duration belong to sdl.set/sdl.reset; | SDL/MSC: x_sdl timer/channel/marker owner and reference rules; x_hmscref belongs to msc.hmscref |
| DDN-PJ216 | error | architecture files: entries must be workspace-relative path strings<br>failed to load:<br>is not in the workspace:<br>x_link needs file and target stringsx_link target file<br>x_link on  targets unknown identity | Cross-file: unknown architecture base file, unknown x_link target identity, or identity collision across bases |
| DDN-PJ217 | error | Cross-file relation  links  and ; an architecture container covering the base(s) is required | Cross-file: a relation spanning architecture bases needs an architecture container covering the base(s) |
| DDN-PJW01 | warning/info | Extended binary Chen; Chen scalar/binary subset;  attribute and relationship occurrences are projections, not copied semantic entities. | - |
| DDN-PJW02 | warning/info | Quantitative mark coordinates remain exact in every drawing style; styling does not change values. | - |
| DDN-PJW03 | warning/info | Sequence participant  has no incident messages; it is drawn with an empty lifeline. | - |
| DDN-PJW04 | warning/info | Parallel-coordinates axes  are constant: their scale is UNKNOWN and values are drawn at mid-height (dashed axis), not at zero.<br>Some series lack values on some axes; those segments pass through mid-height as UNKNOWN, not as zero.<br>Word cloud could not place  word(s) without overlap and omitted them: . Nothing was resized to fit silently. | - |
| DDN-PJW05 | warning/info | Choropleth join:  records matched a feature record(s) have no matching feature feature(s) rendered neutral | - |
| DDN-PJW06 | warning/info | is a SysML rebadge of the  machinery; SysML-specific extensions (x_flow on activity edges, x_port typing) apply on top. | Informational: sysml behavioral profile is a rebadge of the UML machinery |
| DDN-PJW07 | warning/info | x_link on : target file  is not in the workspace; rendered as an unresolved external note. | Cross-file: x_link target file absent from the workspace; rendered as an unresolved external note (warning, not an error) |
| DDN-PX001 | error | Unknown or malformed | - |
| DDN-PX002 | error | Extension points must be unique names on a use case<br>Use-case metadata has an incompatible owner<br>subjects must reference distinct uml.subject definitions | - |
| DDN-PX003 | error | A partial key belongs to a weak entity and is not a full key<br>Chen field flags are booleans on entity fields<br>Composite declaration must match actual child fields<br>Invalid Chen entity metadata<br>Key fields cannot be derived or multivalued<br>Only weak entities declare identifying owner<br>Weak entity requires a declared partial key<br>Weak entity requires a distinct entity owner | - |
| DDN-PX004 | error | Extend must name an extension point on its target use case<br>Extend requires a stated condition or condition definition<br>Use one condition form | - |
| DDN-PX005 | error | Chen associations are binary object-level assoc/ref<br>Each weak instance has exactly one owner<br>Identifying association must connect the declared weak entity to its owner<br>Nonidentifying relationship cannot declare owner/weak roles<br>Participation is nonnegative min/max or max:many<br>identifying is boolean | - |
| DDN-PX006 | error | Extend needs an extension point and condition<br>Include/extend endpoints must share a declared subject<br>Use case must name its subject boundary<br>View subject frame contradicts model membership | - |
| DDN-PX007 | error | Binary Chen relationship needs both min/max participation annotations<br>Chen binary profile selects entities only<br>Cyclic identifying ownership<br>Nested Chen attribute requires composite metadata<br>Weak entity owner is absent from this view<br>Weak entity requires exactly one visible identifying relationship | - |
| DDN-PX008 | error | Annotation needs an explicit attachment<br>Continuation  needs a matched out/in pair and explicit continues link<br>Continuation needs key and in/out side<br>Continuation ports contradict direction<br>Unsupported relationship in documented flowchart | - |
| DDN-Q001 | error | must be a finite number (no numeric-string coercion) | - |
| DDN-Q002 | error | Missing or not-selected quality reference: | - |
| DDN-Q003 | error | Duplicate  record identity<br>Empty record selection<br>needs 1..1000 references | - |
| DDN-Q004 | error | Filter supports eq and in<br>Order direction is asc/desc<br>Sort keys must be supplied scalar valuesdesc | - |
| DDN-Q005 | error | Lifecycle properties require state.flat@1<br>Unknown or malformed  properties | - |
| DDN-QC001 | error | Box marks require boxplot transform<br>Chart requires y binding<br>Quality charts use bar, line, area, point or box marks; use chart.basic for arcs<br>This transform cannot be combined with series/layers/arrangement<br>This transform does not accept series_missing, target or x_type<br>Transform/mark combination is invalid<br>Transforms define their own aggregation; aggregate is not accepted<br>Unknown chart transform<br>Waterfall step labels are categorical<br>is only meaningful for<br>missing must be error or skip | - |
| DDN-QC002 | error | Chart coordinate must be text or number<br>Every observation must declare matching x_record.unit:<br>Missing chart category/coordinate<br>No observations remain | - |
| DDN-QC010 | error | Histogram normalization is count, proportion or density<br>bins must contain 2..101 strictly increasing finite boundaries<br>outside is error or exclude | - |
| DDN-QC011 | error | No observations inside histogram bounds<br>Observation outside declared histogram bounds | - |
| DDN-QC012 | error | Pareto cumulative percentage requires positive total<br>Pareto values must be nonnegative | - |
| DDN-QC013 | error | Waterfall requires a step binding (delta/subtotal/total)<br>Waterfall step must be delta, subtotal, or total | - |
| DDN-QC014 | error | Declared total does not match cumulative changes; totals are not extra deltas | - |
| DDN-QC015 | error | Supported quartiles: linear_r7; whiskers: tukey_1_5 or minmax | - |
| DDN-QC020 | error | Count cannot retain an input measurement unit<br>Date x must be a real ISO date<br>Invalid arrangement or x_type<br>Series must have a nonempty text key of at most 80 characters<br>Unknown aggregatecountCount cannot retain an input measurement unitgapzeroerrorseries_missing is gap, zero or error<br>series_missing is gap, zero or error | - |
| DDN-QC021 | error | Bar series require categorical x<br>Declare exactly one layer per series<br>Percent target must be within 0..100<br>Quality chart limits: 20 series and 200 coordinates<br>Stacked/percent layers must be all bars or all areas<br>Unknown series or unsupported layer mark<br>target is a numeric reference on the shared y scale | - |
| DDN-QC022 | error | Duplicate series/category requires explicit aggregate<br>Missing series/category observationzerozero<br>Percent stack requires nonnegative values<br>Stacks need complete data or explicit zero fill<br>Zero-total percent category has no defined percentages | - |
| DDN-QC099 | error | identity<br>identitycategorydateT00:00:00Zend | - |
| DDN-QD001 | error | Boolean domain is false/true<br>Declare 1..8 input domains<br>Enum cannot declare numeric bounds<br>Enum values must be distinct non-null finite scalars<br>Input type is enum, boolean or number<br>Invalid or duplicate input key<br>Numeric domain cannot declare enum values<br>Numeric input requires finite closed min/max<br>nullable/optional must be boolean | - |
| DDN-QD002 | error | Equality value outside input domain<br>Extra predicate parameters<br>Interval closure must be boolean<br>Invalid numeric predicate interval<br>Membership values outside input domain or duplicate<br>Predicate references unknown input valuevaluesminmaxlower_closedupper_closedpredicate<br>Predicate uses an unavailable null/missing state<br>Unsupported predicate operator<br>when must be a conjunction record | - |
| DDN-QD003 | error | Every rule must provide every scalar output<br>analysis_budget is 1..50000<br>coverage is complete, report or none<br>hit_policy must be unique, first, collect, priority, any, output_order, rule_order or aggregation (the last five are DMN table annotations: bounded analysis still runs, ordering/aggregation itself is the host application engine, not the notation)<br>outputs must name 1..20 distinct keys | - |
| DDN-QD004 | error | More than one matching rule<br>Overlapping rules  for witness | - |
| DDN-QD005 | error | Uncovered input witness | - |
| DDN-QD006 | error | Input must be a record<br>Input outside declared domain:<br>Not a rule-based decision projection<br>Unknown input Input outside declared domain: firstrule_orderuniqueDDN-QD004 | - |
| DDN-QD008 | error | Rule proof budget exceeded ( atoms); disjointness/coverage NOT established | - |
| DDN-QF001 | error | Cause endpoints must be objects<br>First-level ribs must be quality.category<br>Fishbone effect must use quality.effect<br>Fishbone requires a named cause-to-parent relation | - |
| DDN-QF002 | error | Cause cycleDDN-QF003Fishbone limits: 4 cause levels and 250 occurrencesquality.effectDDN-QF001 | - |
| DDN-QF003 | error | Fishbone limits: 4 cause levels and 250 occurrences<br>Fishbone needs 1..12 root categories | - |
| DDN-QF004 | error | Selected cause relationships contain disconnected components | - |
| DDN-QL001 | error | Flat lifecycle accepts only declared states and transitions<br>Flat states do not contain nested fields/regions<br>Lifecycle needs exactly one initial marker and at least one terminal state | - |
| DDN-QL002 | error | Actions must reference scoped definitions; they are not executed<br>Initial marker has no incoming and exactly one outgoing transition<br>Initial transition is unconditional and action-free<br>Noninitial transition requires an event<br>Terminal state has an outgoing transition | - |
| DDN-QL003 | error | State cannot reach a terminal outcome<br>Unreachable lifecycle state | - |
| DDN-QL004 | error | Ambiguous event without declared guard domains | - |
| DDN-QL005 | error | Event data must be a record<br>Trace event name required<br>Trace event supports event and data only<br>Trace input outside domain<br>Trace must contain up to 1000 events<br>Unknown trace input<br>traces must be an array of at most 100 traces | - |
| DDN-QL006 | error | No unique permitted transition for | - |
| DDN-QL007 | error | Trace final state differs from expected | - |
| DDN-QM001 | error | Bands require strictly increasing finite boundaries<br>Category encoding requires 1..12 distinct scalar values<br>Conflicting encoding modes<br>Each category/band needs its readable legend label<br>Encoding mode is numeric, category or bands<br>Numeric encoding needs an explicit finite increasing domain<br>Unknown registered cell palette | - |
| DDN-QM002 | error | Cell is outside band boundaries<br>Cell is outside the declared domain<br>Encoded cells require unique source assignment<br>Encoded numeric cells must be numbers, not numeric strings<br>Unmapped categorical cell | - |
| DDN-QP001 | error | A child-view panel requires panels.composed@1 and cannot also contain items<br>Child view was not compiled<br>Panel view must resolve to a named view | - |
| DDN-QP002 | error | Composed panels support one child-view level; recursive dashboards are not supported | - |
| DDN-QP003 | error | At most twelve embedded child views are permitted<br>Child exceeds visible graph limits | - |
| DDN-QP004 | error | Child panels require the unified engine dispatcher | - |
| DDN-TW01 | warning/info | Some projection text used estimated metrics. Browser-specific shaping is not certified.<br>Some text runs used estimated metrics; this is not a typography-certified publication. | - |
| DDN-W012 | warning/info | 0.2 source accepted through compatibility reader. Migrate headers and review new semantic/routing diagnostics. | - |
| DDN-W013 | warning/info | Bundle keeps imports of files outside the bundle set: | - |
| DDN-W014 | warning/info | Cannot canonicalize @: module identity  is not expressible as a reference; reference left as-is.<br>Cannot canonicalize @; reference left as-is.<br>Conflicting external import alias ); first occurrence kept.<br>Conflicting external import alias ; first occurrence kept. | - |
| DDN-W015 | warning/info | View  binds records explicitly; added record(s)  are not displayed until the view binding lists them. Selector-membership views pick them up automatically. | - |
| DDN-W016 | warning/info | rate  exceeds the -marker DOM-honest cap and is clamped to  at render time. | - |
| DDN-W953 | warning/info | Render prepared at source revision  finalized after the source moved to revision ; the stale result was discarded, not cached. Re-render the current revision. | Stale render: the source changed after this render was prepared; re-render the current revision |
| DDN001 | error | Source exceeds demonstrator size limit | Split the file (>2,000,000 chars): move data blocks into imported files, or replace verbose object lists with a records block. |
| DDN002 | error | Unterminated block comment | - |
| DDN003 | error | Invalid JSON-style string escape<br>String contains a raw newline<br>Unterminated string | Remove the raw newline inside the string; use the JSON escape \n or split into two properties. |
| DDN004 | error | Unpaired Unicode surrogate | - |
| DDN005 | error | Nonfinite number | Replace the non-finite number (NaN/Infinity) with a finite literal; use null or missing for unknown values. |
| DDN006 | error | Unexpected character ${JSON.stringify(c)} | - |
| DDN007 | error | Maximum nesting exceeded | Reduce nesting below 80 levels; flatten deep records into x_record payloads or extra objects. |
| DDN008 | error | Reserved key<br>Reserved keyDDN011Duplicate column ${ct.value}label_columnDDN-E016<br>Reserved keyDDN011Duplicate property ${k.value}DDN010Expected a value<br>Reserved keyrelationstringsource_marktarget_mark | Rename the record key: __proto__, prototype and constructor are reserved; quote is not enough, choose another key. |
| DDN010 | error | Expected ${value\\|\\|type}; found ${t.value\\|\\|t.type}<br>Expected ; or block after ${n.type} ${n.id}<br>Expected ; or block after relation ${n.id}<br>Expected ; or block after row ${n.id}<br>Expected ; or block after view header<br>Expected a @data reference in the view header<br>Expected a @preset reference in the use: list<br>Expected a value<br>Expected record key<br>Missing closing brace | - |
| DDN011 | error | Duplicate column ${ct.value}<br>Duplicate property ${k.value}<br>Duplicate property ${t.value}<br>Duplicate property columns<br>Duplicate property kind (set by the batch header)<br>Duplicate property label_column | Remove the duplicate key/property in the same body (e.g. kind: written twice, or kind: inside a typed declaration). |
| DDN012 | error | Unsupported language version ${version}; expected ${SOURCE_VERSIONS.join(', ')} | Fix the version header: first tokens must be exactly ddn "0.5"; (accepted: "0.2".."0.5"). |
| DDN013 | error | Invalid module identity | Fix the module id: must match [A-Za-z0-9][A-Za-z0-9._:/-]* — no spaces; quote the id string. |
| DDN014 | error | Duplicate import alias | Rename the import alias; aliases must be unique across the whole merged file-level import list. |
| DDN015 | error | Import must precede the first module header (or follow it in the legacy position before any declaration) | Move the import: it is legal only before the FIRST module header, or immediately after it before that section's first declaration. |
| DDN020 | error | Import escapes workspace:<br>Imports must be workspace-relative POSIX paths: | Fix the import path: workspace-relative POSIX only — no scheme, no leading /, no backslashes, .. must stay inside the workspace. |
| DDN021 | error | Import cycle: | - |
| DDN022 | error | Missing workspace file | - |
| DDN023 | error | Duplicate module identity | Rename one module: module ids must be unique workspace-wide, including sibling sections of one file. |
| DDN024 | error | Duplicate declaration | Rename one declaration: identities are unique across sections (symbol key module::path); also check for a compact-form duplicate. |
| DDN025 | error | Top-level declaration must be data, format, view, an architecture container, or a reuse definition (fields, ports, relation_props, preset, fragment) | Only data, format and view declarations are legal at module top level; move the construct inside one of those. |
| DDN030 | error | Expected a reference | - |
| DDN031 | error | Unresolved reference @ | Fix the @reference: check spelling; use @alias.path for imports, @module.id.path for sibling sections (longest module prefix wins), or a local path. |
| DDN032 | error | Expected length, not | Use a length unit (px\|pt\|mm\|cm\|in) in this geometry context; temporal units (ms\|s\|min\|h\|d) are rejected here. |
| DDN033 | error | Unknown ${n.type} property ${key}<br>Unknown spacing value ; expected tight, normal, loose or expanded | Remove or rename the property: only keys in the PROPERTIES whitelist for this declaration type are allowed (x_* extensions always pass). |
| DDN040 | error | View not found: (default) | Pass --view <name>, or declare a view: a bare check builds the first view of the entry file's FIRST module, which declares none. |
| DDN041 | error | View data must reference one or more data blocks | Add data: [@yourDataBlock]; to the view — an array of data-block references is required. |
| DDN042 | error | Nested fields accept only a fields block<br>Unsupported data declaration | Only object/domain/sample/flow/assertion/relation (or compact equivalents) are legal inside data; remove the offending child (fields group only holds fields). |
| DDN043 | error | format must reference a bundle | Point format: at a bundle declaration (format x { bundle b {…} }), not at a single concern declaration. |
| DDN044 | error | Expected ${type} profile, found ${def.type}<br>Expected keyset | Point the concern reference (layout:/display:/…) at a declaration of that same concern type. |
| DDN045 | error | Unknown notation registryddn-core@0.3 | - |
| DDN046 | error | Invalid routing policy<br>Layout lengths cannot be negative:<br>Only explicit junction semantics are allowed<br>Page margin must be a finite length from 0 to 10000px<br>Publication  must be text<br>Shared network trunks require an adopted network profile; independent sharing is forbidden<br>Unknown connector routing<br>Unknown curve family<br>Unknown page orientation<br>Unsupported ${cat}.${key}: ${p[cat][key]}<br>curve_radius must be >0 and <=1000px<br>curve_tension must be >0 and <=1<br>display.depth must be 0..64<br>font_size must be between 8px and 64px<br>layout.auto_place must be boolean<br>layout.columns must be 1..100<br>layout.grid_step must be between 8px and 512px<br>metrics must be required or allow_estimated<br>publication. must be a finite length from 64 to 100000px<br>style.hachure must be boolean<br>style.roughness must be a number from 0 to 3<br>style.seed must be an integer from 0 to 4294967295 | Use a value from the CHOICES enum table for this property; anything else is rejected. |
| DDN047 | error | Numbered relationships require a legend | legend mode numbers requires a visible legend: do not set legend: off / placement: none with mode: numbers. |
| DDN050 | error | Unknown object kind | - |
| DDN051 | error | Sample requires columns and rows | Add both columns: [@field,…] and rows: [[…],…] to the sample block. |
| DDN052 | error | Sample columns must bind to fields | Each sample column must resolve to a field — bind @object.field, not the object itself. |
| DDN053 | error | Sample row width does not match columns | Make every sample row exactly as wide as the columns array. |
| DDN054 | error | Endpoint owner is outside the selected data modules<br>Relation endpoint is not a data element in scope | - |
| DDN055 | error | Only relations accept header endpoints<br>Relation requires two endpoints | Give the relation both endpoints: relation id @source -> @target {…}. |
| DDN056 | error | Unknown relationship kind | Use a verb keyword from the relationship tables (or a registered alias); quote dotted profile verbs like "uml.message". |
| DDN057 | error | View selection contains a non-element or out-of-scope element | select:/exclude: entries must resolve to elements in the view's data scope; fix the ref or its data: list. |
| DDN058 | error | Ambiguous legend key<br>Legend key refers to unknown relation | - |
| DDN059 | error | Callout numbers must be positive integers | - |
| DDN060 | error | Duplicate callout number | - |
| DDN061 | error | Missing explicit callout number for | Number EVERY visible relation in legend.keys when mode: numbers — add the missing relation id or drop the relation. |
| DDN062 | error | Placement target is not selected | place targets must be selected elements: remove the place block or add the element to the selection. |
| DDN063 | error | Route target is not visible | route targets must be visible relations (both endpoints selected); fix the ref or the selection. |
| DDN064 | error | Subdiagram target must be a view | - |
| DDN065 | error | Recursive or excessive inline subdiagram expansion | - |
| DDN070 | error | Page has no usable drawing area<br>embedding_scale must be >0 and <=4 | - |
| DDN071 | error | errorerrorwarningSmallest final text ${fontSize.toFixed(2)}px is below minimum ${minFont.toFixed(2)}px — ${remedy} | Text below the publication minimum: enlarge publication width/height, raise minimum_text, reduce content, or drop long labels. Rule of thumb: keep labels short and give dense graphs >=1200px width. |
| DDN072 | error | Legend exceeds page height | - |
| DDN073 | error | (code selected dynamically at the raise site; no static literal message) | route via points must be axis-aligned (orthogonal); fix the waypoints or set policy: repair to let the runtime recompute. |
| DDN074 | warning/info | Unscaled drawing exceeds publication area<br>Unscaled drawing exceeds publication area; choose reflow or a larger pageUnscaled drawing exceeds publication area | - |
| DDN076 | warning/info | Inline child rendered below configured minimum<br>Inline child text is below final minimum; enlarge the child or link a detail viewInline child rendered below configured minimum | - |
| DDN077 | warning/info | Required measured fonts unavailable for projectionSome projection text used estimated metrics. Browser-specific shaping is not certified.<br>Required measured fonts unavailable; supply text metrics or a browser providerSome text runs used estimated metrics; this is not a typography-certified publication. | - |
| DDN078 | error | Subdiagram reference target must be a safe relative identifier: <g class="ddn-subdiagram" data-view="${esc(d.target)}"><a href="${esc(d.targetLocal)}.svg">frame · diagram reference</a></g> | - |
| DDN099 | error | Load ddn-contracts.js before ddn-core.js<br>Load layout/text/export modules before rendering | - |
| DDN100 | error | No endpoint contract for | - |
| DDN101 | error | Missing  member | - |
| DDN102 | error | Unspecified  kind cannot satisfy<br>cannot use<br>requires distinct object identities<br>requires object endpoints | Endpoint kinds violate the verb's contract — check the verb's source/target kind columns in the relationship table and change the kind or the verb. |
| DDN103 | error | Unregistered extension DDN-W103Preserved unvalidated extension | - |
| DDN104 | error | does not apply to | - |
| DDN105 | error | strictDDN106Unknown semantic property DDN-W106Unregistered semantic property  is retained, not validatednullableoptionalallow_extra | - |
| DDN106 | error | Unknown semantic property | Unknown semantic property in strict mode: use a registered data property (section table) or run validation mode: logical. |
| DDN107 | error | must be boolean or explicit unknown state<br>presence must be required, optional, or an explicit state | - |
| DDN108 | error | domain must resolve to a semantic domain | - |
| DDN109 | error | Unknown modeling level | - |
| DDN110 | error | Company-scoped entity requires company_id<br>Duplicate key memberKey references missing field companycompany_idCompany-scoped entity requires company_idDDN111Missing parent of nested field<br>Key must contain fields<br>Key references missing field | - |
| DDN111 | error | Missing parent of nested field | - |
| DDN112 | error | Unsupported field shape | - |
| DDN113 | error | Variant requires at least two distinct named alternatives<br>Variant requires explicit discriminator name | - |
| DDN114 | error | Structural participation markers do not apply to  relations<br>Unknown endpoint mark | Use an endpoint mark from the endpoint-mark table; structural marks (one/many/…) are legal only on structural-family relations. |
| DDN115 | error | Instance relation source must be an instance/copy when its level is asserted<br>Instance relation target must be a definition when its level is asserted | - |
| DDN116 | error | A cross-database reference cannot claim a local physical foreign key<br>Join tuple names missing target field<br>Same-company comparison requires source company_id<br>Same-company reference must include company_id in target tuple | - |
| DDN130 | error | DDN131Boundary must declare ports | - |
| DDN131 | error | Boundary must declare ports | - |
| DDN132 | error | Binding is not a declared boundary port<br>Binding must resolve to ports<br>Boundary bindings must map this object port to a different object port<br>Boundary port bound more than once:<br>Unbound boundary portproposedrequiredacceptedrejectedwaivedDDN134Requirement needs id, owner, acceptance and explicit stateacceptedwaivedDDN135 | - |
| DDN133 | error | Boundary direction mismatch<br>Boundary direction must be in or out<br>Boundary payload mismatch<br>Boundary payload must identify an existing contract | - |
| DDN134 | error | Requirement needs id, owner, acceptance and explicit state | - |
| DDN135 | error | Accepted/waived requirement needs evidence references; prose approval is insufficient<br>Requirement evidence must refer to an evidence contract | - |
| DDN136 | error | Evidence requires method, scope, observation date, subject hash and outcome<br>Passing evidence requires an artifact digest | - |
| DDN137 | error | Affinity must list explicit field comparisons<br>Affinity must name enforcement responsibility<br>Affinity requires existing fields and eq operator | - |
| DDN138 | error | Cross-service contract requires owner, idempotency key and terminal-state vocabulary<br>Reconciliation requires timeout, compensation and evidence requirements | - |
| DDN139 | error | Custody declaration lacks | - |
| DDN140 | error | DDN141UI needs explicit field bindings and command contractsDDN141 | - |
| DDN141 | error | UI binding requires a unique control and an existing field<br>UI command needs authorization, validation, concurrency, failure and audit contracts<br>UI needs explicit field bindings and command contracts | - |
| DDN142 | error | Report columns must bind existing source fields<br>Report needs grain, cutoff, columns and reconciliation<br>Unknown report aggregation; register an algorithm contract | - |
| DDN150 | error | Public sample export needs a separately approved payload fixture; unsupported in redacted profile<br>key | - |
| DDN151 | error | preservepublished::nkindlevelshapepresencenullablekeydatatypedomainunitmaturityworkloadroletemporaldistributionlocationdirection | - |
| DDN152 | error | samplesampleobject | - |
| DDN153 | error | (no literal message) | - |
| DDN154 | error | Export allowlist contains an unresolved objectpreserve | - |
| DDN204 | error | Pinned or retained placements overlap: | - |
| DDN223 | error | line | - |
| DDN224 | error | Crossing jump obstructs an object or label; increase spacing or select crossings:gap | - |
| DDN900 | error | Reference model does not implement group<br>Reference renderer does not implement view declaration<br>Reference renderer supports reference and inline modes; balanced collapsed interfaces are specified separately<br>Unsupported view override group | - |
| LIVE001 | error | Presentation options must be a record.<br>Unsupported presentation option: | - |
| LIVE002 | error | Unsupported ${k}: ${o[k]} | - |
| LIVE003 | error | ${k} must be between ${min} and ${max}.<br>must be boolean or null. | - |
| LIVE010 | error | DDN source must be text, at most 2,000,000 characters per file.<br>Expected a source changes map.<br>Import escapes workspace.<br>Imports must be workspace relative.<br>Invalid workspace DDN path:<br>Workspace must be a filename-to-DDN-source map. | - |
| LIVE011 | error | Workspace limit: 1,500 files and 12,000,000 source characters. | - |
| LIVE012 | error | File not found.LIVE034Destination already exists.<br>Missing edited file.Structured edit<br>Missing entry: LIVE013Live view limit: 128 elements and 384 relationships. Split the model into linked views.<br>Missing source file.LIVE033File is imported by: Remove<br>Missing source file: | - |
| LIVE013 | error | Live view limit: 128 elements and 384 relationships. Split the model into linked views. | - |
| LIVE014 | error | Workspace name is required. | - |
| LIVE015 | error | Unknown saved workspace format. | - |
| LIVE016 | error | Workspace destroyed. | - |
| LIVE020 | error | Interaction projection does not support<br>Interaction projection retains its fixed lanes and typography. | - |
| LIVE021 | error | Data-bound coordinates cannot be replaced with automatic graph placement<br>Numbered relationships require a legend<br>Requested mark is not supported by this projection/transform<br>This projection does not allow graph setting | - |
| LIVE022 | error | relationRouting key is not a verb or relation in this view:<br>relationRouting must be a record keyed by verb or relation id. | - |
| LIVE023 | error | Unsupported relationRouting value for ${key}: ${value} | - |
| LIVE030 | error | Source changed since this edit was prepared. | - |
| LIVE031 | error | Overlapping or invalid text edits. | - |
| LIVE033 | error | File is imported by: | - |
| LIVE034 | error | Destination already exists. | - |
| LIVE040 | error | Render bridge must expose render(ir, engineOpts, flags). | - |
<!-- /generated (diagnostics) -->

## 10. Profile validation rules (enforced by `ddn-profiles.js` + `ddn-profile-quality.js`)

These are the executable checks where generators most often fail. `ns`/`es` below = selected elements / visible relations (both endpoints selected).

Global (all profiles):
- Unknown profile id → DDN-PF001. `projection.kind` ≠ profile's registered projection → DDN-PF002.
- `flow.*`, `uml.actor`, `uml.usecase`, `c4.*`, `epk.*` elements must NOT declare `fields` compartments (DDN-PF003).
- `uml.generalization`, `uml.include`, `req.derives` relations must be acyclic (DDN-PF004); generalization endpoints must share the same declared kind (DDN-PF005).
- `dfd.data` must involve a `dfd.process` on at least one side (DDN-PF006).
- `export.mode: redacted` with any profile-specific (dotted) kind → DDN-PJ003 (fail closed).
- `req.requirement` elements need unique `x_diagram.code` and nonempty `x_diagram.text` (DDN-PF014).

Per-profile:
- **flow.basic@1 / flow.documented@2 / uml.activity@1**: `flow.*` only (DDN-PF007); links `flow.next` / `uml.flow` / +`flow.annotation`,`flow.continues` (DDN-PX008). One start+end; start none in, end none out (DDN-PF008); `flow.decision` ≥2 distinct named branches (DDN-PF009); all symbols reachable start→end (DDN-PF010). documented@2: offpage needs `x_continuation {key, side, page?}`, one out+in pair per key (DDN-PX008); annotations need an outgoing attachment.
- **dfd.***: `dfd.*` + `dfd.data` only (DDN-PF011); each `dfd.process` unique `x_diagram.number`, ≥1 input and output (DDN-PF012/013).
- **org.tree@1**: `organization|team|role|analysis.role` + `reports_to` only; acyclic; exactly one root (DDN-PJ102); multi-parent fails layout (DDN201).
- **wbs.tree@1**: `analysis.task` + `analysis.decomposes` only; acyclic; one root (DDN-PJ102).
- **mindmap.basic@1**: `object|entity|term|domain` + `assoc` only; `layout.algorithm: mindmap`; acyclic; one root.
- **concept.map@1**: `object|entity|term|domain` + `assoc|ref` only; every selected relation needs an explicit label, not the verb default (DDN-PJ104).
- **c4.***: `c4.rel` links only; context: `c4.person`+`c4.system` only, no member endpoints (DDN-PJ100); container/component: `c4.person|c4.system|c4.container|c4.store` + `c4.queue`/`c4.component`, and EXACTLY ONE frame scoped to the boundary (`c4.system` / `c4.container`) whose members cover every interior node (DDN-PJ101).
- **epc.basic@1**: `epk.event|function|connector` + `epk.next` only; events/functions strictly alternate (DDN-PJ105); connectors carry `x_epc.operator` and|or|xor, forbidden elsewhere (DDN-PJ106).
- **erd.crowfoot@1**: every visible relation `ref|assoc` with BOTH `source_mark`/`target_mark` in `one|zeroone|many|zeromany` (DDN-PJ087).
- **uml.usecase@2**: every `uml.usecase` names subjects (`x_usecase.subjects` → distinct uml.subject refs); `uml.extend` names a declared extension point + condition or condition_ref (one form); include/extend share a declared subject; subject frames must match model membership (DDN-PX002/PX004/PX006).
- **chen.basic@1 / chen.binary@2**: entities only; weak entity needs distinct owner, partial-key field, one visible identifying relation weak↔owner (owner min1/max1); binary@2 requires `x_chen.from/to {min,max|many}`; composite flags match nested fields; ownership acyclic (DDN-PX003/PX005/PX007).
- **uml.object@1**: instances carry `x_instance.classifier`; slots must exist on classifier fields (DDN-PJ112).
- **uml.communication@1**: every `uml.message` needs `x_message.seq` (`^\d+(\.\d+)*$`); replies dotted under the request, non-replies top-level (DDN-PJ111).
- **state.flat@1**: `state.initial|state.state|state.final` + `state.transition` only; one initial, ≥1 terminal (`state.final` or `x_state.terminal`); no fields; initial transition unconditional; non-initial transitions need `x_transition.event`; terminals none out; all states reach a terminal; same-event branches need guard `inputs` domains; optional `traces`, each step exactly one transition (DDN-QL001..QL007).
- **state.composite@1**: `x_region: true` frames = parallel regions; at most one `state.initial` per region/composite (DDN-PJ113); labels from `x_transition`.
- **uml.activity@1** (+ flow rules): `x_partition.lane` names an existing frame (DDN-PJ114); fork count = join count on `flow.forkjoin` bars (DDN-PJ115).
- **bpmn.basic@1**: pools = frames `x_pool: true`; `bpmn.messageflow` only across pools (DDN-PJ116); every `flow.gateway` needs `x_gateway.type` exclusive|parallel|inclusive (DDN-PJ117).
- **bpmn.process@1 / choreography@1 / conversation@1**: event trigger/position rules (DDN-PJ175); extended gateways + event-gateway fan-out (PJ176); activity markers on task kinds (PJ177); choreography bands (PJ178); conversation links to conversation nodes (PJ179); data associations pair data nodes with activities (PJ180).
- **uml.interaction_overview@1**: nodes referencing sub-views via `x_subdiagram.view` must name an existing view (DDN-PJ119); @2: unique gate names, one expansion level (DDN-PJ174).
- **uml.object@2** : slot values match classifier field datatypes (DDN-PJ170).
- **uml.communication@2** : fragment refs resolve to visible messages; constraints in {…} (DDN-PJ172).
- **uml.timing@2** : annotations/constraints in {…}; messages need x_message.at (DDN-PJ173).
- **uml.structure@2 packages / uml.profile@1** : x_pack.visibility needs a package frame (DDN-PJ171); extension endpoints stereotype → metaclass (DDN102).
- **soaml.services@1**: x_service owners (DDN-PJ195); assembly pairs «Service»↔«Request» of the same interface type (PJ196); choreography binding to uml.sequence@2/uml.statemachine@1 (PJ197).
- **dmn.drd@1**: requirement connector endpoints (DDN-PJ194); x_subdiagram must bind a decision-projection view (PJ192); x_boxed owner/form (PJ193). decision.rules@1 also accepts DMN hit-policy labels priority/any/output_order/rule_order/aggregation as annotations (analysis unchanged; ordering/aggregation deferred to host engine); completeness cell C+/C− renders for those labels or `x_completeness: true`.
- **sysml.***: only block-family kinds declare `ports` (DDN-PJ121; @1: `sysml.block` only); parametric@1: each `sysml.constraint` touched by exactly two visible relations (DDN-PJ122), parametric@2: at least one (DDN-PJ189). Requirements: dependency endpoint rules (DDN-PJ185); x_block compartments (PJ186); x_port typing/nesting (PJ187); x_unit resolves in the units registry (PJ188); composition/generalization on block-family kinds (PJ190); ibd@2 item-flow endpoints + x_flow edges (PJ191). Behavioral rebadges sysml.usecase/activity/sequence/statemachine@1 run the uml.* machinery (info DDN-PJW06).
- **archimate.basic@1**: `archi.rel` endpoints among the nine `archi.*` kinds; links same-layer or upward (DDN-PJ123).
- **cmmn.basic@1 / cmmn.complete@1**: `cmmn.sentry` inside a `cmmn.stage` frame with `x_sentry.on` (DDN-PJ120); complete@1: x_cmmn owner/decorator rules (PJ181), sentry attachment/on-part (PJ182), planning tables (PJ183), one case plan per view (PJ184).
- **network.basic@1 / network.rack@1**: `network.attaches` targets a `network.bus` or port (DDN-PJ127); rack members carry unique integer `x_rack.unit` 1..`x_rack.units` (DDN-PJ127).
- **fault.tree@1 / event.tree@1**: `tree.gate` declares `x_gate.type` and|or with ≥2 outgoing `tree.input` edges (DDN-PJ126).
- **family.tree@1**: `family.parent_of` acyclic (DDN-PJ129); ≤2 distinct parents per person (DDN-PJ130).
- **wireframe.ui@1**: `ui.*` controls outside any `ui.frame` frame → warning DDN-PJ128.
- **pert.cpm@1**: tasks (`analysis.task`) need finite nonnegative `x_estimate` days (DDN-PJ125); `analysis.precedes` must be acyclic (DDN-PJ124); critical-path relations/labels are computed at render.
- **uml.deployment@1** : endpoint contracts do the work (DDN102); commpath labels never carry qualifiers; nesting frames scope to node kinds (DDN-PJ164).
- **uml.composite@1** : assembly endpoints are components or their ports; delegation starts at a port member (DDN-PJ165); x_part owners/multiplicity (PJ166).
- **uml.activity@2** : merge ≥2 in / 1 out (DDN-PJ167); interrupt inside x_interruptible frame, exception targets flow.process (PJ168); x_pin on action kinds (PJ169); flow.flowfinal counts as an end (DDN-PF008).
- **uml.structure@2** : end labels/multiplicity on associations (DDN-PJ149); association class resolves to uml.class (PJ150); n-ary ≥3 distinct classifier ends (PJ151); genset one target per name (PJ152); templates on classifiers (PJ153); enumeration literals (PJ154).
- **uml.sequence@2** : fragment spans contiguous/nested, anchored on first message (DDN-PJ155); sort/gate rules — create first, delete final, lost/found self-anchored, gate needs a fragment (PJ156); invariant/activation refs incident (PJ157/158); `{…}` constraints (PJ159).
- **uml.statemachine@1** : x_state on state kinds; submachine → distinct state.state (DDN-PJ160); choice 2+ out, junction pass-through, history/boundary points inside a composite frame (PJ161); after/at/when need parentheses (PJ162); traces stay state.flat@1-only (DDN-Q005).

## 11. Validation workflow (CLI)

```
node notation/cli/cli.js <check|render|resolve|bundle> <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR]
```

- `--workspace DIR` (default `.`): ALL files (entry + transitive imports) must live under this directory; an entry outside → `Entry is outside workspace`; symlinks escaping it are rejected. Imports are resolved POSIX-relative to the importing file inside the workspace.
- `check`: parses entry + transitive imports, builds the IR (view = `--view`, else the first view of the entry file's first module), runs contracts + profile validation. Prints `{"status":"pass-core","view":…,"elements":N,"relations":N,"warnings":[…]}`. Exit code 1 with a JSON error `{code,message,source,offset}` on failure.
- `render`: additionally runs layout/routing/publication and writes/prints the SVG (needs `--out` or prints to stdout). Use it to catch geometry errors (DDN200–224) that `check` does not reach.
- `resolve`: prints the serialized resolved IR (JSON), honoring the `export` profile (redacted allowlist / SQL DDL).
- `bundle`: merges the workspace into one self-contained multi-module file (§2.1).
- `DDNLive` in-browser equivalent: `api.parse`, `ws.resolve`, `ws.renderSync`.

Self-check recipe for an AI: write `file.ddn` (+ any imported files) into a fresh tmp dir, then
`node …/cli.js check /tmp/ws/file.ddn --workspace /tmp/ws && node …/cli.js render /tmp/ws/file.ddn --workspace /tmp/ws --out /tmp/ws/out.svg`.
For files declaring multiple views, repeat with `--view <name>` for each view.

## 12. Multi-file authoring

A single-file self-contained is preferred (one file, one or more module sections, no imports) unless reuse across deliverables is needed — it is the easiest form to validate and ship. When reuse justifies it:

1. Split the model across files freely; every file starts `ddn "0.5";` + file-level `import "<path>" as <alias>;` lines (canonical position: before the FIRST `module` header). Paths are workspace-relative POSIX — no scheme, no leading `/`, no `\`, `..` may not escape the workspace root (DDN020).
2. Reference across files as `@alias.path`; across sections of the SAME file as `@module.id.path` (longest module-id prefix wins). Module ids must be unique workspace-wide (DDN023); declarations unique across sections (DDN024).
3. Validate the whole workspace from the entry file: `cli.js check entry.ddn --workspace <dir>`; every transitive import must live under `<dir>`. For multi-view entries repeat with `--view <name>` per view — a bare `check` builds only the first view of the entry's FIRST module (DDN040 if it declares none).
4. Ship one file with `cli.js bundle entry.ddn --workspace <dir> --out out.ddn` (§2.1); rendering every view of the bundle is byte-identical to the workspace.

## 13. Worked recipes (all verified with `cli.js check` AND `cli.js render`)

Every ```ddn block below is extracted by the generator and must pass BOTH `check` and `render` (every declared view; `shared.ddn` alongside where imported); the build fails if any fails. Comments annotate the language features. Recipes are minimal-but-complete: copy the closest one and adapt.

### 13.1 Crow's-foot ERD (`erd.crowfoot@1`)

```ddn
ddn "0.5";                              // version header (newest source dialect)
module "ddn.examples.crows-foot";
import "shared.ddn" as shared;          // legacy import position (after FIRST header)

// erd.crowfoot@1: every ref/assoc carries source_mark + target_mark (else DDN-PJ087).
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

`shared.ddn` (the imported file, shown once; reused by every recipe that imports it):

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

### 13.2 DFD (`dfd.gane_sarson@1`)

```ddn
ddn "0.5";
module "ddn.examples.dfd";

// dfd.*: only dfd.* participants and dfd.data links; every process needs a
// unique nonempty x_diagram.number and at least one input and one output.
data dfd {
    object supplier "Supplier" { kind: "dfd.external"; }
    object match "Match invoice" { kind: "dfd.process"; x_diagram: { number: "1.0" }; }
    object receipts "Accepted receipts" { kind: "dfd.store"; x_diagram: { number: "D1" }; }
    object post "Post payable" { kind: "dfd.process"; x_diagram: { number: "2.0" }; }
    object ledger "Payables ledger" { kind: "dfd.store"; x_diagram: { number: "D2" }; }
    relation a "Invoice" @supplier -> @match { kind: "dfd.data"; }
    relation b "Receipt evidence" @receipts -> @match { kind: "dfd.data"; }
    relation c "Matched obligation" @match -> @post { kind: "dfd.data"; }
    relation d "Authorized posting" @post -> @ledger { kind: "dfd.data"; }
}

view dfd_view "Synthetic payables / DFD" {
    data: [@dfd];
    projection { kind: graph; profile: "dfd.gane_sarson@1"; }
    publication { size: content; fit: none; }
}
```

### 13.3 Flowchart (`flow.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.flowchart";

// flow.basic@1: only flow.* kinds and flow.next links; >=1 start and end;
// every decision outlet needs a distinct nonempty x_diagram.branch; every
// symbol reachable from a start and able to reach an end.
data flow {
    object start "Purchase request" { kind: "flow.start"; }
    object capture "Capture items" { kind: "flow.io"; }
    object approve "Approved?" { kind: "flow.decision"; }
    object order "Issue purchase order" { kind: "flow.process"; }
    object reject "Return for correction" { kind: "flow.process"; }
    object close "Request closed" { kind: "flow.end"; }
    relation p1 @start -> @capture { kind: "flow.next"; }
    relation p2 @capture -> @approve { kind: "flow.next"; }
    relation p3 "Approved" @approve -> @order { kind: "flow.next"; x_diagram: { branch: "approved" }; }
    relation p4 "Rejected" @approve -> @reject { kind: "flow.next"; x_diagram: { branch: "rejected" }; }
    relation p5 @order -> @close { kind: "flow.next"; }
    relation p6 @reject -> @close { kind: "flow.next"; }
}

view flowchart "Synthetic purchasing / flowchart" {
    data: [@flow];
    projection { kind: graph; profile: "flow.basic@1"; }
    publication { size: content; fit: none; }
}
```

### 13.4 C4 container diagram (`c4.container@1`)

```ddn
ddn "0.5";
module "ddn.examples.c4";

// c4.container@1: c4.* participants, c4.rel links, and EXACTLY ONE frame
// scoped to a selected c4.system whose members cover every selected interior
// node (c4.person stays exterior).
data shop {
    object customer "Customer" { kind: "c4.person"; }
    object site "Online shop" { kind: "c4.system"; }
    object web "Web application" { kind: "c4.container"; }
    object db "Orders database" { kind: "c4.store"; }
    object events "Order events" { kind: "c4.queue"; }
    relation visits @customer -> @web { kind: "c4.rel"; }
    relation orders "Reads/writes orders" @web -> @db { kind: "c4.rel"; }
    relation publishes "Publishes events" @web -> @events { kind: "c4.rel"; }
}

view container "Synthetic shop / C4 container" {
    data: [@shop];
    projection { kind: graph; profile: "c4.container@1"; }
    frame system_boundary { scope: @shop.site; members: [@shop.web, @shop.db, @shop.events]; }
    publication { size: content; fit: none; }
}
```

### 13.5 Org chart (`org.tree@1`)

```ddn
ddn "0.5";
module "ddn.examples.org-chart";

// org.tree@1: organization|team|role|analysis.role participants, reports_to
// links only, acyclic, exactly one root. Tree layout rooted at the CEO.
data people {
    object ceo "A. Rivera — CEO" { kind: "analysis.role"; }
    object vp_eng "B. Okafor — VP Engineering" { kind: "analysis.role"; }
    object vp_fin "C. Novak — VP Finance" { kind: "analysis.role"; }
    object lead_plat "E. Mbeki — Platform lead" { kind: "analysis.role"; }
    relation r1 @ceo -> @vp_eng { kind: reports_to; }
    relation r2 @ceo -> @vp_fin { kind: reports_to; }
    relation r3 @vp_eng -> @lead_plat { kind: reports_to; }
}

view org "Synthetic organisation / org chart" {
    data: [@people];
    projection { kind: graph; profile: "org.tree@1"; }
    layout { algorithm: tree; direction: down; root: @people.ceo; hierarchy: [reports_to]; }
}
```

### 13.6 Mind map (`mindmap.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.mind-map";

// mindmap.basic@1: object|entity|term|domain participants, assoc links only,
// one root, and layout.algorithm MUST be mindmap.
data ideas {
    object root "Q3 launch brainstorm";
    object pricing "Pricing";
    object risks "Risks";
    object tiers "Usage tiers" { kind: term; }
    object creep "Scope creep" { kind: term; }
    relation r1 @root -> @pricing { kind: assoc; }
    relation r2 @root -> @risks { kind: assoc; }
    relation r3 @pricing -> @tiers { kind: assoc; }
    relation r4 @risks -> @creep { kind: assoc; }
}

view mindmap "Synthetic brainstorm / mind map" {
    data: [@ideas];
    projection { kind: graph; profile: "mindmap.basic@1"; }
    layout { algorithm: mindmap; routing: curved; root: @ideas.root; hierarchy: [assoc]; }
    publication { size: content; fit: none; }
}
```

### 13.7 Sequence diagram (`uml.sequence@1`)

```ddn
ddn "0.5";
module "ddn.examples.sequence";

import "shared.ddn" as shared;

// uml.sequence@1: participants are lifelines in declaration order; uml.message
// relations are numbered top-to-bottom in declaration order. x_return draws a
// dashed return; a self-message loops on its own lane.
data flow {
    object customer_app "Customer app" { kind: "application"; }
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

### 13.8 Hierarchical state machine (`state.composite@1`)

```ddn
ddn "0.5";
module "ddn.examples.hierarchicalstate";

import "shared.ddn" as shared;

// Composite state "Fulfillment" is a frame; the payment parallel region is an
// x_region frame; a region gets at most one state.initial (DDN-PJ113).
// Transitions are state.transition relations with x_transition.event.
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

    relation begin "begin" @start -> @draft { kind: "state.transition"; }
    relation submit "submit" @draft -> @fulfillment { kind: "state.transition"; x_transition: { "event": "submit" }; }
    relation pay "pay" @payment_initial -> @awaiting { kind: "state.transition"; }
    relation paid_ev "paid" @awaiting -> @paid { kind: "state.transition"; x_transition: { "event": "payment_received" }; }
    relation payment_end "payment end" @paid -> @payment_final { kind: "state.transition"; x_transition: { "event": "reconcile" }; }
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
        members: [@order.fulfillment, @order.awaiting, @order.paid]; }
    frame payment "PAYMENT" { x_region: true;
        members: [@order.payment_initial, @order.awaiting, @order.paid, @order.payment_final]; }
}
```

(For a validated flat lifecycle use `profile: "state.flat@1"`: exactly one `state.initial` with a single unconditional outgoing transition, ≥1 terminal, full reachability — §10.)

### 13.9 Matrix quadrant (`matrix.bcg@1`)

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

### 13.10 Fishbone (`fishbone.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.fishbone";

// fishbone.basic@1: one quality.effect, first-level ribs are quality.category
// (1..12) linked by the named cause relation; deeper causes hang off categories;
// acyclic, all cause relations connected.
data causes {
    object effect "Inspection failures" { kind: "quality.effect"; }
    object equipment "Equipment" { kind: "quality.category"; }
    object materials "Materials" { kind: "quality.category"; }
    object people "People" { kind: "quality.category"; }
    relation e1 @equipment -> @effect { kind: "quality.cause"; }
    relation e2 @materials -> @effect { kind: "quality.cause"; }
    relation e3 @people -> @effect { kind: "quality.cause"; }
    object wear "Tool wear" { kind: "quality.cause"; }
    relation c1 @wear -> @equipment { kind: "quality.cause"; }
    object humidity "Storage humidity" { kind: "quality.cause"; }
    relation c2 @humidity -> @materials { kind: "quality.cause"; }
}

view fishbone "Synthetic root-cause / fishbone" {
    data: [@causes];
    projection { kind: fishbone; profile: "fishbone.basic@1"; effect: @causes.effect; relation: "quality.cause"; }
}
```

### 13.11 Decision table (`decision.rules@1`)

```ddn
ddn "0.5";
module "ddn.examples.decision";

// decision.rules@1: records are rule.row elements carrying x_rule {when, then};
// inputs declare domains (enum values / number ranges); every rule supplies
// every output; hit_policy unique forbids overlap.
data rules {
    object high "High severity" { kind: "rule.row"; x_rule: { "when": { "severity": { "op": "eq", "value": "high" } }, "then": { "route": "quarantine", "audit": true } }; }
    object low_pass "Low severity in tolerance" { kind: "rule.row"; x_rule: { "when": { "severity": { "op": "eq", "value": "low" }, "score": { "op": "interval", "min": 0, "max": 5, "upper_closed": false } }, "then": { "route": "release", "audit": false } }; }
    object low_review "Low severity outside tolerance" { kind: "rule.row"; x_rule: { "when": { "severity": { "op": "eq", "value": "low" }, "score": { "op": "interval", "min": 5, "max": 10 } }, "then": { "route": "inspect", "audit": true } }; }
}

view decision "Disposition policy / decision table" {
    data: [@rules];
    projection {
        kind: decision; profile: "decision.rules@1";
        records: [@rules.high, @rules.low_pass, @rules.low_review];
        inputs: [{ "key": "severity", "type": "enum", "values": ["low", "high"] }, { "key": "score", "type": "number", "min": 0, "max": 10 }];
        outputs: ["route", "audit"];
        hit_policy: "unique"; coverage: "complete";
    }
    select: [@rules.high, @rules.low_pass, @rules.low_review];
}
```

### 13.12 Timeline / Gantt (`timeline.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.timeline";

// timeline.basic@1: records carry ISO start/end dates (end >= start); optional
// dependencies reference visible analysis.precedes relations that must not
// contradict the dates and must be acyclic.
data tasks {
    object order "Issue purchase order" { kind: "analysis.task"; x_record: { start: "2026-01-05", end: "2026-01-07" }; }
    object receive "Receive and inspect" { kind: "analysis.task"; x_record: { start: "2026-01-08", end: "2026-01-12" }; }
    object post "Post authorized liability" { kind: "analysis.task"; x_record: { start: "2026-01-13", end: "2026-01-16" }; }
}

data schedule {
    relation d1 "Order precedes receipt" @tasks.order -> @tasks.receive { kind: "analysis.precedes"; }
    relation d2 "Receipt precedes posting" @tasks.receive -> @tasks.post { kind: "analysis.precedes"; }
}

view gantt "Synthetic procurement schedule / gantt" {
    data: [@tasks, @schedule];
    projection {
        kind: timeline; profile: "timeline.basic@1";
        records: [@tasks.order, @tasks.receive, @tasks.post];
        start: "x_record.start"; end: "x_record.end";
        dependencies: [@schedule.d1, @schedule.d2];
        width: 1250px;
    }
}
```

### 13.13 Bar chart from a keyed `records` block (`chart.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.chart";

// Keyed tabular records: columns declared once; each row desugars to
// object <id> { kind: record; x_record: {…} }. Row ids are the replaceData
// keys for runtime refresh. The chart binds the records explicitly.
records metrics {
    columns: label, value, unit;
    label_column: label;
    row m1: "Alpha", 10, "ms";
    row m2: "Beta", 20, "ms";
    row m3: "Gamma", 15, "ms";
}

view latency_chart "Synthetic latency / bar chart" {
    data: [@metrics];
    projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2, @metrics.m3]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
    publication { size: content; fit: none; }
}
```

### 13.14 Pie chart (`chart.basic@1`, `mark: pie`)

```ddn
ddn "0.5";
module "ddn.examples.pie";

records share {
    columns: segment, value, unit;
    label_column: segment;
    row s1: "Search", 46, "%";
    row s2: "Direct", 27, "%";
    row s3: "Referral", 17, "%";
    row s4: "Social", 10, "%";
}

view pie "Synthetic traffic share / pie" {
    data: [@share];
    projection { kind: chart; profile: "chart.basic@1"; records: [@share.s1, @share.s2, @share.s3, @share.s4]; mark: pie; x: "x_record.segment"; y: "x_record.value"; unit: "%"; width: 900px; height: 560px; }
}
```

### 13.15 KPI gauge (`chart.gauge@1`)

```ddn
ddn "0.5";
module "ddn.examples.gauge";

// gauge: exactly one record, value 0..100, optional numeric target 0..100.
data sla {
    object q1 "SLA attainment" { kind: record; x_record: { kpi: "SLA attainment", value: 87, unit: "%" }; }
}

view gauge "Synthetic SLA / gauge" {
    data: [@sla];
    projection { kind: chart; profile: "chart.gauge@1"; records: [@sla.q1]; mark: gauge; x: "x_record.kpi"; y: "x_record.value"; unit: "%"; target: 95; width: 900px; height: 560px; }
}
```

### 13.16 Distribution histogram (`chart.histogram@1`)

```ddn
ddn "0.5";
module "ddn.examples.histogram";

// Distribution marks bind only a numeric x (no y/series); bin_count is an integer.
records latency {
    columns: ms, unit;
    row a1: 42, "ms";
    row a2: 45, "ms";
    row a3: 48, "ms";
    row a4: 51, "ms";
    row a5: 55, "ms";
    row a6: 61, "ms";
    row a7: 64, "ms";
    row a8: 69, "ms";
    row a9: 74, "ms";
    row a10: 85, "ms";
    row a11: 96, "ms";
    row a12: 121, "ms";
}

view histogram "Synthetic response times / histogram" {
    data: [@latency];
    projection { kind: chart; profile: "chart.histogram@1"; records: [@latency.a1, @latency.a2, @latency.a3, @latency.a4, @latency.a5, @latency.a6, @latency.a7, @latency.a8, @latency.a9, @latency.a10, @latency.a11, @latency.a12]; mark: histogram; x: "x_record.ms"; x_type: number; bin_count: 6; unit: "ms"; width: 1120px; height: 620px; }
    publication { size: content; fit: none; }
}
```

### 13.17 Sankey (`chart.sankey@1`)

```ddn
ddn "0.5";
module "ddn.examples.sankey";

// sankey: categorical endpoint text x + target binding, positive values, acyclic.
records energy {
    columns: source, target, value, unit;
    label_column: source;
    row f1: "grid", "heating", 40, "MWh";
    row f2: "grid", "it", 30, "MWh";
    row f3: "gas", "heating", 35, "MWh";
    row f4: "heating", "building_a", 45, "MWh";
    row f5: "it", "building_a", 45, "MWh";
}

view sankey "Synthetic energy spend / sankey" {
    data: [@energy];
    projection { kind: chart; profile: "chart.sankey@1"; records: [@energy.f1, @energy.f2, @energy.f3, @energy.f4, @energy.f5]; mark: sankey; x: "x_record.source"; target: "x_record.target"; y: "x_record.value"; unit: "MWh"; width: 1120px; height: 620px; }
    publication { size: content; fit: none; }
}
```

### 13.18 Item dashboard (`panels.basic@1`)

```ddn
ddn "0.5";
module "ddn.examples.panels";

// panels.basic@1: free grid (columns 1..12) of titled panels with item lists;
// panels may span rows/columns but must not overlap.
data notes {
    object strength "Strong brand; recurring revenue";
    object weakness "Single region; thin support bench";
    object opportunity "Adjacent SMB segment; partner channel";
    object threat "Two funded entrants; price pressure";
}

view swot "Synthetic SWOT / panels" {
    data: [@notes];
    projection {
        kind: panels; profile: "panels.basic@1"; columns: 2;
        panels: [
            { id: "s", title: "STRENGTHS", row: 0, column: 0, items: [@notes.strength] },
            { id: "w", title: "WEAKNESSES", row: 0, column: 1, items: [@notes.weakness] },
            { id: "o", title: "OPPORTUNITIES", row: 1, column: 0, items: [@notes.opportunity] },
            { id: "t", title: "THREATS", row: 1, column: 1, items: [@notes.threat] }
        ];
    }
}
```

### 13.19 Refresh-ready composed dashboard (`panels.composed@1` + records blocks)

```ddn
ddn "0.5";
module "ddn.examples.dashboard";

// Refresh-ready: metrics live in a records block whose row ids are the
// replaceData keys; child views bind the records; the composed dashboard
// embeds the child views one level deep (child <= 128 elements/384 relations).
records ops {
    columns: queue, depth, unit;
    label_column: queue;
    row ingest: "ingest", 120, "msgs";
    row billing: "billing", 45, "msgs";
    row notify: "notify", 12, "msgs";
    row search: "search", 67, "msgs";
}

view queue_bars "Queue depth / bars" {
    data: [@ops];
    projection { kind: chart; profile: "chart.basic@1"; records: [@ops.ingest, @ops.billing, @ops.notify, @ops.search]; mark: bar; x: "x_record.queue"; y: "x_record.depth"; unit: "msgs"; }
    publication { size: content; fit: none; }
}

view queue_table "Queue depth / table" {
    data: [@ops];
    projection { kind: table; profile: "table.records@1"; records: [@ops.ingest, @ops.billing, @ops.notify, @ops.search]; columns: [{ key: "x_record.queue", label: "Queue" }, { key: "x_record.depth", label: "Depth (msgs)" }]; }
    publication { size: content; fit: none; }
}

view dashboard "Synthetic operations / composed dashboard" {
    data: [@ops];
    projection {
        kind: panels; profile: "panels.composed@1"; columns: 2;
        panels: [
            { id: "left", title: "CHART", row: 0, column: 0, view: @queue_bars },
            { id: "right", title: "TABLE", row: 0, column: 1, view: @queue_table }
        ];
    }
    publication { size: content; fit: none; }
}
```

### 13.20 Geo choropleth (`geo.choropleth@1`, optional ddn-geo module)

```ddn
ddn "0.5";
module "ddn.examples.geo-choropleth";

import "shared.ddn" as shared;

// Choropleth: x joins each record to a geography feature id or name (unique);
// value is a finite number. The shipped world-110m geography joins on the
// ISO 3166-1 numeric id as a string. The CLI pre-registers the geography;
// without ddn-geo.js the view renders a coded placeholder, never a blank.
data indicators {
    object c840 "United States" { kind: record; x_record: { id: "840", value: 86, unit: "index" }; }
    object c156 "China" { kind: record; x_record: { id: "156", value: 74, unit: "index" }; }
    object c356 "India" { kind: record; x_record: { id: "356", value: 58, unit: "index" }; }
    object c276 "Germany" { kind: record; x_record: { id: "276", value: 81, unit: "index" }; }
    object c076 "Brazil" { kind: record; x_record: { id: "076", value: 49, unit: "index" }; }
    object c392 "Japan" { kind: record; x_record: { id: "392", value: 78, unit: "index" }; }
}

view choropleth "Synthetic adoption index / world choropleth" {
    data: [@indicators]; format: @shared.styles.technical;
    projection { kind: geo; profile: "geo.choropleth@1"; records: [@indicators.c840, @indicators.c156, @indicators.c356, @indicators.c276, @indicators.c076, @indicators.c392]; mark: choropleth; geography: "assets/geo/world-110m.json"; method: equalEarth; x: "x_record.id"; value: "x_record.value"; unit: "index"; width: 1120px; height: 640px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
```

### 13.22 Isometric chart and diagram (optional ddn-iso module)

```ddn
ddn "0.5";
module "ddn.examples.iso";

import "shared.ddn" as shared;

// iso: true + depth extrude chart marks (bar/pie/donut/area/treemap) or render
// graph nodes as prisms. depth accepts a px quantity, a number 0..2000, or an
// "x_record.field" per-record binding. Without ddn-iso.js: coded placeholder.
data capacity {
    object web "Web tier" { kind: record; x_record: { tier: "Web", value: 420, load: 26, unit: "req/s" }; }
    object api "API tier" { kind: record; x_record: { tier: "API", value: 610, load: 34, unit: "req/s" }; }
    object db "Database tier" { kind: record; x_record: { tier: "Database", value: 380, load: 18, unit: "req/s" }; }
    relation r1 @web -> @api { kind: flow; }
    relation r2 @api -> @db { kind: flow; }
}

view iso_bar "Synthetic tier throughput / iso bar" {
    data: [@capacity]; format: @shared.styles.technical;
    projection { kind: chart; profile: "chart.basic@1"; records: [@capacity.web, @capacity.api, @capacity.db]; mark: bar; x: "x_record.tier"; y: "x_record.value"; unit: "req/s"; iso: true; depth: "x_record.load"; width: 1120px; height: 640px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view iso_graph "Synthetic tiers / isometric diagram" {
    data: [@capacity]; format: @shared.styles.technical;
    projection { kind: graph; profile: "ddn@1"; iso: true; depth: 18px; }
    publication { size: content; fit: none; overflow: warn; minimum_text: 8pt; }
}
```

### 13.23 Animated pipeline with a flow trace (motion properties + view `flow` block)

```ddn
ddn "0.5";
module "ddn.examples.motion";

import "shared.ddn" as shared;

// motion: flow = travelling markers; pulse = edge pulse (DDN-E014 on bad values).
// flow blocks trace multi-hop sequences along visible relations (DDN-E013).
data shop {
    object client "Storefront" { kind: application; }
    object cart "Cart service" { kind: service; }
    object payment "Payment gateway" { kind: service; }
    object orders "Order store" { kind: table; fields { field order_id { key: primary; } field total; } }
    relation checkout "Checkout" @client -> @cart { kind: flow; motion: flow; }
    relation charge "Charge card" @cart -> @payment { kind: flow; motion: flow; marker: square; marker_size: 10; rate: 6; speed: 140; marker_color: "#B45309"; }
    relation persist "Persist order" @cart -> @orders { kind: flow; motion: pulse; pulse_color: "#0E7490"; }
}

view traces "Synthetic checkout / animated flow" {
    data: [@shop];
    format: @shared.styles.technical;
    flow purchase "Purchase path" {
        steps: @shop.client -> @shop.cart -> @shop.payment;
        marker: circle; marker_color: "#B91C1C"; speed: 90;
    }
    legend { placement: bottom; }
}
```

### 13.25 Self-contained multi-module file (no imports)

```ddn
ddn "0.5";

// One file, three module sections; sibling sections reference by module-qualified id.

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

```

View-local overrides stack over the bundle (e.g. add `display { fields: none; }` inside a view to compact it).

Check with an explicit view: `cli.js check main.ddn --workspace <dir> --view overview`. Without `--view`, the CLI builds the first view of the entry file's FIRST module — `shop.model` declares no view, so a bare `check` fails with DDN040 even though the file is valid.

## 14. Embedding / runtime API summary

Runtime modules (`notation/runtime/`, dependency-free ES modules sharing namespaces via an explicit module registry; `notation/runtime/assets/` is generated — do not hand-edit):

| module | global | contents |
|---|---|---|
| ddn-contracts.js | DDNContracts | semantic/property/extension validation — load before ddn-core |
| ddn-profiles.js | DDNProfiles | profile catalogue merge + profile validators |
| ddn-profile-quality.js | DDNProfileQuality | additive profile-completion validators |
| ddn-core.js | DDN | lex/parse/bundle/createWorkspace/build, DEFAULTS/CHOICES/PROPERTIES, `quantity`, `semanticJSON`, `DDNError`, VERSION 0.7.0 |
| ddn-text.js | DDNText | text measurement (`FONTS` roles, `setMetrics`, `setProvider`) |
| ddn-shapes.js | DDNShapes | silhouettes/anchors |
| ddn-sketch.js | DDNSketch | seeded hand-drawn strokes (needed for `look: handDrawn`) |
| ddn-palette.js | DDNPalette | fixed themes/semantic colours |
| ddn-layout.js | DDNLayout | placement algorithms, port assignment, orthogonal + curved routing |
| ddn-patterns.js | DDNPatterns | pin-preserving pattern placements |
| ddn-placement.js | DDNPlacement | placement orchestration + retained `layoutState` |
| ddn-render.js | DDNRender | native SVG graph renderer |
| ddn-engine.js | DDNEngine | projection renderer registry/dispatcher; profile-aware label enrichment |
| ddn-projection-data.js | DDNProjectionData | typed projection plans (`plan`, `get`, `supported`) |
| ddn-quality-data.js | DDNQualityData | quality/lifecycle/decision/fishbone/CPM plan builders |
| ddn-quality-render.js | DDNQualityRender | native quality/matrix renderers |
| ddn-projections.js | DDNProjections | data-bound SVG projections (`render`, `vegaLite`) |
| ddn-interaction.js | DDNInteraction | experimental interaction/sequence-lane profile |
| ddn-export.js | DDNExport | allowlist export: `project(ir)`, `serialize(ir)` (JSON or SQL DDL) |
| ddn-defaults.js | DDNDefaults | read-only per-kind defaults: `forKind(idOrKeyword)` → deep copy |

Distribution bundles (`notation/dist/`): `ddn-core` (parse/build/validate/export, no rendering); `ddn-graph` (+ graph renderer); `ddn-quality` (+ fishbone/decision); `ddn-projections` (+ chart/matrix/panels/timeline/table/sequence/timing/chen); `ddn-geo`/`ddn-iso` (optional, never in `ddn.global.js`); `ddn.global.js` = everything else. Each ships IIFE `.js`, minified `.min.js` + map, ESM, and TypeScript declarations. `DDNEngine` throws DDN-E010 naming a missing bundle — except geo/iso, which render coded placeholders (§5, §7.7). Geography data ships separately as `assets/geo/world-110m.json` (~96 KB, Natural Earth): name it via `geography: "assets/geo/world-110m.json"` (register first with `DDNGeo.registerGeography(name, geojson)`; the CLI pre-registers it) or bind inline GeoJSON via `geography: @data.record`.

Core API essentials: `DDN.parse(text, name)` → parsed doc (throws `DDNError`); `DDN.build(files, entry, viewName, registry)` → `{ir, workspace}` (`files` = `{path: sourceText}`; runs all validators); `DDN.bundle` → `{text, diagnostics}`; `DDNExport.serialize(ir)` → JSON or SQL DDL; `DDN.semanticJSON(ir)` → canonical payload (basis of `modelFingerprint`).

Live API (`DDNLive`): `createWorkspace({filename: text})` → `entries()`, `views(entry)`, `analyze`, `resolve`, `inspect`, `renderSync({entry, view, overrides, layoutState})` → `{svg, scene, diagnostics, layoutState, modelFingerprint, …}` (`render` async alias), `exportModel`, `exportVegaLite`, `evaluateDecision`, `simulateLifecycle`, `projectionPlan`, `updateFiles`, `applyEdits`, `snapshot`, undo/redo, `subscribe`. Module-level: `parse`, `lex`, `bundle`, `registerWorkspace`, `fromSnapshot`, `defaults.forKind`, `kinds`/`relations`, `glyphs.forKind`.

**Data refresh (keyed transactional)** — `ws.replaceData(name, records)` → `{ committed, revision, added, removed, updated, diagnostics }`; the full contract is §7.4. Usage:

```js
const r = ws.replaceData("metrics", rows);        // rows: plain objects, optional key
if (!r.committed) console.error(r.diagnostics);   // structured DDN-E011/E012
const out = ws.renderSync({ entry, view: "latency_chart" });
host.innerHTML = out.svg;
```

**Overrides channel** (`renderSync` `overrides`; unknown keys → LIVE001, bad values → LIVE002/003): toggles keyed by concern — `placement`, `center`, `theme`, `look`, `font`, `routing`, `crossings`, `fields`, `domains`/`datatypes`, `labels`, `kind`, `page`, `mark` (chart), `relationRouting`, numeric `width`/`height` 400..32000, `roughness` 0..3, `fontSize` 8..64, `gridStep` 8..512, `depth` 0..64, `curveTension` 0..1, `curveRadius` 0..512, booleans `autoPlace`/`hachure`. Data-bound/chen projections reject graph controls (LIVE021). Limits: 128 elements / 384 relations per live view (LIVE013); 1,500 files / 12M chars per workspace (LIVE011).

CSS hooks on rendered SVG: root `ddn-svg ddn-view-<kind> ddn-profile-<slug>`; nodes `ddn-node ddn-kind-<code>` + `data-ddn-id`; relations `ddn-rel ddn-verb-<slug>`; `ddn-field`, `ddn-label`, `ddn-panel`, `ddn-frame`, `ddn-mark ddn-mark-<type>`. Slugs lowercase with non-alphanumeric runs collapsed to dashes.

<!-- generated: do not edit (grammar) -->
## 15. Appendix — full grammar (standard/grammar/ddn.ebnf, verbatim)

```ebnf
(* DDN 0.5 syntactic core. Context and property restrictions are in spec/01-language.md.
   Whitespace/comments are skipped between terminals. All files are UTF-8.
   a file holds one or more module sections. File-level imports come
   before the first module header (canonical) or immediately after the FIRST
   header before its first declaration (legacy position, kept for existing
   single-module files); anywhere else an import is rejected (DDN015). *)
document       = "ddn", string, ";", { import }, section, { section } ;
section        = "module", string, ";", { top } ;
import         = "import", string, "as", identifier, ";" ;
top            = data | records | format | view | reuseDefinition ;
(* B1-041 compact authoring, phase 5 (workspace-assembly desugar to the
   identical canonical AST as the handwritten inline form; see
   spec/01-language.md): author-controlled reuse. Definitions are top-level
   closed templates; `use: @name;` (or `use: [@a, @b];`) inside a data or
   records block applies a fragment, inside a fields/ports group applies a
   member group of the same kind, and inside an element/relation/flow body
   applies a property preset (relation_props applies to relations only).
   Expansion precedes indexing, so expanded identities are exactly as
   declared inline. Local properties override presets; two presets
   conflicting on a property are a coded error (DDN-E017) unless resolved
   locally; preset-applied properties are ASSERTED, never omitted, and only
   the named definitions' own properties apply. `version: N` on a
   definition is an optional documentary integer, ignored semantically.
   use: inside a definition body, in a batch header, or in a
   non-application context is a coded error (DDN-E017). Parameterized
   fragments are deferred (DDN-GAPS.md). *)
reuseDefinition = ( "fields" | "ports" | "relation_props" | "preset" | "fragment" ), identifier, [ string ], block ;
useApplication = "use", ":", ( reference | "[", reference, { ",", reference }, "]" ), ";" ;
data           = "data", identifier, [ string ], block ;
format         = "format", identifier, [ string ], block ;
view           = "view", identifier, [ string ], ( block | viewHeader ) ;
block          = "{", { member }, "}", [ ";" ] ;
member         = property | declaration | typedDeclaration | compactRelation | relationBatch | contextualMember | targetDeclaration | flowDeclaration | useApplication | group ;
property       = identifier, ":", value, ";" ;
declaration    = identifier, identifier, [ string ], [ endpoints ], ( block | ";" ) ;
(* B1-037 compact authoring, phase 1 (parser desugars both forms to the
   canonical declaration AST; see spec/01-language.md):
   - typedDeclaration: a registry object-kind keyword (or declared alias) in
     declaration position inside a data block introduces an object of that
     kind. `table customer "Customer" {…}` ≡ `object customer "Customer"
     { kind: table; … }`. Kind words are contextual: recognized only at
     data-child statement start followed by an identifier, and never when the
     word is a structural declaration keyword (object, domain, sample, flow,
     assertion, relation) — so `object table "…"` still parses. Extension
     (dotted) kinds are expressible only through a registry-declared `alias`.
   - contextualMember: inside fields {}/ports {} groups, a bare
     `id ["label"] (block | ";")` is a field/port member. The explicit
     field/port keywords remain valid (mixed blocks allowed); a nested group
     keyword (`fields {…}`) still reads as a group. *)
typedDeclaration = kindKeyword, identifier, [ string ], ( block | ";" ) ;
contextualMember = identifier, [ string ], ( block | ";" ) ;
kindKeyword    = identifier ; (* any registry object-kind keyword or alias matching identifier *)
(* B1-038 compact authoring, phase 2 (same desugar rule as phase 1):
   - compactRelation: a registry relationship keyword (or declared alias) in
     declaration position inside a data block introduces a relation of that
     kind, with optional per-endpoint cardinality brackets:
     `ref places "places" @customer [one] -> @purchase [zeromany]
     { enforcement: database; }` ≡ `relation places "places" @customer ->
     @purchase { kind: ref; source_mark: one; target_mark: zeromany;
     enforcement: database; }`. Each bracket is optional; an OMITTED bracket
     omits the mark property (never defaulted), and enforcement is never
     implied. A word that is both an object-kind word and a relationship word
     (note, report, test, …) reads as a relation ONLY when endpoints follow
     the id/label; the structural keywords (flow, domain) never act as verbs.
   - relationBatch: `relations <kind> { shared props; id ["label"] endpoints
     [ marks ] (block | ";"); … }` expands to one canonical relation per
     entry; the header fixes the kind (writing kind: inside is DDN011),
     batch-shared properties merge UNDER per-entry properties (per-entry wins
     on conflict), and identity is never positional — each entry carries its
     own id, label and endpoints. *)
compactRelation = verbKeyword, identifier, [ string ], reference, [ mark ], "->", reference, [ mark ], ( block | ";" ) ;
relationBatch  = "relations", verbKeyword, "{", { property | batchEntry }, "}", [ ";" ] ;
batchEntry     = identifier, [ string ], reference, [ mark ], "->", reference, [ mark ], ( block | ";" ) ;
verbKeyword    = identifier ; (* any registry relationship keyword or alias matching identifier *)
mark           = "[", identifier, "]" ; (* desugars to source_mark / target_mark *)
(* B1-039 compact authoring, phase 3 (same desugar rule as phases 1–2):
   one-line view headers. `view erd: @sales as "erd.crowfoot@1";` ≡
   `view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }`.
   The datasource is a single reference or an explicit list; the label keeps
   its existing position after the id. The header supplies data (+ projection
   when `as` is present) only; an optional body merges exactly like canonical
   properties/groups. The versioned profile string uniquely identifies the
   projection kind (verified against registry/profiles/catalogue.json); an
   unknown or ambiguous profile string is a coded parse error (DDN-E015), and
   a body projection block/property after `as` conflicts with the header
   (DDN-E015). Omitting `as` mirrors a view without a projection block
   exactly (defaults apply at build). *)
viewHeader     = ":", viewData, [ "as", string ], ( block | ";" ) ;
viewData       = reference | "[", [ reference, { ",", reference } ], "]" ;
(* B1-040 compact authoring, phase 4 (same desugar rule as phases 1–3):
   keyed tabular records. A `records` block is a data block whose column order
   is declared once; each `row <id>:` desugars to the identical canonical
   `object <id> "<label>" { kind: record; x_record: { <column>: <value>, … } }`
   declaration — per-row identity, column order, scalar types and the
   missing/null/undecided distinction preserved, so projections and the B1-029
   keyed refresh (row ids ARE the record keys) are unchanged. Row values are
   scalar literals only (string, number, quantity, boolean, null, missing,
   undecided, not_applicable, conflicting, or a bare word — no references,
   arrays or nested records). The optional label_column names the column that
   supplies each row's display label (string or finite number; any other
   scalar falls back to the row id); without it the label is the row id.
   A column count mismatch is a coded parse error (DDN-E016) naming the row
   and the expected/actual counts; a row's optional body carries extra
   PROPERTIES only (merged onto the record object; kind:/x_record: inside is
   a duplicate — DDN011; nested declarations are DDN-E016). Canonical data
   members (object/relation declarations, typed declarations, relation
   batches) mix into a records body freely, which is what lets the refresh
   tool append and rewrite records in canonical form. *)
records        = "records", identifier, [ string ], "{", { recordsMember }, "}", [ ";" ] ;
recordsMember  = columnsDecl | labelColumnDecl | recordRow | typedDeclaration | compactRelation | relationBatch | useApplication | declaration ;
columnsDecl    = "columns", ":", identifier, { ",", identifier }, ";" ;
labelColumnDecl = "label_column", ":", identifier, ";" ;
recordRow      = "row", identifier, ":", scalar, { ",", scalar }, ( block | ";" ) ;
scalar         = string | quantity | number | atom ;
targetDeclaration = ( "place" | "route" ), reference, block ;
flowDeclaration = "flow", identifier, [ string ], block ;
steps          = "steps", ":", reference, { "->", reference }, ";" ;
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
   Endpoint syntax is legal only on relation declarations in the core.
   B1-033: a view-level flow block (multi-hop motion sequence) declares its hop chain
   with the steps production above; steps must resolve to selected elements joined by
   existing visible relations in their declared direction. *)
```
<!-- /generated (grammar) -->
