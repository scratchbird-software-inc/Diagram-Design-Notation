# DDN 0.3 — Language and decoding

The formal syntax is `grammar/ddn.ebnf`. Source files are UTF-8; the formatter convention is LF and no BOM, while the reader accepts a BOM and CRLF. Structural identifiers are ASCII (`[A-Za-z_][A-Za-z0-9_-]*`) in this reference. Display labels and literal values support Unicode. Do not normalize or rewrite sample strings. Unpaired surrogate escapes, unsafe prototype keys, duplicate properties and duplicate identities are rejected.

## Document structure

```ddn
ddn "0.3";
module "example.customer";
import "shared.ddn" as shared;
data model {
 object customer "Customer" {
  kind: table;
  fields {field id; field name;}
 }
}
view overview {
 data: [@model];
 format: @shared.styles.technical;
 layout {algorithm: layered;}
 publication {size: content;fit: none;}
}
```

The module is a stable namespace, not a file path. Imports are local workspace-relative resources. Remote imports, traversal outside the workspace and recursive import cycles are rejected. References start with `@` and resolve declaration paths. A quoted label never serves as identity. An explicit `uid` can preserve identity across declaration refactoring.

### Multi-module files (RFC-117)

A file MAY hold more than one module as marked sections — so a full design (model, data, views, formats) can live in one self-contained file:

```ddn
ddn "0.5";
import "palette.ddn" as palette;

module "shop.model";
data model {
 object customer "Customer" { kind: table; fields { field id; field name; } }
}

module "shop.views";
view overview {
 data: [@shop.model.model];
 format: @palette.styles.technical;
}
```

Each `module "…";` header starts a section; the following top-level declarations belong to that module until the next header or end of file. Imports stay file-level: canonically they precede the first module header; the legacy position (immediately after the FIRST header, before its first declaration) is kept so existing single-module files are unchanged. An import anywhere else is rejected (DDN015). Module identity stays unique across the whole workspace (DDN023, whether the duplicate is another section or another file), and declaration identities stay unique across sections (DDN024). Sibling sections in the same file are implicitly visible to each other through module-qualified references (`@shop.model.model` above) — no import between them. Another file importing a multi-module file imports all its modules; `@alias.path` resolves against each section in order. Older runtimes reject multi-section files with a clean DDN010.

A workspace can be merged into one such file with `DDNLive.io.bundle(files, entry)` or `node notation/cli/cli.js bundle <entry.ddn> --workspace . --out bundled.ddn`. The bundle carries the maximum language version in use, the entry file's module(s) first and the remaining modules sorted by module id. Section bodies are the original source text minus header lines — comments and formatting survive; imports between bundled files are dropped and references written through their aliases are canonicalized to module-qualified sibling references; imports to files outside the bundle set are kept verbatim at the top with a warning diagnostic (DDN-W013). Bundling is deterministic, and rendering every view of the bundle produces byte-identical SVG to rendering the original workspace.

## Values and punctuation

Properties end in semicolons. Declarations without bodies also end in semicolons. Blocks can have an optional trailing semicolon. Arrays accept trailing commas. Records use colon-separated entries with comma or semicolon separators. Strings use JSON-style escapes. Comments are `//` or non-nesting `/* ... */`.

Numbers are finite. Lengths are `px`, `pt`, `mm`, `cm`, or `in`; temporal quantities are `ms`, `s`, `min`, `h`, or `d`. Conversion to geometry rejects temporal units. `true`, `false`, `null`, `missing`, `undecided`, `not_applicable`, and `conflicting` are distinct values. A quoted `"undecided"` is a string, not an unknown-state assertion.

## Declaration contexts

At document scope: `data`, `format`, and `view`. Within data: `object`, `domain`, `sample`, `flow`, `assertion`, and `relation`. Objects can contain `fields` and `ports` groups; a field can recursively contain a `fields` group. Named format declarations include `notation`, `style`, `layout`, `display`, `publication`, `legend`, `validation`, `export`, `keyset`, and `bundle`. Views reference these and may contain local property groups, `place`, `route`, `frame`, and `subdiagram` declarations.

Only relations have `@source -> @target` endpoints. Relationships belong to data, never to a formatting override. A renderer MUST NOT invent a relation because two shapes touch. `place @object {at:[0px,0px];}` is optional. Omit it for automatic layout. A placement body can contain size hints alone.

## Compact authoring (phase 1)

Two compact surface forms desugar in the parser to the identical canonical declarations — same identities, member order, property values and omissions; `DDN.semanticJSON`, rendered SVG and validation outcomes are indistinguishable from the verbose form (source locations aside). No new IR and no renderer involvement.

Typed object declarations. Any registry object-kind keyword may act as the declaration keyword inside a data block:

```ddn
table customer "Customer" { fields { field id; } }
```

is exactly `object customer "Customer" { kind: table; fields { field id; } }`. The kind property is set by the keyword, so writing `kind:` again in the body is a duplicate property (DDN011). Registered kind aliases spell the same kind (`tbl customer {…}` ≡ `kind: table`). Extension kinds whose keywords are dotted (`uml.actor`, `flow.start`) cannot be identifiers, so they do not get bare typed declarations automatically; a registry entry MAY declare an `alias` (single identifier, e.g. `uml.actor` declares `actor`) that opts the kind into the typed form.

Disambiguation. Kind words are contextual, recognized only at data-child statement start followed by an identifier. The structural declaration keywords — `object`, `domain`, `sample`, `flow`, `assertion`, `relation` — always keep their structural meaning, so an object NAMED after a kind still parses: `object table "Table metadata" { kind: table; }`. The sql `view` and data `field` kind words are typed declarations only inside a data block; at document scope `view` stays the view declaration and inside a fields group `field` stays the member keyword.

Contextual members. Inside `fields {}` and `ports {}` groups the `field`/`port` keyword may be omitted:

```ddn
table customer "Customer" {
 fields { id { key: primary; } name; }
}
```

A bare `id ["label"] (block | ";")` is a member; the explicit `field`/`port` keywords remain valid and the two forms mix freely in one block. A nested group keyword still wins (`fields {…}` inside a field stays a group), and endpoints are not members — `id @a -> @b` inside a group is a syntax error (DDN010).

Normalization policy. `tools/normalize-ddn.mjs` does not rewrite verbose↔compact in either direction: compactness is an author choice, and the corpus canonical form stays explicit (canonical-verbose). Compact input parses to the same canonical declarations, so the normalizer's default-pin stripping works unchanged on it.

Authoring tools. Studio/CLI authoring edits (`DDNLive.authoring.*`) operate on the canonical model and write token-precise source spans, so editing a compact declaration (label, property, added member) preserves the surrounding compact syntax; newly generated members are emitted in the canonical-verbose form, which mixes legally into compact blocks.

## Compact authoring (phase 2)

Two more compact surface forms follow the same desugar contract as phase 1: identical canonical relations, with `DDN.semanticJSON`, rendered SVG and validation indistinguishable from the verbose form.

Verb-keyword relations. Any registry relationship keyword may act as the declaration keyword inside a data block, with optional per-endpoint cardinality brackets:

```ddn
ref places "places" @customer [one] -> @purchase [zeromany] { enforcement: database; }
```

is exactly `relation places "places" @customer -> @purchase { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; }`. Each bracket is optional independently; an OMITTED bracket means the mark property is omitted — never defaulted — so the omitted-versus-asserted distinction survives intact. Enforcement is never implied: a compact `ref` without `enforcement` in the body has no enforcement property, exactly like the canonical form. Registered relationship aliases spell the same kind (`transfers_to t @a -> @b;` ≡ `kind: flow`), and extension (dotted) relationship kinds opt in through a registry-declared `alias` the same way object kinds do (e.g. `req.satisfies` declares `satisfies`). Endpoint member syntax is unchanged: `@order.customer_id [one]` keeps the field/port binding. Repeating `kind:` in the body is a duplicate property (DDN011); a compact verb without endpoints parses and fails build exactly like a canonical endpoint-less relation (DDN055).

Disambiguation. Verb words are contextual under the same rule as kind words: declaration position inside a data block, followed by an identifier. A word registered as BOTH an object kind and a relationship (`note`, `report`, `test`, `decision`, `issue`, `schedule`, `snapshot`, `export`, `trigger`, `namespace`) reads as a relation only when `@` endpoints follow the id/label — `note n "N" {}` stays a typed object, `note n @a -> @b {}` is a relation. The structural keywords `flow` and `domain` never act as verbs, so `object ref "…" { kind: table; }` and `flow f {}` keep their meaning.

Named relation batches. Relations sharing a kind and configuration declare once:

```ddn
relations depends {
 enforcement: undecided;                  // shared properties, canonical names
 dep_a "a" @x -> @y;
 dep_b "b" @y -> @z { lane: hot; }        // per-entry body overrides shared
}
```

expands to one canonical `relation` per entry with the kind taken from the batch header. Batch-shared properties merge UNDER per-entry properties — per-entry wins on conflict, the same precedence idiom as format overrides. Every entry carries its own id, label and endpoints (bracket marks allowed), so identity is never positional and legend keys, routes and references address entries by their own ids. The header fixes the kind, so `kind:` in a shared or entry position is a duplicate property (DDN011). The header word must be a relationship keyword or declared alias; `relations` followed by anything else is not a batch, and a `relations:` property inside a data block keeps its property meaning. Anonymous arrow chains are deliberately NOT part of this form.

## Compact authoring (phase 3)

One-line view headers follow the same desugar contract: the parser expands the header to the identical canonical view declaration, so `DDN.semanticJSON`, rendered SVG and validation outcomes are indistinguishable from the verbose form.

```ddn
view erd: @sales as "erd.crowfoot@1";
```

is exactly `view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }`. The datasource is a single reference or an explicit list (`view both: [@orders, @customers] as "ddn@1";`), and the optional label keeps its existing position after the id (`view erd "Sales ERD": @sales as "erd.crowfoot@1";`). The header supplies `data` — and `projection` when `as` is present — only; an optional body still merges exactly like canonical properties and groups:

```ddn
view erd: @sales as "erd.crowfoot@1" {
 format: @styles.technical;
 layout { algorithm: layered; }
}
```

Profile implies kind. The versioned profile string uniquely identifies the projection kind — verified against `registry/profiles/catalogue.json`: every registered profile id maps to exactly one projection (`erd.crowfoot@1` → `graph`), including profiles that share a stem (`uml.usecase@1`, `uml.usecase@2`). The expansion sets `projection.kind` from the profile's registered kind; an unknown or ambiguous profile string in a header is a coded parse error (DDN-E015), never a guess — write the canonical `projection` block for unregistered profiles. Omitting `as` mirrors the default-profile behaviour exactly: no projection block is created and the documented defaults apply at build.

Conflicts. The header owns the projection when `as` is present, so a body `projection {…}` block or `projection:` property is a coded parse error (DDN-E015) — write either the header form or the canonical projection, not both. A body `data:` property after a header datasource stays a plain duplicate property (DDN011). As with phases 1–2, the normalizer never rewrites verbose↔compact headers; authoring edits stay token-precise on the header form.

## Compact authoring (phase 4)

Keyed tabular records follow the same desugar contract: a `records` block is a data block whose column order is declared once, and the parser expands every row to the identical canonical record-object declaration — per-row identity, column order, scalar types and the missing/null/undecided distinction preserved — so `DDN.semanticJSON`, rendered SVG and validation outcomes are indistinguishable from the verbose form.

```ddn
ddn "0.5";
module "shop.facts";
records metrics {
 columns: label, value, unit;
 label_column: label;
 row m1: "Alpha", 10, "ms";
 row m2: missing, null, "ms";
 row m3: "Gamma", 30, "ms" { note: "outlier"; };
}
```

Each `row <id>:` is exactly `object <id> "<label>" { kind: record; x_record: { <column>: <value>, … } }` — the row above desugars to `object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }`. Column order maps values to `x_record` keys positionally; `missing`, `null`, `undecided`/`not_applicable`/`conflicting` keep their canonical literal semantics. Row values are scalar literals only (string, number, quantity, boolean, null, missing, the state words, or a bare word); references, arrays and nested records are a coded parse error (DDN-E016).

Labels. The optional `label_column` names the column that supplies each row's display label: a string (or finite number, coerced) becomes the object label; any other scalar — including `missing` and `null` — falls back to the row id, mirroring the canonical `label||id` display rule. Without a `label_column` the label is the row id (the same convention the refresh tool uses when it appends records).

Row identity and refresh. Row ids ARE the record keys of the keyed refresh (see the data-refresh contract): refreshing a `records` block targets rows by id, and keyed add/remove/update works against the compact source. Updates rewrite a touched row as its canonical object form in place (preserving its display label and any extra body properties); removals delete the row statement; additions are appended in canonical object form. Canonical data members — object/relation declarations, typed declarations, relation batches — mix into a records body freely, which is what makes that round-trip legal.

Bodies and conflicts. A row's optional body carries extra PROPERTIES only, merged onto the record object under canonical duplicate rules (`kind:` or `x_record:` inside is DDN011, since the row supplies both); nested declarations inside a row body are a coded parse error (DDN-E016). The `columns` and `label_column` directives must precede every row (DDN-E016), are singular (DDN011), and `label_column` must name a declared column (DDN-E016). A column count mismatch is a coded parse error (DDN-E016) naming the row and the expected/actual counts. As with phases 1–3, the normalizer never rewrites verbose↔compact records.

## Compact authoring (phase 5)

Author-controlled reuse follows the same desugar contract, one step later in the pipeline: definitions are top-level templates and each `use:` application expands in the workspace assembly to the identical canonical AST as the handwritten inline form BEFORE indexing, so `DDN.semanticJSON`, rendered SVG, validation outcomes and every expanded identity are indistinguishable from the verbose form (no synthetic prefixes, no IR/renderer changes).

```ddn
fields audit { field created_at; field updated_at; }        // named field group
relation_props softref { enforcement: undecided; }          // relation property set
preset std_pulse { motion: pulse; speed: 90; }              // property preset (motion: B1-033 keys)
fragment audit_pair { object log_a {} object log_b {} }     // include-by-reference fragment

data model {
 use: @audit_pair;                                          // fragment application
 table customer { fields { use: @audit; id { key: primary; } } }
 ref r @customer -> @log_a { use: @softref; enforcement: database; }
 transfers_to updates @customer -> @log_b { use: @std_pulse; }
}
```

Definition kinds and application sites. Five top-level definition keywords — `fields`, `ports` (member groups, applied inside a `fields {}`/`ports {}` group of the same kind), `relation_props` (properties, applied to relation bodies only), `preset` (properties, applied to any element/relation body and to view-level flow blocks — a motion preset is simply a preset carrying B1-033 keys) and `fragment` (data members, applied inside a data or records block). Applications use `use: @name;` or a list `use: [@a, @b];`. Applying the wrong definition kind at a site, applying in a non-application context (view bodies, `place`/`route`, batch headers), naming an unknown definition, or writing `use:` inside a definition body (definitions are closed templates — no nesting, hence no cycles) are all coded errors (DDN-E017). Definitions resolve across imports like any module-scope declaration.

Precedence and assertion (D2/D3). Local in-declaration properties override applied presets. Two presets applied together that assert the same property with different values are a coded error (DDN-E017) UNLESS the declaration also declares that property locally (the local value resolves the conflict); equal values are not a conflict. A preset-applied property is ASSERTED on the expanded declaration — present exactly as if written inline, never omitted — and a preset never adds properties the author did not select: only the named definitions' own properties apply. Member expansion preserves declaration order around local members; a member id collision after expansion is the ordinary duplicate declaration (DDN024).

Versioning (D4). A definition may declare `version: N` (optional, integer). It is DOCUMENTARY ONLY — a stability signal for human readers and a future compatibility hook. Expansion ignores it semantically and never merges it into applications; do not rely on it for behaviour. A non-integer version is a coded error (DDN-E017).

Edit scope (D8). Inspector/authoring edits after expansion write to the DECLARATION SITE, never the shared definition: a property edit on a preset-using declaration inserts a local override into that declaration's body (which then wins by the precedence rule), and member-level edits of an expanded field/port/fragment member are refused with a coded error (DDN-E005) rather than rewriting the shared template. See `docs/developers/authoring-sources.md`.

Scope note. Parameterized fragments (`fragment f(name) {…}` substitution) are deliberately NOT in this phase; fragments are unparameterized include-by-reference. The deferral is recorded in `DDN-GAPS.md`.


## Recursive members

```ddn
field contacts {
 shape: array;
 presence: optional;
 fields {field kind;field value {nullable: true;}}
}
```

The resolved children have their own IDs, parent IDs, depth and dotted path. `@model.customer.contacts.value` is a field endpoint. Hiding child rows does not change that endpoint identity. Arrays/maps/sets/variants are structural declarations, not an implicit choice of SQL datatype or separate database table.

## Errors and limits

The reader limits source size and nesting to protect local tools from resource exhaustion. Compile errors carry source/offset information where available. The semantic schema checker supports the explicitly listed subset in `registry/capabilities.json`; it is not a complete JSON Schema evaluator. Unknown extensions are preserved with warnings in logical mode and rejected in strict mode unless registered.
