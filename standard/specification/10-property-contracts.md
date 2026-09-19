# Typed semantic-property contracts

This chapter defines the core production property vocabulary. It supplements, rather than replaces, the 165-item descriptive metadata inventory. The demonstrator preserves many values without enforcing all of these rules; do not mistake successful reference parsing for M1 semantic validation.

## Value and applicability rules

Properties omitted from source are **not asserted**. An explicit `undecided` is a design assertion. `not_applicable` is permitted only when the target kind and selected profile justify it. `null` is a value, never a synonym for absence. The formatter must not populate absent properties with guessed defaults.

Lengths use px, pt, mm or in; time durations use ms, s, min, h or d. Absolute timestamp fields use an explicit time-zone offset where they represent instants. Units are checked by property category, not by merely accepting a number. Locale must not reinterpret decimal separators or timestamps.

Registered fields are subject to target applicability and validation stage. Summary strings in sketch records must be visibly marked incomplete for a physical or observed-state claim. Unknown unqualified properties produce a profile diagnostic; declared namespaced extension properties require their extension contract. This requirement is stricter than the demonstrator's generic metadata preservation.

A union of value types is not a license to choose a semantically different interpretation at render time. References remain references; code/expression records name their language, and their contents are never run by a diagram renderer.

The machine contract is `registry/data-properties.json`. Its targets and validation constraints are normative for this proposal. Format/style properties have their own registry in `registry/profile-properties.json`.

## Identity and evidence

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `uid` | element, field, port, relation | nonempty string | Workspace-unique stable identity; compare exactly, do not fetch it as a URL. |

| `description` | element, field, port, relation | string | Literal explanatory content, never executable markup. |

| `aliases` | element, field, port, relation | string[] | Alternative display/search names; do not introduce duplicate semantic identities. |

## Element identity

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `kind` | element | registered kind keyword | Canonical registry ID after alias resolution; display look cannot change it. |

| `level` | element | concept/definition/instance/fragment/copy | Omission is permitted in sketches; a view occurrence is not a data level. |

| `maturity` | element | draft/review/approved/deprecated/retired/rejected or undecided | Independent of style, runtime health and evidence. |

| `meaning` | element | string | Semantic definition; no implicit datatype selection. |

| `workload` | element | array of oltp/olap/mixed/streaming/batch | An explicitly mixed workload may carry multiple compatible values. |

| `role` | element | authoritative/derived/cache/archive/primary/follower | Include authority or replica scope where claimed; incompatible roles require distinct assertions. |

| `location` | element | local/cloud/edge | Applicable to deployment scopes and instances; not automatic placement for abstract concepts. |

| `distribution` | element | hash/range/list/composite/unpartitioned | Requires a declared partition policy before physical implementation claims. |

| `representation` | element | reference or structured record | Domain-to-platform representation, not a universal datatype. |

## Fields and shape

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `shape` | field | scalar/object/record/array/map/set/variant | Structural category; optional nested fields do not imply a separate stored object. |

| `key` | field | primary/candidate/business/partition/clustering | A shorthand single key role. Composite/multiple roles require referenced key definitions. |

| `domain` | field | reference to semantic domain | Established meaning binding, not a candidate suggestion or an SQL datatype. |

| `datatype` | field | string or representation binding reference | Physical profile interprets it; parser never assumes a vendor type universally exists. |

| `presence` | field | required/optional | Required presence and nullable values are independent. |

| `nullable` | field | boolean | True permits null; it does not mean the property can be absent. |

| `min_items` | field | nonnegative integer | Arrays/sets; must not exceed max_items when finite. |

| `max_items` | field | nonnegative integer or unbounded | Arrays/sets; is not maximum rows in a dataset. |

| `ordered` | field | boolean | A set defaults are not invented from examples; ordering scope must be explicit. |

| `unique` | field | boolean | State whether item identity/value uniqueness is intended; enforcement is separate. |

| `default` | field | literal or expression record | Record distinguishes a literal value from code; drawing never evaluates it. |

| `generated` | field | expression record | Name language, text and evaluation scope; no evaluation during rendering. |

| `discriminator` | field | field reference | Union variants must specify unique matching cases where closed/discriminated. |

| `variants` | field | reference[] | Each target is a shape definition; mutual recursion must be represented without infinite expansion. |

## Domains and bindings

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `allowed_values` | domain, element | literal[] or enumeration reference | Exhaustive only when explicitly declared; never inferred from samples. |

| `unit` | domain, element | unit definition reference | Quantity meaning, conversion and precision are defined by the unit profile. |

| `normalization` | domain, element | rule reference or record | Does not silently transform identifiers or literal source sample values. |

| `equality` | domain, element | rule reference or string | Explicit comparison scope; physical collation binding can differ by platform. |

| `platform` | domain, element | string | Binding applicability, not a remote service to contact. |

| `platform_version` | domain, element | string | Physical profile version; cannot be replaced silently by latest. |

| `precision` | domain, element | nonnegative integer | Applicable representation specifies decimal/binary/significant-digit interpretation. |

| `scale` | domain, element | integer | Applicable numeric binding supplies units and valid range. |

## Relations

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `kind` | relation | registered relation keyword | Normalizes to a fixed family, verb, orientation and compatible endpoints. |

| `source_mark` | relation | registered structural endpoint | Valid only where relation semantics permit participation or composition. |

| `target_mark` | relation | registered structural endpoint | At target B describes how many B instances per one A; never packet count. |

The crow's-foot cardinality value set is `one` (exactly one — bar and bar), `zeroone` (zero or one — circle and bar), `many` (one or many — bar and crowfoot) and `zeromany` (zero or many — circle and crowfoot); the marks are drawn by the shared endpoint renderer. Under the `erd.crowfoot@1` profile every view relation must be `ref` or `assoc` and must carry both `source_mark` and `target_mark` from this set; violations fail with `DDN-PJ087`, while a lexically unknown mark string still fails with `DDN114` under any profile.

| `enforcement` | relation | database/application/expected/none or undecided | A drawn relation does not imply database enforcement. |

| `scope` | relation | string or reference | Authority, delivery, ordering or other qualifier's named scope. |

| `source_min` | relation | nonnegative integer | Structural participation lower bound at source; must not exceed finite source_max. |

| `source_max` | relation | nonnegative integer or unbounded | Explicit bounds supersede compact endpoint shorthand only consistently. |

| `target_min` | relation | nonnegative integer | Structural participation lower bound at target. |

| `target_max` | relation | nonnegative integer or unbounded | Explicit numeric limits must agree with compact displayed symbols. |

## Flow contract

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `capture` | flow, relation | cdc/snapshot/polling/application/manual | Capture method is separate from transport and transformation. |

| `transport` | flow, relation | string or channel reference | For example kafka; no delivery guarantee is inferred from the name. |

| `transformation` | flow, relation | string or activity reference | An overview description should refine to activities when detailed validation is required. |

| `cadence` | flow, relation | continuous/batch/microbatch/on_demand | Schedule/timezone is additional when relevant. |

| `delivery` | flow, relation | requirement/evidence record or undecided | Delivery record fields required and verified remain independent assertions. |

| `payload` | flow, relation | shape reference | Payload identity/version, not a copy of the schema inside every connector. |

| `ordering` | flow, relation | scope record | Total/per-key/per-partition ordering must identify the relevant stream and key. |

| `initial_load` | flow, relation | flow/activity reference | Initial snapshot/catch-up coordination is not implied by CDC. |

| `delete_handling` | flow, relation | rule/reference | Explicit deletion/tombstone policy; drawing an arrow does not establish completeness. |

| `retry` | flow, relation | policy record/reference | Attempts, backoff and exhaustion target; not an execution loop inferred from geometry. |

| `freshness` | flow, relation | duration requirement/evidence record | Duration is measured relative to the declared clock and observation point. |

## Time and recovery

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `temporal` | element, flow | current/valid/recorded/bitemporal/event_history/snapshot | Temporal categories do not imply PITR or complete reconstructability. |

| `time` | element, flow | structured time-axis record | Keyed valid and recorded axes or overview descriptions; production requires field/system/interval details. |

| `time.valid` | element, flow | axis record | Contains start/end field refs, business clock, interval semantics and open-end representation. |

| `time.recorded` | element, flow | axis record | Contains start/end fields, named recording system and correction semantics. |

| `time.retention` | element, flow | duration or policy reference | Retention scope must identify which axes, rows, logs or snapshots it covers. |

| `time.event` | element, flow | field reference | Occurrence time; distinct from arrival and processing timestamps. |

| `time.arrival` | element, flow | field reference | Ingestion timestamp of a named system; not automatically business-valid time. |

| `time.processing` | element, flow | field reference | Processing timestamp tied to an execution/system. |

| `snapshot_at` | element, flow | timestamp or version reference | Consistency scope and source completeness must be explicit for recovery claims. |

| `recovery_window` | element, flow | interval/policy record | PITR scope, oldest/newest recoverable state, backup/log evidence. |

## Deployment

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `provider` | element | string | Provider identity; never infer region or capabilities from a logo. |

| `region` | element | reference or string | Scope within provider/account; not a globally unique bare region token. |

| `environment` | element | string/reference | Intended environment; production does not imply healthy. |

| `partition_key` | element | ordered field references | All fields belong to the partitioned definition or an explicit mapping. |

| `partition_rule` | element | rule reference/record | Hash/range/version and boundaries are explicit policy information. |

| `replication_factor` | element | positive integer | State whether the primary is counted and which fragment/set the count applies to. |

| `replica_role` | element | primary/follower/multiwriter | Belongs to a copy with named coordination scope and observation time when observed. |

| `consistency` | element | policy record | Scope must specify read/write/replication semantics rather than one unlabeled word. |

| `residency` | element | policy/reference | Allowed locations and evidence are separate; a frame alone is not proof. |

## Governance and SQL metadata

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `owner` | element, field, relation | responsible-party reference | Responsibility relationship, not physical containment. |

| `classification` | element, field, relation | classification reference/string | Inheritance only under an explicitly selected governance profile. |

| `contract` | element, field, relation | contract reference | Contract version and producer/consumer roles remain resolvable. |

| `quality` | element, field, relation | rule/assertion references | Validation result and requirement are independent. |

| `dialect` | element, field, relation | string | SQL dialect/platform profile; syntax is not executed by the renderer. |

| `definition` | element, field, relation | text/code-reference record | Explicit content/language; remote content is not fetched without resolver authority. |

| `parameters` | element, field, relation | parameter-definition references | Parameters are not mislabeled as storage columns. |

| `refresh` | element, field, relation | policy record | Materialized view refresh method, schedule and scope. |

| `index_method` | element, field, relation | string | Validated only against the selected platform/version profile. |

## Samples

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `mode` | sample | synthetic/sanitized/observed/expected/counterexample | A sample's role controls validation expectations and disclosure rules. |

| `columns` | sample | ordered field references | Every entry resolves to a field identity, not a coincidental displayed name. |

| `rows` | sample | arrays of literal values | Each row has exactly columns.length cells. Null and missing stay distinct. |

| `source` | sample | evidence reference/string | Required for observed samples; no implicit authorization to publish the contents. |

| `model_revision` | sample | revision reference/string | The design context of the example, not the time in its data cells. |

| `expected` | sample | result/assertion references | Required when a sample is promoted to an executable test fixture. |

## Assertions

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `subject` | assertion | reference | Object, field, relation or other asserted subject. |

| `property` | assertion | property-path string | Resolvable in the selected property/extension profile. |

| `value` | assertion | typed value | Must match the property's applicable value contract when known. |

| `state` | assertion | known/undecided/not_applicable/conflicting | Absent is no assertion; hidden is only a view operation. |

| `basis` | assertion | intended/observed/inferred/measured/verified | Requirements and measurements never overwrite each other implicitly. |

| `source` | assertion | evidence reference/string | Mandatory for observed/measured/verified assertions. |

| `observed_at` | assertion | timestamp string | Explicit timezone/offset for absolute instants; never guessed from browser locale. |

| `confidence` | assertion | number in [0,1] or confidence scheme | Only meaningful with declared method; not a substitute for evidence. |

## Ports

| Property | Applies to | Value shape | Constraint |
|---|---|---|---|

| `direction` | port | input/output/inout | Relation orientation still comes from the connector; direction restricts compatible use. |

| `payload` | port | shape reference | Names the contract at an interface. |

| `binding` | port | field/port/element reference | Balanced collapsed views map each external port to a real internal interface. |


## Structured records and profile expansion

A time-axis record has `start`, optional `end`, `system` or `clock`, `interval` (`closed_open`, `closed_closed`, `open_closed`, `open_open`), and an explicit `open_end` representation when needed. A bitemporal physical claim requires both valid and recorded records, not just the summary badge.

A delivery record has independent `required` and `verified` entries. A verified entry references an evidence assertion whose scope matches the actual end-to-end path; a transport name cannot satisfy this requirement. An ordering record declares `scope`, `key` where relevant, and the responsible channel or processing system.

A code record has `language`, either `text` or a local authorized `source` reference, and optional `dialect`. A binding record has `platform`, optional `platform_version`, `type`, and optional constraints. Semantics such as a SQL precision limit belong to that platform binding, not to the generic SVG renderer.

Constraints, partition policies, recovery plans, entitlements and other rich concepts may be first-class objects with their own references instead of repeated inline records. When a profile supports both forms, it must define their identical normalized semantics. Production implementations must not treat the inline form as an unrelated fact.
