# Relation presentation controls

Owner direction, 26 October 2026. Additive correction to unreleased `ddn-next-1`; existing omitted settings retain their current behavior. No public utility ABI change.

Per-appearance settings: `label.visible true|false`, `label.mode text|numbers`, `legend.include true|false`. All are optional and eligible for file/default/CSS resolution using the existing priority. CSS names are `--ddn-label-visible`, `--ddn-label-mode`, `--ddn-legend-include`. They are presentation controls, not shared semantic changes. The `label` and `legend` objects are strict; absence is distinct from false.

Visible toggles only the main caption. Endpoint multiplicities, qualifiers, arrow glyphs and method markers remain. Hidden captions retain accessible names. Number/text is independent from visibility and legend membership. Omitted mode inherits the view's existing numbers/text/tokens behavior. Existing `route.callout` overrides text, but an explicit numeric mode uses the number.

Explicit legend inclusion creates a relationship key even in a text-mode graph. Explicit exclusion removes only this appearance from the key. View `legend.placement none` and `chrome.legend off` hide the key globally. Default inclusion retains the existing native numbered/token legend behavior. Relation numbering uses file-qualified identities in selected relation order and does not renumber when label visibility or legend membership changes. Repeated appearances share a number; appearances can have different visibility or legend membership. `legend.keys` permits a qualified `file::id` key or existing unqualified id when unique within the view.

Internal mind-map branches always have no visible caption, number or legend entry. Their controls are disabled; external links use normal controls. Unnamed electrical wires and fishbone bones retain no main caption unless explicitly enabled. Fishbone cause/category titles remain node labels and are not affected by relation-label controls.

The viewer, captures and publications use the same resolved settings. Designer edits are immediate, persisted and undoable in the selected view only.

Pre-change input SHA-256:

- `standard/codex/property-codex.json`: `b04c62e00d7e8e1af77aa63c175e6200db577fe43498c0f66933fa568be43638`
- `standard/codex/ddn.schema.json`: `e7f7f724745ae86b3fc69d7350a5aecf07dc0539819be8083ab7e04c63050957`
- `standard/codex/css-map.json`: `3efb37a4fa1975faf47e63d56cb6c89876ed98d8d1e40b73d85a72f73d46d50d`
- `standard/surfaces/surface-schemas.json`: `70f75b0b125c2a3c62ea440ba2d30f232654e00208a5ac74edc5b7385e568ef5`
