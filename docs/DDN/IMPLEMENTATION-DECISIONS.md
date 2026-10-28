# Complete-profile implementation decisions

The implementation applies the adopted `ddn-next-1` reconciled schemas and property codex. Most decisions apply the later normalized contract where historical prose differs. Missing carriers—retained quality transforms, business-calendar holidays, explicit matrix encodings, Equal Earth and configurable link targets—were added to the single adopted schema and property codex to fulfill the owner’s full 151-profile implementation request. Existing default values and the pre-1.0 language identity remain unchanged; no compatibility grammar is introduced.

| Area | Implemented representation |
| --- | --- |
| Profile selection | The designer selects a method and an installed profile. Workarea method, foreign-view permission and allowed profiles constrain the choices. Only a profile's primary palette creates new items; eligible existing context items can be reused. |
| Empty designs | An empty draft view is authorable for every profile. Missing facts produce incomplete display/review evidence when required; they do not require invented data before the first item can be created. |
| Projection settings | `with projection.options` uses the selected profile's reconciled schema. A schema union distinguishes column descriptors from references by their record fields, including qualified `file` references. |
| Named datasets | Compact dotted rows remain text. Numeric, boolean and null values use typed `with columns` and `with rows` records or a data provider. Chart measurements are not coerced from strings. Dataset editing retains identity and unrelated source/comments. |
| JSON scalar and collection notation | In properties that admit multiple scalar types, quotes preserve text: `"076"`, `"true"` and `"null"` remain strings. A numeric-only property still accepts a quoted numeral. `empty list` and `empty record` preserve explicit empty collections where the declared property admits arrays or objects; quoted versions remain text. Nested collections use the same words. The serializer quotes dictionary keys when needed to distinguish them from an `item` list marker. |
| Computed omissions | A derived default is computed or omitted as specified. A descriptive expression in the codex is never inserted as an authored property value. Histogram's authored default remains `auto`. |
| UML endpoint decorations | `qualifiers.source.mark` and `qualifiers.target.mark` carry semantic endpoint decorations, including `filled-diamond` composition and `diamond` aggregation. The same endpoint records carry `navigable`. Generic line markers use the separately declared `properties.source_mark` and `properties.target_mark` enums. |
| Geographic projection | The retained `equalEarth` method is added to `mercator`, `equirectangular`, `albers` and `orthographic`, with its own bounded projection formula. Geography is explicit local GeoJSON or a supplied asset provider; there is no implicit map-service request. |
| Link-chart endpoints | `projection.options.target` accepts a number for gauges or a field-name string for link charts. The effective mark determines the required type. Omission on a link chart binds the existing `metadata.x_record.target` carrier. |
| Composed panels | `projection.options.panels` contains inclusion records with `target`, `kind` and optional `layout` containing zero-based `row`/`column` and positive `rowspan`/`colspan`. Inclusion placement takes priority over a text panel target's `metadata.x_record` grid. The same child view can appear in multiple independently placed panels without creating duplicate definitions or views. Nested view contents preserve source identities while receiving a destination transform and clip. One composed child-view level and cycle checks follow the bounded contract. |
| Matrix domains | Numeric encoding domains retain `{ min, max }` records. `encoding.labels` supplies 1–12 explicit unique scalar categories; `encoding.boundaries` supplies 2–13 increasing numeric band boundaries. Existing shorthand remains valid. |
| Quality transforms | The retained quality contract required an explicit schema reconciliation: `histogram`, `pareto`, `waterfall`, and `boxplot` join the existing transform enum. Histogram bins additionally accept 2–101 explicit numeric boundaries; `step` admits the waterfall field binding; `arrangement` admits `overlay`. Canonical spellings remain `probability`, `drop`, `boxplot`, `linear`, and `iqr`/`minmax`/`1.5`. Transform-specific defaults omit inapplicable identity-only settings. |
| Chart marks | Explicit supported marks dispatch independently of the profile default, subject to that mark’s channel, applicability and numeric rules. A named profile does not silently prohibit an admitted override. |
| Business calendars | `calendar.holidays` supplies unique date-only holidays. Omission means no additional holidays. Business-day counting uses the declared timezone’s civil dates, weekdays and holidays; elapsed timelines preserve instants. |
| Decision policies | Local evaluation implements `unique`, `first`, and `collect`. Other admitted policies remain ordered-match/table annotations under the bounded contract and return `unsupported-policy` for executable evaluation. No FEEL engine is implied. |
| Flat-state analysis | Declared traces use `core::Trace` event references, `core::Event` payloads and explicit expected final states. The bounded analyzer checks results and returns `actionsExecuted: false`; it never executes authored actions. |
| Geometry | Graph occurrences have editable position, size and routing. Data-derived chart/matrix/timeline geometry is edited through its records and projection settings. A view's workarea placement remains movable. |

## Mind-map correction — 24 October 2026

The [owner's mind-map rules](../../standard/codex/MINDMAP-RULES.md)
make horizontal attachment and a single incoming relationship profile
constraints, with top/bottom permitted only for an incoming external link to
the centre. Internal branches are unlabelled curves; mixed-view legends describe
external links only. Topic membership is local to the view. Existing DDN
contracts govern external context, referenced from the mind-map catalogue entry
without duplicating their schemas or adding source syntax.

Selection controls belong to the designer overlay. Child creation and its link
are atomic, authorized and undoable. Editing a generated compact-recipe root
may materialize that block into existing explicit notation to provide stable
editable source records; unrelated blocks and identities are preserved.

## Fishbone and connector geometry — 24 October 2026

Fishbone categories form diagonal ribs on the main spine. Causes attach at
separate positions along their parent rib; subcauses attach to the parent cause
branch. Reusing a cause creates another displayed occurrence with the same
source identity. Category spacing accounts for labels and descendants.

Automatic orthogonal and rounded graph connectors use the existing
`layout.port_clearance` setting for the minimum straight departure and approach
before a bend. Its standard value remains
28 diagram units; file values override eligible CSS and the standard. This
restores an existing property rather than adding syntax or changing defaults.
Explicit waypoints retain their authored geometry. Profile-specific geometry,
including mind-map branches and fishbone bones, retains its own attachment rules.

## Standalone symbols and annotations — 24 October 2026

The [symbol presentation contract](../../standard/codex/SYMBOL-PRESENTATION.md)
separates semantic role from card, image and unboxed text presentation. A
`symbol.image` asset renders as the element itself. Existing explicit icon
artwork declarations also select standalone imagery in automatic mode; a
decorative background image alone retains its normal card behavior.

Image labels can be hidden, centered inside, or placed at any of eight outside
positions. Captions contribute to layout and export extent, while connectors
and selection use the fitted image body. Bundled electrical symbols expose
their visible lead endpoints for wiring. Redundant electrical association
labels are suppressed; authored component notes remain visible without boxes.
The electrical gallery is an illustrative symbol library, not a circuit
verification or simulation profile. Native UML and other method glyphs keep
their own presentation conventions.

The compact **Symbol & label** form changes shared or occurrence settings
through the existing authorized, undoable edit transaction. Explicit image
`null` disables inherited imagery; omitting the property restores inheritance.
Asset intrinsic dimensions give deterministic layout; the viewer discovers
missing natural dimensions locally and uses the same bounds for capture.
Safe inline SVG paint is retained as presentation attributes, including local
gradients and opacity. Scripts, stylesheet rules, events and external resource
references remain excluded from embedded artwork.

## Portable projection registration

`createCompletePresentationPack()` registers the adopted projection families separately from rule and command packs. Its `measure` method returns deterministic text IDs, text, font keys and size constraints. Supply `MeasurementEvidence.measurements` as an object keyed by those IDs, with either a finite nonnegative width or `{ width }`. The projection rejects mismatched model fingerprints, revisions, versions and font generations. Missing widths use the same approximate fallback as a host without a canvas; this fallback is not evidence of exact print pagination.

`ProjectionInput.resolvedProperties` is an object keyed by `JSON.stringify([file, id])` (the presentation `refKey` function), whose values are resolved property records. Supplied values override normal resolution for that record. The standard browser viewer resolves properties directly, measures with its canvas and loads assets through explicit providers.

The public ABI declarations are unchanged. Complete-profile behavior and release qualification are recorded in [implementation status](IMPLEMENTATION.md); the [coverage index](PROFILE-COVERAGE.md) links all 151 bounded contracts.

### Paper surfaces, shadows and stationery

The [adopted presentation extension](../../standard/codex/PAPER-AND-STATIONERY.md)
adds `style.paper`, typed `decorations`, a definition paper colour and new
silhouette members on the existing nullable `shadow` record. `paper note` and
`shadow centre` are short source spellings of those canonical properties.
This extends the unreleased `ddn-next-1` candidate, without changing public ABI
declarations or adding semantic element/relation types.

Paper is applied after layout, before isometric composition. It expands painted
bounds for capture and view placement while preserving semantic body geometry,
hit targets, connector routing and resize dimensions. Data projections decorate
view frames and note/panel surfaces, leaving quantitative marks unchanged.
Existing containment clips still apply. Panel headers keep their original clip
for both text and decorations, so font
substitution cannot let a heading paint across a neighbouring panel. Notes and
view frames can paint their attachments and shadows outside their body bounds.
Automatic view placement reserves incoming and outgoing decorative overhang;
explicit workarea coordinates remain authoritative.
All renderers use numeric local geometry;
the viewer creates local SVG blur filters with instance-specific identities.
SVG and PNG capture include those same filters and vector attachments. No
external resource is fetched for these effects.

Note/pad yellow is a contextual standard. Explicit file and CSS colours retain
priority, including white and transparent. Attachment shading derives from its
configured colour and retains alpha. Designer edits collect touched properties,
validate a staged source patch and commit one undoable edit through the existing
authority service. Unchanged controls preserve inheritance. Colour pickers
retain alpha; text fields also accept transparent and standard hex forms.

Five new views in `website/examples/appearance/paper.ddn` compare shadows,
surfaces, attachments, colours and connected notes. They extend the original
163 converted files/466 views to 164 files/471 views and eight comparison sheets;
the original conversion manifest remains unchanged.

### Website migration: declared members and port metadata

The real example corpus exercises authored field identities alongside table data,
port metadata, and structured comparison guards. The language materializer now
reuses explicit field members and retains ports when deriving a table body, so
existing member endpoints continue to identify the same fields. Structured union
records retain all registered alternatives while schema verification still
rejects invalid combinations.

`core::Port` now exposes the six existing retained port metadata contracts
(`x_fbd`, `x_icom`, `x_pin`, `x_interfaces`, `x_port`, `x_service`) and its declared
side, fraction and datatype properties. This connects the existing verifier and
renderer behavior to the authoring schema. Region lanes count as activity lanes;
SysML activity pins are not treated as structural block ports, and rack slot
checks run in rack views or explicitly declared rack regions. ICOM cardinal sides
accept their equivalent north/south/east/west spelling.

The offline website conversion tool preserves full source identities and human
labels, moves supported presentation settings to their current owners, and keeps
source facts without a registered equivalent in readable authored notes. This is
an example conversion tool, not a legacy dialect mode in the browser utilities.

### Website corpus reconciliation

The retained examples require a rack as context in a network view, neutral
associations between network symbols, and operational activity flows and
cross-sheet references in the relevant UAF views. Their profile endpoint
contracts now explicitly admit those bounded uses; unrelated endpoint kinds
remain rejected. Isometric bar, area, pie, donut and treemap charts accept a
numeric extrusion or a record channel, with extrusion bounded to the existing
0–2000 logical-pixel depth contract. Other hierarchy depth settings stay numeric.

The website migration preserves unsupported legacy facts in readable source
notes. Those notes are evidence, not a claim that a discarded setting is active.
### Native graph variation rendering

Native DDN, mind-map and concept-map views use the shared connection, region and
inline-view pipeline while retaining their measured table, notes and draft-body
primitives. The native placement adapter implements deterministic grid, manual,
layered, tree, spanning-tree, mind-map, grouped, ladder, fit-grid, circular,
radial and bounded organic layouts. Explicit positions remain authoritative;
spacing, direction and column settings affect automatic placements. Organic
relaxation uses 48 passes and at most 128 neighbours per node.

Connection appearances retain declared sides and waypoints. Curved Bezier and
rounded orthogonal paths render differently, and excluded relationships stay
excluded when both endpoints are visible. Retained graph symbols can use local
asset images without changing their semantic role or endpoint rules. Geometry,
source identity and hit targets remain paired through native placement and inline
composition.

The gallery migration exposed two selection/notation defects: quoted inline items
in a list that accepts either references or text now select the text alternative,
and explicit view exclusions override appearances in both profile verification
passes, as they do in rendering. Original BPMN connections shared by different
pool views remain definitions; only occurrences contradicting a particular view's
pool boundaries are excluded, with an authored explanation on that view. SoaML
service interfaces may expose a provided `service` port; `request` port ownership
remains restricted to participants and agents. This retains the existing service
interface example without weakening arbitrary port ownership rules.

### Private website integration evidence

The maintained review website is `website/`. Its 163 converted example
entries preserve 466 original views across all 151 profiles and seven variation
sheets. Current-runtime captures, local source payloads and complete standalone
downloads rebuild from maintained files without the original repository. The
deprecated parser is used only by the one-time evidence extraction, never by the
website or its rebuild. Source hashes are recorded in the conversion manifest.

Conversion exposed a half-open decision interval mapping: `lower_closed` and
`upper_closed` become `include_min` and `include_max`, retaining endpoint meaning.
Original numeric-looking strings remain strings, and empty lists/records retain
their types through notation. Data and domain identities remain separate from
their human display titles.

View theme presets resolve as standard presentation defaults; CSS and explicit
file paint retain priority. Structured entity fields infer a columns body only
when no stronger body setting applies. Explicit title-only presentation remains
valid. Graph isometric extrusion composes existing native placement transforms
and preserves occurrence identity, hit bounds and the flat source model.

One historical frozen drilldown SVG is preserved as a declared static image,
including its original timestamp and historical version text. Two degenerate
zero-area map polygon members are removed with a local normalization record;
features and valid polygons remain. Neither correction introduces old executable
runtime code. The complete review edition is not a size-budget or product-release
qualification claim.

## View layout selection — 25 October 2026

View creation selects a surface layout before selecting the diagram method and profile. Dynamic preserves content-sized views. Open dashboard recipes provide HD, Full HD, 2K, QHD, 4K UHD and 8K UHD dimensions with shared logical typography and display scaling. Fixed surfaces fit content without growing their outer extent. Source stores only the selected preset unless the author overrides a setting. Physical-page and presentation tiles remain disabled in the open designer. See the [surface contract](../../standard/codex/VIEW-SURFACES.md).

A fixed surface applies a presentation transform after diagram layout; designer edits invert that transform to keep source positions and sizes in logical units. Workarea placement coordinates remain independent. Save/reopen and capture retain the selected surface.

## Live settings and detachable drawers — 25 October 2026

Appearance, paper, symbols, properties, text, table data, projection and workarea settings update the diagram from valid input without Apply. Sample buttons show textures, fonts, paper, shadows, attachment kinds and positioning. Numeric controls pair a slider with an exact value. Font size in the appearance editor is shown in points; authored `style.font_size` remains logical pixels (1 pt = 4/3 px). No language defaults change.

Close keeps valid edits; Revert changes restores the settings session while its edits are still the latest source changes. Consecutive live changes share an undo entry. Invalid intermediate input leaves the last valid diagram visible. Changing the document or destroying its designer cancels pending edits. An unrelated source edit invalidates the editor rather than letting it overwrite newer work. Scope and section navigation flushes pending edits before switching targets. Creation, conversion, deletion, acceptance, file replacement and raw-source submission retain explicit actions.

Save waits for pending live edits and verifies that the document has not been replaced. Its cancellation and elapsed-time budget also cover that wait; stopping Save does not cancel the independent edit.

Palette, inspector, navigator and source panels have visible drawer and detachment controls. Palette categories contain only roles allowed by the selected diagram profile. Floating panels move within the page; Pop out opens the same live controls in a browser window that can be moved to another monitor. Closing that window returns the panel. A blocked popup falls back to an in-page floating panel. No server or commercial capability is required.

The additional controls put the native standalone designer above its 400 KiB gzip release target. The limit remains unchanged; successful functional tests do not qualify that size gate. Viewer/verifier size gaps also remain. The website continues to use the modular distribution, and the all-profile standalone downloads are reported separately.

Editable diagram elements and dynamic view frames show a lower-right resize grip only while selected. Deselecting an occurrence removes its grip from display, pointer targets and keyboard navigation. Grips remain screen-sized under zoom, use semantic body bounds rather than shadows or attachments, and store logical dimensions on scaled dashboard surfaces. Pointer resizing commits one undoable change on release; Escape cancels its preview. Compact mind-map topics use the existing recipe materialization path. The declared `locked.move` and `locked.resize` settings are independent. Fixed-size surfaces retain their preset dimensions. Read-only viewers and exported diagrams contain no editing grips.

Floating panels and standard dialogs have matching lower-right grips with pointer, touch and keyboard controls. Forms keep their top-left position during resizing, respect viewport limits and retain accessible scroll areas and footer controls. Detached windows expose a window resize grip; native browser/OS window controls remain available.


## Relation display controls — 26 October 2026

The [relation presentation contract](../../standard/codex/RELATION-PRESENTATION.md)
defines independent visibility, number/text and legend-membership switches in
the relation context menu. Each writes one undoable occurrence edit, keeping
the same relationship's other appearances unchanged. Compact `connect` and
`relation` declarations route `label.visible`, `label.mode` and `legend.include`
into the implicit appearance; explicit `use` blocks use the same properties.
A relation shown through a view selection can acquire an explicit appearance
through the existing atomic create-occurrence command. Read-only/generated
occurrences remain protected, and edits use the normal authority checks.

Omitted settings preserve profile/view defaults. Explicit inclusion can create
a relationship key in a text-labelled view; view-wide legend visibility still
applies. Hidden captions can have legend entries. Number assignments remain
stable when individual rows are excluded. Internal mind-map branches retain
their mandatory unlabelled, non-legend presentation.

## Element palette previews — 26 October 2026

Palette tiles draw from the same role/profile glyphs and default proportions as
the canvas. Native DDN retains its own contours and semantic icons. The chosen
method distinguishes shared roles such as flowchart terminators versus BPMN
events and Yourdon versus Gane–Sarson processes. Small previews preserve circle
proportions, intrinsic symbol marks and relative outline weights. Text-only
labels use an unboxed sample. Previews do not create a viewer, load optional
profile families or alter the model.
