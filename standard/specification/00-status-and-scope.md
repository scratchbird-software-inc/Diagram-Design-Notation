# DDN 0.5 — status and conformance scope

**Current release: 0.7.0 — proposed standard, pre-1.0.** “MUST”, “SHOULD” and “MAY” describe this proposal, not adoption or external certification. Executable capabilities are declared in `registry/capabilities.json` and tested in fixtures. The 0.3 semantic/routing/publication foundation and the 0.4 projection layer remain compatible; chapters 21–24 implement the four quality/lifecycle/reporting stages. The beta.1 stamp is a runtime/standard packaging release per `../governance/VERSIONING.md`: the language source versions stay `0.2`–`0.5` and the core registry stays `ddn-core@0.3`.

## Conformance layers

1. **Reader:** UTF-8 labels, stable ASCII identifiers, local imports, recursive fields and source-preserving workspace editing.
2. **Logical validator:** registered relationships, metadata, domains, profile contracts, bounded decision partitions and lifecycle traces.
3. **Renderer:** native placement, shapes/contours, checked routes, source-bound matrices/charts, fishbones and child views within their declared scopes.
4. **Publisher:** deterministic SVG/JSON, source/occurrence mapping, page constraints, current internal/full exports and existing core authorized allowlists. New profile/projected redaction still fails closed pending a qualified closure.
5. **Deployment assurance:** real applications, security, statistical/engineering policy, infrastructure behavior and independent professional approval. None follows from a parser, diagram, local evaluator or passing fixture.

## Compatibility

The parser's exported `SOURCE_VERSIONS` is the source of truth for the capability manifest. Current accepted inputs are 0.2 through 0.5; 0.2 uses its disclosed compatibility path. Legacy examples retain their accepted version rather than receiving arbitrary syntax rewrites. Quality examples use `ddn "0.5";`. The core notation registry remains `ddn-core@0.3`, while installed profiles have independent versioned names.

Resolved output uses the highest current source-language version in the workspace, at least 0.3: `ddn-resolved@0.3`, `@0.4`, or `@0.5`. Stable semantic identities are preserved. New static checks can reject previously accepted invalid metadata; a renderer must not silently reinterpret it to create a picture.

## Evidence policy

A pass names the input, implementation and checked outcome. Source-generated diagrams and the interactive site share one runtime. Static legend plates are explicitly notation specimens. Historic failures stay under history directories; current results are regenerated. No independent reviewer is marked signed by automated evidence generation.

Quality profiles are documented, bounded diagram/analysis capabilities—not full UML/DMN/SCXML, a statistical package or a deployed ERP. See `quality/SCOPE.md`, chapters 21–24 and the current verification reports. Full-model shrink-to-A4 is not an acceptance criterion: explicit linked and bounded views preserve readability.
