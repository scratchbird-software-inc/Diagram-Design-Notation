# Core element contracts

All omitted semantic properties remain absent. Drafts allow incomplete payloads; review checks the selected purpose and profile.

## EL01 — Workarea

Spatial surface governed by a diagramming method; owns placed views

Schema: `content_EL01`. Properties: `content.method`, `content.placements`, `content.origin`, `content.scopes`.

A method must resolve; extent grows with content; server paging is optional commercial infrastructure

## EL02 — View

A typed presentation and interaction boundary onto shared information

Schema: `content_EL02`. Properties: `content.method`, `content.profile`, `content.selection`, `content.appearances`.

Subtype must be allowed by workarea; visible objects obey that subtype; empty views are valid

## EL03 — Appearance

One occurrence of an object or relation within a view

Schema: `content_EL03`. Properties: `content.target`, `content.position`, `content.size`.

Target and owning view must resolve; several appearances may reference the same target

## EL04 — Region

A spatial frame, lane, panel or boundary inside a view

Schema: `content_EL04`. Properties: `content.bounds`, `content.title`, `content.role`, `content.layout`, `content.appearances`.

Visual containment alone creates no business ownership, execution or security boundary

## EL05 — Selection

A reusable explicit set or bounded query of model/data items

Schema: `content_EL05`. Properties: `content.references`, `content.filters`, `content.ordering`, `content.input_scope`, `content.query_revision`.

Explicit and query forms are distinct; unresolved references and failed queries are reported

## EL06 — Collection

A semantic group, ordered list or hierarchy

Schema: `content_EL06`. Properties: `content.role`, `content.members`, `content.ordering`, `content.hierarchy`, `content.duplicates`.

Set/list/tree policy controls duplicates and cycles; visual proximity does not establish membership

## EL07 — Subject

A named or unnamed domain concept whose detailed nature may still be undecided

Schema: `content_EL07`. Properties: `content.role`, `content.meaning`, `content.sections`.

No fields, key or datatype required for a draft native entity; specialized roles retain their own contracts

## EL08 — Domain

Reusable semantic meaning independent of physical datatype

Schema: `content_EL08`. Properties: `content.meaning`, `content.constraints`, `content.representations`, `content.allowed_values`, `content.unit`.

A provisional domain is legal; same label is not proof of identical meaning

## EL09 — ValueSchema

A value representation, enumeration, unit or structured shape

Schema: `content_EL09`. Properties: `content.shape`, `content.members`, `content.constraints`, `content.unit`, `content.platform`.

Optional, nullable and missing are distinct; units and dimensions must agree where calculated

## EL10 — Field

An independently addressable member, column, parameter or nested attribute

Schema: `content_EL10`. Properties: `content.parent`, `content.ordinal`, `content.domain`, `content.schema`, `content.datatype`, `content.key`, `content.constraints`, `content.comment`, `content.nullable`.

A blank or name-only native draft field is valid; required properties are checked only by selected completion profile

## EL11 — Port

An addressable input/output/role endpoint on an item

Schema: `content_EL11`. Properties: `content.owner`, `content.direction`, `content.role`, `content.domain`, `content.schema`, `content.binding`.

Endpoint compatibility follows the method; unresolved draft ports remain diagnostics, not invented matches

## EL12 — Dataset

A logical collection of data, stored data object or supplied data source

Schema: `content_EL12`. Properties: `content.schemas`, `content.grain`, `content.binding`, `content.data`.

Definition and loaded data are distinct; sample data does not establish universal constraints

## EL13 — Record

A typed row, sample, fixture or structured input value

Schema: `content_EL13`. Properties: `content.values`, `content.schema`, `content.source`, `content.timestamp`.

Record validation uses its declared schema; missing, null and unknown remain distinct

## EL14 — Actor

A person, team, organisation or external participant represented in the model

Schema: `content_EL14`. Properties: `content.role`, `content.display`, `content.external`.

A modelled person is not automatically an authenticated user or collaboration identity

## EL15 — Role

A responsibility or interaction role independent of its current holder

Schema: `content_EL15`. Properties: `content.responsibilities`, `content.scope`.

Role assignment does not silently grant application permissions

## EL16 — Resource

An infrastructure, application, service, physical or reusable operational resource

Schema: `content_EL16`. Properties: `content.role`, `content.properties`, `content.ports`, `content.capacities`, `content.deployment`, `content.location`.

Native resource properties are progressive; foreign roles retain their type rules

## EL17 — Activity

A unit of work, task, process, function or operation

Schema: `content_EL17`. Properties: `content.role`, `content.inputs`, `content.outputs`, `content.duration`, `content.state`, `content.instructions`.

Drawing a task does not execute it; gateway/operator roles have explicit subtype constraints

## EL18 — Message

A command, signal or communication payload definition

Schema: `content_EL18`. Properties: `content.role`, `content.schema`, `content.channel`, `content.correlation`.

Definition is distinct from an observed send/receive event

## EL19 — Event

A declared event type or a recorded occurrence

Schema: `content_EL19`. Properties: `content.form`, `content.time`, `content.source`, `content.payload`, `content.correlation`.

Occurrence form preserves supplied time and provenance; a planned event is not observed evidence

## EL20 — State

A lifecycle state or method-specific pseudostate

Schema: `content_EL20`. Properties: `content.role`, `content.entry`, `content.exit`, `content.states`.

Initial/final/history/choice constraints belong to the selected lifecycle profile

## EL21 — Rule

A constraint, condition, policy or decision-table rule

Schema: `content_EL21`. Properties: `content.role`, `content.expression`, `content.text`, `content.profile`, `content.parameters`, `content.severity`.

Text is inert; execution requires an explicit supported expression contract

## EL22 — Requirement

A required outcome or constraint with traceable verification

Schema: `content_EL22`. Properties: `content.statement`, `content.identifier`, `content.source`, `content.acceptance`.

A satisfies link is a claim; acceptance requires scoped evidence and checks

## EL23 — Goal

An intended outcome, objective or target direction

Schema: `content_EL23`. Properties: `content.statement`, `content.horizon`, `content.target`, `content.owner`.

Progress requires declared observations and calculation rules; no invented completion

## EL24 — Measure

A named quantitative definition

Schema: `content_EL24`. Properties: `content.unit`, `content.aggregation`, `content.formula`, `content.profile`, `content.grain`, `content.time_basis`, `content.missing`.

Calculations require compatible units and sufficient data; undefined is not zero

## EL25 — Observation

A recorded measurement, fact or inspection reading

Schema: `content_EL25`. Properties: `content.value`, `content.time`, `content.source`, `content.subject`, `content.measure`.

Observed facts remain distinguishable from predictions, samples and claims

## EL26 — Assertion

A hypothesis, risk, issue, threat or causal claim

Schema: `content_EL26`. Properties: `content.role`, `content.statement`, `content.confidence`, `content.status`, `content.likelihood`, `content.impact`, `content.basis`.

Likelihood/impact scales must be declared; a drawn causal arrow does not prove causation

## EL27 — Decision

A recorded choice with rationale and alternatives

Schema: `content_EL27`. Properties: `content.question`, `content.alternatives`, `content.choice`, `content.rationale`, `content.time`, `content.actor`.

A decision record is distinct from an executable decision table or process gateway

## EL28 — Assessment

A scored comparison, review or judgement against criteria

Schema: `content_EL28`. Properties: `content.criteria`, `content.scales`, `content.ratings`, `content.weights`, `content.result`, `content.reviewer`.

Weights and aggregation are explicit; missing scores cannot silently become zero

## EL29 — Evidence

An addressable supporting or contradicting evidence reference

Schema: `content_EL29`. Properties: `content.source`, `content.provenance`, `content.scope`, `content.digest`, `content.observed_at`, `content.result`.

Linking a source does not establish its truth; evidence must identify the supported scope

## EL30 — Text

An inert textual fragment, draft body, comment or DDNN topic

Schema: `content_EL30`. Properties: `content.text`, `content.format`, `content.language`, `content.external`.

Code/text remains inert; markup rendering follows the content profile

## EL31 — Document

An ordered composition of text, references and views

Schema: `content_EL31`. Properties: `content.sections`, `content.metadata`, `content.selections`.

Inclusions have declared live or pinned semantics; cycles must be detected

## EL32 — Asset

A file, image, binary resource or generated output artifact

Schema: `content_EL32`. Properties: `content.media_type`, `content.path`, `content.bytes`, `content.digest`, `content.origin`, `content.intrinsic_size`.

Availability and supported media are checked; unknown media is preserved without execution

## EL33 — Geometry

Domain geometry or geography independent of screen position

Schema: `content_EL33`. Properties: `content.geometry`.

Coordinate system and units required for calculation; screen drag does not rewrite domain coordinates

## EL34 — Scenario

A named set of assumptions and input overrides for comparison

Schema: `content_EL34`. Properties: `content.base`, `content.overrides`, `content.assumptions`, `content.horizon`.

Results record scenario and base revision; scenarios cannot silently replace accepted facts

## EL35 — Automation

A DDNA computation, check, transform or orchestration definition

Schema: `content_EL35`. Properties: `content.engine`, `content.version`, `content.inputs`, `content.steps`, `content.rules`, `content.limits`, `content.output_schema`.

No implicit arbitrary code; unsupported engines remain descriptive contracts

## EL36 — Run

One attempted execution or evaluation

Schema: `content_EL36`. Properties: `content.definition`, `content.definition_revision`, `content.inputs`, `content.started_at`, `content.ended_at`, `content.limits`, `content.status`, `content.actor`, `content.source`.

Run status and budget exhaustion explicit; retries are separate attempts

## EL37 — Result

An immutable calculation/check output or diagnostic set

Schema: `content_EL37`. Properties: `content.values`, `content.diagnostics`, `content.producer`, `content.input_revision`, `content.completeness`, `content.units`.

Partial/failed/stale results remain labelled and cannot masquerade as current success

## EL38 — Trace

An ordered or partially ordered record of events and execution observations

Schema: `content_EL38`. Properties: `content.events`, `content.ordering`, `content.time_basis`, `content.correlations`, `content.source`, `content.completeness`.

Replay does not execute the process; visual animation alone is not a trace

## EL39 — Annotation

A comment, pin, marker or review annotation attached to content

Schema: `content_EL39`. Properties: `content.role`, `content.target`, `content.text`, `content.group`, `content.attribution`.

Pins are not votes unless a voting contract explicitly says so

## EL40 — Session

A bounded facilitated or collaborative activity context

Schema: `content_EL40`. Properties: `content.purpose`, `content.phases`, `content.participants`, `content.contributions`, `content.visibility`.

Local modelling does not provide multi-user participation; service authority is explicit

## EL41 — Ballot

A formal voting instrument or individual submitted vote

Schema: `content_EL41`. Properties: `content.form`, `content.options`, `content.eligibility`, `content.limits`, `content.instrument`, `content.choices`, `content.actor`.

Group pins do not become ballots; duplicate/anonymous voting rules belong to the session contract

## EL42 — Publication

A repeatable specification for producing a static or interactive deliverable

Schema: `content_EL42`. Properties: `content.document`, `content.selection`, `content.format`, `content.profile`, `content.snapshot`, `content.adapter`.

Output records source revision and inclusion policy; live and static outputs remain distinct

## EL43 — Delivery

A requested or recorded delivery of a generated artifact

Schema: `content_EL43`. Properties: `content.artifact`, `content.destination`, `content.attempt`, `content.status`, `content.schedule`, `content.audit`.

Defining a destination does not authorize external publication; credentials are not model text

## EL44 — Change

A proposed or recorded mutation with an identified scope

Schema: `content_EL44`. Properties: `content.base_revision`, `content.operations`, `content.author`, `content.source`, `content.affected`, `content.outcome`.

Preconditions prevent applying to the wrong revision; destructive effects are visible

## EL45 — Snapshot

An immutable capture of selected model/data revisions

Schema: `content_EL45`. Properties: `content.scope`, `content.revisions`, `content.values`, `content.captured_at`, `content.digest`.

Snapshot immutability and completeness are explicit; it is not the current live model

## EL46 — Acceptance

A scoped decision accepting a particular captured state under a rule set

Schema: `content_EL46`. Properties: `content.snapshot`, `content.scope`, `content.rules`, `content.results`, `content.actor`, `content.at`.

Changes make current scope differ from accepted scope; they do not rewrite historical acceptance

## EL47 — Method

A versioned family/subtype rule contract

Schema: `content_EL47`. Properties: `content.parent`, `content.vocabulary`, `content.relations`, `content.projections`, `content.editing_actions`, `content.verification`, `content.defaults`.

Inheritance may refine rules; overlapping names are qualified; pack installation does not change existing versions

## EL48 — Style

A type-scoped presentation/default sheet

Schema: `content_EL48`. Properties: `content.kind`, `content.rules`.

File overrides CSS overrides standard; CSS cannot silently change identity, facts or method validity

## EL49 — Adapter

A declared interface to data, calculation, import/export or external services

Schema: `content_EL49`. Properties: `content.profile`, `content.version`, `content.direction`, `content.input_schema`, `content.output_schema`, `content.limits`, `content.capability`, `content.source`.

A declaration is not executable authority; missing adapters produce explicit diagnostics

## EL50 — Binding

An explicit mapping between meanings, fields, ports or an external representation

Schema: `content_EL50`. Properties: `content.source`, `content.target`, `content.mapping`, `content.profile`, `content.transformation`, `content.loss`.

Domain binding does not collapse semantic and physical types; unresolved mappings remain visible

## EL51 — Schedule

A planning or invocation time rule

Schema: `content_EL51`. Properties: `content.timezone`, `content.calendar`, `content.start`, `content.end`, `content.duration`, `content.recurrence`, `content.target`.

Planned dates are distinct from observed events; server invocation is a separate capability

## EL52 — AccessPolicy

A modelled authorization rule or an application-enforced policy reference

Schema: `content_EL52`. Properties: `content.rules`, `content.authority`, `content.enforcement`.

A diagram policy is descriptive until an identified service enforces it

## EL53 — Template

A reusable, parameterised arrangement or method recipe

Schema: `content_EL53`. Properties: `content.parameters`, `content.defaults`, `content.fragment`, `content.view`, `content.method`, `content.profile`, `content.version`.

Instantiation distinguishes shared references from new objects; no hidden identity duplication

## EL54 — Namespace

A named source/module or platform naming scope

Schema: `content_EL54`. Properties: `content.scope_role`, `content.parent`, `content.names`, `content.imports`, `content.exports`.

Namespace identity is distinct from spatial workarea; repeated display names may coexist

## EL55 — Association

A reified association with named participant roles, including n-ary facts

Schema: `content_EL55`. Properties: `content.role`, `content.participants`, `content.fields`, `content.constraints`.

Two-plus or incomplete draft participants allowed by profile; n-ary meaning must not be flattened into independent binary links
