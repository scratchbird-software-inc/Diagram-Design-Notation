# Information architecture and interface surfaces

**DDN Designer specification 0.2.0 — proposed; baseline audited 0.7.0.**

## Application separation
`live/editor.html` remains Studio, the source-first application. `designer/index.html` becomes Designer. A top-level project navigation may link both, but neither route redirects to or replaces the other. Open source in Studio is an explicit handoff with a workspace snapshot, selected view and stable selection. If a second window is used, the receiving editor reports its base revision; automatic cross-tab write merging is not assumed.

## Main desktop layout
Target a comfortable 1440×900 working surface. Reference dimensions are design tokens, not fixed page geometry: 56px project bar, 44px tools/view bar, 240px left shelf, 320px inspector, 28px bottom status. The canvas takes the remainder. At 1180px the shelves become collapsible; at tablet widths use one shelf at a time. Phone support initially permits inspection and property edits, not a desktop canvas squeezed to illegibility.

The project bar contains project name, save/draft status, undo/redo, source handoff, Review, and Export. The tools bar contains Select, Pan, Connect, Add, view tabs, and Arrange. Look, palette and print settings are inside This view, not spread across the top. Search is reachable without opening a large toolbox.

## Left shelf
Three tabs: **Add**, **Model**, **Views**. Add offers the current profile's common items and search of the installed registry. Model displays definitions, their files/data blocks and usage. Views displays named projections and child references. Switching tabs does not change data.

Add never shows 188 equally weighted shapes. The initial generic shelf has eight task groups: Meaning; Data; Process; Systems; Scopes; People & control; Notes & evidence; Analysis. A specialized profile shows 6–12 relevant templates. “All installed” and exact-name search retain discoverability. Favorite templates are user preferences, not new semantic kinds.

> Implementation status (ED-001): the full 188-kind mapped shelf is implemented in `designer/prototype/` — the Add tab renders the eight `palette_group` sections and every kind from `contracts/kind-ui-map.json` with search and per-kind `creation_action` dispatch. Profile-filtered specialized shelves remain proposed.

## Right inspector
Selection header: friendly name, semantic kind, source location, and “Used in n views.” Three tabs remain stable:
- **Meaning:** identity-independent name, kind, meaningful content and required profile properties.
- **This view:** visible compartments, approved appearance variants, pin/size/route settings, occurrence notes and local overrides.
- **Details:** typed implementation, scope, evidence, domain and extension groups with search.

Without a selection the inspector shows the selected view's projection, profile, layout, appearance and publication. Multiple selection exposes only compatible controls, including a mixed-value state; it never replaces distinct meanings with whichever value was read first.

## Bottom surfaces
A collapsed Problems strip reports error, warning and incomplete counts separately. Expanding opens a navigable list tied to elements/fields and fixes. An optional source-diff drawer shows the last command's exact changed ranges and affected views. The status line distinguishes “Saved in browser,” “Downloaded,” and “Saved to selected file”; a local cache is not a disk-save guarantee.

## Design screens
The supplied design prototype covers the graph inspector, field connection, pin/layout settings, source/changes, projected matrix, chart binding, shared-change review and save/export concepts. Mock-only screens are marked as review designs. The prototype's working actions and exclusions are documented separately; it is not the released full editor.
