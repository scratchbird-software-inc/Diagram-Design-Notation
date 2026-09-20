# 37. ArchiMate-style layered profile (`archimate.basic@1` on projection `graph`)

Status: implemented in runtime 0.5.0-draft.2, governed by RFC-111
(`standard/governance/rfcs/RFC-111-archimate.md`). Source grammar remains DDN
0.5; the nine element kinds and the relation verb are registry entries, so
this chapter is a semantic addition, not a grammar change.

ArchiMate-style layered views model an enterprise-architecture overview as
three layers — business, application, technology — on the existing `graph`
projection, with serving links pointing upward. Users write
`projection { kind:graph; profile:"archimate.basic@1"; }`.

This is profile-level coverage, not ArchiMate conformance.

## Vocabulary (nine kinds, one verb)

| kind | layer | silhouette | fallback | code |
|---|---|---|---|---|
| `archi.business_actor` | business | `actor` | `team` | `BIZ_ACTOR` |
| `archi.business_role` | business | `round` | `team` | `BIZ_ROLE` |
| `archi.business_process` | business | `round` | `activity` | `BIZ_PROCESS` |
| `archi.business_service` | business | `round` | `application` | `BIZ_SERVICE` |
| `archi.business_interface` | business | `ellipse` | `application` | `BIZ_INTERFACE` |
| `archi.application_component` | application | `component` | `application` | `APP_COMPONENT` |
| `archi.application_service` | application | `round` | `application` | `APP_SERVICE` |
| `archi.technology_node` | technology | `rect` | `host` | `TECH_NODE` |
| `archi.technology_service` | technology | `round` | `application` | `TECH_SERVICE` |

The single verb is `archi.rel` ("serves / relates to", family `structural`,
code `ARCHIREL`, `start:'none'`, `end:'open'`, `allow_self:false`,
`member_endpoints:false`), rendered as a plain link with an open arrowhead.
No extension properties are declared.

## Layer colours

An element's layer is derived from its kind keyword prefix
(`archi.business_`, `archi.application_`, `archi.technology_`); there is no
layer property. Layer colours come from the registered catalogue family of
each kind — business kinds use family `governance`, application kinds family
`interface`, technology kinds family `deployment` — stamped onto the profile
kind by `ddn-profiles.js` `registry()` and rendered through the shared
palette (`ddn-palette.js` `node()`), which follows the active theme preset
and lightens hues deterministically for low-light themes. No per-kind colour
fields exist.

## Layer-pair legality table (`archi.rel`)

The legality of an `archi.rel` link is fixed by this 3×3 table (source row →
target column):

| source ↓ / target → | business | application | technology |
|---|---|---|---|
| business | allowed | `DDN-PJ123` | `DDN-PJ123` |
| application | allowed | allowed | `DDN-PJ123` |
| technology | allowed | allowed | allowed |

Same-layer and upward links (technology→application→business, the "serving"
direction) are allowed; downward links are rejected with `DDN-PJ123` (error).
`DDN-PJ123` also fires when an `archi.rel` endpoint kind is outside the nine
registered kinds. The message names the relation and both endpoint layers.
The check is implemented in `ddn-profile-quality.js` `validate()` under
`profile==='archimate.basic@1'`; the core endpoint-kind contract defers to it
for this verb under this profile so the diagnostic is always `DDN-PJ123`,
never `DDN102`.

## Viewpoints

A viewpoint is a named `view` with an explicit `select:[…]` list (chapter
03): a "business viewpoint" is a view selecting only the `archi.business_*`
objects. No new machinery is involved. See the `business_viewpoint` view of
`examples/basics/51-archimate.ddn`.

## Diagnostics

| code | severity | meaning |
|---|---|---|
| `DDN-PJ123` | error | `archi.rel` links a downward layer pair per the fixed table, or an endpoint kind is outside the nine registered kinds |

## Scope and non-conformance

This is profile-level coverage, not ArchiMate conformance. The ArchiMate
exchange format, relationship derivation machinery and full ArchiMate
conformance remain unsupported. No UML/BPMN/SysML/CMMN/ArchiMate conformance
is claimed anywhere in this chapter.
