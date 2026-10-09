/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDNA Phase C (ddna ch.13 §13.5): the open-tool KEEL host — the nine Z.120
 * §5.3 seam functions verbatim (Wf1–4, Tc1–3, EqVar, Tc4, Vars, Replace,
 * NewVar, Eval), tiers T0–T2 (OT-050), and the minimal conformant host
 * language keel-l0@1 (OT-051): decimal numbers, strings, booleans, null;
 * lists and records; field/index access; integer-safe arithmetic;
 * comparison and boolean operators; if-then-else; no recursion, no loops,
 * no effects, no time access. keel-l0@1 is a HOST language, not a DDNA
 * dialect — companions reference it by tag. The PoC's scratch subset
 * ('poc-expr') is accepted as L0-compatible (its fixtures predate the tag).
 * Anything above the open ceiling degrades to DDN-A005 (OT-052) — the
 * caller skips the feature; the workspace still loads.
 *
 * Tool-layer only; nothing here enters the DDN runtime (OT-003).
 */
(function (host) {
'use strict';

const ID = 'ddna-keel-l0', VERSION = '1.0.1';
const L0_TAGS = ['keel-l0@1', 'poc-expr'];
/* Tier model (ch.5 §5.2): T0 opaque reference, T1 static analysis, T2 pure
 * evaluation. The open host ceiling is T2. */
function tierOf(language) {
  const t = String(language || '').trim();
  if (L0_TAGS.includes(t)) return 2;
  return Infinity; /* unknown/higher-tier language: above the open ceiling */
}
function tierAvailable(language) { return tierOf(language) <= 2; }

const ok = v => ({ ok: true, value: v });
const bad = m => ({ ok: false, error: m });

/* ---------------------------------------------------------------- parser
 * keel-l0@1 recursive descent. Tokens: numbers, strings, booleans, null,
 * identifiers, [ ] { } ( ) . , operators, if/then/else. */
const RE_TOK = /"(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|==|!=|&&|\|\||[+\-*/()[\]{},.<>:]/g;
function tokenize(text) {
  const toks = String(text).match(RE_TOK) || [];
  /* Reject anything the tokenizer skipped (no silent partial parses). */
  if (toks.join('').replace(/\s+/g, '') !== String(text).replace(/\s+/g, '')) throw new Error('keel-l0@1: untokenizable input near ' + JSON.stringify(String(text).slice(0, 40)));
  return toks;
}
function parseExpr(text) {
  const toks = tokenize(text);
  let pos = 0;
  const peek = () => toks[pos], take = () => toks[pos++];
  const expect = t => { if (take() !== t) throw new Error('keel-l0@1: expected ' + t); };
  function expr() { return orExpr(); }
  function orExpr() { let l = andExpr(); while (peek() === 'or' || peek() === '||') { take(); l = { kind: 'bin', op: 'or', l, r: andExpr() }; } return l; }
  function andExpr() { let l = cmpExpr(); while (peek() === 'and' || peek() === '&&') { take(); l = { kind: 'bin', op: 'and', l, r: cmpExpr() }; } return l; }
  function cmpExpr() {
    let l = addExpr();
    while (['==', '!=', '<', '>', '<=', '>='].includes(peek())) { const op = take(); l = { kind: 'bin', op, l, r: addExpr() }; }
    return l;
  }
  function addExpr() { let l = mulExpr(); while (peek() === '+' || peek() === '-') { const op = take(); l = { kind: 'bin', op, l, r: mulExpr() }; } return l; }
  function mulExpr() { let l = unary(); while (peek() === '*' || peek() === '/') { const op = take(); l = { kind: 'bin', op, l, r: unary() }; } return l; }
  function unary() {
    if (peek() === 'not') { take(); return { kind: 'not', l: unary() }; }
    if (peek() === '-') { take(); return { kind: 'neg', l: unary() }; }
    return postfix();
  }
  function postfix() {
    let n = primary();
    for (;;) {
      if (peek() === '.') { take(); const f = take(); if (!/^[A-Za-z_]/.test(f || '')) throw new Error('keel-l0@1: field name after .'); n = { kind: 'get', l: n, f }; }
      else if (peek() === '[') { take(); const i = expr(); expect(']'); n = { kind: 'idx', l: n, i }; }
      else break;
    }
    return n;
  }
  function primary() {
    const t = peek();
    if (t === 'if') { take(); const c = expr(); if (take() !== 'then') throw new Error('keel-l0@1: if needs then'); const a = expr(); if (take() !== 'else') throw new Error('keel-l0@1: if-then needs else'); const b = expr(); return { kind: 'if', c, a, b }; }
    if (t === '(') { take(); const n = expr(); expect(')'); return n; }
    if (t === '[') { take(); const items = []; if (peek() !== ']') { do { items.push(expr()); } while (peek() === ',' && take()); } expect(']'); return { kind: 'list', items }; }
    if (t === '{') {
      take(); const entries = [];
      if (peek() !== '}') do {
        let k = take();
        if (k.startsWith('"')) k = JSON.parse(k);
        expect(':'); entries.push([k, expr()]);
      } while (peek() === ',' && take());
      expect('}');
      return { kind: 'record', entries };
    }
    if (/^-?\d/.test(t || '')) { take(); return { kind: 'num', value: Number(t) }; }
    if (t && t.startsWith('"')) { take(); return { kind: 'str', value: JSON.parse(t) }; }
    if (t === 'true' || t === 'false') { take(); return { kind: 'bool', value: t === 'true' }; }
    if (t === 'null') { take(); return { kind: 'null' }; }
    if (/^[A-Za-z_]/.test(t || '')) { take(); return { kind: 'var', name: t }; }
    throw new Error('keel-l0@1: unexpected token ' + JSON.stringify(t));
  }
  const out = expr();
  if (pos < toks.length) throw new Error('keel-l0@1: trailing input ' + JSON.stringify(toks.slice(pos).join(' ')));
  return out;
}
function printExpr(n) {
  if (!n) return '';
  switch (n.kind) {
    case 'num': return String(n.value);
    case 'str': return JSON.stringify(n.value);
    case 'bool': return String(n.value);
    case 'null': return 'null';
    case 'var': return n.name;
    case 'not': return 'not ' + printExpr(n.l);
    case 'neg': return '-' + printExpr(n.l);
    case 'get': return printExpr(n.l) + '.' + n.f;
    case 'idx': return printExpr(n.l) + '[' + printExpr(n.i) + ']';
    case 'list': return '[' + n.items.map(printExpr).join(', ') + ']';
    case 'record': return '{' + n.entries.map(([k, v]) => k + ': ' + printExpr(v)).join(', ') + '}';
    case 'if': return 'if ' + printExpr(n.c) + ' then ' + printExpr(n.a) + ' else ' + printExpr(n.b);
    case 'bin': return '(' + printExpr(n.l) + ' ' + n.op + ' ' + printExpr(n.r) + ')';
  }
  return '?';
}
function evalNode(n, st) {
  switch (n.kind) {
    case 'num': case 'str': case 'bool': return n.value;
    case 'null': return null;
    case 'var': return st[n.name];
    case 'list': return n.items.map(i => evalNode(i, st));
    case 'record': return Object.fromEntries(n.entries.map(([k, v]) => [k, evalNode(v, st)]));
    case 'get': { const v = evalNode(n.l, st); return v && typeof v === 'object' ? v[n.f] : undefined; }
    case 'idx': { const v = evalNode(n.l, st), i = evalNode(n.i, st); return Array.isArray(v) && Number.isInteger(i) ? v[i] : undefined; }
    case 'not': { const v = evalNode(n.l, st); return typeof v === 'boolean' ? !v : undefined; }
    case 'neg': { const v = evalNode(n.l, st); return typeof v === 'number' ? -v : undefined; }
    case 'if': { const c = evalNode(n.c, st); return typeof c === 'boolean' ? evalNode(c ? n.a : n.b, st) : undefined; }
    case 'bin': {
      const a = evalNode(n.l, st), b = evalNode(n.r, st);
      switch (n.op) {
        case '+': return typeof a === 'number' && typeof b === 'number' ? a + b : typeof a === 'string' && typeof b === 'string' ? a + b : undefined;
        case '-': return typeof a === 'number' && typeof b === 'number' ? a - b : undefined;
        case '*': return typeof a === 'number' && typeof b === 'number' ? a * b : undefined;
        case '/': { if (typeof a !== 'number' || typeof b !== 'number') return undefined; const q = a / b; return Number.isFinite(q) ? q : undefined; } /* integer-safe: 1/0 is undefined, not Infinity */
        case '==': return a === b;
        case '!=': return a !== b;
        case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        case 'and': return typeof a === 'boolean' && typeof b === 'boolean' ? a && b : undefined;
        case 'or': return typeof a === 'boolean' && typeof b === 'boolean' ? a || b : undefined;
      }
    }
  }
  return undefined;
}

/* --- Parse: Wf1–Wf4 ------------------------------------------------------ */
const Wf1 = s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s).trim()) ? ok(true) : bad('Wf1: not a variable string: ' + s);
const Wf2 = s => String(s).includes('=') ? ok(true) : bad('Wf2: not a data definition: ' + s);
const Wf3 = s => ['number', 'string', 'boolean', 'null', 'any', 'list', 'record'].includes(String(s).trim()) ? ok(true) : bad('Wf3: unknown type ref: ' + s);
const Wf4 = s => { try { return ok(parseExpr(String(s))); } catch (e) { return bad('Wf4: ' + (e && e.message)); } };

/* --- TypeCheck: Tc1–Tc3 --------------------------------------------------- */
const Tc1 = ast => ast && ast.kind ? ok(ast.kind) : bad('Tc1: not a parsed keel-l0@1 expression');
const Tc2 = () => ok(true);
const Tc3 = () => ok(true);

/* --- NameEq / Conformance ------------------------------------------------- */
const EqVar = (a, b) => String(a) === String(b);
const Tc4 = (value, typeRef) => {
  if (typeRef === 'any') return true;
  if (typeRef === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeRef === 'string') return typeof value === 'string';
  if (typeRef === 'boolean') return typeof value === 'boolean';
  if (typeRef === 'null') return value === null;
  if (typeRef === 'list') return Array.isArray(value);
  if (typeRef === 'record') return !!value && typeof value === 'object' && !Array.isArray(value);
  return false;
};

/* --- FreeVars with occurrence counts / Replace / NewVar -------------------- */
function Vars(astOrText) {
  const counts = Object.create(null);
  const walk = n => {
    if (!n) return;
    if (n.kind === 'var') counts[n.name] = (counts[n.name] || 0) + 1;
    for (const k of ['l', 'r', 'c', 'a', 'b', 'i']) if (n[k]) walk(n[k]);
    (n.items || []).forEach(walk);
    (n.entries || []).forEach(([, v]) => walk(v));
  };
  walk(typeof astOrText === 'string' ? parseExpr(astOrText) : astOrText);
  return counts;
}
function Replace(astOrText, name, n, value) {
  let seen = 0;
  return String(typeof astOrText === 'string' ? astOrText : printExpr(astOrText))
    .replace(new RegExp('\\b' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), m => (++seen === n ? String(value) : m));
}
let freshCounter = 0;
const NewVar = (base) => String(base || 'v') + '_' + (++freshCounter);

/* --- Eval (partial, Z.120 §5.3): undefined unless every variable is
 * defined in the state argument. */
function Eval(astOrText, state) {
  let ast;
  try { ast = typeof astOrText === 'string' ? parseExpr(astOrText) : astOrText; }
  catch { return undefined; }
  const vars = Vars(ast);
  const st = state || {};
  for (const v of Object.keys(vars)) if (!Object.prototype.hasOwnProperty.call(st, v)) return undefined;
  return evalNode(ast, st);
}

const KEEL = { id: ID, version: VERSION, tierOf, tierAvailable, Wf1, Wf2, Wf3, Wf4, Tc1, Tc2, Tc3, EqVar, Tc4, Vars, Replace, NewVar, Eval, parseExpr, printExpr };
if (typeof module === 'object' && module.exports) module.exports = KEEL;
host.DDNToolKeel = KEEL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
