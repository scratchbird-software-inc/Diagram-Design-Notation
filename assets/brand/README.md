# Family icon exports

The owner artwork is `ScratchBirdLogos.svg`. Run `npm run build:brand` at the
repository root to regenerate its named-group SVGs and raster assets. The
normal and `-dark` `.ico` files each contain transparent 16, 24, 32, 48, 64,
128 and 256 px PNG frames. `favicon.ico` is a copy of `ddn.ico`.

To regenerate only the ICOs from the checked-in SVGs, run
`python3 tools/build-ico.py`. Inkscape is required; no separate Python imaging
package is needed. The website build copies these files to
`website/assets/brand/`.
