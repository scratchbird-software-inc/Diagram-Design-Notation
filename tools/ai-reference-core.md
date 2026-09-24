# DDN (Diagram Design Notation) — AI Authoring Reference

**ScratchWeaver** — the Diagram Design Notation (DDN) toolkit from ScratchBird Software Inc. The language itself is named DDN (Diagram Design Notation); ScratchWeaver is the product (reference runtime, CLI, Studio, and dist bundles) described here.

Single self-contained reference for generating valid `.ddn` files. Derived entirely from the authoritative repository sources of DDN runtime **{{RUNTIME_VERSION}}** (`notation/runtime/*`, `notation/cli/cli.js`, `notation/studio/src/api.js`) and standard **0.3/0.5** (`standard/grammar/ddn.ebnf`, `standard/specification/*`, `standard/registry/catalogue.json`, `standard/registry/profiles/catalogue.json`, `standard/registry/data-properties.json`). Vocabulary tables below are machine-extracted from those registry/runtime files, not paraphrased.

<!-- @gen:counts -->

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

Compact authoring (phase 1, purely additive — both forms desugar in the parser to the IDENTICAL canonical declarations; semantic model, rendered SVG and validation are indistinguishable):

- Typed declarations: any registry object-kind keyword may be the declaration keyword inside a data block — `table customer "Customer" { … }` ≡ `object customer "Customer" { kind: table; … }`. Registered aliases spell the same kind (`tbl customer {…}`). Do NOT repeat `kind:` in the body (duplicate property, DDN011). Dotted extension kinds (`uml.actor`, `flow.start`) are usable only through a registry-declared `alias` (e.g. `uml.actor` declares `actor`, so `actor customer {…}` ≡ `kind: "uml.actor"`).
- Disambiguation: kind words are contextual — recognized only at data-child statement start followed by an identifier. Structural keywords (`object`, `domain`, `sample`, `flow`, `assertion`, `relation`) always keep their meaning, so `object table "…" { kind: table; }` (an object NAMED `table`) still parses. The `view`/`field` kind words are typed declarations only inside data blocks.
- Contextual members: inside `fields {}`/`ports {}` the member keyword may be omitted — `fields { id { key: primary; } name; }` ≡ `fields { field id { key: primary; } field name; }`. Explicit `field`/`port` remains valid and mixes freely; a nested `fields {…}` keyword still reads as a group.
- Verb relations (phase 2): any registry relationship keyword may be the declaration keyword — `ref places "places" @customer [one] -> @purchase [zeromany] { enforcement: database; }` ≡ `relation places "places" @customer -> @purchase { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; }`. Brackets are optional per side; an OMITTED bracket omits the mark property (never defaulted); enforcement is never implied. Aliases work (`transfers_to` ≡ flow); extension relation kinds opt in via registry `alias` (`req.satisfies` declares `satisfies`). Words registered as both kind and verb (`note`, `report`, `test`, …) are relations only when `@` endpoints follow; `flow`/`domain` stay structural.
- Named batches (phase 2): `relations depends { enforcement: undecided; dep_a "a" @x -> @y; dep_b "b" @y -> @z { lane: hot; } }` expands to one canonical relation per entry, kind from the header (writing `kind:` inside is DDN011), shared properties merge UNDER per-entry ones (per-entry wins). Identity is never positional — every entry has its own id/label/endpoints. Anonymous arrow chains are NOT provided.
- View headers (phase 3): `view erd: @sales as "erd.crowfoot@1";` ≡ `view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }`. Datasource is `@name` or `[@a, @b]`; the label keeps its position after the id; an optional body merges like canonical properties/groups (`view erd: @sales as "…" { format: @s; layout {…} }`). The versioned profile string uniquely implies `projection.kind` (registry-verified); unknown/ambiguous profiles and any body `projection` after `as` are coded parse errors (DDN-E015). Omitting `as` ≡ a view without a projection block (defaults apply).
- Keyed tabular records (phase 4): a `records` block is a data block whose column order is declared once — `records metrics { columns: label, value, unit; label_column: label; row m1: "Alpha", 10, "ms"; row m2: missing, null, "ms"; }` — and each `row <id>:` ≡ `object <id> "<label>" { kind: record; x_record: { <column>: <value>, … } }` (per-row identity, column order, scalar types, missing/null/undecided preserved). Row values are scalar literals only (string/number/quantity/boolean/null/missing/state words/bare word); `label_column` supplies the display label (string or finite number, else falls back to the row id; without it the label IS the row id). Row ids are the keyed-refresh record keys; a column count mismatch is a coded parse error (DDN-E016) naming row + expected/actual counts; a row body carries extra PROPERTIES only (`kind:`/`x_record:` inside is DDN011; nested declarations are DDN-E016). Canonical data members mix in freely.
- The normalizer never rewrites verbose↔compact; compactness is an author choice and the corpus canonical form stays explicit-verbose.

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

<!-- @gen:properties -->

<!-- @gen:defaults -->

<!-- @gen:enums -->

<!-- @gen:vocabulary -->

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

<!-- @gen:projection-kinds -->

Common rules: `width`/`height` hints 240..12000 px (DDN-PJ006); measured result extent ≤ 50000 px (DDN-PJ060); reference arrays hold 1..500 unique refs (DDN-PJ009), except chart/table `records: []` which declares an intentional empty state (empty plot with axes for bar/line/area/point; header-only table; DDN-PJ009 otherwise); every bound element must be in the data scope (DDN-PJ007) AND selected in the view (DDN-PJ008); binding strings are dot-separated safe property paths like `x_record.value`, or the special element properties `name`, `id`, `kind` (unsafe paths → DDN-PJ004); filters are `{key, op: eq|in, value}` only (DDN-PJ011); ordering is `{key, direction: asc|desc}` (DDN-PJ011); filtering may not empty the selection (DDN-PJ012). **All non-graph/chen projections are data-bound**: they reject `place`/`route`/`frame`/`subdiagram` geometry and any retained layout state (DDN-PJ002, DDN-PJ051), and cannot combine with interaction (`x_interaction`) layout.

Per-kind summary:

- **graph**: the default. `profile: "ddn@1"` plain DDN, or any graph profile id from the table in 4.5 (section 6 lists enforced rules). `inputs`/`analysis_budget`/`traces` are legal only with `profile: "state.flat@1"` (DDN-Q005) or `pert.cpm@1` CPM enrichment.
- **chen**: `profile: "chen.binary@1"` (scalar subset) or `"chen.binary@2"` (extended). Projects entity objects and binary object-level `assoc`/`ref` relations into Chen occurrences (attribute ovals, association diamonds). Requires only `entity` nodes and binary non-member `assoc`/`ref` edges (DDN-PJ050); the scalar subset also rejects nested/repeated fields. Emits info DDN-PJW01.
- **matrix**: `rows` + `columns` (1..500 refs each; ≤5000 cells, ≤40 columns — DDN-PJ013), `relation` = a registered relationship keyword (DDN-PJ014), `value` = binding for cell text, `duplicates: error|join` (`join` only on `matrix.relations@1`, `matrix.bcg@1`, `matrix.ansoff@1`, `matrix.tows@1`, `matrix.storymap@1` — RACI/CRUD require one assignment per cell), optional `encoding` (numeric/category/bands with explicit domain/values/boundaries + labels; palette `blue|diverging`; DDN-QM001/QM002). Cells are relations row→column of the declared kind. Quadrant profiles (`matrix.bcg@1` growth×share high/low, `matrix.ansoff@1` market×product existing/new, `matrix.tows@1` internal strength/weakness × external opportunity/threat) require rows/columns to be exactly the named categories via `x_category` (DDN-PJ082). `matrix.raci@1` rows need exactly one `A`, ≥1 `R`, only R/A/C/I (DDN-PJ016); `matrix.crud@1` values are distinct C/R/U/D letters (DDN-PJ017); `matrix.storymap@1` uses `assoc` cells carrying `x_story.task` refs to `analysis.task` (DDN-PJ014/PJ093), one cell per story per release (DDN-PJ086).
- **table**: `records` + `columns: [{key, label}]` (1..30, unique — DDN-PJ018); `missing: error|blank` (DDN-PJ019); values must be scalar.
- **panels**: `columns` 1..12, `panels: [{id, title, row, column, rowspan?, colspan?, items?, view?}]` (1..80 panels, no overlaps — DDN-PJ020/PJ021). Canvas profiles require fixed panel sets (DDN-PJ080/081/083): `canvas.bmc@1` = kp, ka, kr, vp, cr, ch, cs, cost, rev; `canvas.lean@1` = problem, solution, keymetrics, uvp, unfair, channels, segments, cost, revenue; `canvas.pest@1` = political, economic, social, technological; `canvas.pestle@1` adds legal, environmental; `canvas.porter5@1` = entrants, supplier, rivalry, buyer, substitutes; `canvas.empathy@1` = says, thinks, persona, does, feels; `canvas.scorecard@1` = financial, customer, internal, learning. `panels.journey@1`: 2..8 phase columns; row 0 = `phase-<slug>` panels; rows 1..3 = `actions|touchpoints|opportunities-<phase>`; row 4 = single full-width `emotions` panel whose items carry `x_record.phase` + `x_record.value` in 1..5 (DDN-PJ084/PJ085). `panels.pyramid@1`: 3..5 bands, single column, contiguous rows (DDN-PJ089). `panels.venn@1`: 2..3 sets; item membership via `x_sets` must match panel listing (DDN-PJ090/PJ091). `panels.composed@1`: panels with `view:` embed child views (one level only, ≤12 children, child ≤128 elements/384 relations — DDN-QP001..003).
- **chart**: marks `bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey` plus the B1-024 Category-2 pack `histogram, density, qq, quantiledot, dotplot, boxplot, violin, beeswarm, topk, tidytree, radialtree, circlepack, sunburst, packedbubble, heatmap, densityheatmap, calendar, parallelcoords, wordcloud, arc, force, edgebundle` (DDN-PJ030); overlays `error:"binding"` (I-beam error bars on bar/point, DDN-PJ141) and `trend:linear|loess` (least-squares / tricube loess span 0.3 on numeric point/line, DDN-PJ142); distribution marks bind only numeric x (no y/series, DDN-PJ134; bin_count integer, DDN-PJ131; zero-variance is UNKNOWN, DDN-PJ132; k/others for topk, DDN-PJ133; sample-size and grid caps, DDN-PJ135; hierarchy values nonnegative, DDN-PJ136; duplicate heatmap cells/calendar days/wordcloud words, DDN-PJ137; wordcloud weights positive, DDN-PJ138); `x_type: category|number|date`; explicit `x` and `y` bindings (candlestick uses `open/high/low/close`); `y` must be finite numeric, no string coercion (DDN-PJ032); date x must be real ISO `YYYY-MM-DD` (DDN-PJ033); `aggregate: none|sum|count|min|max|mean` on category bars/arcs only (DDN-PJ031); duplicate categories require an aggregate (DDN-PJ036); `missing: error|skip` (DDN-PJ019); `unit` requires matching `x_record.unit` on every record (DDN-PJ034); `inner_radius` 0..0.9 exclusive. Mark-specific: point requires x_type number; pie/donut/bar/radar/funnel require categorical x; radar ≥3 categories, series key ≤80 chars (DDN-PJ071/072/030); funnel ≥2 distinct stages, no series, nonnegative (DDN-PJ073/PJ107); gauge exactly one record, value 0..100, optional numeric `target` 0..100 (DDN-PJ074/075); candlestick high≥low and open/close within [low,high], x not number (DDN-PJ076/077); treemap dotted paths ≤3 levels, nonnegative, no aggregation/series (DDN-PJ078/PJ031); sankey categorical endpoint text x + `target` binding, positive values, acyclic (DDN-PJ108/PJ079).
  - **chart.quality@1** (and any chart with series/arrangement/transform/layers/bins/normalize/whiskers/quartiles/step/target, except gauge/sankey) adds: `transform: identity|histogram|pareto|waterfall|boxplot` (DDN-QC001), quality marks `bar|line|area|point|box`; histogram needs 2..101 increasing `bins`, `normalize: count|proportion|density`, `outside: error|exclude` (DDN-QC010/QC011); pareto needs nonnegative values with positive total (DDN-QC012); waterfall needs a `step` binding (`delta|subtotal|total`) and declared totals must match cumulative deltas (DDN-QC013/QC014); boxplot quartiles `linear_r7`, whiskers `tukey_1_5|minmax` (DDN-QC015); multi-series: ≤20 series × ≤200 categories, `arrangement: group|stack|percent|overlay`, one `layers` entry per series with mark bar|line|area|point, stacked/percent all-bars-or-areas, `series_missing: gap|zero|error`, duplicates need aggregate (DDN-QC020/QC021/QC022).
- **timeline**: `records` with `start`/`end` ISO date bindings (end ≥ start, DDN-PJ040); optional `dependencies` refs to visible `precede`/`analysis.precedes` relations that must not contradict dates (DDN-PJ041/PJ042) and must be acyclic (DDN-PJ043); `label` binding optional.
- **sequence** (`uml.sequence@1`): participants = selected object declarations in declaration order (lifelines); messages = visible `uml.message` relations, ordered top-to-bottom in declaration order; `x_return: true` draws dashed return; endpoints must be selected objects (DDN-PJ110).
- **timing**: participants carry `x_states: [{at: finite number, state: nonempty string}, …]` with strictly increasing `at` (DDN-PJ118).
- **fishbone**: `effect` ref to a `quality.effect` element; `relation` = named cause relation; first-level ribs must be `quality.category` (1..12); acyclic, ≤4 cause levels, ≤250 occurrences, all selected cause relations connected (DDN-QF001..004).
- **decision**: `inputs: [{key, type: enum|boolean|number, values?|min/max?, nullable?, optional?}]` (1..8, DDN-QD001), `outputs: [1..20 keys]`, `records` = rule elements carrying `x_rule: {when, then}` where `when` predicates use `op: eq|in|interval|null|missing` within declared domains (DDN-QD002), every rule supplies every output (DDN-QD003); `hit_policy: unique|first|collect`, `coverage: complete|report|none`, `analysis_budget` 1..50000 (default 4096); overlap under `unique` → DDN-QD004; uncovered witness under `complete` → DDN-QD005; budget exceeded blocks proofs → DDN-QD008.
- **geo** (optional ddn-geo module; `geo.choropleth@1`, `geo.symbols@1`, `geo.outline@1`): `geography` (registered name/URL or inline `@record` GeoJSON — DDN-PJ144), `method: mercator|equirectangular|albers|equalEarth` (default mercator; albers uses standard parallels 29.5°/45.5° and fits to latitudes −60..85 so whole-world fits are not pole-arc dominated; DDN-PJ143 on unknown), `mark: choropleth|symbol|outline` (default from profile), `graticule: true|false`. Choropleth binds `x` (join key → feature id or name, unique — DDN-PJ148) + `value` (finite number — DDN-PJ145); unmatched features render neutral and unmatched records/features are reported via DDN-PJW05 (info). Symbol binds `x`=lon/`y`=lat in range, optional `size` (DDN-PJ146), radius sqrt-scaled. GeoJSON ingestion accepts Feature/FeatureCollection with Polygon/MultiPolygon/Point/MultiPoint (DDN-PJ147 on others); coordinates must be finite in-range pairs (DDN-PJ146); antimeridian crossings split the path instead of streaking. Rendering a geo view **without** ddn-geo.js yields the inline placeholder ("Map view requires ddn-geo.js") + coded DDN-E010 diagnostic; planning stays a hard DDN-E010.
- **iso/depth** (optional ddn-iso module, B1-034; graph and chart projections only): `iso: true|false` (default false) and `depth` (px quantity or number 0..2000, per-record `"x_record.field"` binding, or `@data.record.field` view binding — DDN-ISO151 on bad forms, DDN-ISO152 when the binding is not a finite 0..2000 number; `iso` non-boolean or on other kinds → DDN-ISO150). Charts: bar/pie/donut/area/treemap extrude (axes stay flat; other marks warn DDN-ISOW01 and render flat). Graphs with `iso: true`: nodes render as extruded prisms on an iso ground plane (per-object `depth:` overrides the view depth), relations are routed flat then projected onto the ground plane (never 3D routing); frames/subdiagrams omitted (DDN-ISOW02). Missing module: `iso: true` → visible placeholder "Isometric view requires ddn-iso.js" + coded DDN-E010; `depth` alone → flat render + DDN-E010 warning. Refresh transitions: `renderSync({isoFrom:{depths}})` after `replaceData` → one-shot 250 ms SMIL; `noMotion` strips it.
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

<!-- @gen:diagnostics -->

## 9. Embedding / runtime API summary

Runtime modules (`notation/runtime/`, real ES modules, no dependencies): cross-module wiring goes through an explicit module registry (`ddn-module-registry.js`: `publishNamespace`/`namespace`/`optionalNamespace`, one store per realm shared via `globalThis`), so script-tag, CJS `require`, ESM `import`, and `vm` consumers all find the same namespaces. Bundle entries publish the documented browser globals (DDNLive, DDNRender, …) from those namespaces; module code never reads host globals directly. Registry assets under `notation/runtime/assets/` (`catalogue.js`, `glyphs.js`, `profiles-catalogue.js`) are generated ESM (`tools/build-assets.js` from `standard/registry/` — do not hand-edit). Per-module contents:

| module | global | contents |
|---|---|---|
| ddn-contracts.js | DDNContracts | semantic/property/extension validation (`validate`, `schemaErrors`, workflow/guard evaluators) — load before ddn-core |
| ddn-profiles.js | DDNProfiles | profile catalogue merge (`registry(base)`) + profile validators (`validate`, `get`) |
| ddn-profile-quality.js | DDNProfileQuality | additive profile-completion validators |
| ddn-core.js | DDN | lex/parse/bundle/createWorkspace/build, `DEFAULTS`, `CHOICES`, `PROPERTIES`, `quantity`, `semanticJSON`, `DDNError`, VERSION {{RUNTIME_VERSION}} |
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

Distribution bundles (`notation/dist/`, built with Rollup via `tools/build-sdk.js` / `npx rollup -c tools/rollup.config.mjs`; entries in `tools/rollup/entries/`). Each bundle ships: a readable browser IIFE `.js` (identical globals/load-guards to the historical concatenated builds), a minified `.min.js` with `.min.js.map` (terser), an ES module build, and TypeScript declarations `.d.ts` (CJS) + `.d.mts` (ESM). For the four modular bundles the ESM build is `ddn-<name>.mjs` with sibling-bundle imports that resolve relative to `dist/`; the all-in-one ESM entry is `ddn.mjs` (there is no `ddn.global.mjs`). The bundles: `ddn-core` = defaults/quality-data/projection-data/profile-quality/profiles/contracts/core/patterns/export/engine — parse/build/validate/export plus the workspace API, no rendering; `ddn-graph` = core + palette/text/sketch/shapes/layout/placement/render + interaction — the graph renderer, registers the `graph` projection kind; `ddn-quality` = graph + quality renderers (quality charts, decision tables, fishbone) — registers the `fishbone` and `decision` kinds, which compose through ddn-projections; `ddn-projections` = graph + data-bound projections (chart/matrix/panels/timeline/table/sequence/timing/chen); `ddn-geo` = graph + the **optional** geographic module (projection math: mercator/equirectangular/albers/equalEarth; GeoJSON ingestion; choropleth/symbol/outline rendering) — registers the `geo` kind with `optional: true`, never embedded in `ddn.global.js`; `ddn-iso` = graph + the **optional** isometric module (B1-034: axonometric 30° math, face shading, painter's-order composition; bar/pie/donut/area/treemap extrusions; iso graph prisms) — publishes `DDNIso`, registers no kind, never embedded in `ddn.global.js`; `ddn.global.js` = everything except ddn-geo and ddn-iso in one file. The all-in-one ESM entry is `ddn.mjs` (types `ddn.d.mts`); `notation/package.json` exposes the bundles through an `exports` map — `"."` → `dist/ddn.mjs` (import) / `dist/ddn.global.js` (require), plus `"./core"`, `"./graph"`, `"./projections"`, `"./quality"`, `"./geo"`, `"./iso"` → the matching `.mjs`/`.js` with per-format `types` — and declares `sideEffects: ["dist/*.js"]` so bundlers tree-shake the ESM builds while preserving the IIFE guard side effects. `ddn.css` = optional CSS custom-property hook stylesheet. `DDNEngine` maps projection kinds to bundles: graph→ddn-graph.js; chart/matrix/panels/timeline/table/sequence/timing/chen→ddn-projections.js; fishbone/decision→ddn-quality.js (loaded alongside ddn-projections); geo→ddn-geo.js (optional); iso→ddn-iso.js (optional, engine-routed namespace, no kind). Missing bundle → DDN-E010 naming the bundle to load — except the optional `geo` kind, which renders a visible inline SVG placeholder ("Map view requires ddn-geo.js") and surfaces the coded DDN-E010 through the diagnostics channel (never silent), and `iso: true` views, which render the analogous "Isometric view requires ddn-iso.js" placeholder (a `depth` property without ddn-iso degrades to the flat render + a coded DDN-E010 warning); every other kind keeps the hard throw. Geography data ships separately as the optional `assets/geo/world-110m.json` asset (~96 KB, Natural Earth 110m, built by `tools/build-geo-assets.mjs`); views name it via `geography:"assets/geo/world-110m.json"` (hosts register it first with `DDNGeo.registerGeography(name, geojson)`; the CLI pre-registers it) or bind inline GeoJSON via `geography: @data.record`.

Core API essentials:
- `DDN.parse(text, name)` → `{version, module, imports, sections: [{module, declarations}], declarations, …}` (throws `DDNError`).
- `DDN.build(files, entry, viewName, registry)` → `{ir, workspace}`; `files` is `{path: sourceText}`; runs all validators, throws `DDNError`.
- `DDN.bundle(files, entry)` → `{text, diagnostics}` self-contained multi-module file.
- `DDNExport.serialize(ir)` → JSON string (or SQL DDL when `export.format: sql`).
- `DDN.semanticJSON(ir)` → canonical semantic payload (basis of `modelFingerprint`).

Live API (`DDNLive`, `notation/studio/src/api.js`): `DDNLive.createWorkspace({filename: text})` → workspace with `entries()`, `views(entry)`, `analyze(file)`, `resolve(entry, view)`, `inspect(entry, view)` (capabilities/profiles/fingerprint/dependencies), `renderSync({entry, view, overrides, layoutState})` → `{svg, scene, diagnostics, layoutState, modelFingerprint, capabilities, keys, sourceMap, …}`, `render` (async alias), `exportModel`, `exportVegaLite`, `evaluateDecision`, `simulateLifecycle`, `projectionPlan`, `updateFiles`, `applyEdits` (structured text edits), `snapshot`, undo/redo, `subscribe`. Module-level: `DDNLive.parse`, `DDNLive.lex`, `DDNLive.bundle(files, entry)` (also exposed as `io.bundle`), `DDNLive.registerWorkspace(id, files)`, `DDNLive.fromSnapshot`, `DDNLive.defaults.forKind`, `DDNLive.kinds`/`relations` (id/label/code lists), `DDNLive.glyphs.forKind(kindId)`.

**Data refresh (B1-029, keyed transactional)** — `ws.replaceData(name, records)` → `{ committed, revision, added, removed, updated, diagnostics }` (strict superset of the old `{revision, diagnostics}`). Contract: records carry the same field keys as the block's first record (DDN-E011); optional per-record `key` field matches declaration ids (all-or-nothing, valid unique identifiers, stripped from payload; unknown key appends a declaration with that id) — positional fallback without keys is order-sensitive. Field values are type-checked against inferred block field types (`null` = UNKNOWN, accepts anything) and every workspace view is validated on the candidate source BEFORE commit; failure → `committed:false`, source/revision untouched, structured DDN-E012 diagnostics (`type-mismatch`, `removed-record-referenced`, `view-validation`, `source-validation`) naming view/record/field. Removing a view-referenced record is rejected (D4). Membership re-resolved: selector views (`data: [@block]`) pick up additions; explicit-binding views keep exactly their bound records and get DDN-W015 `addedRecordsNotVisible`. Empty refresh is legal (subject to removal rule): graph renders empty canvas; chart/table authored with `records: []` render empty plot with axes (bar/line/area/point) / header-only table; filter-to-empty still fails DDN-PJ012. Regression suite: `notation/tests/data-refresh.js`; docs: spec §20 (data refresh), `website/docs/developers/data-refresh.md`.

**Overrides channel** (`renderSync` `overrides` record; unknown keys → LIVE001, bad values → LIVE002/003). Keys and allowed values: `endpointOrdering: source|optimize|preserve`; `placement: source|auto|grid|manual|fit_grid|circular|radial|layered|tree|spanning_tree|mindmap|grouped|organic`; `center: source|pins|content`; `theme: source|default|base|neutral|dark|night|forest`; `look: classic|handDrawn|neo`; `font: source|sans|serif|mono|handwriting`; `routing: source|orthogonal|straight|curved|rounded` (`rounded` = curved + rounded corners); `crossings: source|gap|bridge|square_bridge`; `fields: source|names|none`; `domains`/`datatypes: source|show|hide`; `labels: source|numbers|text|tokens`; `kind: source|icon_token|icon|text|none`; `page: source|content|web|a4-landscape|a4-portrait|letter-landscape|letter-portrait|custom`; `mark: source|bar|line|area|point|pie|donut` (chart only, capability-dependent); numeric ranges: `width`/`height` 400..32000, `roughness` 0..3, `fontSize` 8..64, `gridStep` 8..512, `depth` 0..64 (integer), `curveTension` 0..1, `curveRadius` 0..512; booleans: `autoPlace`, `hachure`; `relationRouting`: record keyed by verb or relation id (relation id wins over verb) with values `orthogonal|straight|curved|rounded` (LIVE022/023). Data-bound/chen projections reject graph controls (LIVE021); sequence/interaction projections retain fixed lanes and typography (LIVE020). Live view limit: 128 elements / 384 relations (LIVE013); workspace limit 1,500 files / 12M chars (LIVE011).

CSS hooks on rendered SVG: root `ddn-svg ddn-view-<kind> ddn-profile-<slug>`; nodes `ddn-node ddn-kind-<code>` + `data-ddn-id`; relations `ddn-rel ddn-verb-<slug>`; `ddn-field`, `ddn-label`, `ddn-panel`, `ddn-frame`, `ddn-mark ddn-mark-<type>`. Slugs lowercase with non-alphanumeric runs collapsed to dashes.

## 10. Worked examples (all verified with `cli.js check` AND `cli.js render`)

Each example below is extracted by the generator and must pass BOTH `node notation/cli/cli.js check <f> --workspace <tmpdir>` AND `... render <f> --workspace <tmpdir> --view <each-view>` (with `shared.ddn` alongside where imported); the build fails if any example fails. Comments annotate the language features.

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

## 11. Task quick references

Compact recipes for the four most common authoring tasks. Everything here restates contracts from sections 2–9; when in doubt, those sections win.

### 11.1 Authoring a chart

1. Model each data point as an `object` with `kind: record;` and an `x_record: { … }` payload (numbers must be real numbers, dates real ISO `YYYY-MM-DD` strings).
2. In the view: `projection { kind: chart; profile: "chart.basic@1"; records: […]; mark: bar; x: "x_record.<key>"; y: "x_record.<key>"; }`. `records` lists the bound record elements explicitly (1..500) or `records: []` declares an intentional empty state (bar/line/area/point only). There is no selector form — chart membership is always explicit, so runtime-added records surface as DDN-W015 until the binding lists them.
3. Pick a legal `mark` (section 5 chart bullet), keep `y` numeric, set `unit:` only when every record carries `x_record.unit`, and add overlays with `error: "<binding>"` / `trend: linear|loess`.
4. Run `check` AND `render`; chart errors (DDN-PJ03x/07x/13x) surface at both stages.

```ddn
ddn "0.5";
module "ddn.examples.chart";

// Minimal bar chart: record objects carry x_record payloads; the chart binds
// them explicitly. The second view shows the same block as a plain graph —
// one data block, two projections.
data metrics {
    object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
    object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
    object m3 "Gamma" { kind: record; x_record: { label: "Gamma", value: 15, unit: "ms" }; }
    relation trend "Alpha drives Beta" @m1 -> @m2 { kind: flow; }
    relation feed "Beta feeds Gamma" @m2 -> @m3 { kind: flow; }
}

view latency_chart "Latency / chart" {
    data: [@metrics];
    projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2, @metrics.m3]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
    publication { size: content; fit: none; }
}

view dependency_graph "Latency / dependency graph" {
    data: [@metrics];
    publication { size: content; fit: none; }
}
```

### 11.2 Authoring a geo map

1. Geo is an OPTIONAL module: load `ddn-geo.js` (never inside `ddn.global.js`). Without it a geo view renders an inline "Map view requires ddn-geo.js" placeholder plus a coded DDN-E010 diagnostic — never a silent blank.
2. Geography data ships separately as `assets/geo/world-110m.json` (Natural Earth 110m). The CLI pre-registers it; browser hosts call `DDNGeo.registerGeography(name, geojson)` first. Inline GeoJSON via `geography: @data.record` also works (Feature/FeatureCollection, Polygon/MultiPolygon/Point/MultiPoint — DDN-PJ147).
3. Minimal choropleth: `projection { kind: geo; profile: "geo.choropleth@1"; geography: "assets/geo/world-110m.json"; records: […]; mark: choropleth; x: "x_record.iso"; value: "x_record.value"; }` — `x` joins to feature id or name (unique, DDN-PJ148), `value` is a finite number (DDN-PJ145). `method: mercator|equirectangular|albers|equalEarth` (default mercator, DDN-PJ143 on unknown); `graticule: true` draws a graticule. Symbol maps bind `x`=lon/`y`=lat with optional `size` (DDN-PJ146).
4. Full contract: section 5 geo bullet; profiles `geo.choropleth@1`, `geo.symbols@1`, `geo.outline@1` in section 4.5.

### 11.2b Authoring isometric depth (B1-034)

1. Iso is an OPTIONAL module: load `ddn-iso.js` (never inside `ddn.global.js`). Without it an `iso: true` view renders an inline "Isometric view requires ddn-iso.js" placeholder plus a coded DDN-E010 diagnostic; a `depth` property alone degrades to the flat render plus a DDN-E010 warning.
2. `projection { kind: chart; iso: true; depth: "x_record.load"; … }` extrudes bar/pie/donut/area/treemap marks; `depth` accepts a px quantity, a number (0..2000), a per-record `"x_record.field"` binding, or `@data.record.field` (view depth from one record). Per-object `depth:` on data-block objects overrides the view depth. Validation: DDN-ISO150/151/152; unsupported marks warn DDN-ISOW01 and render flat.
3. `iso: true` on a `kind: graph` view renders nodes as extruded prisms on an iso ground plane (labels on the top face); relations are routed flat, then projected onto the ground plane — never 3D routing. Frames/subdiagrams are omitted (DDN-ISOW02).
4. Refresh: `ws.replaceData(...)` then `ws.renderSync({ entry, view, isoFrom: { depths: { [elementId]: previousPx } } })` emits a one-shot SMIL depth transition (250 ms); `noMotion: true` strips it. Demo: `examples/embed/iso-load-monitor.html`.

### 11.3 Multi-file workspaces

1. Split the model across files freely; every file starts `ddn "0.5";` + file-level `import "<path>" as <alias>;` lines (canonical position: before the FIRST `module` header). Paths are workspace-relative POSIX — no scheme, no leading `/`, no `\`, `..` may not escape the workspace root (DDN020).
2. Reference across files as `@alias.path`; across sections of the SAME file as `@module.id.path` (longest module-id prefix wins). Module ids must be unique workspace-wide (DDN023); declarations unique across sections (DDN024).
3. Validate the whole workspace from the entry file: `cli.js check entry.ddn --workspace <dir>`; every transitive import must live under `<dir>`. For multi-view entries repeat with `--view <name>` per view — a bare `check` builds only the first view of the entry's FIRST module (DDN040 if it declares none).
4. Ship one file with `cli.js bundle entry.ddn --workspace <dir> --out out.ddn` (section 2.1); rendering every view of the bundle is byte-identical to the workspace.

### 11.4 Refreshing data at runtime (keyed transactional, B1-029)

1. `ws.replaceData(name, records)` → `{ committed, revision, added, removed, updated, diagnostics }`. Nothing commits unless every check passes (`committed: false` otherwise; source and revision untouched).
2. Records must carry the same field keys as the block's first record (DDN-E011). Optional per-record `key` field matches declaration ids: all-or-nothing, valid unique nonreserved identifiers, stripped from the payload; an unknown key APPENDS a declaration with that id. Without keys the match is positional and order-sensitive.
3. Field values are type-checked against inferred field types (`null` = UNKNOWN, accepts anything); every workspace view is validated against the candidate source before commit. Failures arrive as structured DDN-E012 diagnostics (`type-mismatch`, `removed-record-referenced`, `view-validation`, `source-validation`) naming view/record/field.
4. Selector views (`data: [@block]`) pick up added records automatically; explicit-binding views (chart `records: [@…]`) keep exactly their bound records and report DDN-W015 `addedRecordsNotVisible`. Removing a view-referenced record is rejected (D4).
5. Empty refresh is legal subject to the removal rule: graph views render an empty canvas; chart/table authored with `records: []` render the declared empty state; filter-to-empty still fails DDN-PJ012. Regression suite: `notation/tests/data-refresh.js`.

```js
const r = ws.replaceData("metrics", rows);        // rows: plain objects, optional key
if (!r.committed) console.error(r.diagnostics);   // structured DDN-E011/E012
const out = ws.renderSync({ entry, view: "latency_chart" });
host.innerHTML = out.svg;
```

<!-- @gen:grammar -->

