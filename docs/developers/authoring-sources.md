# Authoring `.ddn` sources

A `.ddn` file is plain text in the DDN language (current versions `0.3`,
`0.4`, `0.5`; `0.2` reads for compatibility). The grammar lives in
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

- `ddn "0.5";` — language version stamp. See spec `01-language.md`.
- `module` — namespace; every declaration id is module-qualified. See
  `01-language.md` and `02-data-model.md`.
- `import "…" as alias` — pulls another file's declarations in as
  `@alias.name`. See `03-views-and-reuse.md`.

## Data blocks: the model is the source of truth

`data` blocks declare `object`, `domain`, `relation`, and `sample`
definitions — never pictures. Kinds come from the registry
(`standard/registry/catalogue.json`: `table`, `application`, `process`,
`record`, …); relation verbs likewise (`references`, `assoc`, `flow`,
`uses_domain`, …). Fields nest (`field address { shape: object; }`), samples
carry synthetic example rows, and records for charts are objects with an
`x_record` payload. Full model semantics: `02-data-model.md`; property
contracts: `10-property-contracts.md`.

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
- Spacing hints (`tight`/`normal`/`loose`/`expanded`, B1-008): registered in
  `standard/registry/capabilities.json`, behavior pinned by
  `notation/tests/spacing-hints.js`.
- Publication sizes, subdiagrams, legends: `06-publication-and-subdiagrams.md`.

## Projections and profiles

`projection { kind: …; profile: "…"; … }` turns a view into a specific
diagram family: `chen`, `matrix`, `panels`, `table`, `chart`, `timeline`,
`fishbone`, `decision`, `sequence`, `timing`, or a specialised `graph`
profile. All 73 installed profiles are listed in
`standard/registry/profiles/catalogue.json` and each has a rendered example
in the gallery (`examples/gallery/index.html`). The projection chapters:
`16-profiles-and-projections.md` through `42-family-trees.md` (matrices and
panels 18, charts/time 19 + 22, lifecycles/rule tables 23, sequence 27,
BPMN 32, SysML 36, ArchiMate 37, and so on).

## Checking your work

```sh
node notation/cli/cli.js check your.ddn --workspace .
node notation/cli/cli.js render your.ddn --view overview --workspace . --out /tmp/o.svg
```

Diagnostics carry stable codes (`DDN0xx` core, `DDN-PJ0xx` projections,
`DDN-I0xx` interaction, `DDN-E0xx` API) — `07-reference-and-conformance.md`
is the conformance chapter. Programmatic authoring edits (the same
operations the visual designer uses) are documented in
[api-reference.md](api-reference.md) under `authoring`; the editing model
itself is spec `16-workspace-and-editing.md`.

More prose, lesson-style: `25-diagram-field-guide.md`. The largest
collection of real sources to copy from is `examples/basics/` (01–60).
