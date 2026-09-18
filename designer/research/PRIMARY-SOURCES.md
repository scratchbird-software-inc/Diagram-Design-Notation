# Primary research sources

Checked 2026-09-08. Observations are paraphrases. The proposed design is original; sources do not endorse DDN. No competitor source code, artwork, or fonts are redistributed. Licensing notes identify published terms, not legal advice.

- **[R01] draw.io editor** — https://www.drawio.com/docs/manual/editor/
  Observation: Context-sensitive panels and distinct editor themes; left palette and right inspector.
  DDN use: Borrow the visible interaction vocabulary, not an unrestricted styling-first data model.
- **[R02] draw.io shape properties** — https://www.drawio.com/docs/manual/shapes/shape-properties/
  Observation: Applicable properties depend on selection; mixed selection exposes common controls.
  DDN use: Show applicable properties only; avoid the documented thousands-of-properties experience.
- **[R03] draw.io connections** — https://www.drawio.com/doc/faq/connect-shapes
  Observation: Quick append/connect and keyboard alternatives.
  DDN use: Use contextual append with explicit DDN relation meaning; never split arbitrary references silently.
- **[R04] draw.io fixed/floating connectors** — https://www.drawio.com/docs/manual/connectors/connector-fixed-vs-floating/
  Observation: Distinguishes attachment to fixed connection points from perimeter connections.
  DDN use: DDN distinguishes field/port identity from automatic visual anchor freedom.
- **[R05] draw.io metadata** — https://www.drawio.com/doc/faq/shape-metadata
  Observation: Shapes and connectors can carry metadata and separate tooltip behavior.
  DDN use: DDN metadata remains typed; do not expose all hidden sensitive properties in tooltips.
- **[R06] React Flow custom UI and APIs** — https://reactflow.dev/learn
  Observation: Node/edge/handle customization, viewport controls, examples and integration API.
  DDN use: Alternative interaction host; keep DDN scene, router, and canonical source authoritative.
- **[R07] React Flow validation** — https://reactflow.dev/examples/interaction/validation
  Observation: Connection validation is available as an explicit predicate.
  DDN use: Filter by compatible endpoint types, then validate the actual proposed DDN transaction.
- **[R08] React Flow accessibility** — https://reactflow.dev/learn/advanced-use/accessibility
  Observation: Keyboard selection/movement, accessible labels, focus behavior.
  DDN use: Build full keyboard creation and connection flows; framework features do not certify the finished product.
- **[R09] diagram-js architecture via bpmn-js walkthrough** — https://bpmn.io/toolkit/bpmn-js/walkthrough/
  Observation: Separates generic canvas/command stack/context pad from domain metamodel and modeling rules.
  DDN use: Best architectural reference for commands, rules, and contextual construction.
- **[R10] diagram-js license** — https://github.com/bpmn-io/diagram-js/blob/develop/LICENSE
  Observation: MIT license for diagram-js itself.
  DDN use: Eligible optional interaction dependency; distinct from bpmn-js licensing.
- **[R11] bpmn.io domain toolkit license** — https://bpmn.io/license/
  Observation: bpmn-js and related toolkits require preserving the visible bpmn.io watermark.
  DDN use: Do not assume generic diagram-js and domain toolkits have identical terms.
- **[R12] JointJS ports** — https://docs.jointjs.com/learn/features/ports/
  Observation: First-class port definitions and port groups.
  DDN use: Separate meaning of a port from its position and visual magnet.
- **[R13] JointJS Inspector** — https://docs.jointjs.com/learn/features/property-editor-and-viewer/
  Observation: Declarative inputs, groups, conditional visibility, validation, and typed controls; example imports @joint/plus.
  DDN use: Adopt the descriptor-driven approach; do not bundle the commercial Inspector unknowingly.
- **[R14] JointJS command history** — https://docs.jointjs.com/learn/features/undo-redo/
  Observation: Batch commands collapse related changes into one undo operation; documented plugin uses @joint/plus.
  DDN use: One user intent is one DDN source transaction; no second independent history.
- **[R15] JointJS licensing** — https://www.jointjs.com/license
  Observation: Community library is MPL-2.0; JointJS+ is a separate commercial extension.
  DDN use: License-check actual selected modules rather than assuming every documented feature is community code.
- **[R16] tldraw shape architecture** — https://tldraw.dev/docs/shapes
  Observation: Validated props and shape utilities separate geometry, rendering, indicators and interaction.
  DDN use: Reusable geometry + typed descriptors + migrations are valuable patterns.
- **[R17] tldraw licensing** — https://tldraw.dev/community/license
  Observation: SDK is source-available under its own license; production requires an applicable license/key.
  DDN use: Not the default dependency for a freely redistributable DDN editor.
- **[R18] Excalidraw integration** — https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/
  Observation: Host callbacks, local scene changes, view modes and optional custom data.
  DDN use: Borrow compact contextual UX; customData is not a DDN semantic contract.
- **[R19] Excalidraw license** — https://github.com/excalidraw/excalidraw/blob/master/LICENSE
  Observation: MIT license in the inspected repository.
  DDN use: Suitable reference; replacing DDN export with freehand scene export would lose semantics.
- **[R20] yEd partial layout** — https://yed.yworks.com/support/manual/layout/layout_partial.html
  Observation: Selected regions can be laid out without moving the remainder; scope and preferred placement are explicit.
  DDN use: Provide selected/unpinned/all scopes and preview before applying the existing DDN layouts.
- **[R21] Penpot components** — https://help.penpot.app/user-guide/design-systems/components/
  Observation: Main/copy distinction, linked instances, overrides, reset and explicit update of main.
  DDN use: Show Shared definition versus This view and show override provenance; never equate a visual occurrence with a physical replica.
- **[R22] WCAG dragging movements** — https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
  Observation: SC 2.5.7 requires a single-pointer alternative to nonessential dragging.
  DDN use: Click-place and click-connect plus keyboard controls are requirements, not follow-up enhancements.
- **[R23] WCAG target size** — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  Observation: SC 2.5.8 defines minimum target size with exceptions.
  DDN use: Use at least 24 CSS-pixel hit regions or conforming spacing; prefer 32–44 for creation and touch.
- **[R24] WAI toolbar pattern** — https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
  Observation: Toolbar grouping and keyboard navigation guidance.
  DDN use: Use a labeled toolbar with tested focus behavior and do not hijack shortcuts inside text fields.
- **[R25] WAI treeview pattern** — https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
  Observation: Tree semantics, selection and keyboard interaction guidance.
  DDN use: Provide a searchable keyboard-operable model outline with equivalent commands.
- **[R26] Pointer events** — https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
  Observation: Unified mouse/pen/touch input, pointer capture and cancellation.
  DDN use: Cancel transient geometry cleanly on pointercancel; commit only completed intentions.
- **[R27] React Flow license** — https://github.com/xyflow/xyflow/blob/main/LICENSE
  Observation: MIT for the inspected xyflow repository.
  DDN use: Separate core licensing from paid examples/support and other dependencies.
- **[R28] draw.io license** — https://github.com/jgraph/drawio/blob/dev/LICENSE
  Observation: Apache License 2.0 in the inspected branch.
  DDN use: Do not infer third-party asset or trademark rights; no draw.io source copied into this deliverable.
