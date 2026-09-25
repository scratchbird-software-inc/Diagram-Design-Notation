# DDN (Diagram Design Notation) — AI Authoring Reference

Single self-contained authoring specification. An AI given ONLY this file plus a natural-language diagram request must be able to produce correct, current-dialect `.ddn` source for any diagram the runtime supports. Derived entirely from the authoritative repository sources of DDN runtime **{{RUNTIME_VERSION}}** (`notation/runtime/*`, `notation/cli/cli.js`) and standard 0.3/0.5 (`standard/grammar/ddn.ebnf`, `standard/registry/*`); vocabulary and property tables are machine-extracted, not paraphrased. (DDN = the language; ScratchWeaver = the product: reference runtime, CLI, Studio.)

<!-- @gen:counts -->

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
module "shop.views";                // further sections (RFC-117 multi-module)
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

- Typed declarations: any registry object-kind keyword may be the declaration keyword inside a data block — `table customer "Customer" { … }` ≡ `object customer "Customer" { kind: table; … }`. Registered aliases spell the same kind (`tbl customer {…}`). Do NOT repeat `kind:` in the body (duplicate property, DDN011). Dotted extension kinds (`uml.actor`, `flow.start`) are usable only through a registry-declared `alias` (e.g. `uml.actor` declares `actor`, so `actor customer {…}` ≡ `kind: "uml.actor"`); most dotted kinds have NO alias — write them as `object x { kind: "dfd.process"; }`.
- Disambiguation: kind words are contextual — recognized only at data-child statement start followed by an identifier. Structural keywords (`object`, `domain`, `sample`, `flow`, `assertion`, `relation`) always keep their meaning, so `object table "…" { kind: table; }` (an object NAMED `table`) still parses. The `view`/`field` kind words are typed declarations only inside data blocks.
- Contextual members: inside `fields {}`/`ports {}` the member keyword may be omitted — `fields { id { key: primary; } name; }` ≡ `fields { field id { key: primary; } field name; }`. Explicit `field`/`port` remains valid and mixes freely; a nested `fields {…}` keyword still reads as a group.
- Verb relations: any registry relationship keyword may be the declaration keyword — `ref places "places" @customer [one] -> @purchase [zeromany] { enforcement: database; }` ≡ `relation places "places" @customer -> @purchase { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; }`. Brackets are optional per side; an OMITTED bracket omits the mark property (never defaulted); enforcement is never implied. Aliases work (`transfers_to` ≡ flow); extension relation kinds opt in via registry `alias` (`req.satisfies` declares `satisfies`). Words registered as both kind and verb (`note`, `report`, `test`, …) are relations only when `@` endpoints follow; `flow`/`domain` stay structural.
- Named batches: `relations depends { enforcement: undecided; dep_a "a" @x -> @y; dep_b "b" @y -> @z { lane: hot; } }` expands to one canonical relation per entry, kind from the header (writing `kind:` inside is DDN011), shared properties merge UNDER per-entry ones (per-entry wins). Identity is never positional — every entry has its own id/label/endpoints. Anonymous arrow chains are NOT provided.
- View headers: `view erd: @sales as "erd.crowfoot@1";` ≡ `view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }`. Datasource is `@name` or `[@a, @b]`; the label keeps its position after the id; an optional body merges like canonical properties/groups (`view erd: @sales as "…" { format: @s; layout {…} }`). The versioned profile string uniquely implies `projection.kind` (registry-verified); unknown/ambiguous profiles and any body `projection` after `as` are coded parse errors (DDN-E015). Omitting `as` ≡ a view without a projection block (defaults apply).
- Keyed tabular records: a `records` block is a data block whose column order is declared once — `records metrics { columns: label, value, unit; label_column: label; row m1: "Alpha", 10, "ms"; row m2: missing, null, "ms"; }` — and each `row <id>:` ≡ `object <id> "<label>" { kind: record; x_record: { <column>: <value>, … } }` (per-row identity, column order, scalar types, missing/null/undecided preserved). Row values are scalar literals only (string/number/quantity/boolean/null/missing/state words/bare word); `label_column` supplies the display label (string or finite number, else falls back to the row id; without it the label IS the row id). Row ids are the keyed-refresh record keys; a column count mismatch is a coded parse error (DDN-E016) naming row + expected/actual counts; a row body carries extra PROPERTIES only (`kind:`/`x_record:` inside is DDN011; nested declarations are DDN-E016). Canonical data members mix in freely.
- Reuse presets and fragments: top-level closed templates applied with `use: @name;` or `use: [@a, @b];` — `fields`/`ports` member groups (inside a `fields {}`/`ports {}` group of the same kind), `relation_props` (relation bodies only), `preset` (any element/relation body and view-level flow blocks; a motion preset carries the motion keys of §7.6), `fragment` (unparameterized include-by-reference data members). Expansion happens in the workspace assembly before indexing and yields identities exactly as handwritten inline. Local properties override presets; two presets conflicting on a property are DDN-E017 unless resolved locally; preset-applied properties are ASSERTED, never omitted, and only the named definitions' own properties apply. `version: N` on a definition is documentary only. `use:` inside a definition body, a batch header, or a non-application context is DDN-E017.
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
| `x_usecase` | object, relation | object (`subjects` refs / `extension_points` on objects; `extension_point`, `condition`\|`condition_ref` on `uml.extend` relations) |
| `x_chen` | object, field, relation | object (Chen metadata; §10) |
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

<!-- @gen:projection-kinds -->

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
| process map (BPMN) | graph | `bpmn.basic@1` | pools = frames `x_pool: true`, `x_gateway.type`, `bpmn.messageflow` across pools |
| process chain (EPC) | graph | `epc.basic@1` | alternating `epk.event`/`epk.function`, `x_epc.operator` on connectors |
| activity diagram / swimlanes | graph | `uml.activity@1` | `uml.flow`, `x_partition.lane` names a frame, fork=join bars |
| state machine / lifecycle | graph | `state.flat@1` / `state.composite@1` | `state.*` kinds + `state.transition` with `x_transition.event`; regions = `x_region` frames |
| sequence diagram | sequence | `uml.sequence@1` | lifelines in declaration order, `uml.message`, `x_return: true` for replies |
| communication/collaboration | graph | `uml.communication@1` | `uml.message` + `x_message.seq` dotted-decimal |
| class diagram | graph | `uml.structure@1` | `uml.class/interface`, `x_member` on fields, `uml.generalization` acyclic |
| use cases | graph | `uml.usecase@1` / `uml.usecase@2` | `uml.subject` boundaries + `x_usecase` for @2 |
| object/instance diagram | graph | `uml.object@1` | `x_instance.classifier` |
| timing diagram | timing | `uml.timing@1` | `x_states` per participant |
| C4 architecture | graph | `c4.context@1` / `c4.container@1` / `c4.component@1` | exactly one boundary frame for container/component |
| system context/free architecture | graph | `ddn@1` | any kinds/verbs; no enforced profile rules |
| requirements traceability | graph | `requirements.basic@1` | `req.*` kinds/verbs, `x_diagram.code`+`text` |
| SysML | graph | `sysml.bdd@1` / `sysml.ibd@1` / `sysml.parametric@1` | ports only on `sysml.block` |
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

Every view resolves to the full §3.5 default set; a property you omit takes the default (or inherits from the referenced bundle/concern per the §3.3 resolution order) and is NEVER written into the model. Asserting a property pins it. Consequences: omit everything you do not intend to change; a view-local group overrides a bundle for exactly the keys it names; compact forms never imply extra properties (an omitted mark bracket omits the mark; preset-applied properties are asserted by definition).

### 7.2 Identity, labels, uid

Identity is the declaration id (dotted path inside its module), never the quoted label. Renaming a label changes no references; renaming an id breaks every `@ref`. `uid: "…"` pins a stable identity across refactoring. Two declarations sharing a symbol key fail (DDN024).

### 7.3 missing / null / undecided / not_applicable / conflicting

`null` = SQL-like UNKNOWN (absence of value; in data-refresh typing, a null-typed field accepts anything). `missing` = the value is required but not supplied. `undecided` = an open modeling decision. `not_applicable` = the property does not apply. `conflicting` = known disagreement. They are unquoted atoms; quoted forms are plain strings. Charts: `missing: error|skip` controls record handling (DDN-PJ019); tables: `missing: error|blank`.

### 7.4 Data refresh contract (keyed, transactional)

`ws.replaceData(name, records)` replaces a data block's records atomically: records carry the same field keys as the block's first record (DDN-E011); optional per-record `key` matches declaration ids (all-or-nothing, valid unique identifiers, stripped from the payload; unknown key appends a declaration with that id) — a `records` block's row ids ARE these keys, so author refresh-target data as `records` blocks. Without keys the match is positional and order-sensitive. Field values are type-checked against inferred field types; every workspace view is validated on the candidate source BEFORE commit; failure → `{committed:false}` with structured DDN-E012 diagnostics (`type-mismatch`, `removed-record-referenced`, `view-validation`, `source-validation`). Removing a view-referenced record is rejected. Membership re-resolved: selector views (`data: [@block]`) pick up additions automatically; explicit-binding views (chart `records: [@…]`) keep exactly their bound records and warn DDN-W015 `addedRecordsNotVisible`. Empty refresh is legal (subject to the removal rule): graph renders an empty canvas; chart/table authored with `records: []` render the declared empty state; filter-to-empty still fails DDN-PJ012.

### 7.5 Layout, routing, chrome, sizing

- Omit `place`/`route` for automatic layout; pin only when the author must control geometry (`place.at`/`size`, `route.via`). Pins must not overlap (DDN204); route hints follow `route_policy` (§3.3). `layout.algorithm` picks the placement (grid/layered/tree/mindmap/organic/…, §3.6); `direction` orients layered/tree layouts; `spacing: tight|normal|loose|expanded` scales gaps.
- Legends/title/footer chrome: §3.3 `chrome` bullet; numbered legends number relations, not time.
- Page/artboard: `publication { size: content|fixed; width/height; margin; fit; overflow: warn|error; minimum_text }`; result extent ≤ 50000 px.
- Text: measured with the embedded font metrics; if the smallest final text would fall below `publication.minimum_text`, DDN071 warns (or errors under `overflow: error`). DDN071 rule of thumb: keep labels ≤ ~30 chars, give dense graphs ≥ 1200 px width, and prefer `size: content` so the page grows instead of shrinking text.

### 7.6 Motion and flow semantics (animation)

Relations accept motion properties: `motion: flow|pulse|none` (travelling markers / edge pulse / static), `marker: circle|square|rect`, `marker_size` (>0..128px), `speed` (px/s ≤ 10000), `rate` (markers in flight, positive integer; >32 warns DDN-W016 and clamps), `marker_color`, `pulse_color`. View-level `flow <id> "label" { steps: @a -> @b -> @c; … }` declares a step-traceable multi-hop sequence: each hop must resolve to an existing VISIBLE relation in its declared direction (DDN-E013). Invalid motion values → DDN-E014. The exported SVG animates autonomously (SMIL); `noMotion` / `--no-motion` renders static for print.

### 7.7 Module requirements (iso / geo)

Geo views need the optional `ddn-geo.js` module and a registered geography (`assets/geo/world-110m.json`; CLI pre-registers it; browser hosts call `DDNGeo.registerGeography(name, geojson)`; inline GeoJSON via `geography: @data.record`). Iso/depth needs `ddn-iso.js` (graph + chart only). Both degrade loudly without the module (visible placeholder + DDN-E010) — §5 geo/iso bullets. Never assume they are inside `ddn.global.js` — they are not.

## 8. Optimization and size discipline

- Omit defaults (§7.1) — the shortest correct source is the best source.
- Use compact forms where they read naturally: typed declarations (`table customer {…}`), contextual members (`fields { id { key: primary; } name; }`), verb relations (`ref places @a [one] -> @b [zeromany]`), view headers (`view erd: @sales as "erd.crowfoot@1";`).
- Use a `records` block for tabular data — one column declaration instead of repeating `kind: record; x_record: {…}` per row, and row ids double as `replaceData` keys.
- Use `preset`/`relation_props`/`fields` groups for repetition (≥3 similar declarations); use `fragment` for reusable sub-models.
- Size limits to design within: live/refresh views cap at **128 elements / 384 relations** (LIVE013); reference arrays ≤500 refs; matrices ≤5000 cells and ≤40 columns; panels ≤80; chart series ≤20 × 200 categories; file ≤ 2M chars; result extent ≤ 50000 px. To stay under them: filter (`filter`/`order` on projections), select subsets (`select:`/`exclude:`), drill down with `subdiagram` or `panels.composed@1` child views (each child has its own 128/384 budget), and split large models across linked views rather than one giant canvas.
- Canvas/routing hints for large graphs: `layout { algorithm: layered; direction: down; }` for DAGs, `grid` for atlases, `tree`+`root`+`hierarchy` for hierarchies; raise `gap`/`row_gap` before pinning anything; use `spacing` at the view level; prefer `route` hints over `place` pins when only crossings bother you.
- Split files when a workspace exceeds ~2–3 screens of source per concern (§12); ship one file via `bundle`.

<!-- @gen:diagnostics -->

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
- **flow.basic@1 / flow.documented@2 / uml.activity@1**: participants only `flow.*` kinds (DDN-PF007). Links: flow.basic only `flow.next`; uml.activity only `uml.flow`; flow.documented allows `flow.next`, `flow.annotation`, `flow.continues` (DDN-PX008). At least one `flow.start` and one `flow.end`; start has no incoming control; end has no outgoing (DDN-PF008). Every `flow.decision` needs ≥2 outgoing control edges with explicit, distinct, nonempty `x_diagram.branch` names (DDN-PF009). Every non-annotation symbol must be reachable from a start and reach an end (DDN-PF010). flow.documented@2 additionally: `flow.offpage` nodes need valid `x_continuation {key, side: in|out, page?}`; each key is exactly one out + one in pair joined by exactly one `flow.continues` edge (DDN-PX008); every `flow.annotation` node needs an outgoing `flow.annotation` attachment.
- **dfd.***: only `dfd.*` participants and `dfd.data` links (DDN-PF011); every `dfd.process` has unique nonempty `x_diagram.number` and at least one input and one output (DDN-PF012/013).
- **org.tree@1**: participants `organization|team|role|analysis.role`; links only `reports_to`; acyclic (DDN-PF004); exactly one root (DDN-PJ102); multiple parents fail at layout (DDN201).
- **wbs.tree@1**: participants only `analysis.task`; links only `analysis.decomposes`; acyclic; exactly one root (DDN-PJ102).
- **mindmap.basic@1**: participants `object|entity|term|domain`; links only `assoc`; `layout.algorithm` MUST be `mindmap`; acyclic; exactly one root.
- **concept.map@1**: participants `object|entity|term|domain`; links only `assoc|ref`; EVERY selected relation needs an explicit author-written label different from the verb default (DDN-PJ104). No root/cycle constraints.
- **c4.context@1**: participants only `c4.person`, `c4.system`; links only `c4.rel`; no member (field/port) endpoints (DDN-PJ100). **c4.container@1**: participants `c4.person|c4.system|c4.container|c4.store|c4.queue`; links only `c4.rel`; requires EXACTLY ONE frame scoped to a selected `c4.system` boundary whose members cover every selected interior node (exterior: `c4.person`) (DDN-PJ101). **c4.component@1**: participants `c4.person|c4.system|c4.container|c4.store|c4.component`; same one-boundary rule with a `c4.container` frame (exterior: `c4.person`, `c4.system`, `c4.store`).
- **epc.basic@1**: participants `epk.event|epk.function|epk.connector`; links only `epk.next`; events and functions must strictly alternate (no event→event or function→function; DDN-PJ105); `epk.connector` must carry `x_epc.operator` of `and|or|xor`, and `x_epc.operator` on anything else is rejected (DDN-PJ106).
- **erd.crowfoot@1**: every visible relation must be `ref` or `assoc` and carry BOTH `source_mark` and `target_mark` from `one|zeroone|many|zeromany` (DDN-PJ087).
- **uml.usecase@2**: every selected `uml.usecase` names its subject boundary via `x_usecase.subjects` (refs to distinct `uml.subject` elements); `uml.extend` needs `x_usecase {extension_point}` naming an extension point declared on the target use case plus a `condition` string or `condition_ref` (exactly one form); include/extend endpoints must share a declared subject; a view frame scoped to a `uml.subject` must not contradict model membership (DDN-PX002/PX004/PX006).
- **chen.basic@1 / chen.binary@2**: entities only; weak entity (`x_chen.weak: true`) requires a distinct entity owner (`x_chen.owner`), a declared partial-key field, exactly one visible identifying relationship, and identifying relations must connect weak↔owner with the owner end at min 1/max 1; participation bounds `x_chen.from/to {min, max|many}` required on every relation under binary@2; composite attributes must match actual nested fields; key fields cannot be derived/multivalued; ownership must be acyclic (DDN-PX003/PX005/PX007).
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

### 13.21 Geo symbol map (`geo.symbols@1`)

```ddn
ddn "0.5";
module "ddn.examples.geo-symbols";

import "shared.ddn" as shared;

// Symbol map: x = longitude, y = latitude (in range), optional size binding
// (sqrt-scaled radius).
data quakes {
    object q1 "Honshu M7.1" { kind: record; x_record: { lon: 141.3, lat: 38.3, mag: 7.1, unit: "Mw" }; }
    object q2 "Chile M6.8" { kind: record; x_record: { lon: -70.7, lat: -33.4, mag: 6.8, unit: "Mw" }; }
    object q3 "Sumatra M6.2" { kind: record; x_record: { lon: 100.5, lat: -0.8, mag: 6.2, unit: "Mw" }; }
    object q4 "Iceland M5.1" { kind: record; x_record: { lon: -18.9, lat: 64.8, mag: 5.1, unit: "Mw" }; }
}

view symbols "Synthetic seismic catalog / symbol map" {
    data: [@quakes]; format: @shared.styles.technical;
    projection { kind: geo; profile: "geo.symbols@1"; records: [@quakes.q1, @quakes.q2, @quakes.q3, @quakes.q4]; mark: symbol; geography: "assets/geo/world-110m.json"; method: mercator; x: "x_record.lon"; y: "x_record.lat"; size: "x_record.mag"; unit: "Mw"; width: 1120px; height: 640px; }
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

// Declarative motion: motion: flow sends markers along the edge; pulse animates
// the edge stroke. rate/marker/speed/colours tune it (DDN-E014 on bad values).
// The view-level flow block traces a multi-hop sequence: every hop must follow
// an existing visible relation in its declared direction (DDN-E013). The
// exported SVG animates autonomously; --no-motion renders static for print.
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

### 13.24 Pipeline graph with numbered legend (plain `ddn@1` profile)

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

### 13.25 Self-contained multi-module file (no imports)

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

Check with an explicit view: `cli.js check main.ddn --workspace <dir> --view overview` (and `--view compact`). Without `--view`, the CLI builds the first view of the entry file's FIRST module — this file's first module (`shop.model`) declares no view, so a bare `check` fails with DDN040 even though the file is valid.

## 14. Embedding / runtime API summary

Runtime modules (`notation/runtime/`, dependency-free ES modules wired through an explicit module registry, so script-tag/CJS/ESM/vm consumers share namespaces; assets under `notation/runtime/assets/` are generated — do not hand-edit):

| module | global | contents |
|---|---|---|
| ddn-contracts.js | DDNContracts | semantic/property/extension validation — load before ddn-core |
| ddn-profiles.js | DDNProfiles | profile catalogue merge + profile validators |
| ddn-profile-quality.js | DDNProfileQuality | additive profile-completion validators |
| ddn-core.js | DDN | lex/parse/bundle/createWorkspace/build, `DEFAULTS`, `CHOICES`, `PROPERTIES`, `quantity`, `semanticJSON`, `DDNError`, VERSION {{RUNTIME_VERSION}} |
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

Distribution bundles (`notation/dist/`): `ddn-core` (parse/build/validate/export, no rendering); `ddn-graph` (core + graph renderer, registers `graph`); `ddn-quality` (graph + quality renderers, registers `fishbone`/`decision`); `ddn-projections` (graph + chart/matrix/panels/timeline/table/sequence/timing/chen); `ddn-geo` (optional geographic module, registers `geo`, never in `ddn.global.js`); `ddn-iso` (optional isometric module, publishes `DDNIso`, registers no kind, never in `ddn.global.js`); `ddn.global.js` = everything except geo and iso. Each ships browser IIFE `.js`, minified `.min.js` + map, ESM build, and TypeScript declarations. `DDNEngine` maps projection kinds to bundles and throws DDN-E010 naming a missing bundle — except the optional geo/iso modules, which render visible coded placeholders (§5, §7.7). Geography data ships separately as `assets/geo/world-110m.json` (~96 KB, Natural Earth 110m): views name it via `geography: "assets/geo/world-110m.json"` (hosts register it first with `DDNGeo.registerGeography(name, geojson)`; the CLI pre-registers it) or bind inline GeoJSON via `geography: @data.record`.

Core API essentials: `DDN.parse(text, name)` → parsed doc (throws `DDNError`); `DDN.build(files, entry, viewName, registry)` → `{ir, workspace}` (`files` = `{path: sourceText}`; runs all validators); `DDN.bundle(files, entry)` → `{text, diagnostics}`; `DDNExport.serialize(ir)` → JSON or SQL DDL; `DDN.semanticJSON(ir)` → canonical semantic payload (basis of `modelFingerprint`).

Live API (`DDNLive`): `DDNLive.createWorkspace({filename: text})` → workspace with `entries()`, `views(entry)`, `analyze(file)`, `resolve(entry, view)`, `inspect(entry, view)`, `renderSync({entry, view, overrides, layoutState})` → `{svg, scene, diagnostics, layoutState, modelFingerprint, …}`, `render` (async alias), `exportModel`, `exportVegaLite`, `evaluateDecision`, `simulateLifecycle`, `projectionPlan`, `updateFiles`, `applyEdits`, `snapshot`, undo/redo, `subscribe`. Module-level: `parse`, `lex`, `bundle`, `registerWorkspace`, `fromSnapshot`, `defaults.forKind`, `kinds`/`relations`, `glyphs.forKind`.

**Data refresh (keyed transactional)** — `ws.replaceData(name, records)` → `{ committed, revision, added, removed, updated, diagnostics }`; the full contract is §7.4. Usage:

```js
const r = ws.replaceData("metrics", rows);        // rows: plain objects, optional key
if (!r.committed) console.error(r.diagnostics);   // structured DDN-E011/E012
const out = ws.renderSync({ entry, view: "latency_chart" });
host.innerHTML = out.svg;
```

**Overrides channel** (`renderSync` `overrides` record; unknown keys → LIVE001, bad values → LIVE002/003): runtime render toggles keyed by concern — `placement`, `center`, `theme`, `look`, `font`, `routing`, `crossings`, `fields`, `domains`/`datatypes`, `labels`, `kind`, `page`, `mark` (chart only), `relationRouting` (per verb/relation), numeric `width`/`height` 400..32000, `roughness` 0..3, `fontSize` 8..64, `gridStep` 8..512, `depth` 0..64, `curveTension` 0..1, `curveRadius` 0..512, booleans `autoPlace`/`hachure`. Each takes `source` (as-authored) plus the enum the concern implies. Data-bound/chen projections reject graph controls (LIVE021). Live view limit: 128 elements / 384 relations (LIVE013); workspace limit 1,500 files / 12M chars (LIVE011).

CSS hooks on rendered SVG: root `ddn-svg ddn-view-<kind> ddn-profile-<slug>`; nodes `ddn-node ddn-kind-<code>` + `data-ddn-id`; relations `ddn-rel ddn-verb-<slug>`; `ddn-field`, `ddn-label`, `ddn-panel`, `ddn-frame`, `ddn-mark ddn-mark-<type>`. Slugs lowercase with non-alphanumeric runs collapsed to dashes.

<!-- @gen:grammar -->
