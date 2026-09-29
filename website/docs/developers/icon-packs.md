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

Vendor packs (Cisco/AWS/Azure/GCP) are excluded pending licensing diligence.

## Binding

- **Default**: the first icon entry whose `kinds` lists the node's kind
  wins; pack registration order is precedence.
- **Per node**: `x_icon: { library: "tabler-infra@1", icon: "server" }`.

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
