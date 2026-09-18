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

## Values and punctuation

Properties end in semicolons. Declarations without bodies also end in semicolons. Blocks can have an optional trailing semicolon. Arrays accept trailing commas. Records use colon-separated entries with comma or semicolon separators. Strings use JSON-style escapes. Comments are `//` or non-nesting `/* ... */`.

Numbers are finite. Lengths are `px`, `pt`, `mm`, `cm`, or `in`; temporal quantities are `ms`, `s`, `min`, `h`, or `d`. Conversion to geometry rejects temporal units. `true`, `false`, `null`, `missing`, `undecided`, `not_applicable`, and `conflicting` are distinct values. A quoted `"undecided"` is a string, not an unknown-state assertion.

## Declaration contexts

At document scope: `data`, `format`, and `view`. Within data: `object`, `domain`, `sample`, `flow`, `assertion`, and `relation`. Objects can contain `fields` and `ports` groups; a field can recursively contain a `fields` group. Named format declarations include `notation`, `style`, `layout`, `display`, `publication`, `legend`, `validation`, `export`, `keyset`, and `bundle`. Views reference these and may contain local property groups, `place`, `route`, `frame`, and `subdiagram` declarations.

Only relations have `@source -> @target` endpoints. Relationships belong to data, never to a formatting override. A renderer MUST NOT invent a relation because two shapes touch. `place @object {at:[0px,0px];}` is optional. Omit it for automatic layout. A placement body can contain size hints alone.

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
