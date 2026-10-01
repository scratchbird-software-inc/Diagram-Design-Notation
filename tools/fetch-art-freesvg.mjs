#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 3: freesvg.org
 * candidate fetch for the art pack (fills slots the Wikimedia Commons pass
 * missed). Per item: search → item page → verify the page's CC0 license
 * meta tag and author → session GET of the SVG → candidate + meta written
 * to /tmp/art-candidates/ (skips slots already fetched).
 *
 *   node tools/fetch-art-freesvg.mjs [slot ...]
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/tmp/art-candidates';
const SLOTS = {
  'server-rack': 'server rack', 'storage-array': 'hard disk', 'tape-drive': 'tape cassette',
  'switch': 'network switch', 'firewall': 'firewall', 'wifi-ap': 'wifi router', 'antenna': 'antenna tower',
  'cloud': 'cloud computing', 'satellite-dish': 'satellite dish', 'modem': 'modem',
  'office-building': 'office building', 'factory': 'factory', 'house': 'house', 'datacenter': 'server room',
  'hospital': 'hospital building', 'school': 'school building', 'warehouse': 'warehouse', 'shop': 'shop',
  'person': 'person', 'team': 'people team', 'technician': 'technician', 'customer': 'customer',
  'presenter': 'presentation', 'operator': 'computer operator',
  'globe': 'globe', 'lock': 'padlock', 'gear': 'gear', 'document': 'document', 'folder': 'folder',
  'camera': 'camera', 'truck': 'truck', 'phone': 'telephone',
  'router': 'router', 'mainframe': 'mainframe',
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) ddn-art-pack-curation/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let cookie = '';
async function get(url, referer) {
  const res = await fetch(url, { headers: { 'user-agent': UA, cookie, ...(referer ? { referer } : {}) }, redirect: 'follow' });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map(c => c.split(';')[0]).join('; ');
  return res;
}
function itemLinks(html) {
  return [...new Set([...html.matchAll(/href="(https:\/\/freesvg\.org\/[a-z0-9-]+)"/g)].map(m => m[1]))]
    .filter(u => !/(search|about|contact|privacy|terms|dmca|login|register|blog|category)/.test(u));
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
let done = 0; const failed = [];
for (const [id, q] of Object.entries(SLOTS)) {
  if (only.length && !only.includes(id)) continue;
  if (fs.existsSync(path.join(OUT, id + '.svg'))) { done++; continue; }
  try {
    const search = await (await get('https://freesvg.org/search?q=' + encodeURIComponent(q))).text();
    await sleep(1500);
    const links = itemLinks(search);
    let picked = null;
    for (const link of links.slice(0, 6)) {
      const page = await (await get(link)).text();
      await sleep(1500);
      if (!/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(page)) continue;
      const dl = (page.match(/href="\/download\/(\d+)"/) || [])[1];
      if (!dl) continue;
      const author = (page.match(/author" content="([^"]+)"/) || [])[1] || 'freesvg contributor';
      const title = (page.match(/<h1[^>]*>([^<]+)/) || [])[1] || id;
      picked = { link, dl, author: author.trim(), title: title.trim() };
      break;
    }
    if (!picked) { failed.push(id + ' (no CC0 candidate: ' + q + ')'); continue; }
    const res = await get('https://freesvg.org/download/' + picked.dl, picked.link);
    await sleep(1500);
    const svg = await res.text();
    if (!svg.includes('<svg')) { failed.push(id + ' (download not svg)'); continue; }
    if (svg.length > 150000) { failed.push(id + ' (too big ' + svg.length + ')'); continue; }
    fs.writeFileSync(path.join(OUT, id + '.svg'), svg);
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({
      id, query: q, title: 'File:' + picked.title + '.svg', license: 'CC0', bytes: svg.length,
      url: picked.link, artist: picked.author, licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      retrieved: new Date().toISOString().slice(0, 10),
    }, null, 2) + '\n');
    console.log('OK', id, '←', picked.title, '|', picked.author, '|', svg.length + 'b');
    done++;
  } catch (e) { failed.push(id + ' (' + e.message + ')'); }
}
console.log('done=' + done, 'failed=' + failed.length);
for (const f of failed) console.log('FAILED', f);
