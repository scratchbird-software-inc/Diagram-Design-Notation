#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Designer redesign phase 2: stamps the `allowed_in` capability list onto
 * every entry of designer/contracts/kind-ui-map.json and
 * relation-ui-map.json. The derivation is computed by the runtime
 * (notation/runtime/ddn-capabilities.js) from the merged registry and the
 * profiles catalogue — never hand-edit `allowed_in` in the contracts.
 * Consistency gates: every contract entry resolves to a registered
 * kind/relation, every capability tag is a known projection kind or installed
 * profile id, and no entry ends with an empty list. Deterministic: same
 * registry + contracts in, same bytes out. Run:
 *   node designer/contracts/build-allowed-in.mjs [--check]
 * --check verifies freshness without writing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import DDN from '../../notation/runtime/ddn-core.js';
import Profiles from '../../notation/runtime/ddn-profiles.js';
import Capabilities from '../../notation/runtime/ddn-capabilities.js';
import baseCatalogue from '../../notation/runtime/assets/catalogue.js';

const here = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes('--check');
const registry = Profiles.registry(JSON.parse(JSON.stringify(baseCatalogue)));
const maps = Capabilities.deriveAllowedIn(registry, Profiles.catalogue);
const knownTags = new Set();
for (const p of Profiles.catalogue.profiles) { knownTags.add(p.id); knownTags.add(p.projection); }

function stamp(file, entries, keyOf, lookup) {
  const path = join(here, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const registered = new Set(lookup === 'kinds' ? registry.kinds.map(k => k.keyword) : registry.relationships.map(r => r.keyword));
  for (const e of entries(data)) {
    const kw = keyOf(e);
    if (!registered.has(kw)) throw new Error(file + ': entry not registered in the runtime registry: ' + kw);
    const allowed = maps[lookup][kw];
    if (!allowed || !allowed.length) throw new Error(file + ': empty allowed_in for ' + kw);
    for (const t of allowed) if (!knownTags.has(t)) throw new Error(file + ': unknown capability tag ' + JSON.stringify(t) + ' on ' + kw);
    e.allowed_in = allowed;
  }
  const text = JSON.stringify(data, null, 2) + '\n';
  if (check) {
    if (readFileSync(path, 'utf8') !== text) throw new Error(file + ' is stale — run node designer/contracts/build-allowed-in.mjs');
    return 0;
  }
  writeFileSync(path, text);
  return entries(data).length;
}

if (!check) {
  const a = stamp('kind-ui-map.json', d => d.kinds, e => e.kind, 'kinds');
  const b = stamp('relation-ui-map.json', d => d.relations, e => e.id, 'relations');
  console.log('build-allowed-in: stamped ' + a + ' kinds and ' + b + ' relations');
} else {
  stamp('kind-ui-map.json', d => d.kinds, e => e.kind, 'kinds');
  stamp('relation-ui-map.json', d => d.relations, e => e.id, 'relations');
  console.log('build-allowed-in: contracts are fresh');
}
