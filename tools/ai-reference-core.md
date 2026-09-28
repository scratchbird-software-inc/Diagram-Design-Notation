# DDN (Diagram Design Notation) — AI Authoring Reference

Single self-contained authoring specification. An AI given ONLY this file plus a natural-language diagram request must be able to produce correct, current-dialect `.ddn` source for any diagram the runtime supports. Derived entirely from the authoritative repository sources of DDN runtime **{{RUNTIME_VERSION}}** (`notation/runtime/*`, `notation/cli/cli.js`) and standard 0.3/0.5 (`standard/grammar/ddn.ebnf`, `standard/registry/*`); vocabulary and property tables are machine-extracted, not paraphrased. (DDN = the open-source language and project: reference runtime, CLI, free ddn-viewer and ddn-designer. ScratchWeaver sponsors the project; ScratchRobin owns backend evaluation (KEEL) — never in scope here.)

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
| `x_state` | object, relation | `{terminal?, entry?, exit?, do?, internal?, submachine?}` (RFC-121; `state.*` kinds only — DDN-PJ160) |
| `x_transition` | object, relation | `{event?, guard?: object|string, effect?, actions?}` — label `trigger [guard] / effect` (RFC-121; DDN-PJ162) |
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
| `x_part` | field | `{classifier?, multiplicity?}` — internal part row `role: Classifier [mult]` (RFC-123; DDN-PJ166) |
| `x_pin` | port | `{set?, streaming?}` — activity pin parameter set/streaming (RFC-124; DDN-PJ169) |
| `x_interrupt` / `x_exception` | relation | boolean — lightning-bolt activity edges (RFC-124; DDN-PJ168) |
| `x_activity` | object | `{call?, transaction?, adhoc?, event_subprocess?, collapsed?, markers?}` BPMN task decorations (DDN-PJ177) |
| `x_io` / `x_bands` | object | `{set?}` io-set badge / `[participant…]` choreography bands (DDN-PJ178/PJ180) |
| `x_cmmn` | object | `{discretionary?, nonblocking?, required?, repetition?, manual_activation?, completion?, collapsed?}` plan-item decorators (DDN-PJ181) |
| `x_planning` | object | `{items: [string]}` planning table on a stage/task (DDN-PJ183) |
| `x_sentry` | object | `{on: entry|exit, attach?, on_part?, if_part?}` (B1-064: criterion attachment, on/if-parts; DDN-PJ182) |
| `x_block` | field | `{compartment: values|parts|references|operations|constraints}` — SysML block compartment row (DDN-PJ186) |
| `x_port` | port | `{type: proxy|full, conjugated?, multiplicity?, nested?}` — SysML port typing (DDN-PJ187) |
| `x_unit` | field | `{unit, quantity?}` — unit from `standard/registry/units.json`, renders `name: unit` (DDN-PJ188) |
| `x_flow` | relation | `{rate?, probability?, continuous?}` — SysML activity-edge annotations under sysml.activity@1 (DDN-PJ191) |
| `x_boxed` | object | `{form: literal|context|invocation|relation, text?, entries?}` — DMN boxed-expression presentation (text only, never evaluated; DDN-PJ193) |
| `x_pack` | object | `{visibility: public|private}` — packaged element +/− (RFC-125; DDN-PJ171) |
| `x_use` | object | `{arguments?, gates?}` — interaction-use detail (RFC-125; DDN-PJ174) |
| `x_timeconstraint` | object | `["{…}", …]` timing constraints (RFC-125; DDN-PJ173) |
| `x_diagram` | object, relation | `{number?, owner?, code?, text?, branch?, stereotype?}` only |
| `x_epc` | object | `{operator: string}` (must be `and|or|xor` on `epk.connector`; forbidden elsewhere) |
| `x_sets` | object | array of 1..3 unique strings (venn membership) |
| `x_return` | relation | boolean (sequence/communication reply) |
| `x_message` | relation | `{seq?, sort?, gate?, time?, duration?}` (RFC-120; seq enforced by uml.communication@1 DDN-PJ111) |
| `x_fragment` | relation | `{operator: alt|opt|loop|…|assert, operands: [{guard?, messages: [@msg…], fragments?}]}` on first covered uml.message (DDN-PJ155) |
| `x_invariant` | object | `[{after: @msg, label}]` lifeline state invariant (DDN-PJ157) |
| `x_activation` | object | `[{from: @msg, to: @msg}]` explicit execution bars (DDN-PJ158) |
| `x_instance` | object | requires `classifier` (ref) |
| `x_partition` | object | `{lane: string}` exactly |
| `x_event` | object | `{type: none|message|…|parallel_multiple, position?, interrupting?, on?}` on event kinds |
| `x_gateway` | object | `{type: exclusive|parallel|inclusive|complex|event|event_exclusive}` on flow.gateway |
| `x_states` | object | array of `{at: number, state: string}` (timing; strictly increasing `at`) |
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
| BPMN process/collaboration | graph | `bpmn.basic@1` / `bpmn.process@1` | pools = `x_pool` frames, `x_gateway.type`, `bpmn.messageflow` across pools; process@1: full event system, 6 gateways, activity markers, data nodes, flow variants |
| BPMN choreography | graph | `bpmn.choreography@1` | `flow.choreotask` + `x_bands` participant bands |
| BPMN conversation | graph | `bpmn.conversation@1` | conversation hexagons + `bpmn.conversationlink` |
| process chain (EPC) | graph | `epc.basic@1` | alternating `epk.event`/`epk.function`, `x_epc.operator` on connectors |
| activity diagram / swimlanes | graph | `uml.activity@1` / `uml.activity@2` | `uml.flow`, `x_partition.lane` names a frame, fork=join bars; @2 (RFC-124): merge, pins (x_pin), signals/time events, flow final, interruptible/structured regions, exception handlers |
| state machine / lifecycle | graph | `state.flat@1` / `state.composite@1` / `uml.statemachine@1` | `state.*` + `x_transition.event`; regions = `x_region` frames; uml.statemachine@1: activities/internal/submachines, pseudostates, effects, time events |
| sequence diagram | sequence | `uml.sequence@1` / `uml.sequence@2` | declaration-order lifelines; @2 (RFC-120): fragments, gates, message sorts, `{…}` constraints, invariants, activations |
| communication | graph | `uml.communication@1` / `uml.communication@2` | `uml.message` + dotted `x_message.seq`; @2 (RFC-125): `x_fragment` frames, `{…}` constraints |
| interaction overview | graph | `uml.interaction_overview@1` / `uml.interaction_overview@2` | `x_subdiagram.view` refs; @2 (RFC-125): inline expansion, `x_use` gates/arguments |
| profile diagram | graph | `uml.profile@1` | `uml.metaclass`/`uml.stereotype`, `uml.extension` (filled triangle), `uml.application` |
| class diagram | graph | `uml.structure@1` / `uml.structure@2` | class/interface/enumeration, `x_member`; @2 (RFC-119): end labels, diamonds, association classes, n-ary, gensets, templates, provided/required |
| deployment diagram | graph | `uml.deployment@1` | node/device/executionenv 3D boxes, artifacts, deploy/manifest, commpaths + multiplicity; nesting = node-scoped frames (RFC-122) |
| component / composite structure | graph | `uml.composite@1` | ports on classifiers, `uml.assembly` (socket+lollipop), `uml.delegation`, `uml.connector` + `x_endlabels`, parts (`x_part`), `uml.collaboration` (RFC-123) |
| use cases | graph | `uml.usecase@1` / `uml.usecase@2` / `uml.usecase@3` | `uml.subject` boundaries + `x_usecase` (@2); @3: extend conditions on labels |
| object diagram | graph | `uml.object@1` / `uml.object@2` | `x_instance.classifier`; @2 (RFC-125): underlined titles, slot datatype checks, `uml.link` multiplicity |
| timing diagram | timing | `uml.timing@1` / `uml.timing@2` | `x_states` per participant; @2 (RFC-125): duration/slew, `x_timeconstraint`, compaction, lifeline messages |
| C4 architecture | graph | `c4.context@1` / `c4.container@1` / `c4.component@1` | exactly one boundary frame |
| system context/free architecture | graph | `ddn@1` | any kinds/verbs; no enforced profile rules |
| requirements traceability | graph | `requirements.basic@1` | `req.*` kinds/verbs, `x_diagram.code`+`text` |
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
- **uml.object@2** (RFC-125): slot values match classifier field datatypes (DDN-PJ170).
- **uml.communication@2** (RFC-125): fragment refs resolve to visible messages; constraints in {…} (DDN-PJ172).
- **uml.timing@2** (RFC-125): annotations/constraints in {…}; messages need x_message.at (DDN-PJ173).
- **uml.structure@2 packages / uml.profile@1** (RFC-125): x_pack.visibility needs a package frame (DDN-PJ171); extension endpoints stereotype → metaclass (DDN102).
- **dmn.drd@1**: requirement connector endpoints (DDN-PJ194); x_subdiagram must bind a decision-projection view (PJ192); x_boxed owner/form (PJ193). decision.rules@1 also accepts DMN hit-policy labels priority/any/output_order/rule_order/aggregation as annotations (analysis unchanged; ordering/aggregation deferred to host engine); completeness cell C+/C− renders for those labels or `x_completeness: true`.
- **sysml.***: only block-family kinds declare `ports` (DDN-PJ121; @1: `sysml.block` only); parametric@1: each `sysml.constraint` touched by exactly two visible relations (DDN-PJ122), parametric@2: at least one (DDN-PJ189). Requirements: dependency endpoint rules (DDN-PJ185); x_block compartments (PJ186); x_port typing/nesting (PJ187); x_unit resolves in the units registry (PJ188); composition/generalization on block-family kinds (PJ190); ibd@2 item-flow endpoints + x_flow edges (PJ191). Behavioral rebadges sysml.usecase/activity/sequence/statemachine@1 run the uml.* machinery (info DDN-PJW06).
- **archimate.basic@1**: `archi.rel` endpoints among the nine `archi.*` kinds; links same-layer or upward (DDN-PJ123).
- **cmmn.basic@1 / cmmn.complete@1**: `cmmn.sentry` inside a `cmmn.stage` frame with `x_sentry.on` (DDN-PJ120); complete@1: x_cmmn owner/decorator rules (PJ181), sentry attachment/on-part (PJ182), planning tables (PJ183), one case plan per view (PJ184).
- **network.basic@1 / network.rack@1**: `network.attaches` targets a `network.bus` or port (DDN-PJ127); rack members carry unique integer `x_rack.unit` 1..`x_rack.units` (DDN-PJ127).
- **fault.tree@1 / event.tree@1**: `tree.gate` declares `x_gate.type` and|or with ≥2 outgoing `tree.input` edges (DDN-PJ126).
- **family.tree@1**: `family.parent_of` acyclic (DDN-PJ129); ≤2 distinct parents per person (DDN-PJ130).
- **wireframe.ui@1**: `ui.*` controls outside any `ui.frame` frame → warning DDN-PJ128.
- **pert.cpm@1**: tasks (`analysis.task`) need finite nonnegative `x_estimate` days (DDN-PJ125); `analysis.precedes` must be acyclic (DDN-PJ124); critical-path relations/labels are computed at render.
- **uml.deployment@1** (RFC-122): endpoint contracts do the work (DDN102); commpath labels never carry qualifiers; nesting frames scope to node kinds (DDN-PJ164).
- **uml.composite@1** (RFC-123): assembly endpoints are components or their ports; delegation starts at a port member (DDN-PJ165); x_part owners/multiplicity (PJ166).
- **uml.activity@2** (RFC-124): merge ≥2 in / 1 out (DDN-PJ167); interrupt inside x_interruptible frame, exception targets flow.process (PJ168); x_pin on action kinds (PJ169); flow.flowfinal counts as an end (DDN-PF008).
- **uml.structure@2** (RFC-119): end labels/multiplicity on associations (DDN-PJ149); association class resolves to uml.class (PJ150); n-ary ≥3 distinct classifier ends (PJ151); genset one target per name (PJ152); templates on classifiers (PJ153); enumeration literals (PJ154).
- **uml.sequence@2** (RFC-120): fragment spans contiguous/nested, anchored on first message (DDN-PJ155); sort/gate rules — create first, delete final, lost/found self-anchored, gate needs a fragment (PJ156); invariant/activation refs incident (PJ157/158); `{…}` constraints (PJ159).
- **uml.statemachine@1** (RFC-121): x_state on state kinds; submachine → distinct state.state (DDN-PJ160); choice 2+ out, junction pass-through, history/boundary points inside a composite frame (PJ161); after/at/when need parentheses (PJ162); traces stay state.flat@1-only (DDN-Q005).

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
| ddn-core.js | DDN | lex/parse/bundle/createWorkspace/build, DEFAULTS/CHOICES/PROPERTIES, `quantity`, `semanticJSON`, `DDNError`, VERSION {{RUNTIME_VERSION}} |
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

<!-- @gen:grammar -->
