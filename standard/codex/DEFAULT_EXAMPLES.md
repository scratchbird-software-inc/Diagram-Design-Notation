# Defaults in short diagrams

These are source examples under the agreed new language, not examples accepted by the old parser.

```text
erd Sales
    Customer
    Order
    connect Customer to Order
```

This supplies native ERD context, `entity` roles and the `assoc` default connector. The file's implicit workarea is DDN. Status is Draft; look is classic; font is sans at 16 local pixels. The native entity body is title-only. Missing fields, types, keys, domains and cardinality remain absent.

```text
mindmap Ideas
    Launch
    Audience
    connect Launch to Audience
```

The common font/status/workarea defaults are the same. The selected `mindmap.basic@1` profile supplies the mind-map layout and its one-root/one-parent/acyclic completion rules. Those rules do not apply to the ERD. Retained concept roles keep their own symbol defaults.

```text
erd Sales as field:lt:40:8:6.domain::30.key
    Customer
        data
            field.domain.key
            Key..primary
            Name.CustomerName
```

The local `data` header overrides the view header for that entity. To use the view template's sizing settings in a local header, repeat those intentional differences there or set eligible table defaults through the view's defaults block. Omitted percentages share remaining width; absent cells remain empty. The view template is not a way to alter the meaning of a separately supplied dataset.

```text
document DesignReport as pdf
    use Sales
```

This is an output-oriented view. PDF supplies A4 portrait; narrative notes are complete in the output; output captures a coherent revision. A dashboard document instead defaults to live supplied updates. No document declaration automatically sends its output.

Read-only lookups from this directory:

```sh
python3 query_codex.py --profile mindmap.basic@1 --property layout.algorithm
python3 query_codex.py --owner appearance --role entity --property symbol.color
python3 query_codex.py --owner document --format pdf --property page.size
python3 query_codex.py --catalogue C093
```

A lookup reports the value or absence rule and its provenance. `PROPERTIES.md` lists every owner/path; the machine indexes provide its type, applicability and source constraints.
