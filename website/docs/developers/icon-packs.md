# Icon packs

DDN renders named SVG symbols inside diagram nodes. The symbols ship in
**icon packs** — self-contained JSON documents specified openly in
[specification chapter 49](../../standard/specification/49-icon-packs.html)
(schema: `standard/schemas/icon-pack.schema.json`). The format is
tool-agnostic: any producer or consumer can interoperate.

## Shipped packs

| Pack | Icons | License | Use |
| --- | --- | --- | --- |
| `network-generic@1` | 20 | GPL-2.0-or-later | generic infrastructure; default-bound to `network.*` kinds |
| `vsm-symbols@1` | 16 | GPL-2.0-or-later | value-stream mapping; default-bound to `vsm.*` kinds |
| `pid-common@1` | 36 | GPL-2.0-or-later | ISA-5.1-style common set (common-practice, pending document review) |
| `electrical-common@1` | 32 | GPL-2.0-or-later | IEC 60617-style common set (common-practice, pending document review) |
| `tabler-infra@1` | 50 | MIT | curated Tabler infrastructure selection |
| `iconoir-infra@1` | 49 | MIT | curated Iconoir selection, complementing Tabler |
| `generic-demo@1` | 4 | GPL-2.0-or-later | mechanism demo set |
| `ddn-pack-general@1` | 121 | MIT | general-purpose end-user selection (people, documents, devices, network, security, business, process, places, transport, status, nature, messaging) |

Vendor packs (Cisco/AWS/Azure/GCP) are excluded pending licensing diligence.
`ddn-pack-general@1` binds nothing by default — pick icons explicitly in the
designer (select a node → **Icon → Browse icons…**) or per node in source.
Per-icon provenance: `standard/registry/icon-packs/ddn-pack-general.provenance.json`.

## Binding

- **Default**: the first icon entry whose `kinds` lists the node's kind
  wins; pack registration order is precedence.
- **Per node**: `x_icon: { library: "tabler-infra@1", icon: "server" }` — works on **any** node kind, not just notation-profile kinds.

Unknown references are `DDN-PJ206` errors, never silent fallbacks.

## Authoring and loading your own pack

Author a single JSON document per the spec (manifest with license and
attribution, one shared grid, inline stroke SVG ≤ 20 KiB per icon), then
register it at runtime — it is validated and sanitized exactly like a
shipped pack before it can render:

```js
DDNLive.registerIconPack(pack);          // throws DDN-PJ206 (manifest) / DDN-PJ207 (unsafe SVG)
DDNLive.hostIconPacks();                 // currently registered host packs
DDNLive.unregisterIconPack('acme-symbols@1');
```

Host packs append after shipped packs in binding precedence, so they never
shadow the built-in defaults accidentally. Every icon — shipped or
host-supplied — is sanitized: no scripts, `foreignObject`, event handlers,
or external references of any kind, and a 20 KiB cap per icon.

## Art packs (presentation illustrations)

**Art packs** (`ddn-art-pack@1`,
[specification chapter 50](../../standard/specification/50-art-packs.html),
schema `standard/schemas/art-pack.schema.json`) are the presentation-idiom
sibling of icon packs: detailed illustrations (computers, server racks,
network gear, buildings, people) with arbitrary viewBoxes and full colour —
not 24×24 stroke icons. Every item declares **connection anchors** (the four
side anchors plus optional named points, in viewBox coordinates); relations
attach exactly at them: a body endpoint lands on its side's anchor, and a
`port` member whose name matches an anchor snaps to that anchor.

Art packs are **never inlined into the runtime bundles** — register them
explicitly:

```js
DDNLive.registerArtPack(pack);           // throws DDN-PJ206 (manifest) / DDN-PJ207 (unsafe SVG)
DDNLive.hostArtPacks();
DDNLive.unregisterArtPack('acme-art@1');
```

or per CLI run:

```sh
node notation/cli/cli.js render diagram.ddn --view overview \
  --pack standard/registry/art-packs/presentation-devices__1.json
```

Bind an item to a node with `x_art: { library: "presentation-devices@1",
item: "server" }`. An unresolvable reference draws a dashed placeholder
naming the missing pack — never an error — so a shared `.ddn` file still
renders on hosts without the pack. The illustration scales into the node's
interior below the header with aspect preserved.

The shipped `presentation-devices@1` pack (Wikimedia Commons CC0/public
domain selection, per-item provenance in the pack) is demonstrated by
`website/examples/basics/110-presentation-architecture.ddn`.

### Browsing and adding items

Every installed item is browsable with previews and a copyable `x_art`
reference in the [art pack viewer](../../icons/art.html).

To add items to a pack (or author a new one), work through the format and
its gates — there is no shortcut around them:

1. **One JSON document per pack** (`ddn-art-pack@1`): manifest (`id`
   `lowercase-name@N`, `name`, semantic `version`, `license`, `attribution`,
   `source`) plus `items`.
2. **Each item** needs `id` (`lowercase-with-hyphens`), `name`, inline `svg`
   (≤ 64 KiB, arbitrary viewBox, self-contained), required **anchors**
   (`north`/`east`/`south`/`west` in viewBox coordinates — the points
   relations attach to — plus optional named points addressable as `port`
   members), and mandatory **provenance** (`title`, `author`, `license`,
   `source` URL, `retrieved` date).
3. **Licensing is the hard gate.** Verify every item's license at curation
   time and record it in `provenance` — CC0 / public domain preferred. Items
   whose terms cannot be verified do not ship. (unDraw and similar
   use-but-don't-redistribute licenses are out; see `NOTICE.md` for the
   standing evaluations.)
4. **Sanitization is identical to icons**: registration rejects scripts,
   `foreignObject`, event handlers, external references (DDN-PJ207), and
   malformed manifests (DDN-PJ206) — a pack with one unsafe item fails as a
   whole.
5. **Curation tooling** (used for the shipped pack):
   `tools/fetch-art-candidates.mjs` (Wikimedia Commons CC0/PD search +
   download with license metadata), `tools/fetch-art-freesvg.mjs` +
   `tools/review-art-freesvg.mjs` (freesvg.org CC0 candidates + manual
   review listing), `tools/curate-art.mjs` (topic-slot search helper),
   `tools/build-art-pack.mjs` (license gate, sanitize, minify, anchor
   derivation, provenance assembly → `standard/registry/art-packs/`).
   Review every candidate visually — automated picking is not trustworthy
   on its own.
6. **Versioning**: item removals, renames, anchor moves, or anchor-shifting
   artwork changes require a new pack major (`@N`), never an in-place edit.
