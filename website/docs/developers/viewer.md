# Viewer (retired)

The single-file end-user viewer (`notation/viewer/ddn-viewer.html`, B1-007)
was retired in B1-027: its features — fit modes, per-kind/verb/object colour
and typography overrides, click-to-select panels, `?src=` deep links, PNG
export — live on in the **unified diagram tool**, served as
`tools/index.html` (see [tool.md](tool.md)). The old URL
`tools/viewer/index.html` is a redirect stub that forwards `?src=` (and
`entry`/`view`/`mode`/`drawers`) to the unified tool.

The viewer sources (`notation/viewer/src/`) and `tools/build-viewer.js` are
kept, deprecated, and still covered by their test suite; they are no longer
served by the website.
