# View surfaces

Owner direction, 25 October 2026: a view's surface layout is independent of its diagram profile and of workarea/standalone document mode. This opt-in extension belongs to the unreleased `ddn-next-1` defaults. Omission remains the existing dynamic view. No existing default changes.

A view selects its surface with one optional setting:

```ddn
mindmap Roadmap
    with
        surface.preset tv-4k
    Research
    Delivery
```

| Preset | Outer pixels | Preferred scale | Default text pixels before fitting |
|---|---:|---:|---:|
| dynamic | content extent | 1 | existing profile defaults |
| tv-hd | 1280 × 720 | 2/3 | 16 |
| tv-fhd | 1920 × 1080 | 1 | 24 |
| tv-2k | 2048 × 1080 | 1 | 24 |
| tv-qhd | 2560 × 1440 | 4/3 | 32 |
| tv-4k | 3840 × 2160 | 2 | 48 |
| tv-8k | 7680 × 4320 | 4 | 96 |

Pixel dimensions disambiguate 2K from QHD. TV recipes use a logical 1080-line drawing space, sans font at 24 logical pixels, neutral theme, white background, dark text, visible title and no standard banner/footer. Fixed outer dimensions never grow with content. `surface.fit contain` uniformly reduces content if necessary; it does not enlarge content above the preferred `surface.scale`. `none` retains that scale and clips overflow. Padding is 32 logical units multiplied by the preferred scale. Resolved view typography is the standard fallback for contained items; their CSS, defaults and explicit settings retain priority.

`surface.width` and `surface.height` override recipe dimensions, in pixels. Both must be positive or both null; null/null gives dynamic extent. `surface.scale` must be positive; `surface.padding` must be nonnegative and leave a positive drawable area. `surface.preset` is explicit, not CSS/defaults eligible. Other surface settings are CSS/default eligible with file > CSS > recipe standard priority. Ordinary view/element properties continue to override fonts, paint, backgrounds and chrome. Existing background-image assets and title/footer settings provide optional branding; no logo, company identity or external resource is inserted by these recipes.

The open designer enables Dynamic and TV/dashboard layouts. Physical pages (Letter, Legal, A1–A5, Custom) and presentation proportions (PPTX/ODP 16:9, 4:3, Custom) are visible unavailable creation choices for Weaver, with explanatory hints. Those tiles neither author a fictional preset nor imply an installed publication adapter. Existing publication `page.*` settings remain a separate output contract.

The executable recipe catalogue is `project/ddn/packages/profiles/src/view-surfaces.ts`. Property types, omission values and CSS names are indexed in `property-codex.json`, `ddn.schema.json` and `css-map.json`. A future released default change needs a new defaults version.
