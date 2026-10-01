#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 3: automated
 * candidate fetch for the presentation art pack. For each slot (id → Commons
 * search query) picks the first CC0/Public-domain SVG under the byte budget,
 * downloads it to /tmp/art-candidates/, and writes meta.json per item for
 * human review. Rate-limited politely (Commons API etiquette).
 *
 *   node tools/fetch-art-candidates.mjs [slot ...]
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/tmp/art-candidates';
const BUDGET = 150000;
const SLOTS = {
  // computers
  'laptop': ['laptop clipart'], 'desktop-pc': ['desktop computer clipart'], 'monitor': ['computer monitor clipart'],
  'tablet': ['tablet computer clipart'], 'smartphone': ['smartphone clipart'], 'printer': ['printer clipart'],
  'keyboard': ['computer keyboard clipart'], 'mouse': ['computer mouse clipart'],
  // servers
  'server': ['server computer clipart'], 'server-rack': ['server rack', '19 inch rack svg', 'server rack diagram'], 'database': ['database cylinder clipart'],
  'storage-array': ['hard disk drive clipart', 'disk array', 'storage server clipart'], 'mainframe': ['mainframe computer', 'supercomputer clipart'], 'tape-drive': ['magnetic tape', 'tape cartridge clipart'],
  // network gear
  'router': ['router clipart', 'network router svg'], 'switch': ['network switch', 'ethernet switch clipart'], 'firewall': ['firewall clipart', 'firewall brick wall computer'],
  'wifi-ap': ['wireless access point', 'wifi router clipart'], 'antenna': ['antenna tower', 'radio tower clipart'], 'cloud': ['cloud computing clipart', 'cloud svg'],
  'satellite-dish': ['satellite dish', 'parabolic antenna clipart'], 'modem': ['modem clipart', 'dsl modem'],
  // buildings
  'office-building': ['office building', 'skyscraper building clipart'], 'factory': ['factory clipart', 'factory building'], 'house': ['house clipart'],
  'datacenter': ['data center', 'server room clipart'], 'hospital': ['hospital clipart', 'hospital building'], 'school': ['school clipart', 'school building'],
  'warehouse': ['warehouse clipart', 'warehouse building'], 'shop': ['shop clipart', 'store clipart'],
  // people
  'person': ['person silhouette', 'person icon clipart'], 'team': ['people group clipart', 'team people'], 'technician': ['technician clipart', 'worker clipart'],
  'customer': ['customer clipart', 'person shopping'], 'presenter': ['presentation clipart', 'teacher clipart'], 'operator': ['operator clipart', 'person at computer'],
  // misc presentation
  'globe': ['globe clipart', 'earth globe'], 'lock': ['padlock clipart', 'lock icon'],
  'gear': ['gear clipart', 'cog wheel'],
  'document': ['document clipart', 'paper sheet clipart'], 'folder': ['folder clipart', 'file folder'],
  'camera': ['camera clipart', 'photo camera'], 'truck': ['truck clipart', 'delivery truck'],
  'phone': ['telephone clipart', 'phone icon clipart'],
};
const LICENSE_OK = /^(CC0|Public domain)/i;
const UA = { 'user-agent': 'ddn-art-pack-curation/1.0 (Wikimedia Commons CC0/PD research)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&gsrsearch=' + encodeURIComponent(q);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429 || res.status >= 500) { await sleep(8000 * (attempt + 1)); continue; }
    const d = await res.json();
    return Object.values(d?.query?.pages || {}).map(p => {
      const ii = p.imageinfo[0], em = ii.extmetadata || {};
      return {
        title: p.title, license: em.LicenseShortName?.value || '', bytes: ii.size, url: ii.url,
        artist: (em.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
        licenseUrl: em.LicenseUrl?.value || '', attribution: (em.Attribution?.value || '').replace(/<[^>]+>/g, '').trim(),
      };
    }).filter(x => /\.svg(\?|$)/i.test(x.url) && LICENSE_OK.test(x.license) && x.bytes > 400 && x.bytes <= BUDGET)
      .sort((a, b) => a.bytes - b.bytes);
  }
  return [];
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
let done = 0, failed = [];
for (const [id, queries] of Object.entries(SLOTS)) {
  if (only.length && !only.includes(id)) continue;
  if (fs.existsSync(path.join(OUT, id + '.svg'))) { done++; continue; }
  let hit = null, usedQuery = queries[0];
  for (const q of queries) {
    const hits = await search(q);
    await sleep(6000);
    if (hits.length) { hit = hits[0]; usedQuery = q; break; }
  }
  if (!hit) { failed.push(id + ' (no hit: ' + queries.join(' / ') + ')'); continue; }
  let svg = null;
  for (let attempt = 0; attempt < 4 && svg === null; attempt++) {
    const res = await fetch(hit.url, { headers: UA });
    if (res.status === 429 || res.status >= 500) { await sleep(10000 * (attempt + 1)); continue; }
    if (!res.ok) break;
    svg = await res.text();
  }
  await sleep(6000);
  if (!svg || (!svg.trimStart().startsWith('<svg') && !svg.includes('<svg'))) { failed.push(id + ' (download failed)'); continue; }
  fs.writeFileSync(path.join(OUT, id + '.svg'), svg);
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ id, query: usedQuery, ...hit, retrieved: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  console.log('OK', id, '←', hit.title, hit.license, hit.bytes + 'b');
  done++;
}
console.log('done=' + done, 'failed=' + failed.length);
for (const f of failed) console.log('FAILED', f);
