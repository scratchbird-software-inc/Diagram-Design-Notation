# Proposal governance and extension process

DDN 0.3 is a working proposal, not an assertion of community consensus. The initial website should invite review of syntax, semantics, accessibility, routing and implementation feasibility. A release should identify maintainers and a real discussion/issue destination before presenting a public governance process as operational.

## Versioning

Language major-minor versions identify syntax and semantic contracts. Registry and renderer releases have their own versions. A compatible new optional registry entry can be a registry revision; reinterpreting a token, indicator slot, relation direction or default behaviour requires an explicit compatibility decision. A draft suffix signals that breaking changes are still possible. Tools must record the versions they actually resolved.

Deprecation includes a replacement, rationale, migration example and planned removal boundary. A formatter does not silently migrate a model to another language version. Migration is an explicit command with a diff. Legacy colour-alias policies are not silently carried into a fixed-notation profile.

## Extensions

An extension declares a globally distinguishable ID, version, semantic class, definition, applicable targets/endpoints, parameter schema, glyph/slot recipe, optional label, colour-mode treatment, safe fallback, dependencies and test fixtures. It must not redefine an existing standard identifier. Unknown extensions are preserved or rejected according to the selected conformance profile; they are never silently interpreted as the nearest familiar kind.

Extension SVG must be sanitized. Executable behavior is not implicitly trusted by registration. Vendor profiles identify platform and version and distinguish unsupported features from undecided choices. A proposed extension should include one minimal positive example and one example of a misleading rendering it prevents.

## Review workflow

Use an RFC with problem statement, proposed syntax/semantics, alternatives, compatibility impact, security/privacy/accessibility effects, executable fixtures and unresolved questions. Review grammar and semantics before investing in a large icon set. Additions should preferably compose existing shapes/slots rather than create arbitrary new silhouettes.

A release gate requires a versioned specification, changelog, test corpus, reproducible examples, implementation capability statement and review of licensing/provenance. The project should avoid implying that an attractive demonstration is an endorsed international standard.

## Open-source distribution model

The proposed distribution is a free library, CLI, static/self-hostable editor and openly readable specification. The supplied original code and documentation include an MIT license file as a proposed permissive distribution choice. No Mermaid code or brand artwork is copied into the runtime. Mermaid is cited as a design reference; its own repository uses MIT [S10]. A maintainer should verify rights and naming before a public release, especially for future contributed assets or dependencies.

Paid hosting or support can exist separately, but must not be required to decode a `.ddn` file, render SVG or host the standard editor. Source files, registry metadata and model interchange remain available without a central service.
