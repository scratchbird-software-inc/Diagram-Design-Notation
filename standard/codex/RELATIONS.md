# Relation pattern contracts

All omitted semantic properties remain absent. Drafts allow incomplete payloads; review checks the selected purpose and profile.

## RL01 — contains

Owner contains a semantically owned child

Schema: `qualifiers_RL01`. Properties: `qualifiers.scheme`, `qualifiers.source`, `qualifiers.target`.

Ownership scheme explicit; at most one owner per scheme; no ownership cycles; never inferred from screen nesting

## RL02 — member

Collection contains a member without transferring ownership

Schema: `qualifiers_RL02`. Properties: `qualifiers.ordinal`, `qualifiers.hierarchy`, `qualifiers.duplicates`, `qualifiers.source`, `qualifiers.target`.

Ordinal for lists; tree collections enforce one parent and acyclicity; duplicates depend on collection policy

## RL03 — appears

Appearance refers to the shared item it displays

Schema: `qualifiers_RL03`. Properties: `qualifiers.source`, `qualifiers.target`.

Exactly one target; relation targets allowed; changing position does not modify the target

## RL04 — places

Surface places a presentation occurrence

Schema: `qualifiers_RL04`. Properties: `qualifiers.source`, `qualifiers.target`.

Workarea places views; view places appearances/regions; region places appearances/regions; visual cycles forbidden

## RL05 — selects

Selector identifies content to include or assess

Schema: `qualifiers_RL05`. Properties: `qualifiers.ordering`, `qualifiers.exclusions`, `qualifiers.source`, `qualifiers.target`.

Explicit set or bounded query; order and exclusion explicit; no permission grant

## RL06 — uses-method

Presentation scope uses a versioned method/subtype

Schema: `qualifiers_RL06`. Properties: `qualifiers.source`, `qualifiers.target`.

View method must be permitted by workarea method; exactly one effective method per view

## RL07 — uses-style

Presentation subject uses a type-scoped sheet

Schema: `qualifiers_RL07`. Properties: `qualifiers.priority`, `qualifiers.source`, `qualifiers.target`.

File overrides CSS overrides standard; matching/specificity deterministic

## RL08 — has-field

Owner declares an addressable member

Schema: `qualifiers_RL08`. Properties: `qualifiers.ordinal`, `qualifiers.source`, `qualifiers.target`.

Field has one structural owner; ordinal; no parent cycle; incomplete native fields legal

## RL09 — has-port

Owner exposes an addressable endpoint

Schema: `qualifiers_RL09`. Properties: `qualifiers.direction`, `qualifiers.role`, `qualifiers.source`, `qualifiers.target`.

One structural owner; direction and role optional until subtype requires them

## RL10 — has-domain

Value-bearing member uses a semantic domain

Schema: `qualifiers_RL10`. Properties: `qualifiers.source`, `qualifiers.target`.

Provisional named domains legal; no physical datatype implied

## RL11 — has-schema

Value-bearing subject uses a representation contract

Schema: `qualifiers_RL11`. Properties: `qualifiers.source`, `qualifiers.target`.

Explicit binding when semantic/physical conversion needed; absent is unknown

## RL12 — instance-of

Instance refers to its declared definition/type

Schema: `qualifiers_RL12`. Properties: `qualifiers.source`, `qualifiers.target`.

Role-specific definition/occurrence compatibility; no self-type or accidental identity merge

## RL13 — specializes

More specific type refines a general type

Schema: `qualifiers_RL13`. Properties: `qualifiers.family`, `qualifiers.source`, `qualifiers.target`.

Same compatible type family; acyclic subtype inheritance; method refinements cannot silently weaken rules

## RL14 — realizes

Concrete item realises an abstract item

Schema: `qualifiers_RL14`. Properties: `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

A modelling claim with optional evidence; no automatic acceptance

## RL15 — part-of

Part belongs to a composite whole

Schema: `qualifiers_RL15`. Properties: `qualifiers.scheme`, `qualifiers.exclusive`, `qualifiers.source`, `qualifiers.target`.

Composition scheme controls exclusive ownership and cycles; differs from visual containment

## RL16 — references

Source explicitly refers to a target

Schema: `qualifiers_RL16`. Properties: `qualifiers.source`, `qualifiers.target`.

No stronger causal, ownership or execution meaning; external unresolved references remain visible

## RL17 — associated

Two items have a named business association

Schema: `qualifiers_RL17`. Properties: `qualifiers.source`, `qualifiers.target`, `qualifiers.direction`.

Role names, cardinality and direction belong to association subtype; n-ary uses Association plus ports

## RL18 — equivalent-to

Source asserts semantic equivalence to target

Schema: `qualifiers_RL18`. Properties: `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Symmetric claim; does not merge IDs or prove equivalence

## RL19 — maps-to

Source maps to target under an explicit mapping

Schema: `qualifiers_RL19`. Properties: `qualifiers.profile`, `qualifiers.loss`, `qualifiers.source`, `qualifiers.target`.

Mapping profile and loss declarations; correspondence is not equality

## RL20 — copy-of

Copy points to the source from which it was copied

Schema: `qualifiers_RL20`. Properties: `qualifiers.source_revision`, `qualifiers.transformation`, `qualifiers.source`, `qualifiers.target`.

Independent identity; source revision and transformation optional; future changes do not propagate implicitly

## RL21 — version-of

Revision/variant identifies its predecessor or versioned identity

Schema: `qualifiers_RL21`. Properties: `qualifiers.scheme`, `qualifiers.revision`, `qualifiers.source`, `qualifiers.target`.

Version scheme explicit; do not mix copy and identity; no revision cycles

## RL22 — supersedes

New item supersedes an older item

Schema: `qualifiers_RL22`. Properties: `qualifiers.scope`, `qualifiers.effective_at`, `qualifiers.source`, `qualifiers.target`.

Historical item retained; scope and effective time explicit

## RL23 — depends-on

Dependent requires a prerequisite

Schema: `qualifiers_RL23`. Properties: `qualifiers.kind`, `qualifiers.failure`, `qualifiers.source`, `qualifiers.target`.

Dependency subtype controls cycles and failure policy; not every dependency is a schedule edge

## RL24 — precedes

Earlier item precedes a later item

Schema: `qualifiers_RL24`. Properties: `qualifiers.kind`, `qualifiers.lag`, `qualifiers.source`, `qualifiers.target`.

Schedule relation supports declared FS/SS/FF/SF and lag; sequence ordering uses its own profile

## RL25 — flows-to

Source sends a declared material, information or control flow to target

Schema: `qualifiers_RL25`. Properties: `qualifiers.role`, `qualifiers.payload`, `qualifiers.source`, `qualifiers.target`.

Flow role and payload required when ambiguous; method endpoint rules retained; crossings are not junctions

## RL26 — reads

Actor operation reads a source

Schema: `qualifiers_RL26`. Properties: `qualifiers.slice`, `qualifiers.source`, `qualifiers.target`.

Read does not imply write or deletion; source slice may be qualified

## RL27 — writes

Actor operation writes a destination

Schema: `qualifiers_RL27`. Properties: `qualifiers.mode`, `qualifiers.slice`, `qualifiers.source`, `qualifiers.target`.

Write mode and affected slice explicit when known; modelling does not execute mutation

## RL28 — consumes

Input is consumed by an activity

Schema: `qualifiers_RL28`. Properties: `qualifiers.mode`, `qualifiers.source`, `qualifiers.target`.

Consumption meaning belongs to role; ordinary reads need not destroy data

## RL29 — produces

Producer generates an output

Schema: `qualifiers_RL29`. Properties: `qualifiers.run`, `qualifiers.event`, `qualifiers.source`, `qualifiers.target`.

Definition and observed production are distinguished by run/event evidence

## RL30 — derives-from

Derived item points back to its upstream source

Schema: `qualifiers_RL30`. Properties: `qualifiers.transformation`, `qualifiers.run`, `qualifiers.source`, `qualifiers.target`.

Provenance direction explicit; transformation/run reference optional; no automatic causality proof

## RL31 — invokes

Caller invokes a declared operation

Schema: `qualifiers_RL31`. Properties: `qualifiers.mode`, `qualifiers.retry`, `qualifiers.source`, `qualifiers.target`.

Call, retry and cancellation roles remain distinct; execution requires adapter capability

## RL32 — sends

Sender declares a message it may send

Schema: `qualifiers_RL32`. Properties: `qualifiers.channel`, `qualifiers.correlation`, `qualifiers.source`, `qualifiers.target`.

Channel/correlation qualifiers; actual send is an Event occurrence

## RL33 — receives

Receiver declares a message it may receive

Schema: `qualifiers_RL33`. Properties: `qualifiers.protocol`, `qualifiers.event`, `qualifiers.source`, `qualifiers.target`.

Receipt guarantees require the selected protocol; observed receipt is a separate occurrence

## RL34 — connects

Explicit physical or logical connection

Schema: `qualifiers_RL34`. Properties: `qualifiers.direction`, `qualifiers.topology`, `qualifiers.source`, `qualifiers.target`.

Undirected unless subtype says otherwise; topology and electrical/Petri rules remain method-specific

## RL35 — transitions

Lifecycle state transitions to another state

Schema: `qualifiers_RL35`. Properties: `qualifiers.event`, `qualifiers.guard`, `qualifiers.action`, `qualifiers.priority`, `qualifiers.source`, `qualifiers.target`.

Event, guard, action, priority and nesting semantics belong to lifecycle profile; no implicit execution

## RL36 — triggered-by

Action is triggered by a declared event or condition

Schema: `qualifiers_RL36`. Properties: `qualifiers.condition`, `qualifiers.source`, `qualifiers.target`.

Definition-level trigger is not evidence of an actual run

## RL37 — governed-by

Subject is governed by a policy

Schema: `qualifiers_RL37`. Properties: `qualifiers.scope`, `qualifiers.authority`, `qualifiers.source`, `qualifiers.target`.

Applicability and authority explicit; descriptive policy not enforcement

## RL38 — constrained-by

Subject must satisfy a declared constraint

Schema: `qualifiers_RL38`. Properties: `qualifiers.stage`, `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Stage and scope required for blocking checks; drafts may retain unresolved constraints

## RL39 — satisfies

Source claims to satisfy a requirement

Schema: `qualifiers_RL39`. Properties: `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Evidence and acceptance separate; foreign satisfy rules retained

## RL40 — verifies

Check or evidence verifies a requirement/constraint

Schema: `qualifiers_RL40`. Properties: `qualifiers.result`, `qualifiers.scope`, `qualifiers.revision`, `qualifiers.source`, `qualifiers.target`.

Check definition differs from successful result; preserve result scope and revision

## RL41 — supports

Source supplies support for a claim or decision

Schema: `qualifiers_RL41`. Properties: `qualifiers.scope`, `qualifiers.provenance`, `qualifiers.source`, `qualifiers.target`.

No implied proof; source scope and provenance retained

## RL42 — contradicts

Source contradicts a claim or decision

Schema: `qualifiers_RL42`. Properties: `qualifiers.scope`, `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Contradiction is explicit; does not delete other evidence

## RL43 — assesses

Assessment evaluates a target

Schema: `qualifiers_RL43`. Properties: `qualifiers.criterion`, `qualifiers.scale`, `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Criterion, scale and scope references; no score invented

## RL44 — measures

Measure defines what is measured

Schema: `qualifiers_RL44`. Properties: `qualifiers.grain`, `qualifiers.unit`, `qualifiers.aggregation`, `qualifiers.time_basis`, `qualifiers.source`, `qualifiers.target`.

Grain, unit, aggregation and time basis declared for calculations

## RL45 — observes

Observation records a reading about a measure or subject

Schema: `qualifiers_RL45`. Properties: `qualifiers.measure`, `qualifiers.time`, `qualifiers.source`, `qualifiers.target`.

Measure reference required for numerical aggregation; time/source preserved

## RL46 — targets

Goal identifies its target measure or subject

Schema: `qualifiers_RL46`. Properties: `qualifiers.value`, `qualifiers.time`, `qualifiers.source`, `qualifiers.target`.

Desired value/time optional for draft; comparable units required for progress calculations

## RL47 — contributes-to

Source contributes to an intended outcome

Schema: `qualifiers_RL47`. Properties: `qualifiers.strength`, `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Contribution strength is an assertion unless evaluated with a declared model

## RL48 — influences

Source is asserted to influence target

Schema: `qualifiers_RL48`. Properties: `qualifiers.polarity`, `qualifiers.delay`, `qualifiers.confidence`, `qualifiers.source`, `qualifiers.target`.

Polarity, delay and confidence allowed; no causal inference from a line alone

## RL49 — mitigates

Response reduces a risk/threat/issue

Schema: `qualifiers_RL49`. Properties: `qualifiers.effectiveness`, `qualifiers.evidence`, `qualifiers.position`, `qualifiers.source`, `qualifiers.target`.

Effectiveness requires evidence; bowtie barrier roles retain position and direction

## RL50 — addresses

Response addresses an issue or need

Schema: `qualifiers_RL50`. Properties: `qualifiers.status`, `qualifiers.residual`, `qualifiers.source`, `qualifiers.target`.

Status and residual issue explicit; link alone does not resolve the issue

## RL51 — decides

Decision records a choice affecting target

Schema: `qualifiers_RL51`. Properties: `qualifiers.source`, `qualifiers.target`.

Rationale, alternatives and effective scope remain on the Decision

## RL52 — annotates

Comment or marker annotates a target

Schema: `qualifiers_RL52`. Properties: `qualifiers.source`, `qualifiers.target`.

Relation targets allowed; annotation does not change semantic type

## RL53 — grouped-as

Marker assigns its annotated target to a group

Schema: `qualifiers_RL53`. Properties: `qualifiers.group`, `qualifiers.contributor`, `qualifiers.count_rule`, `qualifiers.source`, `qualifiers.target`.

Multiple markers/groups permitted; count rule and contributor policy explicit; not a ballot

## RL54 — attributed-to

Item is attributed to a contributor or source role

Schema: `qualifiers_RL54`. Properties: `qualifiers.role`, `qualifiers.anonymous`, `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Authorship, observation source and import actor are distinct roles; anonymity preserves declared scope

## RL55 — responsible-to

Subject is owned, stewarded or operated by a responsible party

Schema: `qualifiers_RL55`. Properties: `qualifiers.role`, `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Owner/steward/operator/RACI roles retained; RACI A/R/C/I never collapsed; no application permission implied

## RL56 — fills-role

Actor holds a role in a stated scope

Schema: `qualifiers_RL56`. Properties: `qualifiers.scope`, `qualifiers.interval`, `qualifiers.source`, `qualifiers.target`.

Scope and interval optional; modelled role is distinct from authenticated entitlement

## RL57 — reports-to

Subordinate reports to a manager

Schema: `qualifiers_RL57`. Properties: `qualifiers.scheme`, `qualifiers.source`, `qualifiers.target`.

Hierarchy profile governs cycles/multiple managers; normalized direction is subordinate to manager

## RL58 — assigned-to

Work/resource is allocated to an actor, role or resource

Schema: `qualifiers_RL58`. Properties: `qualifiers.amount`, `qualifiers.interval`, `qualifiers.scheme`, `qualifiers.source`, `qualifiers.target`.

Amount, interval and assignment scheme explicit; no scheduling optimisation inferred

## RL59 — located-in

Subject has a domain location

Schema: `qualifiers_RL59`. Properties: `qualifiers.scheme`, `qualifiers.source`, `qualifiers.target`.

Physical/logical location scheme distinct from screen position

## RL60 — deployed-on

Deployable item is hosted on infrastructure

Schema: `qualifiers_RL60`. Properties: `qualifiers.environment`, `qualifiers.version`, `qualifiers.source`, `qualifiers.target`.

Deployment definition is not an executed deployment; environment and version qualifiers allowed

## RL61 — participates

Actor participates in an activity/session/association

Schema: `qualifiers_RL61`. Properties: `qualifiers.role`, `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Participation role and scope retained; commercial session requires service authorization

## RL62 — in-session

Contribution belongs to a session

Schema: `qualifiers_RL62`. Properties: `qualifiers.source`, `qualifiers.target`.

Session visibility and identity policy applies; local description remains possible

## RL63 — casts

Participant submits a formal ballot

Schema: `qualifiers_RL63`. Properties: `qualifiers.instrument`, `qualifiers.revision`, `qualifiers.anonymous`, `qualifiers.source`, `qualifiers.target`.

Eligibility, anonymity and revision rules come from voting contract; service enforces shared constraints

## RL64 — votes-for

Ballot submission selects an option

Schema: `qualifiers_RL64`. Properties: `qualifiers.weight`, `qualifiers.rank`, `qualifiers.source`, `qualifiers.target`.

Weight/rank and allowed choices follow instrument; not equivalent to grouped-as

## RL65 — based-on

Artifact uses a captured source state

Schema: `qualifiers_RL65`. Properties: `qualifiers.scope`, `qualifiers.captured_at`, `qualifiers.completeness`, `qualifiers.source`, `qualifiers.target`.

Scope, capture time and completeness explicit; no silent current-state substitution

## RL66 — records

Container records events, observations or decisions

Schema: `qualifiers_RL66`. Properties: `qualifiers.ordering`, `qualifiers.immutable`, `qualifiers.basis`, `qualifiers.source`, `qualifiers.target`.

Ordering and immutability declared; observed and synthetic trace sources labelled

## RL67 — executes

Run attempts execution of a definition

Schema: `qualifiers_RL67`. Properties: `qualifiers.definition_revision`, `qualifiers.input_snapshot`, `qualifiers.source`, `qualifiers.target`.

Definition version and input snapshot required for reproducible results; bounded engine contract explicit

## RL68 — uses-input

Computation or mapping uses a named input

Schema: `qualifiers_RL68`. Properties: `qualifiers.role`, `qualifiers.revision`, `qualifiers.value_state`, `qualifiers.source`, `qualifiers.target`.

Input role, revision and value state explicit; missing input is not zero

## RL69 — yields

Run produces a result or trace

Schema: `qualifiers_RL69`. Properties: `qualifiers.completeness`, `qualifiers.status`, `qualifiers.source`, `qualifiers.target`.

Producer provenance, completeness and status mandatory on actual result

## RL70 — replays

Viewer presents supplied trace state over appearances

Schema: `qualifiers_RL70`. Properties: `qualifiers.time`, `qualifiers.source`, `qualifiers.target`.

Read-only replay; all appearances of a target reflect the selected replay state without creating duplicate instances

## RL71 — includes

Document/output composes referenced content

Schema: `qualifiers_RL71`. Properties: `qualifiers.ordinal`, `qualifiers.mode`, `qualifiers.revision`, `qualifiers.condition`, `qualifiers.source`, `qualifiers.target`.

Ordinal, live/pinned and conditional inclusion explicit; cycles diagnosed

## RL72 — publishes

Publication fixes the captured state to be rendered

Schema: `qualifiers_RL72`. Properties: `qualifiers.revision`, `qualifiers.source`, `qualifiers.target`.

A new capture creates a new publication instance/version; public access not implied

## RL73 — delivers

Delivery attempts to send or save an artifact

Schema: `qualifiers_RL73`. Properties: `qualifiers.attempt`, `qualifiers.outcome`, `qualifiers.source`, `qualifiers.target`.

Destination and authorization held separately; attempt/outcome retained

## RL74 — uses-adapter

Operation uses a versioned adapter contract

Schema: `qualifiers_RL74`. Properties: `qualifiers.capability`, `qualifiers.source`, `qualifiers.target`.

Unsupported adapters report missing capability; credentials never embedded in ordinary model text

## RL75 — bound-to

Binding identifies its semantic/platform endpoints

Schema: `qualifiers_RL75`. Properties: `qualifiers.source_role`, `qualifiers.target_role`, `qualifiers.source`, `qualifiers.target`.

Endpoint role source/target explicit; at least one endpoint may remain unresolved in draft

## RL76 — scheduled-by

Action or output follows a declared schedule

Schema: `qualifiers_RL76`. Properties: `qualifiers.source`, `qualifiers.target`.

Local planning is distinct from background server execution

## RL77 — changes

Change set proposes or records mutations of a target

Schema: `qualifiers_RL77`. Properties: `qualifiers.base_revision`, `qualifiers.operation`, `qualifiers.source`, `qualifiers.target`.

Base revision and operation kind explicit; deletion cannot silently orphan references

## RL78 — accepts

Acceptance approves a captured scope under specified rules

Schema: `qualifiers_RL78`. Properties: `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Exactly one captured state per acceptance; required checks and actor authority explicit

## RL79 — applies-to

Contract or reusable definition applies to a scope

Schema: `qualifiers_RL79`. Properties: `qualifiers.scope`, `qualifiers.source`, `qualifiers.target`.

Application is typed and scoped; style cannot apply semantic mutations

## RL80 — exported-as

Source output is materialised as an artifact

Schema: `qualifiers_RL80`. Properties: `qualifiers.format`, `qualifiers.profile`, `qualifiers.source_revision`, `qualifiers.loss`, `qualifiers.source`, `qualifiers.target`.

Format/profile, source revision and loss/fidelity report recorded

## RL81 — grants

Policy grants a named action on a declared scope

Schema: `qualifiers_RL81`. Properties: `qualifiers.scope`, `qualifiers.authority`, `qualifiers.source`, `qualifiers.target`.

Effect requires service authority; standalone model is descriptive

## RL82 — denies

Policy denies a named action on a declared scope

Schema: `qualifiers_RL82`. Properties: `qualifiers.scope`, `qualifiers.authority`, `qualifiers.source`, `qualifiers.target`.

Conflict resolution belongs to authorization contract; no CSS permission policy

## RL83 — binds

Members/endpoints are paired by a declared interface or join contract

Schema: `qualifiers_RL83`. Properties: `qualifiers.profile`, `qualifiers.loss`, `qualifiers.source`, `qualifiers.target`.

Mapping vs equality vs join roles distinct; domains/shapes/directions checked under role contract

## RL84 — exposes

Owner exposes an interface or feature

Schema: `qualifiers_RL84`. Properties: `qualifiers.visibility`, `qualifiers.source`, `qualifiers.target`.

Visibility does not imply access permission or implementation ownership

## RL85 — implements

Implementation realizes a declared contract/design

Schema: `qualifiers_RL85`. Properties: `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Implementation claim remains separate from conformance evidence

## RL86 — aliases

Source is an alternate named reference to a target

Schema: `qualifiers_RL86`. Properties: `qualifiers.source`, `qualifiers.target`.

Preserve target identity; alias cycles forbidden; ambiguous resolution diagnosed

## RL87 — compatible-with

Source asserts compatibility with target under a named contract

Schema: `qualifiers_RL87`. Properties: `qualifiers.direction`, `qualifiers.version_range`, `qualifiers.source`, `qualifiers.target`.

Direction and version range explicit; compatibility is not equivalence

## RL88 — enforces

Mechanism claims to enforce a rule

Schema: `qualifiers_RL88`. Properties: `qualifiers.authority`, `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Enforcement authority and evidence explicit; a diagram claim cannot activate permissions

## RL89 — parent-of

Parent has a genealogical child

Schema: `qualifiers_RL89`. Properties: `qualifiers.role`, `qualifiers.source`, `qualifiers.target`.

Genealogy subtype; not organisational reports-to; cycles forbidden

## RL90 — partner-of

Actors have a genealogical partnership

Schema: `qualifiers_RL90`. Properties: `qualifiers.role`, `qualifiers.interval`, `qualifiers.source`, `qualifiers.target`.

Symmetric; role and temporal scope optional; not general business ownership

## RL91 — inhibits

Source prevents enablement under a named model

Schema: `qualifiers_RL91`. Properties: `qualifiers.weight`, `qualifiers.source`, `qualifiers.target`.

Petri inhibitor semantics remain in Petri pack; no generic boolean assumption

## RL92 — subset-of

Source extension is constrained to a subset of target

Schema: `qualifiers_RL92`. Properties: `qualifiers.roles`, `qualifiers.arity`, `qualifiers.source`, `qualifiers.target`.

ORM roles/arity and collection semantics checked; not visual containment

## RL93 — excludes

Source and target are mutually excluded under a declared rule

Schema: `qualifiers_RL93`. Properties: `qualifiers.scope`, `qualifiers.roles`, `qualifiers.source`, `qualifiers.target`.

Symmetry and applicable scope explicit; ORM exclusion differs from access denial

## RL94 — refines

Source elaborates a target without claiming subtype identity

Schema: `qualifiers_RL94`. Properties: `qualifiers.role`, `qualifiers.evidence`, `qualifiers.source`, `qualifiers.target`.

Requirement refinement, decomposition and trace roles preserve their distinct contracts
