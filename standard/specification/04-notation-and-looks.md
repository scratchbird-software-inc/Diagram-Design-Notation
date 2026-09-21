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

The reference examples use a 16px base design metric. The roles `sans`, `serif` and `mono` use system DejaVu/Arial/Georgia fallbacks. The optional `handwriting` role tries Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, then generic cursive. These are local font requests, not embedded or downloaded resources. Missing handwriting fonts change the text appearance, but do not remove the hand-drawn vector geometry. Other requested base metrics are rejected by the demonstrator rather than silently ignored. The production contract requires variable font size, accurate measurement and glyph fallback. Page scaling still operates independently and is checked at the final embedding size.

## 7. Label modes and completeness

Kind text, kind icons and discriminator tokens are independently optional subject to unambiguous recovery. Relation labels support `text`, `tokens` and `numbers`. Numbered mode replaces full midpoint wording, not direction or structural participation endpoints. A relation's legend entry includes its source, target, verb and selected qualifiers. The text alternative should include field-level endpoints even when the drawing collapses them. The `concept.map@1` profile proves relation labels are first-class: concept maps require an explicit author-written relation name on every link and reject bare verb defaults (`DDN-PJ104`).

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
        font: handwriting;   // optional; sans also supports hand-drawn strokes
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

The renderer is original, dependency-free JavaScript in `reference/ddn-sketch.js`. It is not Rough.js or Mermaid code. In browser hosts load core, sketch primitives, then renderer. Exported SVG contains its completed geometry and needs none of these scripts to display. Full collision-envelope enforcement and exact font shaping remain production milestones.

Crossing gaps are encoded as omitted path sections as well as masks, so their disconnected meaning does not depend exclusively on luminance-mask support. Relation dash offsets continue across those omitted sections. Directed legend arrows and missing-value symbols request a separate local symbol-capable font fallback.

## 10. Registry element defaults and property precedence

Every kind in `registry/catalogue.json` (and the profile catalogue) carries an optional `defaults` object: property name → default value, using only properties legal for elements under the chapter-10 contracts. Kinds with no meaningful extra defaults carry `{}`. Defaults are documentation for authoring flows, not renderer input: a renderer MUST NOT apply registry defaults implicitly, so a source that omits a property keeps its "not asserted" meaning and renders exactly as before. Authoring tools (for example the designer's creation commands) merge the registry defaults before the user's explicit properties — explicit always wins — and write the result into the source, where it stays visible and script-overridable.

The full precedence order, weakest to strongest: registry kind defaults < format/look (view/format level; `look: classic` and friends are never per-kind) < view overrides < declaration properties < occurrence overrides. Invalid `defaults` entries fail the schema build (`tools/build-schemas.py` type-checks them against `registry/data-properties.json`); there is no new runtime error code.
