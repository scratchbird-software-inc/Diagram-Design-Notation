# Optional DDN font resources

These four open font families form the standard local suite. They are optional page resources, separate from the DDN JavaScript runtime and its generic font defaults. No network service is needed to use them.

| Family | Purpose | Version | Weight range | Faces |
| --- | --- | --- | --- | --- |
| Inter | Sans serif | 4.001 | 100–900 | Normal, italic |
| Source Serif 4 | Serif | 4.005 | 200–900 | Normal, italic |
| JetBrains Mono | Monospace | 2.305 | 100–800 | Normal, italic |
| Caveat | Handwriting | 2.000 | 400–700 | Normal |

Seven WOFF2 files total **1,926,284 bytes**. The full upstream character sets are retained. A font can still lack characters outside its coverage; browsers use their usual fallback glyphs. Generic `sans`, `serif`, `mono`, `monospace` and `handwriting` keep their existing system mappings. Choose the named family to use these bundled files.

[manifest.json](manifest.json) records pinned official repository commits, exact download URLs, upstream and distributed SHA-256 hashes, versions, face descriptors, byte sizes and available axes. The runtime exposes supported families and face weight/style descriptors; it does not claim an arbitrary variable-axis editing API.

Official sources and retained licenses:

- [Inter](https://github.com/rsms/inter), [local license](inter/OFL.txt).
- [Source Serif](https://github.com/adobe-fonts/source-serif), [local license](source-serif/OFL.txt).
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), [local license](jetbrains-mono/OFL.txt).
- [Caveat](https://github.com/googlefonts/caveat), [local license](caveat/OFL.txt).

All four fonts use SIL Open Font License 1.1. These upstream notices and font licenses remain separate from DDN's GPL-2.0-or-later licence. Inter, Source Serif and JetBrains Mono WOFF2 binaries are unchanged. Caveat is the official variable TTF compressed to WOFF2 using `fonttools 4.59.2` with `brotli 1.1.0`; no subsetting, outline edits or naming changes were made. To reproduce that compression, download the pinned `sourceURL` from the manifest, check `sourceSha256`, then use `TTFont(input)`, set `font.flavor = 'woff2'`, and `font.save(output)` in an environment containing those versions. The recorded WOFF2 SHA-256 is the output integrity authority.

Build the resource pack from repository root:

```sh
source tooling/env.sh
node tooling/workspace/ddn-fonts.mjs .work/builds/ddn-fonts
```

The builder verifies every font and license hash before producing `ddn-fonts.js`, `ddn-fonts-manifest.json` and `ddn-fonts-LICENSES.txt`. The JavaScript pack includes all notices and local data URLs, so it also works beside a standalone HTML file opened with `file://`. The optional script is approximately 2.63 MB including base64 encoding and notices. It does not request external fonts. Preserve its notices when distributing it.

See [the browser font integration contract](../../../../docs/DDN/FONTS.md) for installation, custom local fonts, persistence and SVG export.
