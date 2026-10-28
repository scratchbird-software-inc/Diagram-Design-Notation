# Appearance presets and standard dialogs

This reviewed extension follows the owner's request for compact standard dialogs,
custom textures/fonts and reusable user/company appearance. It extends the
unreleased `ddn-next-1` implementation. Background textures are specified in
[BACKGROUND-TEXTURES.md](BACKGROUND-TEXTURES.md); paper and stationery retain
their separate properties. No semantic role, acceptance state or authorization
grant changes.

## Separate interface preferences from document presentation

The tools use shared Light, Dark, Midnight and Warm interface themes. Interface tokens
control surfaces, input backgrounds, text, borders, accents, focus indication,
radius and density. Host overrides are validated values, never executable CSS.
An interface preference does not alter DDN source or diagram capture. The
standalone pages and review website start in Dark only when there is no saved
preference; an explicit theme query overrides that initial choice. Generic
embedded viewers inherit their host theme. Existing DDN logo variants identify
the tools, with no network resource dependency. The source pane can be hidden
and restored without discarding its contents. On narrow standalone viewer and
designer screens it starts collapsed; document controls open on demand and
editing toolbars scroll horizontally. These interface choices do not alter
document loading, editing authority or model content. Transparent diagrams use a
neutral white canvas backing; that interface backing is not written into
authored source or transparent captures.

The standard dialog is 480 logical pixels wide, capped to the available
viewport, with 13-pixel text and 32-pixel controls. Its body scrolls while the
heading, error and action areas remain visible. Desktop height is capped at 640
pixels; narrow viewports reduce it further. Settings forms float above the canvas and can be moved by their title bar or
keyboard Move control; they remain clamped to the viewport. Modeless forms
leave canvas interaction available and name their pinned edit target. Modal
pickers retain focus containment. Both forms provide Escape/Cancel, return
focus, nested picker handling and cleanup on host removal. The fixed property
drawer is replaced by an on-demand read-only Item details form. Full inherited
values remain available in a collapsed disclosure.

Meaningful bounded numeric settings use linked slider and precise number
controls. Range steps make dragging and keyboard adjustment practical; exact
number input retains the schema's permitted precision. Seeds and very large
ranges do not use misleading sliders. General Properties uses owner-specific
typed controls and a separately disclosed advanced path/JSON editor.
Optional host metrics stay within the bounds declared by `ui-theme.ts`.

Colour editors share hexadecimal, RGB and alpha controls, swatches and draft
preview. The source colour contract remains `transparent`, `#RGB`, `#RRGGBB` or
`#RRGGBBAA`. Font editors choose a loaded family and the existing 8–64 logical
pixel base size. Unsupported variable axes are not presented as active controls.

## Portable preset pack, version 1

```json
{
  "format": "ddn-appearance-presets",
  "version": 1,
  "presets": [{
    "id": "company-note",
    "name": "Company note",
    "scope": "company",
    "target": "element",
    "profile": "ddn@1",
    "properties": {
      "background.color": "#f5e9d4",
      "background.texture": {"kind": "paper", "seed": 42},
      "style.font": "Inter"
    }
  }]
}
```

`scope` is `user` or `company`; `target` is `workarea`, `element` or `view`.
`profile` is optional and limits an entry to that exact diagram profile. IDs
contain 1–80 ASCII letters/digits/dots/underscores/hyphens, starting with a
letter/digit. IDs are unique within a library; `standard-` is reserved. Names
are nonempty text of at most 80 characters. Packs contain at most 100 entries
and their JSON input is bounded to 256 KiB. Unknown fields and duplicate IDs
are rejected; import never silently overwrites an existing entry.

Permitted property paths are `background.color`, `background.texture`,
`text.color`, `border.color`, `opacity`, `style.paper`, `style.font`,
`style.font_size`, `style.look`, `shadow` and `decorations`. Values use the
existing owner-specific property schemas. Element packs can carry occurrence
paint; applying one to a shared definition must still satisfy that definition's
schema. Incompatible properties produce an error without a partial source edit.
Semantic facts, relationships, status, acceptance, scripts and remote asset
addresses are not preset settings.

The user explicitly chooses a preset and an eligible source scope. Apply writes
its properties through the existing authorized, revision-checked command service
as one undoable edit. Existing source comments and unrelated properties remain.
Cancel discards staged document edits. Saving/importing a library entry is a
separate explicit library action. A saved user copy retains every supported
effective appearance property, including paper, shadows and decorations.

Presets introduce no new implicit priority tier: file settings still override
CSS, and CSS overrides versioned standards. User/company library names alone
do not override anything. File defaults and scoped CSS remain the mechanism
for automatically supplying omitted settings.

## Standalone and Weaver responsibilities

The standalone designer saves user libraries in browser storage when available
and supports JSON import/export without a server. Storage failures are reported
as session-only retention. Imported company entries are read-only in the local
library; users may create separate user copies. The company label records
provenance and grants no authority. JSON is not a company policy enforcement
mechanism.

Weaver owns authenticated company publication, approval/version history,
membership-based distribution, company storage and mandatory policy enforcement.
Those services must supply verified packs and enforce their own grants. These
client utilities do not claim that central administration has been implemented.

Font resources remain separate from appearance settings. The optional standard
pack supplies locally pinned OFL fonts with notices and provenance. Host/local
fonts are loaded explicitly. A portable `ddn-font-resources-1` JSON envelope
contains a `resources` array of validated font records; file import is limited
to 32 MiB. Resources carry their family, bytes as a local data URL, weight,
style and optional licence notice. No implicit font service is contacted.
SVG/PNG capture includes used loaded font resources; unavailable families use
the host's fallback. Custom font files and their distribution rights remain
the supplier's responsibility.
