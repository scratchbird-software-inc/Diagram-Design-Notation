/* SPDX-License-Identifier: GPL-2.0-or-later. B1-027 (D6): legacy tool URL mapper.
 * The three retired pages — /tools/viewer/index.html, /tools/studio/index.html,
 * /tools/studio/editor.html — are replaced by redirect stubs that forward to
 * the unified tool (/tools/index.html) preserving the parameters each old
 * page understood: src (viewer deep link), entry/view (gallery + editor boot),
 * plus mode/drawers when present. Malformed values are dropped, never fatal.
 *
 * ?src= values are paths relative to the OLD page, which sat one directory
 * deeper than the tool: when given the stub's own URL and the tool URL, the
 * mapper re-relativizes same-origin paths so old bookmarks keep working.
 * UMD: inlined into the stubs by website/build-site.mjs and required by tests. */
(function (host) {
'use strict';
/* Path of `target` relative to the directory of `from` (same-origin absolute
 * URLs), or null when the origins differ. */
function relativize(from, target) {
  if (from.origin !== target.origin || from.origin === 'null') return null;
  const a = from.pathname.split('/').slice(1, -1), b = target.pathname.split('/').slice(1);
  while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
  return a.map(() => '..').concat(b).join('/');
}
function mapLegacyParams(search, stubHref, toolHref) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const out = new URLSearchParams();
  let src = params.get('src');
  if (src) {
    src = src.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src) && !src.startsWith('/') && /\.ddn($|[?#])/i.test(src)) {
      if (stubHref && toolHref) {
        try {
          const rel = relativize(new URL(toolHref, stubHref), new URL(src, stubHref));
          if (rel) src = rel;
        } catch { /* keep verbatim */ }
      }
      out.set('src', src);
    }
  }
  const entry = params.get('entry');
  if (entry && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(entry.trim())) out.set('entry', entry.trim());
  const view = params.get('view');
  if (view) out.set('view', view.trim());
  const mode = params.get('mode');
  if (['diagram', 'view', 'explore', 'edit'].includes(mode)) out.set('mode', mode);
  const drawers = params.get('drawers');
  if (drawers && /^[A-Za-z]+:(open|closed|none)(,[A-Za-z]+:(open|closed|none))*$/.test(drawers)) out.set('drawers', drawers);
  const q = out.toString();
  return q ? '?' + q : '';
}
const api = { mapLegacyParams, relativize };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNRedirect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
