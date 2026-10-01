#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 3: one-off curation
 * helper for the presentation art pack. Searches Wikimedia Commons for
 * CC0/Public-domain vector clipart per topic, fetches candidates, and prints
 * a review table (title, license, bytes, url). Nothing is written into the
 * repo by this script; reviewed items go into
 * standard/registry/art-packs/presentation-devices.sources.json by hand and
 * tools/fetch-art-pack.mjs materializes the pack from that manifest.
 *
 *   node tools/curate-art.mjs [topic ...]
 */
const TOPICS = {
  computers: ['laptop computer clipart openclipart', 'desktop computer monitor clipart openclipart', 'tablet computer clipart', 'smartphone clipart openclipart', 'printer clipart openclipart', 'computer keyboard clipart'],
  servers: ['server computer clipart openclipart', 'server rack clipart openclipart', 'database cylinder clipart', 'hard disk storage clipart openclipart', 'mainframe computer clipart'],
  network: ['router network clipart openclipart', 'network switch clipart openclipart', 'firewall clipart openclipart', 'wireless antenna wifi clipart', 'cloud computing clipart openclipart', 'satellite dish clipart'],
  buildings: ['office building clipart openclipart', 'factory building clipart openclipart', 'house clipart openclipart', 'datacenter building clipart', 'hospital building clipart', 'school building clipart'],
  people: ['person user clipart openclipart', 'people team clipart openclipart', 'technician worker clipart', 'customer person clipart', 'presentation speaker clipart'],
};
const LICENSE_OK = /^(CC0|Public domain|CC0 1\.0|CC0 1.0 Universal)/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&gsrsearch=' + encodeURIComponent(q);
  const d = await (await fetch(url, { headers: { 'user-agent': 'ddn-art-curation/1.0 (research; contact: repo maintainer)' } })).json();
  return Object.values(d?.query?.pages || {}).map(p => {
    const ii = p.imageinfo[0], em = ii.extmetadata || {};
    return { title: p.title, license: em.LicenseShortName?.value || '', bytes: ii.size, url: ii.url, artist: (em.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 60) };
  }).filter(x => x.url.endsWith('.svg') && LICENSE_OK.test(x.license) && x.bytes < 65000);
}

const only = process.argv.slice(2);
for (const [topic, queries] of Object.entries(TOPICS)) {
  if (only.length && !only.includes(topic)) continue;
  console.log('\n== ' + topic);
  for (const q of queries) {
    const hits = await search(q);
    console.log('  -- ' + q);
    for (const h of hits.slice(0, 4)) console.log('     ' + h.license + ' | ' + h.bytes + 'b | ' + h.title + ' | ' + h.url);
    await sleep(400);
  }
}
