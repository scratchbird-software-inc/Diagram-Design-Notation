/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — entry/view picking, file plausibility, fresh ids, ?src= deep links and the import closure.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
const O = typeof module === 'object' && module.exports ? require('./options.js') : host.DDNOptions;
const MAX_FILE_BYTES = O.MAX_FILE_BYTES;

/* B1-050 (D1): pick the entry file and view for setSource. opts.entry /
 * opts.view win; otherwise the first file (sorted) declaring a view, and its
 * first view. Coded DDN-T1xx errors; parseFn is injected (A.parse) so the
 * helper stays node-testable. */
function pickEntryView(files, opts, parseFn) {
  const toolError = (code, msg) => { const e = new Error(msg); e.code = code; return e; };
  opts = opts || {};
  if (typeof parseFn !== 'function') throw toolError('DDN-T100', 'parse function required');
  const names = Object.keys(files || {}).sort();
  if (!names.length) throw toolError('DDN-T101', 'setSource needs at least one source file');
  const viewsOf = name => parseFn(files[name], name).declarations.filter(n => n.type === 'view');
  if (opts.entry != null) {
    if (!Object.prototype.hasOwnProperty.call(files, opts.entry))
      throw toolError('DDN-T102', 'setSource: opts.entry "' + opts.entry + '" is not in the source map (' + names.join(', ') + ')');
    const views = viewsOf(opts.entry);
    if (!views.length) throw toolError('DDN-T103', 'setSource: entry "' + opts.entry + '" declares no view');
    if (opts.view != null && !views.some(v => v.id === opts.view))
      throw toolError('DDN-T104', 'setSource: entry "' + opts.entry + '" has no view "' + opts.view + '" (has: ' + views.map(v => v.id).join(', ') + ')');
    return { entry: opts.entry, view: opts.view != null ? opts.view : views[0].id };
  }
  if (opts.view != null) {
    for (const name of names) if (viewsOf(name).some(v => v.id === opts.view)) return { entry: name, view: opts.view };
    throw toolError('DDN-T104', 'setSource: no file declares a view "' + opts.view + '"');
  }
  for (const name of names) {
    const views = viewsOf(name);
    if (views.length) return { entry: name, view: views[0].id };
  }
  throw toolError('DDN-T105', 'setSource: no view declaration found in the source');
}

/* Flatten ws.entries() into a picker list [{entry, view, label}]. */
function viewListFrom(entries) {
  if (!Array.isArray(entries)) throw new Error('entries array required');
  const out = [];
  for (const e of entries) for (const v of (e && e.views) || []) out.push({ entry: e.file, view: v.id, label: e.file + ' · ' + (v.name || v.id) });
  return out;
}

function isPlausibleSourceFile(f) {
  if (!f || typeof f.name !== 'string') return false;
  return /\.ddn($|\.)/i.test(f.name) || /\.(zip|json)$/i.test(f.name) || (typeof f.type === 'string' && f.type.startsWith('text/'));
}

/* B1-051 (D2): pick a fresh local identifier for a design-mode creation.
 * `taken` is any iterable of existing local ids (or uids — the tail after the
 * last '.' is compared too); the kind keyword is slugged into the base. */
function freshLocalId(taken, base) {
  const b = String(base || 'element').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'element';
  const used = new Set();
  for (const id of taken || []) { used.add(String(id)); used.add(String(id).split('.').pop()); }
  let candidate = 'new_' + b, n = 1;
  while (used.has(candidate)) candidate = 'new_' + b + '_' + (++n);
  return candidate;
}

/* `?src=<relative .ddn path>` deep link (B1-023 D1, reused per B1-027 D5).
 * Strictly relative: any scheme, scheme-relative host, or absolute path is
 * rejected — the tool only ever fetches siblings of its own page. */
function srcFromQuery(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const src = params.get('src');
  if (src == null) return null;
  const v = src.trim();
  if (!v) throw new Error('?src= is empty — give a relative path to a .ddn file');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) throw new Error('?src= must be a relative path, not a URL with a scheme: ' + v);
  if (v.startsWith('//') || v.startsWith('/')) throw new Error('?src= must be a relative path (no host, no absolute path): ' + v);
  if (!/\.ddn$/i.test(v.split(/[?#]/)[0])) throw new Error('?src= must point at a .ddn source: ' + v);
  return v;
}

function srcFetchErrorMessage(err, protocol, src) {
  if (protocol === 'file:')
    return 'cannot fetch ' + src + ' — browsers block file:// page fetches. Serve the site over HTTP (npm run serve) or use Open / paste instead.';
  return err && err.message || 'fetch failed';
}

/* B1-026 import closure, reused for both ?src= deep links and ?entry= paths
 * that are not in the bundled catalogue (D5). Cycle-safe; every fetched text
 * is size-capped; failures name the missing file. */
function srcImportClosure(src, pageHref, fetchFn, parseImports, resolvePath) {
  const files = Object.create(null);
  const entryName = src.split('/').pop().split(/[?#]/)[0];
  const pull = (url, name) => fetchFn(url).then(r => {
    if (!r.ok) throw new Error(name + ' — HTTP ' + r.status + ' (' + url + ')');
    return r.text();
  }).then(text => {
    if (text.length > MAX_FILE_BYTES)
      throw new Error(name + ' is ' + Math.round(text.length / 1e6) + ' MB — the tool accepts sources up to ' + (MAX_FILE_BYTES / 1e6) + ' MB');
    if (Object.prototype.hasOwnProperty.call(files, name)) return null;
    files[name] = text;
    return Promise.all(parseImports(text, name).map(p =>
      pull(new URL(p, url), resolvePath(name, p))));
  });
  return pull(new URL(src, pageHref), entryName).then(() => ({ files, entryName }));
}

const api = { pickEntryView, viewListFrom, isPlausibleSourceFile, freshLocalId, srcFromQuery, srcFetchErrorMessage, srcImportClosure };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolFiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
