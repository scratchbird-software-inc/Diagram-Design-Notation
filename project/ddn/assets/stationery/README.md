# Stationery design references

The `references` directory preserves the SVG files supplied by the owner for
this presentation expansion. Original metadata and notices remain in each SVG.
These are design references; the browser utilities draw configurable vector
geometry from `packages/presentation/src/stationery.ts` and do not load these
files at runtime or require an external resource.

| Local reference | Owner-supplied filename |
| --- | --- |
| `references/shadows.svg` | `svg-paper-shadow-comparison.svg` |
| `references/push-pins.svg` | `10602857_42448.svg` |
| `references/paper-clips.svg` | `1678193239paperclips.svg` |
| `references/note-pad.svg` | `post-it.svg` |
| `references/sticky-note.svg` | `postit.svg` |

The implemented set includes offset, raised-centre, raised-corners and
raised-corner shadows; plain paper, sticky notes and layered pads; push-pins,
round pins, paper clips, binder clips and tape. Paper, shadow and attachment
colours are independent. Highlights and shading derive from the selected
colour. The procedural attachment artwork uses no source-script, embedded
image, external gradient or external filter dependency.

The [interactive comparison page](../../../../website/features/paper.html)
uses the maintained new-dialect examples and current viewer/designer.
