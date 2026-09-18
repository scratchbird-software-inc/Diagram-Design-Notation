# DDN 0.3 — Data model and executable contracts

The canonical model records elements, recursive fields, ports, relations and typed assertions. A view occurrence is not a deployed copy. A SQL namespace is not a host; a logical shard is not a replica. Definition, instance, fragment and copy relationships retain separate IDs and declared responsibilities.

## Semantic identities

Element identity is module/path or an explicit `uid`. Field identity is independent of its visible label. Nested field parents and paths are materialized in the resolved model. Imports and view selections do not duplicate elements. A declared sample column binds a field identity, not merely a column heading.

## Domains and representation

A domain carries shared meaning before a physical representation is selected. A field's established `domain` reference must resolve to a semantic domain. Candidate relationships remain proposals. The renderer can expose domains and datatypes independently; neither display choice changes model semantics. An SQL-domain kind is different from a pre-implementation semantic domain.

## Structure and presence

Field `shape` is scalar, object, record, array, map, set or variant. `presence: optional` and `nullable: true` are independent. A variant requires distinct alternative names and an explicit discriminator. These declarations describe shape; they do not substitute for a full JSON document validator. Sample `missing` and `null` remain different values. Samples do not silently establish enumeration, uniqueness or datatype constraints.

## Relationships

Every registered relationship has source/target kind constraints, member-endpoint applicability and self-relationship policy. Invalid known kinds fail. An unspecified sketch kind causes a deferred-check warning; strict mode refuses that unproven endpoint. Structural multiplicity markers cannot be placed on a replication/flow edge. Replication from a team to a table fails; a valid table/copy-to-table/copy relation remains representable.

Registered `x_erp` field metadata checks nullable flags and the bounded proposed SQL type vocabulary. Table metadata validates required fields and key membership. Relation metadata validates join tuple names, same-company tuple presence and the distinction between database and reconciliation enforcement. These are logical checks, not installation of physical constraints.

## Business assertions

`x_affinity` declares field comparisons and enforcement responsibility. `x_reconciliation` declares idempotency identity, pending/accepted/rejected/compensated states, timeout, compensation and evidence obligations. `x_constraint` describes uniqueness, half-open non-overlap and immutable-state guards for supplied fixtures. A check over sample rows cannot establish race-free behavior in a database engine.

`x_ui` binds controls to fields and requires command authorization, validation, concurrency, failure and audit contracts. `x_report` names grain, source fields, aggregations, cutoff and reconciliation. These are model contracts, not executable UI applications or report SQL.

`x_requirement`, `x_evidence`, and `x_custody` model review obligations and the evidence they require. An accepted requirement needs evidence references; a passing evidence declaration needs a digest. The compiler does not authenticate the digest's origin or the signer's professional authority.

Full machine structure is in `schema/resolved.schema.json`; endpoint contracts and extension schemas are in `registry/`.
