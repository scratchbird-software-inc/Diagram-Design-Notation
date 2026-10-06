# Fixed notation, configurable looks

## 1. Semantic and decorative channels

The registry fixes semantic form, object-kind recipe, indicator position, standard words, family colour, relation pattern and endpoint meaning. A presentation look changes how those primitives are drawn. It cannot choose another shape family, repurpose a symbol or overwrite an indicator lane.

**DDN-R01.** A renderer MUST preserve exact distinctions with a registered unique glyph, token, full standard label or an explicit numbered relationship key. Colour alone is not the canonical meaning channel. Hiding a token is allowed only when the remaining glyph is unambiguous in the active registry/profile. In the supplied conservative renderer, `icon_token` is the default kind mode.

Structural endpoint marks (`source_mark`/`target_mark`) are semantic channel content, not decoration: the crow's-foot marks (`one`, `zeroone`, `many`, `zeromany`) express cardinality and are drawn by the shared endpoint renderer for every look. Under the `erd.crowfoot@1` profile both marks are obligatory on every `ref`/`assoc` relation in the view.

The shared glyph library (`standard/registry/glyph-library.svg`) holds original DDN line-art symbols (`stroke="currentColor"`, 24×24 viewBox); no vendor or cloud-provider artwork is distributed. The network profiles (spec 40) add four original glyphs to this summary: `network-bus` (horizontal trunk with three drop lines), `network-switch` (rectangular bar with opposing arrows), `network-server` (two stacked trays with indicator dots) and `network-rack` (tall frame with three shelf separators), referenced by the `network.bus`, `network.switch`, `network.server` and `network.rack` kinds.

A hand-drawn table remains a table. A precise diagram may still contain draft decisions. A dark canvas does not imply an operational state. A round-corner activity cannot become a generic table just because another theme looks nicer with rounded rectangles.

## 2. Six primary forms

| Form | Use | Invariant |
|---|---|---|
| Rectangular card | Named concept, definition, structure, resource or party. | Name is the only required visible content. |
| Rounded activity card | Action, transformation, workflow or execution. | Not a storage-object synonym. |
| Typed frame | Namespace, deployment, organizational or other named scope. | Scope type and membership interpretation remain recoverable. |
| Folded annotation | Note, decision, assumption or observation. | Does not become an ordinary data object by attachment. |
| Sample grid | Bound example records. | Values illustrate, not silently constrain. |
| Square port | Identified interaction or field attachment. | Binding is semantic, not nearest-point geometry. |

A navigation reference has its own view-occurrence recipe and is not a seventh business-object category. A frame may collapse to a card without losing identity. Compound graphical representations may reveal structure, but shape complexity itself does not establish sharding, replication or authority.

Registered notation-profile kinds extend this vocabulary additively rather than adding primary forms: the C4-style profiles (`c4.context@1`, `c4.container@1`, `c4.component@1`) map their six `c4.*` kinds onto existing actor, rounded-card, card, cylinder and component silhouettes with core-kind fallbacks, so the six forms above remain the only primary geometry contract. The EPC profile (`epc.basic@1`) likewise adds the `epk.*` kinds and registers `hexagon` as a profile silhouette (a flat-topped six-point polygon drawn by the generic polygon path) for its events — an additive profile silhouette, not a new primary form.

Relation verbs are likewise registered additively. The core governance verb set includes `reports_to` ("has direct report"): although the English keyword reads subordinate→manager, the registered meaning fixes the direction as parent→child (manager to direct report, like `emb`), so native tree layouts root at the node with no incoming `reports_to` edge and org charts hang downward from it. Its endpoints are plain (no arrowheads), per the org-chart convention. The profile verb `analysis.decomposes` ("decomposes into") follows the same parent→child rule for `analysis.task` deliverables, so work breakdown structures hang downward from the single root deliverable.

## 3. Reserved indicator positions

| Slot | Meaning |
|---|---|
| NW/header-leading | Kind icon, registered discriminator token or type words. |
| NE/header-trailing | Design maturity only. |
| E/outside rail | Evidence and operational observations, separately ordered. |
| SW1 | Workload. |
| SW2 | Authority or representation role, with explicit scope. |
| SE1 | Temporal capabilities and axes. |
| SE2 | Distribution and copy roles. |
| S1/S2/S3 | Placement, security/handling and ownership references. |
| Field-leading/trailing | Key, domain, presence, nullability, collection and order facets. |
| M/connector midpoint | Exact relationship verb or numbered relationship callout. |
| Nref/outside navigation | Link to another view; not a maturity or runtime badge. |

Two compact badges per corner is the default maximum; further badges move to an expanded lane or an explicit detail count. A hidden badge cannot leave a misleading visible count or suggest no properties were defined. Conflicting encodings are rendering errors, not something the reader must resolve.

## 4. Looks modeled after Mermaid's configuration separation

The current Mermaid configuration schema lists `classic`, `handDrawn` and `neo` looks [S01]. DDN uses those familiar look names for analogous *presentation categories*. DDN is not Mermaid syntax, does not reproduce Mermaid's exact renderer, and does not claim affiliation or source compatibility.

| DDN look | Rendering recipe | Never changes |
|---|---|---|
| classic | Precise single-stroke borders, crisp bends, no simulated roughness. | Shape class, relation family or semantic colour. |
| handDrawn | Seeded organic double strokes on rectangular, rounded and folded outlines; bowed separators and connectors; optional sparse hachure shading. | Exact endpoints, junction dots, port alignment, callout digits and symbol identity. |
| neo | Precise geometry with a visible offset shadow and an elevated top-edge accent. | Rectangle versus activity distinction; no universal forced corner radius. |

Roughness is seeded per stable occurrence ID and configured seed. Inserting another object must not rerandomize existing objects. Stroke perturbation stays within a reserved ink envelope and cannot erase the short dashes that distinguish relation families. Small semantic marks remain precise. The demonstrator applies seeded organic strokes to card outlines, rounded activities, folded notes, frames, field/domain separators, sample grids, subdiagram reference cards and connector bodies. Endpoints, corner vertices, crossings, glyphs and callout circles remain deliberately precise. Dashed relation bodies receive one stroke pass so the registered dash rhythm remains distinguishable; solid bodies may receive a restrained second pass.

## 5. Theme names and fixed palettes

Mermaid's documented themes include default, neutral, dark, forest and base; its current schema also contains additional choices [S02]. DDN borrows only the five familiar category names in this draft. It does not claim that this is an exhaustive inventory of all current Mermaid themes.

**default** uses a light decorative canvas and the fixed semantic family palette. **base** uses a plain white canvas with the same semantics. **forest** changes neutral canvas/editorial surfaces; it does not recolour every SQL object green. **dark** uses a dark canvas plus the registry's fixed high-contrast connector counterparts. **neutral** is the registered monochrome mode and retains tokens, patterns, shape/position and endpoint distinctions.

Semantic fill, icon ink, maturity outline and connector colours come from the registry. Arbitrary source CSS or per-view palette aliases are not allowed in standard mode. A custom theme can change documented nonsemantic canvas, text and padding variables only; a new semantic palette requires an explicit registry revision or extension and contrast tests.

The fixed colour values remain in `registry/catalogue.json`. The dark connector map is separately listed, not generated unpredictably from the user's screen. Object cards in the demonstrator retain light semantic fills on a dark canvas to preserve readable text and familiar family colours. This is a deliberate registered contrast recipe, not an assertion that every future dark renderer must use pastel cards.

## 6. Typography and measurement

A style declares a font family role, weight, line spacing and base size. A workspace font profile resolves family roles to actual fonts. A reproducible publication pins resources and text-measurement conditions. This bundle distributes no fonts. Missing font coverage must produce a fallback report; source UTF-8 alone does not guarantee glyph availability.

Production measurement shapes Unicode text before calculating box size, line wrapping or ports. Right-to-left text, combining marks and wide glyphs are measured with a real shaping engine. A text string may not be truncated into unreadable ellipsis without the display policy explicitly permitting it and preserving the full accessible label.

The reference examples use a 16px base design metric. The roles `sans`, `serif` and `mono` use system DejaVu/Arial/Georgia fallbacks. The optional `handwriting` role tries Comic Neue, Comic Sans MS, Segoe Print, Bradley Hand, Purisa, Nanum Pen Script, then generic cursive. These are local font requests, not embedded or downloaded resources; when no handwriting font exists on the viewing machine the fallback generic is whatever the platform maps `cursive` to — on font-bare systems that can be a serif or sans face, so a handwriting look requires one of the named fonts (Comic Neue is OFL-licensed and packaged for Linux). Missing handwriting fonts change the text appearance, but do not remove the hand-drawn vector geometry. Other requested base metrics are rejected by the demonstrator rather than silently ignored. The production contract requires variable font size, accurate measurement and glyph fallback. Page scaling still operates independently and is checked at the final embedding size.

## 6A. Portable text properties (0.8 amendment)

> **0.8 draft amendment:** this section is gated on source version `ddn "0.6";` — below it, any `text { }` group or run text key is `DDN-V04`. A diagram that declares no text property renders byte-identically to before this amendment.

Richer text styling survives in the `.ddn` file and renders identically in every conformant consumer. The design is **one vocabulary with three application contexts**, not per-context keys:

| Key | Values | Default |
|---|---|---|
| `weight` | keyword `bold` (alias for 700), or an integer 100–900 | role-assigned |
| `italic` | Boolean | `false` |
| `decoration` | `strike` (line-through) or `none` | `none` |
| `variant` | `small-caps` or `normal` | `normal` |
| `color` | `#rgb` or `#rrggbb` | role/theme-assigned |

`underline` is deliberately **not** in this revision's `decoration` vocabulary; it is reserved for a future revision and rejected today (`DDN-TX04`). Font **family** and **size** are not text properties: family stays role-based (`style.font` and the workspace font profile), size stays role-metric — `text` carries decoration only.

**Application contexts and precedence** (per key, later wins):

1. **View-wide** — a `text { }` group nested in a `style` profile declaration or in a view's `style { }` override group. It overrides the baked role weights/decorations of every drawing text run (labels, field text, kind chips, badges, legend, notes, relation labels, profile-silhouette text). The override group wins over the referenced profile, key by key.
2. **Per element** — a `text { }` group nested in a model element declaration (object, domain, sample, flow, assertion; not relations, not fields). It decorates that element's **label** only — its title lines on the plain card path and its name label on profile silhouettes — and wins over the view-wide group. Field rows, detail lines, notes, samples and relation labels are not element-addressable in this revision.
3. **Header/footer runs** — the same five keys as flat properties on the run records of chapter 53 §53.1. The run record is itself a text target, so no nested group exists there. View-wide and element `text { }` never restyle publication chrome.

Kind-level source typography does not exist: kinds carry no text properties, and per-kind styling remains reference-tool session preview (chapter 57), never serialized. The full precedence chain is therefore **role default < view `style.text` < element `text { }`**, with run keys self-contained.

**Portability rules.** Measurement MUST consume the same resolved properties as painting (OWN-080 determinism):

- `weight` participates in the measurement key exactly as role weights always have.
- `italic` and `variant: small-caps` join the measurement key and the canvas font string (`italic small-caps <weight> <size>px <stack>`). In the pinned-cache/estimate path, italic keeps regular advance widths (oblique advances are equal) and small-caps substitutes uppercase metrics at 0.8× size for cased-lowercase graphemes; the amendment keys append to the pre-existing 4-tuple cache key only when present, so pre-0.8 pinned metric caches stay valid.
- Line wrapping recomputes at the effective measurement, so a bolder, italic or small-caps label can grow its box (chapter 54 fit modes compose unchanged).
- The DDN071 minimum-text check operates on the run's nominal size at the final page scale, unchanged; authors should treat small-caps runs as visually smaller (lowercase glyphs render at roughly 0.8×).

Painting emits `font-weight`, `font-style: italic`, `text-decoration: line-through`, `font-variant-caps: small-caps` and `fill` per resolved property. All three looks (classic, handDrawn, neo) share the same text painter, so the properties carry over; sketch geometry is unaffected. Header/footer run text additionally carries addressable classes `ddn-run ddn-run-left|center|right` so hosts can target runs in CSS (chapter 53 §53.1).

**Validation.** All three contexts share one validator:

| Code | Condition |
|---|---|
| `DDN-TX01` | `text` is not a record, or carries a key outside `weight, italic, decoration, variant, color` |
| `DDN-TX02` | `weight` is neither `bold` nor an integer 100–900 |
| `DDN-TX03` | `italic` is not Boolean |
| `DDN-TX04` | `decoration` is not `strike` or `none` (message notes `underline` is reserved) |
| `DDN-TX05` | `variant` is not `small-caps` or `normal` |
| `DDN-TX06` | `color` is not `#rgb`/`#rrggbb` |

```ddn-0.8
data m {
  object invoice "Invoice" {
    kind: service;
    text { weight: bold; variant: small-caps; }   // this element's label
    fields { total: money; }
  }
}
view v {
  data: [@m];
  style { text { italic: true; } }                 // every drawing run
}
```

(0.8 syntax — requires `ddn "0.6";`: `text { }` groups in `style` and on elements.)

## 6B. Portable stroke and line properties (0.8 amendment)

> **0.8 draft amendment:** this section is gated on source version `ddn "0.6";` — below it, any `line { }`/`stroke { }` group or `fill` property is `DDN-V04`. A diagram that declares no line property renders byte-identically to before this amendment. This is a deliberate, bounded relaxation of §5's "no arbitrary colours" rule: author-declared colours are portable **only** through the properties defined here and in §6A.

Line styling survives in the `.ddn` file and renders identically in every conformant consumer. The design mirrors §6A: **one vocabulary, two model-level contexts**:

| Key | Values | Default |
|---|---|---|
| `color` | `#rgb` or `#rrggbb` | registry/theme-assigned |
| `weight` | length, 0.25–16 px | registered (relation: verb width; element: 1.8 px) |
| `dash` | `solid`, `dashed`, `dotted` | registered pattern / solid |
| `corners` | `round` | `round` |

`dash` is a closed deterministic keyword set — `dashed` maps to `10 6`, `dotted` to `2 5` — so every consumer paints the identical rhythm; custom dash arrays are reserved for a future revision (`DDN-LN04`). `solid` is a real value: it un-dashes a verb whose registered pattern is dashed. `corners` accepts only `round`; square corner treatment is reserved (`DDN-LN05`) because silhouette corner geometry is baked per kind and re-cornering would change registered silhouettes.

**Application contexts** (no view-wide layer — colours are semantic per §5, so declaration is per target; precedence is simply registry default < declaration):

1. **Relations** — a `line { color, weight, dash }` group decorates the painted route: orthogonal, straight, curved and string routing alike, under every look. Endpoint arrowheads and marks share the line's pen: their stroke follows the line's colour and weight so head and shaft read as one stroke. The routed geometry, crossing gaps, label corridors and endpoint seating are untouched — `line` is paint-only. Registered structural marks (`source_mark`/`target_mark`, §1 and chapter 10) are semantic channel content and are unaffected: their geometry, registered keyword grammar and `DDN114` contract are unchanged by this amendment.
2. **Elements** — a `stroke { color, weight, dash, corners }` group decorates the element's silhouette outline and a flat `fill: color` property replaces its semantic fill. Interior separators, kind chips, badges and text keep their role channels. On the plain card silhouettes (rect, note, sticky) all four properties apply, under all three looks (handDrawn forwards weight/dash to the sketch pen; hachure is unaffected). On profile silhouettes (chapter 17 shapes), `color` and `fill` ride the shared palette channels; `weight` and `dash` are plain-card properties this revision because silhouette paint strings bake their registered widths.

Under the monochrome themes (`neutral`, `mono_print`) the black-and-white contract wins: line/stroke/fill colours are suppressed exactly like registered colours. Stroke paint is SVG-standard centred on the outline path, so half the declared weight lies outside the laid-out box; layout, routing, endpoints and the `modelFingerprint` never change. DDN071/print-lint effective sizes are unaffected.

**Tool layering.** The reference designer's session-preview line/outline CSS channels (chapter 57) are a tool-side overlay that is never serialized; when a source declares these properties, tools SHOULD prefer the source declaration over any session preview.

**Validation** (one shared validator):

| Code | Condition |
|---|---|
| `DDN-LN01` | `line`/`stroke` is not a record, or carries a key outside its allowed set (`corners` is element-only) |
| `DDN-LN02` | `color`/`fill` is not `#rgb`/`#rrggbb` |
| `DDN-LN03` | `weight` is not a length from 0.25 px to 16 px |
| `DDN-LN04` | `dash` is not `solid`/`dashed`/`dotted` (message notes custom arrays are reserved) |
| `DDN-LN05` | `corners` is not `round` (message notes square is reserved) |

```ddn-0.8
data m {
  object invoice "Invoice gateway" {
    kind: service;
    fill: "#FFF7ED";
    stroke { color: "#C2410C"; weight: 3px; dash: dashed; }
    fields { total: money; }
  }
  object ledger "Ledger" { kind: database; }
  relation posts @invoice -> @ledger {
    kind: flow;
    line { color: "#1D4ED8"; weight: 2.5px; dash: dotted; }
  }
}
```

(0.8 syntax — requires `ddn "0.6";`: `line { }` on relations, `stroke { }`/`fill` on elements.)

## 6C. Per-element sizing resolution and content opacity (0.8 amendment)

> **0.8 draft amendment:** the sizing half of this section restates (and pins) the element-override contract chapter 54 already defines; `opacity` is gated on source version `ddn "0.6";` — below it, `opacity` on an element is `DDN-V04`.

**Sizing.** The four view-level sizing keys of chapter 54 — `text_fit`, `max_width`, `max_height`, `min_font` — resolve **per key** on every element:

| Key | Element | View (`style { }`) | Engine default |
|---|---|---|---|
| `text_fit` | wins | profile/bundle default | inferred `wrap` when a width constraint exists, else fixed box |
| `max_width` / `max_height` | wins | view-wide bound | none (natural size) |
| `min_font` | wins | view-wide floor | 8 px absolute floor |

An element therefore overrides exactly the keys it declares and inherits the rest — `max_width` on the element composes with `min_font` from the view, and so on. The chapter-54 fit loop (measure → resize → re-layout, at most two passes) consumes the **resolved per-element record**, so a view-wide bound applies to every element that does not counter-declare it. Composition with the publication layer is unchanged: `content_scale` (chapter 06) scales the post-fit drawing uniformly at page composition, and DDN071 checks effective sizes at the final page scale (contain factor × `content_scale`). These keys change geometry, never semantics: `modelFingerprint`, endpoints and relation identities are unaffected. (Reference-tool note: the designer's Sizing editor targets these same source keys; tool wiring is not part of this contract.)

**Opacity.** An element gains an optional `opacity` key: a plain number from 0 to 1, painted as **one SVG group opacity** over the whole node — fill, stroke and text fade together, exactly like the view `background { opacity }` at the page layer. Opacity is paint-only: it does not affect hit-testing, measurement, layout, routing, diagnostics (DDN071, print lint) or the `modelFingerprint`, and it applies under every theme including the monochrome modes (it carries no colour). `1` is the default and paints nothing; anything outside 0–1 or not a number is `DDN-SZ01`.

```ddn-0.8
data m {
  object summary "Quarterly summary, rather long" {
    kind: note;
    max_width: 200px;      // overrides the view-wide 320px
    opacity: 0.85;
  }
}
view v {
  data: [@m];
  style { max_width: 320px; min_font: 10px; }   // inherited keys still apply
}
```

(0.8 syntax — requires `ddn "0.6";`: `opacity` on elements; element sizing keys are chapter-54 syntax.)

## 7. Label modes and completeness

Kind text, kind icons and discriminator tokens are independently optional subject to unambiguous recovery. Relation labels support `text`, `tokens`, `numbers` and `none`. With `none` no relation label or badge renders at all; the label corridor space is reclaimed, and the relationship key disappears for the same reason it does under full inline text — there is nothing left to decode — unless the author explicitly sets `chrome.legend: 'on'`. Numbered mode replaces full midpoint wording, not direction or structural participation endpoints. A relation's legend entry includes its source, target, verb and selected qualifiers. The text alternative should include field-level endpoints even when the drawing collapses them. The `concept.map@1` profile proves relation labels are first-class: concept maps require an explicit author-written relation name on every link and reject bare verb defaults (`DDN-PJ104`).

A legend is generated from the resolved view and profile, not manually reconstructed by an author. The complete registry key and the per-diagram relationship key are distinct sections. Compact figures may show only used vocabulary. No unused decorative colour should appear as though it represents a data fact.

## 8. Accessible and static exports

The SVG includes title/description, readable ordinary text and explicit role metadata. The publishing host supplies meaningful image alt text and a textual relation summary. Colour is redundant with shape, position, label, pattern or token; this reflects W3C accessibility guidance [S07], but the prototype is not accessibility-certified.

Tiny dash gaps, hatch marks, endpoints and circled numbers must remain distinguishable at target scale. Printing in monochrome must not turn two relation kinds into one unqualified line. Sketch outlines cannot create accidental junction dots. The print pipeline preserves semantic clarity even when interactive hover descriptions are unavailable.

## 9. Hand-drawn renderer revision 2

Draft.2 corrects the barely visible draft.1 look. The old implementation skipped rounded cards and left the majority of line work mechanically straight. This release changes the geometry generated by the renderer rather than applying a screenshot or post-render blur.

```ddn
format discussion {
 style pen {
 look: handDrawn;
 font: handwriting; // optional; sans also supports hand-drawn strokes
 seed: 42;
 roughness: 1.8;
 hachure: true;
 }
}
```

A view references this declaration with `style: @discussion.pen;` or overrides its existing style using `style { look: handDrawn; }`. A style-only edit cannot change any data definition, scene coordinate, route endpoint, callout assignment or model hash.

`roughness` is a finite number in the inclusive range 0–3; the default is 1.8. It controls stroke deviations, not scene positions. Zero removes outline perturbation and hachures. `hachure` is a Boolean defaulting to true in hand-drawn rendering; false keeps the organic outlines but removes interior shading. Classic and neo ignore both controls. `seed` is an integer in the range 0–4294967295, default 42.

Random streams use the global seed, stable element or relation identity, and primitive role. There is no diagram-global advancing random stream. Adding or reordering an unrelated object therefore does not change existing strokes when its geometry is held fixed. Moving a shape changes its absolute positions but not its random key.

Object hachures are analytically clipped against the shape, rendered behind text at low opacity, and have no data meaning. A generic dotted or dashed relation is not made of two independently staggered dash patterns. Short segments near connection endpoints, orthogonal elbows, and detected crossings remain on the exact original centerline. The ideal route in scene JSON stays orthogonal; the visible pen stroke is permitted to deviate around that route.

The renderer is original, dependency-free JavaScript in `notation/runtime/ddn-sketch.js`. It is not Rough.js or Mermaid code. In browser hosts load core, sketch primitives, then renderer. Exported SVG contains its completed geometry and needs none of these scripts to display. Full collision-envelope enforcement and exact font shaping remain production milestones.

Crossing gaps are encoded as omitted path sections as well as masks, so their disconnected meaning does not depend exclusively on luminance-mask support. Relation dash offsets continue across those omitted sections. Directed legend arrows and missing-value symbols request a separate local symbol-capable font fallback.

## 10. Registry element defaults and property precedence

Every kind in `registry/catalogue.json` (and the profile catalogue) carries an optional `defaults` object: property name → default value, using only properties legal for elements under the chapter-10 contracts. Kinds with no meaningful extra defaults carry `{}`. Defaults are documentation for authoring flows, not renderer input: a renderer MUST NOT apply registry defaults implicitly, so a source that omits a property keeps its "not asserted" meaning and renders exactly as before. Authoring tools (for example the designer's creation commands) merge the registry defaults before the user's explicit properties — explicit always wins — and write the result into the source, where it stays visible and script-overridable.

The full precedence order, weakest to strongest: registry kind defaults < format/look (view/format level; `look: classic` and friends are never per-kind) < view overrides < declaration properties < occurrence overrides. Invalid `defaults` entries fail the schema build (`tools/build-schemas.py` type-checks them against `registry/data-properties.json`); there is no new runtime error code.

## 11. CSS class hooks and host-page styling

Every rendered SVG mark carries deterministic CSS class hooks so a host web page can restyle a diagram with its own stylesheet without forking the renderer. The class scheme is fixed (no new options) and derives only from registry codes and identifiers, keeping the renderer deterministic:

- Root: `<svg class="ddn-svg ddn-view-<kind> [ddn-profile-<profile-id-slug>] …">` where `<kind>` is the projection kind (`graph`, `chart`, `matrix`, `panels`, `timeline`, `sequence`, …) and the profile class appears when the view declares a projection profile.
- Nodes: `ddn-node ddn-kind-<code-lowercase>` (the registry kind code, e.g. `ddn-kind-tbl`). Node marks also carry a stable per-object attribute hook `data-ddn-id="<element-id>"` (in addition to the pre-existing `data-id`), so a host page or viewer can target one specific object (`[data-ddn-id="…"]`) without parsing ids out of classes.
- Relations: `ddn-rel ddn-verb-<verb-slug>` (registry relationship code, e.g. `ddn-verb-publish`).
- Field rows `ddn-field`; relation labels `ddn-label`; panels `ddn-panel`; frames `ddn-frame`; projection marks `ddn-mark ddn-mark-<type>` (`bar`, `line`, `arc`, `point`, …; pie and donut sectors are `arc`).

Slugs are lowercase with every non-alphanumeric run collapsed to one dash (`chart.basic@1` → `ddn-profile-chart-basic-1`).

Cascade: page CSS < format palette < look < object/occurrence overrides (inline). All script-driven paint is still emitted as SVG presentation attributes on the classed elements, so exported SVG stays self-contained and identical when no page CSS is present; the renderer never emits a `<style>` block for styling hooks and never uses `!important`. Host stylesheets select the classes above; a declaration the script itself made for a specific element (its kind, its look, an occurrence override) continues to win for that element. An optional ready-made stylesheet mapping the hook classes to `--ddn-*` custom properties ships as `notation/dist/ddn.css` (source `notation/studio/src/ddn.css`), and the live component's optional `theme` attribute injects a constructed stylesheet setting those properties.
