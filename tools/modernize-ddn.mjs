#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-099: conservative 0.7-dialect
 * codemod for .ddn sources. Rewrites ONLY the desugar pairs the 0.7 grammar
 * (standard/grammar/ddn.ebnf, B1-037..041) defines as identical canonical
 * ASTs, so a semantic-equivalence gate can prove every rewrite:
 *
 *   T1  object id "L" { kind: word; … }      → word id "L" { … }          (typedDeclaration)
 *   T2  relation id "L" @a -> @b { kind: v; source_mark: m; target_mark: n; … }
 *                                            → v id "L" @a [m] -> @b [n] { … }  (compactRelation)
 *   T3  fields { field id …; } / ports { port id …; } → bare contextual members
 *   T4  view v "L" { data: [@d]; projection { kind: graph; profile: "p@1"; } }
 *                                            → view v "L": @d as "p@1";   (compact view header)
 *
 * (T5 records-block conversion is deliberately NOT automated — the value
 * serialization risk is higher than the win; uniform record blocks are listed
 * for manual review in the B1-099 report.)
 *
 * Comments and string literals are masked before scanning, so rewrites never
 * touch prose. Every rewrite is a candidate only — the per-file equivalence
 * gate (tools/check-example-equivalence.mjs) decides whether the file ships.
 *
 *   node tools/modernize-ddn.mjs FILE…          rewrite in place (prints stats)
 *   node tools/modernize-ddn.mjs --dry FILE…    report candidates without writing
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const DDN = require(path.join(REPO, 'notation/runtime/ddn-core.js')).default;
const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'standard/registry/catalogue.json'), 'utf8'));
const KIND_WORDS = DDN.typedKindWords(reg);       // word -> kind keyword
const VERB_WORDS = DDN.relationKindWords(reg);    // word -> relation keyword
const ID = '[A-Za-z_][A-Za-z0-9_-]*';

/* Mask comments and string literals with spaces (newlines preserved), so
 * structural scanning never sees prose. The ORIGINAL text feeds rewrites. */
function mask(src) {
  let out = '', i = 0;
  while (i < src.length) {
    if (src.startsWith('//', i)) { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; out += ' '.repeat(end - i); i = end; }
    else if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      out += '"' + ' '.repeat(j - i - 1) + '"'; i = j + 1;
    }
    else { out += src[i]; i++; }
  }
  return out;
}

/* Brace-matching span finder over the MASKED text: returns [openIdx, closeIdx] pairs. */
function spans(masked, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}') { depth--; if (!depth) return [openIdx, i]; }
  }
  return [openIdx, -1];
}

/* Apply a list of {start, end, text} edits (masked-text coordinates) back to front. */
function applyEdits(src, edits) {
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);
  return src;
}

function modernize(src) {
  const masked = mask(src);
  const edits = [];
  const stats = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, skipped: [] };

  // ---- T2 relations first (relation blocks also contain `kind:`) ----------
  {
    const re = new RegExp(`\\brelation\\s+(${ID})((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)\\s+(@${ID}(?:\\.${ID})*)\\s*->\\s*(@${ID}(?:\\.${ID})*)\\s*\\{`, 'g');
    let m;
    while ((m = re.exec(masked))) {
      const [open, close] = spans(masked, re.lastIndex - 1);
      if (close < 0) continue;
      const body = masked.slice(open + 1, close);
      const bodySrc = src.slice(open + 1, close);
      const kindAt = body.match(/kind\s*:\s*/);
      if (!kindAt) continue;
      const kindM = bodySrc.slice(kindAt.index).match(new RegExp(`^kind\\s*:\\s*(?:"(${ID})"|(${ID}))\\s*;`));
      if (!kindM) continue;
      const verbWord = kindM[1] || kindM[2];
      // alias words canonicalize in the desugar (kind value would change) — only
      // canonical keywords are identity-preserving
      if (VERB_WORDS.get(verbWord) !== verbWord) continue;
      const verb = verbWord;
      const smM = body.match(new RegExp(`\\bsource_mark\\s*:\\s*(${ID})\\s*;`));
      const tmM = body.match(new RegExp(`\\btarget_mark\\s*:\\s*(${ID})\\s*;`));
      let rest = body;
      for (const mm of [kindAt, smM, tmM]) if (mm) rest = rest.replace(body.slice(mm.index, mm.index + (mm === kindAt ? kindM[0].length : mm[0].length)), '');
      if (/[{}]/.test(rest)) continue; // nested declarations — leave verbose
      const label = (src.slice(m.index).match(new RegExp(`^relation\\s+${ID}((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)`)) || [])[1] || '';
      const indent = (src.slice(0, m.index).match(/([ \t]*)$/) || [])[1];
      const restClean = rest.replace(/^\s+/, '').replace(/\s+$/, '');
      const head = `${verb} ${m[1]}${label} ${m[3]}${smM ? ` [${smM[1]}]` : ''} -> ${m[4]}${tmM ? ` [${tmM[1]}]` : ''}`;
      const replacement = restClean
        ? `${head} {\n${indent}    ${restClean.replace(/\n/g, '$&' + indent + '    ')}\n${indent}}`
        : `${head};`;
      edits.push({ start: m.index, end: close + 1, text: replacement });
      stats.T2++;
      re.lastIndex = m.index + 1;
    }
  }

  // ---- T1 typed object declarations ---------------------------------------
  {
    const re = new RegExp(`\\bobject\\s+(${ID})((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)\\s*\\{`, 'g');
    let m;
    while ((m = re.exec(masked))) {
      const [open, close] = spans(masked, re.lastIndex - 1);
      if (close < 0) continue;
      const body = masked.slice(open + 1, close);
      const kindAt = body.match(/kind\s*:\s*/);
      if (!kindAt) continue;
      const kindM = src.slice(open + 1 + kindAt.index).match(new RegExp(`^kind\\s*:\\s*(?:"(${ID})"|(${ID}))\\s*;`));
      if (!kindM) continue;
      const word = kindM[1] || kindM[2];
      // alias words canonicalize in the desugar — canonical keywords only
      if (KIND_WORDS.get(word) !== word) continue;
      // kind: must be a direct property of this body (top brace level)
      const upto = body.slice(0, kindAt.index);
      if ((upto.match(/\{/g) || []).length !== (upto.match(/\}/g) || []).length) continue;
      // remove the kind statement, its line indent, and any trailing newline it owns
      const lineStart = body.slice(0, kindAt.index).match(/[ \t]*$/)[0];
      const tail = body.slice(kindAt.index + kindM[0].length).match(/^[ \t]*(\n|)/);
      const rmStart = open + 1 + kindAt.index - lineStart.length;
      const rmEnd = open + 1 + kindAt.index + kindM[0].length + (tail ? tail[0].length : 0);
      // if the body becomes whitespace-only, collapse to the bodyless form
      const remaining = (body.slice(0, kindAt.index - lineStart.length) + body.slice(rmEnd - (open + 1))).trim();
      if (!remaining) {
        edits.push({ start: m.index, end: close + 1, text: `${word} ${m[1]}${(src.slice(m.index).match(new RegExp(`^object\\s+${ID}((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)`)) || [])[1] || ''};` });
      } else {
        edits.push({ start: rmStart, end: rmEnd, text: tail && tail[1] ? '' : '' });
        edits.push({ start: m.index, end: m.index + 6, text: word });
      }
      stats.T1++;
      re.lastIndex = close;
    }
  }

  // ---- T3 contextual field/port members -----------------------------------
  {
    const re = /\b(fields|ports)\s*\{/g;
    let m;
    while ((m = re.exec(masked))) {
      const [open, close] = spans(masked, re.lastIndex - 1);
      if (close < 0) continue;
      const inner = masked.slice(open + 1, close);
      // only strip at depth 1 of the group
      let depth = 0;
      for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (depth === 0 && (inner[i] === 'f' && m[1] === 'fields' || inner[i] === 'p' && m[1] === 'ports')) {
          const kw = m[1] === 'fields' ? 'field' : 'port';
          if (inner.startsWith(kw + ' ', i) || inner.startsWith(kw + '\t', i)) {
            const before = i === 0 || /[\s;{}]/.test(inner[i - 1]);
            const afterM = inner.slice(i + kw.length).match(new RegExp(`^\\s+(${ID})`));
            if (before && afterM) { edits.push({ start: open + 1 + i, end: open + 1 + i + kw.length + 1, text: '' }); stats.T3++; i += kw.length; }
          }
        }
      }
      re.lastIndex = close;
    }
  }

  // ---- T4 compact view headers ---------------------------------------------
  {
    const re = new RegExp(`\\bview\\s+(${ID})((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)\\s*\\{`, 'g');
    let m;
    while ((m = re.exec(masked))) {
      const [open, close] = spans(masked, re.lastIndex - 1);
      if (close < 0) continue;
      const body = masked.slice(open + 1, close);
      const dataM = body.match(new RegExp(`^([ \\t]*)data\\s*:\\s*(@${ID}(?:\\.${ID})*|\\[[^\\]]*\\])\\s*;[ \\t]*(\\n|$)`, 'm'));
      const projM = body.match(/\bprojection\s*\{/);
      if (!dataM || !projM) continue;
      const pOpen = open + 1 + projM.index + projM[0].length - 1;
      const [, pClose] = spans(masked, pOpen);
      if (pClose < 0) continue;
      const projBody = masked.slice(pOpen + 1, pClose);
      const profM = projBody.match(new RegExp(`^\\s*(?:kind\\s*:\\s*${ID}\\s*;\\s*)?profile\\s*:\\s*"\\s*"\\s*;\\s*$`))
        || projBody.match(new RegExp(`^\\s*profile\\s*:\\s*"\\s*"\\s*;\\s*(?:kind\\s*:\\s*${ID}\\s*;\\s*)?$`));
      if (!profM) continue;
      const slice = src.slice(pOpen + 1, pClose);
      const profSrcM = slice.match(/profile\s*:\s*"([^"]*)"/);
      if (!profSrcM) { if (process.env.B1099_DEBUG) console.error('T4 skip: profile string not found in', JSON.stringify(slice.slice(0, 120))); continue; }
      const profStr = profSrcM[1];
      const dataStr = dataM[2];
      const projIndent = body.slice(0, projM.index).match(/[ \t]*$/)[0];
      const projTail = masked.slice(pClose + 1).match(/^[ \t]*;?[ \t]*(\n|)/)[0];
      edits.push({ start: open + 1 + projM.index - projIndent.length, end: pClose + 1 + projTail.length, text: '' });
      edits.push({ start: open + 1 + dataM.index, end: open + 1 + dataM.index + dataM[0].length, text: '' });
      const label = (src.slice(m.index).match(new RegExp(`^view\\s+${ID}((?:\\s+"(?:[^"\\\\]|\\\\.)*")?)`)) || [])[1] || '';
      edits.push({ start: m.index, end: open, text: `view ${m[1]}${label}: ${dataStr} as "${profStr}" ` });
      stats.T4++;
      re.lastIndex = m.index + 1;
    }
  }

  return { text: applyEdits(src, edits), stats };
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
for (const f of args.filter(a => !a.startsWith('--'))) {
  const abs = path.resolve(f);
  const src = fs.readFileSync(abs, 'utf8');
  const { text, stats } = modernize(src);
  const n = stats.T1 + stats.T2 + stats.T3 + stats.T4 + stats.T5;
  if (n && !dry) fs.writeFileSync(abs, text);
  console.log(`${path.relative(REPO, abs)}: T1=${stats.T1} T2=${stats.T2} T3=${stats.T3} T4=${stats.T4} T5=${stats.T5}${dry ? ' (dry)' : ''}`);
}
