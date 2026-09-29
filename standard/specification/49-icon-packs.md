# 49. Icon packs (ddn-icon-pack@1)

Status: implemented in runtime 0.7.0. This chapter is the normative
specification of the DDN **icon pack** format — an open, self-contained way
to distribute sets of diagram symbols. It is written at the format level:
nothing here depends on a particular tool, repository or runtime, and any
conforming producer or consumer can interoperate. The machine-readable
schema is `standard/schemas/icon-pack.schema.json`; shipped packs live as
one file per pack under `standard/registry/icon-packs/`.

## 1. Purpose and distribution format

An icon pack is a **single JSON document**. One file is one pack: packs can
be emailed, vendored, published on the web, or embedded in a host
application without any supporting directory structure. The document's
`format` member is the string `ddn-icon-pack@1`.

A pack has two parts: a **manifest** (who made this, under what license,
from where) and the **icons** (the artwork plus binding metadata).

## 2. Manifest

| Member | Type | Required | Rule |
| --- | --- | --- | --- |
| `format` | string | yes | The constant `ddn-icon-pack@1`. |
| `id` | string | yes | `lowercase-name@N` — the pack namespace. Icons are referenced as `<id>/<icon-id>`. |
| `name` | string | yes | Human-readable pack name. |
| `version` | string | yes | Semantic version `x.y.z` of the pack document. |
| `license` | string | yes | SPDX license identifier of the artwork. |
| `attribution` | string | yes | Copyright holder and credit line for derivative notices. |
| `source` | string | yes | Canonical upstream location of the artwork. |
| `licenseText` | string | conditional | Full license text; required when the license demands redistribution of the text (e.g. MIT). |
| `note` | string | no | Scope note: curation stance, disclaimers, deliberate omissions. |
| `grid` | object | yes | The grid convention (§3). |

Producers **must** state license and attribution honestly; consumers
**should** surface them anywhere the pack is listed. Third-party artwork
ships only with its license text included.

## 3. Grid conventions

`grid` fixes the pack's drawing convention: `size` (the square grid edge;
every icon's `viewBox` must be `0 0 <size> <size>`), `strokeWidth` (the
nominal stroke shared by the pack, in grid units), and optional `linecap`
and `linejoin`. Icons are stroke-based, drawn on the shared grid so a
diagram mixing icons from one pack reads as a single family. `24` with a
stroke of `1.5`–`2` is the established convention across the shipped packs.

## 4. Icon entries

Each entry in `icons` has:

| Member | Type | Required | Rule |
| --- | --- | --- | --- |
| `id` | string | yes | `lowercase-with-hyphens`, unique within the pack. |
| `name` | string | yes | Human-readable icon name. |
| `svg` | string | yes | A complete inline SVG document, ≤ 20 KiB, conforming to §5. |
| `kinds` | string[] | no | DDN element kinds this icon binds to by default (§6). |
| `tags` | string[] | no | Free-form classification for search and curation. |

## 5. Sanitization requirements (normative)

Icon SVG is user-supplied markup rendered into the consumer's page, so
**every consumer must reject an icon before rendering it** when any of the
following holds (the DDN runtime reports rejection as `DDN-PJ207`):

- the `svg` member is not a string beginning with `<svg`;
- it exceeds **20 KiB** (20,480 characters);
- it contains scripts (`<script>`, `javascript:`), embedded documents
  (`<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<image>`),
  external references of any kind (`href`/`xlink:href` attributes, `url()`
  paint servers, remote fonts), event-handler attributes (`on*=`),
  or `<!doctype`/`<!entity` declarations.

Icons must inline everything they need. A pack that fails sanitization for
any icon fails as a whole.

## 6. Binding rules

- **Default binding**: when a node has no explicit icon, the first icon
  entry — across all registered packs, in pack registration order — whose
  `kinds` contains the node's kind is drawn inside the node. Pack order is
  therefore binding precedence; a curated, more specific pack should
  register before a generic one.
- **Override**: the `x_icon` extension property on any element
  (`x_icon: { library: "<pack-id>", icon: "<icon-id>" }`) binds a specific
  icon to that node, regardless of `kinds`.
- **Unknown references** are errors (`DDN-PJ206`), never silent fallbacks.

## 7. Versioning and namespaces

- The `@N` suffix in the pack id is the **major version**: removing an
  icon, renaming an id, or redrawing an icon incompatibly requires a new
  pack id (`acme-symbols@2`), so existing diagrams keep rendering exactly
  as authored. In-place additions may bump `version` only.
- Pack ids are a flat namespace. Host applications must refuse to register
  a pack whose id is already registered (shipped or host-supplied) —
  reported as `DDN-PJ206`.
- Icon ids never change within a pack major version.

## 8. Host registration

Hosts (viewers, editors, embedding applications) may accept packs at
runtime. The DDN runtime exposes `registerIconPack(pack)` /
`unregisterIconPack(id)` / `hostIconPacks()` on its public API: a pack is
manifest-validated and sanitized exactly as in §5 before it can render, and
host packs append after shipped packs in binding precedence. Malformed
manifests fail `DDN-PJ206`; unsafe icons fail `DDN-PJ207`.

## 9. Shipped packs

| Pack | Icons | License | Scope |
| --- | --- | --- | --- |
| `network-generic@1` | 20 | GPL-2.0-or-later | generic infrastructure; binds `network.*` |
| `vsm-symbols@1` | 16 | GPL-2.0-or-later | value-stream mapping; binds `vsm.*` |
| `pid-common@1` | 36 | GPL-2.0-or-later | ISA-5.1-style common set (common-practice, pending document review) |
| `electrical-common@1` | 32 | GPL-2.0-or-later | IEC 60617-style common set (common-practice, pending document review) |
| `tabler-infra@1` | 50 | MIT | curated Tabler infrastructure selection |
| `iconoir-infra@1` | 49 | MIT | curated Iconoir selection, complementing Tabler |
| `generic-demo@1` | 4 | GPL-2.0-or-later | original mechanism demo set |

The two MIT packs include their license text and attribution in the
manifest and are recorded in the repository `NOTICE.md`. Vendor packs
(Cisco/AWS/Azure/GCP) remain excluded pending licensing diligence.

## 10. Authoring a pack (summary for third parties)

1. Draw stroke SVG icons on one square grid, one stroke width.
2. Assemble the single JSON document per §2–§4 with honest license fields.
3. Validate against `standard/schemas/icon-pack.schema.json` and the §5
   sanitization rules.
4. Load it: ship it to the registry for everyone, or register it at runtime
   per §8.

Examples: every file under `standard/registry/icon-packs/` is a conforming
worked example; the compliance suite validates all of them against the
schema and renders every icon.
