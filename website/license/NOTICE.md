# Notices and provenance

ddn (Diagram Design Notation) is an open-source project of ScratchBird Software Inc.
(https://www.scratchbird.ca), sponsored by the ScratchWeaver project
(https://scratchbird.ca/weaver). The free tools
are ddn-viewer and ddn-designer. ScratchWeaver is also the commercial diagramming
suite built on ddn; ScratchRobin (commercial database console/BI, https://github.com/scratchbird-software-inc/CDEadmin) owns backend
capabilities such as KEEL, which are not part of ddn, ddn-viewer, or ddn-designer.

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

## Standards and notation attributions

This project renders diagram notations defined by external standards bodies.
Implementations are original work based on publicly described notation
conventions; no standards-document text, figures, or symbol tables are
reproduced. Support is profile-level coverage, not conformance or
certification.

- **C4 model** — the C4 model and c4model.com content by Simon Brown are
  licensed under Creative Commons Attribution 4.0 (CC BY 4.0) —
  https://c4model.com. C4 diagrams rendered by this project follow that
  convention with thanks to the author.
- UML, BPMN, CMMN, DMN, SysML, SoaML, and UAF are trademarks of the Object
  Management Group (OMG). ArchiMate is a registered trademark of The Open
  Group. ISA-5.1 (International Society of Automation), ISO 5807,
  ISO/IEC 15909, ISO/IEC 19507, ISO/IEC/IEEE 42010 (ISO/IEC/IEEE),
  IEC 60617 / IEC 61131-3 (IEC), ITU-T Z.100 / Z.120 (ITU), and IEEE 1320.1
  (IEEE) are cited as standards references only. All trademarks remain the
  property of their respective owners; use here is nominative and does not
  imply endorsement, affiliation, or certification.

## Bundled third-party icon artwork

Two shipped icon packs contain curated selections of MIT-licensed artwork,
each with its license text included in the pack manifest
(`standard/registry/icon-packs/`):

- **Tabler Icons** (`tabler-infra@1`) — Copyright (c) 2020-2026 Paweł Kuna,
  MIT License — https://github.com/tabler/tabler-icons
- **Iconoir** (`iconoir-infra@1`) — Copyright (c) 2021 Luca Burgio,
  MIT License — https://github.com/iconoir-icons/iconoir

Both are diagram-relevant subsets; the full sets are not vendored. Their
names do not imply endorsement or affiliation.
