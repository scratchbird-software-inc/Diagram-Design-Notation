# Paper surfaces, shadows and stationery

The owner requested these presentation additions while `ddn-next-1` remains an
unreleased candidate. They change how an existing item or view is drawn. They do
not introduce a new semantic element, connector, vote, lifecycle state or grant.
Omitting them preserves the existing appearance.

`style.paper`, `shadow` and `decorations` are available on definitions,
appearances, view definitions, placed views and output-oriented documents. A
definition supplies shared presentation; an appearance can override one use.
Relations keep their method-specific connector geometry. The paper surface and
attachments render on item/view surfaces, not on connector strokes. Existing
workarea/publication shadow records use the same typed shadow object but do not
acquire paper or attachment collections.

## Short source

```text
element Idea as note
    with
        paper note
        background.color "#fff2ab"
        shadow centre
        decorations
            item
                kind push-pin
                color "#d04b86"
                position rt
view Workshop as ddn@1
    use Idea
```

`paper` is the short spelling of `style.paper`. `shadow centre` supplies
`shadow.kind centre`; the recognized silhouette words can also be quoted.
Structured `shadow` blocks, dotted paths such as `shadow.blur`, and `shadow null`
remain the same canonical shadow contract. The shorthand does not create a
separate style-shadow property or a second cascade.

## Values and omissions

| Setting | Values | When omitted |
| --- | --- | --- |
| `style.paper` | `plain`, `note`, `pad` | `plain`; existing surface |
| `shadow` | typed object or `null` | `null`; no shadow |
| `shadow.kind` | `none`, `offset`, `centre`, `corners`, `corner` | `offset` when a shadow object is supplied |
| `shadow.color` | standard DDN colour | `#000000` |
| `shadow.opacity` | 0–1 | 0.24 |
| `shadow.x`, `shadow.y` | finite logical-pixel offsets | 6 and 8 for `offset`; 0 and 0 otherwise |
| `shadow.blur` | 0–128 logical pixels | 4 |
| `shadow.spread` | 0–128 logical pixels | 0 |
| `shadow.lift` | 0–64 logical pixels | 10 |
| `decorations` | ordered list, at most 32 entries | empty list |

`centre` lifts the middle of the bottom edge, `corners` lifts both lower corners,
and `corner` lifts the lower-right corner. `none` disables a shadow without
changing paper or attachments. `background.color` controls paper colour on
definitions, occurrences and view frames. The note/pad standard colour is
`#fff59d`; this applies only at standard origin, so explicit white or any other
colour from CSS, default rules or the file retains priority. Plain surfaces keep
their existing defaults. Text and borders retain their
separate settings. Shadows increase painted bounds, not semantic geometry or
hit areas.

Each decoration requires a `kind`; other settings are optional:

| Setting | Values | Default |
| --- | --- | --- |
| `kind` | `push-pin`, `round-pin`, `paper-clip`, `binder-clip`, `tape` | required |
| `color` | standard DDN colour | kind-specific below |
| `position` | `lt`, `ct`, `rt`, `lm`, `cm`, `rm`, `lb`, `cb`, `rb` | `ct` |
| `size` | 8–128 logical pixels | 32 |
| `rotation` | −180–180 degrees | 0 |
| `opacity` | 0–1 | 1 |
| `offset.x`, `offset.y` | −256–256 logical pixels | 0, 0 |

Position combines left/centre/right with top/middle/bottom. The anchor belongs
to the existing surface; offsets and rotation move only the decorative artwork.
Source order controls attachment paint order. Default colours are `#df4545` for
push-pins, `#45a3da` for round pins, `#5b83b4` for paper clips, `#3b414b` for
binder clips and `#e4c788` for tape. Colours use the existing DDN contract:
`transparent`, `#RGB`, `#RRGGBB` or `#RRGGBBAA`.

## Defaults and CSS

All three properties are eligible for file/workarea/view defaults and scoped
CSS. Explicit file properties retain priority over CSS. A supplied decorations
list replaces the inherited list; it is not concatenated with it. Shadow object
members merge through the existing cascade, so a colour override need not
repeat the selected silhouette.

```css
.method-ddn.subtype-discussion.role-note {
    --ddn-style-paper: note;
    --ddn-shadow: {"kind":"corners","color":"#243448","opacity":0.2};
    --ddn-decorations: [{"kind":"push-pin","color":"#d04b86"}];
}
```

The exact constraints live in `ddn.schema.json`, the indexed property bindings
in `property-codex.json`, and the CSS hooks in `css-map.json`. Optional record
member defaults are presentation defaults; readers need not write them into
authored source. Standard defaults outside this extension are unchanged.
