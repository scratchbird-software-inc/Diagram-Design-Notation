# Hand-drawn rendering correction — draft.2

This bundle replaces the weak draft.1 stroke treatment with visibly hand-drawn vector geometry. Open `site/gallery.html` for the existing six-look gallery, or `examples/rendered/09-look-comparison/handDrawn.svg` for the new coordinate-free sample. Its source is `examples/09-look-comparison.ddn`.

## What changed

- Irregular double-stroke outlines for tables, domains, samples, rounded activities, notes and frames.
- Seeded bowed pen strokes for field separators, sample-grid rules and relationship bodies.
- Optional light diagonal hatching, clipped inside each object, preserving registered semantic colours.
- Explicit optional `font: handwriting` support using local fonts. No font files are redistributed or fetched.
- Neo gets a clearer offset shadow and top-edge treatment; rectangular tables remain rectangular.
- Crossing paths now contain explicit gaps as well as masks, preventing false joins in SVG readers with alpha-only mask handling.
- Endpoint marks, registry icons, numbered circles, crossing semantics and scene geometry remain stable.
- Invalid roughness, hachure and seed values are diagnosed rather than silently ignored.

## Use in an existing view

```ddn
style {
    look: handDrawn;
    font: handwriting;
    seed: 42;
    roughness: 1.8;
    hachure: true;
}
```

Only `look: handDrawn;` is needed for the new geometry. Omit `font` to retain your current font; set `hachure: false;` for plain interiors. Formatting references and shared data work as before.

## Integration

The complete bundle already loads `reference/ddn-sketch.js` before the renderer in its browser editor. An existing external browser host must add that script between `ddn-core.js` and `ddn-render.js`. The CLI requires the module directly. No npm install, CDN, raster filtering or font download is required. Changing just an old pre-rendered SVG cannot change the renderer: regenerate the SVG from the source.

```sh
npm test
npm run build:examples
npm run serve
```

New executable examples: `09-look-comparison.ddn` shares one model across three distinct looks with automatic grid placement; `10-handdrawn-routing.ddn` shows gap, rounded bridge, square bridge and straight routing in the corrected look.

This is a rendering correction, not a new layout engine. Grid/manual placement and the pre-existing limits on global routing, measured typography and graphical editing remain. Handwriting font appearance depends on installed fonts; sketch geometry remains present even when the font falls back. Existing outputs intentionally change and must be regenerated for updated hashes.
