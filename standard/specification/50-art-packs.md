# 50. Art packs (ddn-art-pack@1)

Status: implemented in runtime 0.7.0. This chapter is the normative
specification of the DDN **art pack** format — the presentation-illustration
sibling of the icon pack (chapter 49) for detailed artwork that is **not**
drawn on a 24×24 stroke grid: computers, server racks, network devices,
buildings, people. The machine-readable schema is
`standard/schemas/art-pack.schema.json`; shipped packs live as one file per
pack under `standard/registry/art-packs/`.

## 1. Purpose and distribution format

An art pack is a **single JSON document**, exactly like an icon pack: one
file is one pack. The document's `format` member is the string
`ddn-art-pack@1`.

Art packs differ from icon packs in three ways:

1. **Artwork, not symbols.** Items are detailed illustrations with arbitrary
   `viewBox` dimensions and full colour; there is no shared grid, stroke
   width, or cap/join convention.
2. **Connection anchors.** Every item declares the points where relations
   attach to the illustration (§4) — the presentation-diagram idiom of
   connectors glued to a shape's connection points.
3. **Per-item provenance.** Because artwork is curated item by item, each
   entry carries its own source and license record (§5) in addition to the
   pack manifest.

Art packs are **never inlined into runtime bundles**. A host registers a
pack explicitly (`DDNLive.registerArtPack`); the CLI registers packs for a
single run with `--pack FILE.json`. Distribution is by file download, not by
embedding in `ddn.global.js` or the standalone tools.

## 2. Manifest

The manifest is identical in shape and rules to the icon pack manifest
(chapter 49 §2): `format`, `id` (`lowercase-name@N`), `name`, `version`
(semantic), `license` (SPDX), `attribution`, `source`, conditional
`licenseText`, optional `note`. There is no `grid` member.

## 3. Art entries

Each entry in `items` has:

| Member | Type | Required | Rule |
| --- | --- | --- | --- |
| `id` | string | yes | `lowercase-with-hyphens`, unique within the pack. |
| `name` | string | yes | Human-readable item name. |
| `svg` | string | yes | A complete inline SVG document, ≤ 64 KiB, conforming to §6. |
| `anchors` | object | yes | Connection points in `viewBox` coordinates (§4). |
| `tags` | string[] | no | Free-form classification for search and curation. |
| `provenance` | object | yes | Per-item licensing record (§5). |

An item is referenced from a model with the `x_art` extension:
`x_art: { library: "<pack-id>", item: "<item-id>" }`. The illustration
renders in the node's interior below its header, scaled to fit with aspect
preserved.

An **unresolvable `x_art` reference is not an error**. Art is presentation
content and packs install per host; a consumer that lacks the pack draws a
dashed placeholder naming the missing reference. This keeps a shared `.ddn`
file renderable everywhere. (Contrast with `x_icon`, whose references are
normative model metadata and fail closed.)

## 4. Connection anchors

`anchors` maps anchor names to `[x, y]` points in the item's `viewBox`
coordinate space. The four side anchors — `north`, `east`, `south`, `west` —
are **required**; any number of additional named anchors (for example
`console`, `uplink`) is allowed. Anchor names are
`lowercase-with-hyphens`.

Consumers that route relations **must** attach endpoints as follows:

- A relation endpoint that names a member equal to an anchor name attaches
  exactly at that anchor. (The member is declared in the model as a `port`;
  the anchor refines where on the illustration the port sits.)
- A body endpoint assigned to a side with a declared anchor attaches at the
  side's anchor point.
- Endpoint direction is the outward normal of the anchor's nearest edge.

Anchors map through the same aspect-preserving fit transform as the drawn
illustration, so the drawn attachment and the routed attachment coincide.

## 5. Provenance and licensing

Every item carries a `provenance` record:

| Member | Type | Required | Rule |
| --- | --- | --- | --- |
| `title` | string | yes | Upstream work title (file name or artwork name). |
| `author` | string | yes | Upstream author or publisher. |
| `license` | string | yes | SPDX identifier for this item's artwork. |
| `source` | string | yes | Canonical URL of the exact upstream file. |
| `retrieved` | string | yes | ISO date the item was fetched and verified. |

The pack-level `license` is the dominant (most restrictive) item license.
Producers **must** verify every item's license at curation time and record
it honestly; items whose license terms cannot be verified do not ship.
`CC0-1.0` and public-domain items need no `licenseText`.

## 6. Sanitization (normative)

Every art item — shipped or third-party — is rejected before rendering
under the same rules as icon artwork (chapter 49 §5): no scripts, no
`foreignObject`, no event handlers, no external references of any kind
(`href`, `url()`, remote fonts, images), no doctype/entity declarations.
The per-item byte budget is **64 KiB** (detailed artwork needs more than an
icon's 20 KiB). A pack with one unsafe item fails as a whole.

## 7. Versioning

The icon-pack versioning rule applies unchanged: item removals, renames,
anchor moves, or artwork changes that shift anchors require a new pack
major version (a new `@N` `id`), never an in-place edit.
