# Sources, precedents and attribution

**External material checked 7 September 2026.** The DDN syntax, diagrams, slot assignments and normative requirements are original proposals. The following sources inform specific engineering decisions; none endorses or standardizes DDN. No Mermaid source, vendor artwork or font files are redistributed in this bundle.

## S01 — Mermaid looks

[Mermaid configuration schema: look](https://mermaid.ai/open-source/config/schema-docs/config-properties-look.html) lists `classic`, `handDrawn` and `neo`. DDN borrows these familiar look names as an interface convention, but uses its own SVG implementation and fixed semantic notation. Similar naming is not pixel equivalence or Mermaid syntax compatibility.

## S02 — Mermaid themes and configuration

[Mermaid theming](https://mermaid.ai/open-source/config/theming.html) and the [configuration schema](https://mermaid.ai/open-source/config/schema-docs/config.html) distinguish styling/configuration controls. DDN adopts a subset of familiar names: default, base, neutral, dark and forest. This is not an exhaustive statement of Mermaid's current themes. DDN deliberately constrains semantic recolouring more tightly than general-purpose theming.

## S03 — Language implementation

[Langium features](https://langium.org/docs/features/) and [grammar language](https://langium.org/docs/reference/grammar-language/) describe grammar-based parsing, references, validation and language tooling. Langium is a proposed production component; the included reference decoder is original dependency-free JavaScript and does not redistribute Langium.

## S04 — Layout implementation

[ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) documents layered layouts, routing and port-related capabilities. [ELK.js](https://github.com/kieler/elkjs) provides the JavaScript integration. ELK supplies layout calculations, not the complete DDN semantic model, symbol renderer or crossing/post-processing policy. The included demonstrator does not bundle ELK.

## S05 — Markdown portability

[CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) defines fenced code blocks and their info strings. A `ddn` fence needs a DDN-aware build or host extension; ordinary Markdown does not automatically interpret this language. Static image/link publication is the portable fallback.

## S06 — Unicode identity policies

[Unicode UAX #31](https://www.unicode.org/reports/tr31/) and [UTS #39](https://www.unicode.org/reports/tr39/) inform future identifier and confusable-character profiles. The DDN 0.3 reference uses ASCII identifiers and Unicode string values; Unicode identifiers are not silently enabled.

## S07 — Accessibility

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) support non-colour alternatives and accessible interaction. DDN includes accessibility requirements and a monochrome mode; this bundle has not been independently accessibility-certified.

## S08 — SVG coordinate systems

[SVG coordinate systems](https://www.w3.org/TR/SVG/coords.html) define viewports, transforms, `viewBox` and aspect-ratio behaviour. DDN page sizing, legend allocation and minimum-readable-scale policies are proposed rules built above these mechanisms.

## S09 — SVG embedding and navigation

[SVG conformance](https://www.w3.org/TR/SVG/conform.html), [linking](https://www.w3.org/TR/SVG2/linking.html) and [document structure](https://www.w3.org/TR/SVG/struct.html) distinguish SVG embedding modes and linking/structural mechanisms. An SVG displayed as an ordinary image is not an interactive application. Cross-view links therefore also receive textual fallbacks in published documentation.

## S10 — Open-source precedent

[Mermaid's MIT license](https://github.com/mermaid-js/mermaid/blob/develop/LICENSE) is an open-source precedent, not a license grant to Mermaid trademarks or a claim of project affiliation. Original materials in this bundle carry their own MIT license; see `LICENSE` and `NOTICE.md`. Project maintainers should verify provenance before publishing a new repository.

## S11 — Machine schemas

[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) is the vocabulary used for the included machine-readable interchange schemas. Structural schema validity does not replace cross-reference, topology, unit or semantic validation.

## Sketch-rendering background (draft.2)

- Rough.js official overview: https://roughjs.com/ — seedable hand-drawn vector rendering as a general design reference.
- Rough.js author’s algorithm explanation: https://shihn.ca/posts/2020/roughjs-algorithms/ — background on organic lines and hachure shading. DDN’s primitive implementation is original; this bundle does not contain Rough.js.

## S12 — SVG analytic curve commands

[SVG 2 paths](https://www.w3.org/TR/SVG/paths.html) defines straight, quadratic and cubic path commands. DDN's curved-route output uses cubic Bézier commands with explicit endpoint/control coordinates; its route safety, control metadata, callout and crossing policies are original DDN rules.

## S13 — Routing/interpolation precedents

[Mermaid flowchart curve styles](https://mermaid.ai/open-source/syntax/flowchart.html#styling-line-curves) and [ELK edge routing](https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeRouting.html) distinguish geometry/interpolation choices from model relationships. DDN implements its own small set (`straight`, `orthogonal`, `curved`; `bezier` or `rounded`), not the entire Mermaid/D3 or ELK curve vocabulary. Source pages checked 7 September 2026.
