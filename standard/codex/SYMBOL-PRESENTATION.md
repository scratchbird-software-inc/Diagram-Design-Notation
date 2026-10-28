# Symbol presentation

The owner's 24 October 2026 correction extends the unreleased `ddn-next-1`
contract. Electrical and other supported notations use their own symbols; an
image symbol does not acquire a DDN card merely because its semantic role has a
card presentation. This is presentation, not a new electrical semantic profile
or a circuit simulator. Native UML symbols retain their existing glyphs.

| Property | Values | Standard default |
| --- | --- | --- |
| `symbol.mode` | `auto`, `card`, `image`, `text` | `auto` |
| `symbol.image` | asset reference or `null` | `null` |
| `symbol.label` | `auto`, `none`, `inside`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right` | `auto` |
| `symbol.label_gap` | nonnegative logical pixels | `6` |

All four properties are available on shared element definitions and individual
appearances, and in their existing scoped default rules. File settings override
eligible CSS, which overrides versioned defaults; occurrence settings override
shared definition settings. Existing `with` notation is sufficient:

```text
asset ComputerImage as resource from "assets/computer.svg"
    with
        media_type "image/svg+xml"
        intrinsic_size
            width 120
            height 80
element Workstation as object
    with
        symbol.image ComputerImage
        symbol.label bottom-right
view Infrastructure as ddn@1
    use Workstation
```

`auto` uses standalone imagery when `symbol.image` resolves to an asset. It also
recognizes the existing artwork declaration (`metadata.x_icon` on a definition,
with its `background.image` asset). Artwork from `electrical-common@1` defaults
to hidden captions; other standalone image symbols default to a bottom caption.
A background image without that artwork declaration remains a background.
Explicit `symbol.image null` disables inherited imagery and this artwork
fallback; the standard omitted null does not disable the fallback.

`card` explicitly chooses the role's normal presentation. `image` requires a
resolved image asset; a missing or unavailable image produces an actionable
diagnostic instead of silently substituting a generic card. `text` displays the
existing text/note body without a border or opaque background. Its normal
relationships can associate the note with other elements. These modes neither
change semantic identity nor create new relationships.

Image symbols have no card frame, paper, shadow, card metadata or automatic
status chrome. A selected symbol may still have editor selection affordances.
The intrinsic image aspect ratio is preserved. Existing `asset.intrinsic_size`
provides portable dimensions for browser and headless output; when omitted the
browser may discover dimensions from a loaded image, with a square provisional
fallback. Set intrinsic dimensions for deterministic layout before loading.
An explicit appearance size is a fit envelope; connectors use the fitted symbol
body boundary rather than the envelope or outside caption. Transparent margins
inside a supplied image remain part of that image's coordinate extent; tightly
cropped SVG artwork gives precise connections.

Outside labels occupy the eight compass positions relative to that body;
`inside` centers the caption within it. `none` suppresses visible caption text
while preserving the accessible name, selection identity and inspector title.
Caption bounds participate in layout and export bounds, not connector docking.
Label positions apply to standalone image and text presentations. Native/card
presentations retain their profile label conventions; setting these fields does
not relocate their titles. Relations retain their own labels and routing controls.

The compact designer **Symbol & label** form edits the selected occurrence or
shared definition, selects existing image assets, offers each name position and
a gap slider, and applies the staged settings as one authorized, undoable edit.
An untouched form does not materialize default values. Each setting can return
to inheritance independently. The read-only viewer has no editing controls.

P06643–P06650 bind these properties in the codex. CSS names are
`--ddn-symbol-mode`, `--ddn-symbol-image`, `--ddn-symbol-label` and
`--ddn-symbol-label-gap`; selectors remain scoped by method/profile/role.
