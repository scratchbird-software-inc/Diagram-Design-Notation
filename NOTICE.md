# Notices and provenance

ScratchWeaver is a product of ScratchBird Software Inc. (https://www.scratchbird.ca); Diagram Design
Notation (DDN) is the name of the language/notation it implements.

DDN is an original proposed notation/language project. Original reference
code, SVG geometry, documentation, and site assets are distributed together
under `LICENSE` (GPL-2.0-or-later). The project was imported from draft
packages previously distributed under MIT by the same contributors.

Mermaid, Langium, ELK, Rough.js, Vega/Vega-Lite, React Flow, diagram-js,
JointJS, tldraw, Excalidraw, draw.io, yEd, Penpot, Unicode, W3C, and JSON
Schema are cited design/technical references only. Their names do not imply
endorsement, compatibility, or affiliation, and no runtime code from them is
vendored in this repository. No vendor logos or font files are distributed;
the reference JavaScript has no runtime dependencies.

`notation/runtime/ddn-sketch.js` is original DDN code. Rough.js documentation
was consulted as background for seeded sketch rendering; no Rough.js
implementation or dependency is included. The optional
`notation/adapters/vega-lite/` adapter is original code and is not part of
the runtime bundle.

Python rebuild utilities (optional) use locally installed `markdown-it-py`,
`jsonschema`, `lxml`, and `Pillow`; these are not bundled and their own
licenses apply to their distributions. The prebuilt website and JavaScript
reference commands do not require them. External specifications are cited,
not copied wholesale.
