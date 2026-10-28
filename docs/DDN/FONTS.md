# Local font resources

The browser font adapter supports an optional standard suite and user-selected local fonts without a server. It is a presentation utility; it adds no dialect grammar, network font lookup or font-upload service. Existing generic defaults remain unchanged. The [resource manifest](../../project/ddn/assets/fonts/manifest.json) and [font resource notes](../../project/ddn/assets/fonts/README.md) define the pinned standard suite and licenses.

The shared module is [viewer/src/fonts.ts](../../project/ddn/packages/viewer/src/fonts.ts). Its APIs use an explicit `Document` to keep separately hosted viewers and browser realms isolated. The core viewer/designer bundle does not contain font binaries. The host can include the optional `ddn-fonts.js` before constructing the viewer:

```html
<script src="ddn-fonts.js"></script>
```

The script is a small catalogue/loader. Keep its `fonts/` directory beside it, using the resources from the modular ZIP. It registers `DDN_FONT_CATALOGUE` and `DDN_LOAD_FONTS`; `DDN_FONT_RESOURCES` initially contains no binaries. Viewers load the normal Inter face, then only the family/style faces used by their scenes. Appearance selection loads a selected face before applying it. Verifiers do not load fonts. Each face is a local content-addressed script carrying base64 WOFF2 bytes and its full licence notice. Concurrent requests share one load, errors are bounded and retryable, and filenames come exclusively from the trusted catalogue. Missing resource registration is a no-op. A host that does not include it keeps system fonts. A missing script file may appear as a browser resource warning but must not prevent application startup.

## API

```ts
fontFamily(key: string): string
ensureFontResources(document: Document,
  requests: readonly { family: string; style?: FontStyle }[]): Promise<boolean>
installFontResources(document: Document,
  resources?: readonly FontResource[]): Promise<readonly FontOption[]>
listFonts(document: Document): readonly FontOption[]
loadFontFile(document: Document, file: File,
  options?: { family?: string; weight?: string; style?: 'normal' | 'italic' | 'oblique' }
): Promise<FontOption>
getFontResources(document: Document,
  usedFontKeys?: Iterable<string>): readonly FontResource[]
fontCSS(document: Document, usedFontKeys: Iterable<string>): string
```

`fontFamily` preserves `sans`, `serif`, `mono`, `monospace` and `handwriting`. Named families and comma-separated fallback lists become safely quoted CSS family values. Family selection uses existing `style.font`; font size uses existing `style.font_size`. The optional suite does not change their defaults or the file > CSS > standard priority.

`ensureFontResources` loads and installs only requested standard faces and reports whether installation changed. Unknown/system families do not load resources. `installFontResources` reads an explicit resource array; with no array it explicitly loads the complete optional standard suite when a catalogue loader exists, or uses the page's global registration otherwise. Await its result before initial text measurement, layout and capture. It validates the whole input array before constructing any browser `FontFace`, loads each binary and registers only successful faces with that document's `FontFaceSet`. Simultaneous identical registrations share pending work. A different binary for an already occupied family/weight/style slot is rejected; one user font cannot silently replace another. A failed browser load rejects the call; other successfully loaded faces remain usable. The host should report that failure and allow system fallback. Document font loading events can invalidate viewer text measurements after later custom additions.

Each `FontOption` has `key`, `family`, `label`, `category`, `source`, `available`, `weights` and `styles`. Generic choices are always available. Standard family entries exist before installation with `available: false`; after loading they describe the faces actually present. Custom entries appear only after successful loading. Weight strings are actual single weights or ranges. Style metadata does not promise unsupported italic files or arbitrary variable-axis controls. Caveat has a normal face; any browser synthesized italic is not a bundled italic face.

Each `FontResource` has a required `family` and `dataURL`, with optional `weight`, `style`, `category`, `source` and `license` notice. The defaults are weight `400`, style `normal`, category `custom`, source `custom`. Only base64 `data:font/woff2`, `data:font/woff`, `data:font/ttf` and `data:font/otf` sources are accepted. The MIME declaration must match the binary signature. Remote URLs, HTML/SVG payloads and font collections are rejected. Fonts are passed to the browser as binary buffers; there is no URL-based font loader. Limits are 16 MiB per face and 128 faces per document. Browser validation must also succeed before a font is offered as loaded.

## Custom local fonts and persistence

A file input can accept `.woff2,.woff,.ttf,.otf`. Pass the selected `File` to `loadFontFile`. The family defaults to the filename without its extension, with underscores/hyphens replaced by spaces. A host can supply a distinct family name; no internal font-name parser is assumed. A local font cannot take over a generic alias. The simple loader registers one normal 400 face unless weight/style are supplied explicitly; it does not infer arbitrary axes from a custom binary.

Loading a file does not upload it, write browser storage or edit DDN source. After loading, the designer can explicitly set the existing `style.font` property to the returned family. A font name in DDN does not itself carry font bytes. Reloading that DDN on another machine therefore requires the matching local resource pack or the custom font to be loaded again. Hosts that provide persistence can save the copied resources returned by `getFontResources` and reinstall them later; supplied license notices remain attached. Binary data belongs to the host's local resource handling, not an undocumented DDN property.

## SVG and PNG export

Collect the scene's used text `fontKey` values and call `fontCSS`. Insert the result as `textContent` of an SVG `style` element before serialization. It embeds all installed weight/style faces of the selected families, with local data URLs and any supplied license notices. Unused families are omitted. Standard suite notices are retained automatically. Custom fonts are embedded only when explicitly loaded locally; the adapter never retrieves fonts from CSS URLs or extracts installed operating-system font binaries.

The same self-contained SVG can be rasterized to PNG. Generic or unknown system fonts cannot be made portable by name alone. A used family must be registered locally to be embedded. The host must await font installation before capturing; text placement was calculated using those metrics.

## Pack builder and validation

[tooling/workspace/ddn-fonts.mjs](../../tooling/workspace/ddn-fonts.mjs) exports `buildFontPack(outputDirectory)` and returns `{script, manifest, licenses, index, bytes, files, faces}`. Output must be beneath the repository's `.work`. It reads only the maintained local font assets, verifies recorded hashes and creates the catalogue script, face index, original provenance manifest, licence file and seven face scripts. No build-time download is necessary. Distribution/site builders can copy those outputs to their existing publication destinations.

Focused tests are [fonts.test.mjs](../../project/tests/ddn/browser/fonts.test.mjs) and [fonts.browser.mjs](../../project/tests/ddn/browser/fonts.browser.mjs). They cover default preservation, input validation, concurrent registration, failure handling, document isolation, export subsets and notices, official asset integrity, real offline `file://` loading, distinct measured family metrics, custom TTF loading, malformed fonts and SVG raster fidelity after the originating document's font set is removed. Build DDN before running them. Browser artifacts remain under `.work/reports/ddn-fonts`.
