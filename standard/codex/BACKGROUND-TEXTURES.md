# Background textures

The owner-requested texture extension belongs to the unreleased `ddn-next-1`
candidate. `background.texture` is available on workareas, shared definitions,
appearances, view definitions, placed views and documents. It is an optional
procedural layer over the existing `background.color`; it does not replace that
colour setting, a semantic symbol, a background asset or the paper setting.

```text
element Idea as note
    with
        paper note
        background.color "#fff2ab"
        background.texture
            kind paper
            color "#9b7952"
            seed 42
view Workshop as ddn@1
    use Idea
```

The setting is `null` by default. An empty object selects the versioned paper
defaults. All members may be omitted:

| Member | Values | Default |
| --- | --- | --- |
| `kind` | `paper`, `linen`, `grid`, `dots` | `paper` |
| `color` | standard DDN colour | `#725d43` |
| `opacity` | 0–1 | 0.12 |
| `scale` | 4–128 logical pixels per tile | 32 |
| `seed` | integer 0–2147483647 | 1 |

Paper uses fine grain and short fibres. Linen uses crossing woven threads. Grid
uses square cells; dots uses a regular dot lattice. Scale controls the repeated
tile, not the size of the item. Seed changes paper and linen detail; the regular
grid and dot patterns do not vary with seed. The procedural algorithm and these
defaults are versioned. Texture opacity affects the texture only, preserving the
independent base colour and any alpha in either colour.

`background.texture null` disables inherited texture. Object members merge
through the existing cascade: explicit file values override eligible scoped CSS,
which overrides standards. A shared definition supplies item presentation, and
an appearance may override that use. A placed view similarly inherits its view
definition. Workarea settings apply to that surface; shared defaults can target
items or views separately. The CSS hook is:

```css
.method-ddn.subtype-discussion.role-note {
    --ddn-background-texture: {"kind":"paper","color":"#9b7952","opacity":0.12,"scale":32,"seed":42};
}
```

Built-in textures generate bounded local SVG geometry, without executable
markup, scripts, external URLs, noise filters or network requests. SVG patterns
and CSS tiles use the same geometry. Transparent texture colour or zero texture
opacity reveals the existing base colour. View and item textures scale with
their logical coordinates. Workarea rendering and capture use the same logical
tile size and origin.

Texture follows the original outer shape, including rectangles, handdrawn
outlines, closed native paths and ellipses. Note/pad uses it on the top sheet.
It adds no geometry to semantic bounds, hit targets, layout or status. Relations,
axes and data cells do not acquire item textures. Existing clips remain
authoritative, including clipped panel headers. Paper shadows and attachments
retain their separate presentation settings.

P06637–P06642 bind the six owners in the property codex. The exact record schema
is `background_texture`; `nullable_background_texture` defines the off value.
The normalized file stores only authored members. Readers may apply documented
member defaults without adding them to source.
