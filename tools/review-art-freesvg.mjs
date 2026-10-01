#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. List freesvg CC0 candidates for
 * manual art-pack slot review: prints per slot the first N candidates with
 * title/author/download-id/bytes. Pair with fetch-art-pick.mjs to download
 * the chosen ids.
 *
 *   node tools/review-art-freesvg.mjs slot=query [slot=query ...]
 */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) ddn-art-pack-curation/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let cookie = '';
async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, cookie } });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map(c => c.split(';')[0]).join('; ');
  return res;
}
function itemLinks(html) {
  return [...new Set([...html.matchAll(/href="(https:\/\/freesvg\.org\/[a-z0-9-]+)"/g)].map(m => m[1]))]
    .filter(u => !/(search|about|contact|privacy|terms|dmca|login|register|blog|category)/.test(u));
}
for (const arg of process.argv.slice(2)) {
  const [slot, ...qw] = arg.split('='), q = qw.join('=');
  console.log('\n== ' + slot + ' (' + q + ')');
  const search = await (await get('https://freesvg.org/search?q=' + encodeURIComponent(q))).text();
  await sleep(1200);
  let shown = 0;
  for (const link of itemLinks(search)) {
    if (shown >= 8) break;
    const page = await (await get(link)).text();
    await sleep(1200);
    if (!/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(page)) continue;
    const dl = (page.match(/href="\/download\/(\d+)"/) || [])[1];
    if (!dl) continue;
    const author = ((page.match(/author" content="([^"]+)"/) || [])[1] || '?').trim();
    const title = ((page.match(/<h1[^>]*>([^<]+)/) || [])[1] || '?').trim();
    console.log('   dl=' + dl + ' | ' + title + ' | ' + author + ' | ' + link);
    shown++;
  }
}
