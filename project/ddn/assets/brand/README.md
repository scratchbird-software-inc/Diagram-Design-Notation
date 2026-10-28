# DDN interface artwork

These are the project's existing DDN logo variants, preserved byte-for-byte.
`ddn.svg` is the blue mark for light surfaces; `ddn-dark.svg` is the white mark
for dark surfaces. The private review website retains the same marks alongside
the ScratchBird product-family artwork.

The standalone utilities embed the SVG bytes so downloaded HTML needs no
external logo file or network request. After an intentional artwork update,
run `node tooling/workspace/ddn-brand.mjs --write`; running that tool without
`--write` checks the generated TypeScript resource. Branding does not affect
DDN document data or exported diagrams.
