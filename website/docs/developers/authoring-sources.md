# Authoring `.ddn` sources

A `.ddn` file is plain text in the DDN language (current versions `0.3`,
`0.4`, `0.5`, `0.6`; `0.2` reads for compatibility). `0.6` is the DDN 0.8
dialect — a strict superset of `0.5`; see *0.8 additions* below. The grammar lives in
`standard/grammar/`; the normative chapters are `standard/specification/`.
This page is the tour; each section names the chapter with the full rules.

## File skeleton

```ddn
ddn "0.5";
module "shop.orders";
import "shared.ddn" as shared;

data model {
    object customer "Customer" { kind: table; fields { field customer_id; field name; } }
    object order "Order" { kind: table; fields { field order_id; field customer_id; } }
    relation order_customer @order.customer_id -> @customer.customer_id {
        kind: references; source_mark: zeromany; target_mark: one;
    }
}

view overview "Orders / shared model" {
    data: [@model];
    format: @shared.styles.technical;
}
```

- `ddn "0.5";` — language version stamp (accepted: `0.2`–`0.6`; write `0.6`
  when using the 0.8 features below). See spec `01-language.md` and
  `51-version-and-compatibility.md`.
- `module` — namespace; every declaration id is module-qualified. See
  `01-language.md` and `02-data-model.md`. A file may hold several
  `module "…";` sections, so a full design can live in one
  self-contained file; sibling sections reference each other by
  module-qualified id (`@otherModule.name`) with no import between them.
- `import "…" as alias` — pulls another file's declarations in as
  `@alias.name`. See `03-views-and-reuse.md`. Imports are file-level: they
  precede the first module header (canonical), or immediately follow the
  FIRST header in the legacy position. `DDNLive.io.bundle(files, entry)` and
  the CLI `bundle` command merge a workspace into one multi-section file with
  byte-identical rendering.

## Data blocks: the model is the source of truth

`data` blocks declare `object`, `domain`, `relation`, and `sample`
definitions — never pictures. Kinds come from the registry
(`standard/registry/catalogue.json`: `table`, `application`, `process`,
`record`, …); relation verbs likewise (`references`, `assoc`, `flow`,
`uses_domain`, …). Fields nest (`field address { shape: object; }`), samples
carry synthetic example rows, and records for charts are objects with an
`x_record` payload. Full model semantics: `02-data-model.md`; property
contracts: `10-property-contracts.md`.

## Reuse: presets and fragments (phase 5)

Repeated structure declares once as a top-level definition and applies with
`use: @name;` (or a list `use: [@a, @b];`). Expansion happens in the
workspace assembly, before indexing — the result is exactly the handwritten
inline form, identities included:

```ddn
fields audited { created_at; updated_at { datatype: "timestamp"; } }
relation_props governed { enforcement: database; }
preset gentle_pulse { motion: pulse; pulse_color: "#0E7490"; speed: 60; }
fragment audit_log { table audit_log "Audit log" { fields { event; } } }

data model {
    use: @audit_log;                        // fragment: data members
    table customer "Customer" {
        fields { use: @audited; customer_id { key: primary; } }
    }
    ref logs @customer -> @audit_log { use: @governed; }
    transfers_to events @customer -> @audit_log { use: @gentle_pulse; }
}
```

- `fields`/`ports` — member groups, applied inside a `fields {}`/`ports {}`
  group of the same kind; member order is preserved around local members.
- `relation_props` — property sets for relation bodies only.
- `preset` — property sets for any element/relation body and for view-level
  `flow` blocks; a motion preset is a preset carrying the motion keys.
- `fragment` — include-by-reference data members (unparameterized;
  parameterized fragments are deferred — see `DDN-GAPS.md`).

Precedence: local in-declaration properties override presets; two presets
conflicting on a property are a coded error (DDN-E017) unless the declaration
resolves the property locally. A preset-applied property is ASSERTED — it is
an explicit author decision, present on the expanded declaration — and only
the named definitions' own properties apply. `version: N` on a definition is
optional, integer, and documentary only (expansion ignores it). Definitions
are closed templates: `use:` inside a definition body, in a batch header, or
in a non-application context is a coded error (DDN-E017).

Edit scope (inspector/authoring tools): edits write to the DECLARATION SITE,
never the shared definition. A property edit on a preset-using declaration
inserts a local override into that declaration's body; member-level edits of
an expanded field/port/fragment member are refused (DDN-E005) — edit the
definition in source, or declare the member locally. See
`website/examples/basics/74-reusable-presets.ddn` for a runnable tour.

## Views: projections of the model

A `view` picks data (`data: [@model]`, optionally `select:` a subset) and a
presentation. Presentation is resolved from a **format bundle** — named
`style`, `layout`, `display`, `publication`, `legend` groups inside a
`format` block, composed into a `bundle` — with per-view inline overrides:

```ddn
view sketch "Orders / workshop sketch" {
    data: [@model];
    style { look: handDrawn; theme: forest; }
    layout { algorithm: layered; direction: right; routing: curved; curve: bezier; }
    spacing: loose;
    publication { size: content; fit: none; minimum_text: 8pt; }
}
```

- Looks, themes, fonts: `04-notation-and-looks.md`.
- Layout algorithms, routing modes, crossings: `05-routing.md`,
  `15-placement-and-low-light.md`, `13-curved-relations.md`,
  `26-local-endpoint-ordering.md`.
- Spacing hints (`tight`/`normal`/`loose`/`expanded`): registered in
  `standard/registry/capabilities.json`, behavior pinned by
  `notation/tests/spacing-hints.js`.
- Publication sizes, subdiagrams, legends: `06-publication-and-subdiagrams.md`.

## Projections and profiles

`projection { kind: …; profile: "…"; … }` turns a view into a specific
diagram family: `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`,
`fishbone`, `decision`, `sequence`, `timing`, `geo`, or a specialised `graph`
profile. All 150 installed profiles (12 projection kinds) are listed in
`standard/registry/profiles/catalogue.json` and each has a rendered example
in the gallery (`website/examples/gallery/index.html`). The projection chapters:
`16-profiles-and-projections.md` through `42-family-trees.md` (matrices and
panels 18, charts/time 19 + 22, lifecycles/rule tables 23, sequence 27,
BPMN 32, SysML 36, ArchiMate 37, and so on).

## 0.8 additions (source version `0.6`)

Files stamped `ddn "0.6";` can use the DDN 0.8 surface (normative chapters
`51-`…`58-`; everything in 0.5 keeps working, and an 0.8 construct in a ≤0.5
file is error DDN-V04):

- **View kinds and strictness** — `kind: flowchart; strictness: strict;` on a
  view declares the diagram family, attaches default profile/theme, and
  optionally enforces the family's vocabulary (ch. 52). Registered kinds:
  `ddn-native`, `flowchart`, `c4-context/container/component`, the five
  `uml-*` kinds, `chart-bar`/`chart-line`, `ladder`, `patent-figure`.
- **Themes** — `theme: colorblind_safe;` / `theme: mono_print;` re-skin paint
  only, never geometry or semantics (ch. 52).
- **Publication chrome** — `header`/`footer` runs with `$title`/`$page`/
  `$date`/`$view_id`/`$figure` variables, page `border`, page `background`
  (colour, PNG/WebP image, sanitized SVG pattern — workspace-relative paths
  only), and multi-view `publication_set` figure sets published with
  `cli.js publish … --set <name>` (ch. 53). Print-size lint (DDN-PS01–PS04,
  `--strict-print`) catches text/line weights that would be illegible at the
  declared paper size.
- **Text fit** — `text_fit: wrap|grow|shrink;` with `max_width`/`max_height`/
  `min_font` bounds, residual-overflow diagnostics (DDN-LW07/LW08), and
  `font_pin` for byte-stable cross-machine rendering (ch. 54).
- **Markings and metadata** — `marks: [forbidden|tentative]`, inert
  `assertion`/`assertions` claim text, `source:`/`generator:` provenance,
  `ref:` cross-reference anchors that render an element's `numeral` or label,
  and defined uid move/duplicate semantics (ch. 55).
- **CLI** — `verbs --from <kind> --to <kind>` endpoint-legality query,
  `--diagnostics json` with stable `{code,severity,file,line,view,message}`
  locations, `--content-size`, `--strict-print`, `--publication-date`,
  `publish --set` (ch. 56).

Runnable tours: `website/examples/basics/111-publication-chrome.ddn` (a
patent-style figure set with header/footer/border and reference numerals) and
`website/examples/basics/112-markings-metadata.ddn` (markings, assertions,
provenance, `ref:` anchors). The full authoring surface with verified
recipes: `website/download/DDN-AI-REFERENCE.md` §14.

## Checking your work

```sh
node notation/cli/cli.js check your.ddn --workspace.
node notation/cli/cli.js render your.ddn --view overview --workspace. --out /tmp/o.svg
```

Diagnostics carry stable codes (`DDN0xx` core, `DDN-PJ0xx` projections,
`DDN-I0xx` interaction, `DDN-E0xx` API) — `07-reference-and-conformance.md`
is the conformance chapter. Programmatic authoring edits (the same
operations the visual designer uses) are documented in
[api-reference.md](api-reference.md) under `authoring`; the editing model
itself is spec `16-workspace-and-editing.md`.

More prose, lesson-style: `25-diagram-field-guide.md`. The largest
collection of real sources to copy from is `website/examples/basics/` (numbered examples 01–108 plus support files).
