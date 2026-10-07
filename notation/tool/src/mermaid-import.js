/* SPDX-License-Identifier: GPL-2.0-or-later. 0.9 Mermaid import (roadmap
 * DDN-0.9, ch.57 §57.4 surface decision): a Mermaid → DDN converter for the
 * DESIGNER — a reference-tool feature, never runtime; the spec and the
 * conformant runtime stay Mermaid-free (NOTICE.md: Mermaid is a cited design
 * reference only; no Mermaid code is vendored here).
 *
 * Pure layer (node-testable, no DOM):
 *  · parseMermaid(text) — line grammar for the practical subset: flowchart
 *    (graph/flowchart TD|BT|LR|RL — nodes, labeled edges, subgraphs),
 *    sequenceDiagram (participants/actors, ->>/-->> messages incl. self),
 *    classDiagram (classes, members, relations), erDiagram (entities,
 *    attribute blocks, crow's-foot relations), stateDiagram (states, [*]
 *    initial/final, transitions, composites).
 *  · mermaidToDdn(text, opts) — maps the parsed model to DDN equivalents from
 *    the registry's existing kinds (flow.*, uml.message, uml.class +
 *    uml.generalization/realization/association/dependency, table + ref with
 *    crow's-foot endpoint marks, state.*), auto layout only (no coordinate
 *    import), and returns the DDN source plus a loss report: every skipped
 *    construct with its line and reason (styling, click handlers, comments,
 *    unsupported statements) — nothing is dropped silently.
 *
 * UMD: inlined into the single-file tool build and required by node tests. */
(function (host) {
'use strict';

const SKIP = (line, text, reason) => ({ line, text: text.trim().slice(0, 120), reason });

function baseParse(text) {
  const skipped = [];
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let comments = 0;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const ci = line.indexOf('%%');
    if (ci >= 0) { comments++; line = line.slice(0, ci); }
    line = line.replace(/\s+$/, '');
    if (line.trim()) out.push({ n: i + 1, text: line });
  }
  const first = out.length ? out[0].text.trim() : '';
  let type = null, direction = null;
  let m = first.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i);
  if (m) { type = 'flowchart'; direction = m[1].toUpperCase(); }
  else if (/^sequenceDiagram\b/.test(first)) type = 'sequence';
  else if (/^classDiagram\b/.test(first)) type = 'class';
  else if (/^erDiagram\b/.test(first)) type = 'er';
  else if (/^stateDiagram(?:-v2)?\b/.test(first)) type = 'state';
  else if (/^(?:graph|flowchart)\b/.test(first)) { type = 'flowchart'; direction = 'TD'; }
  if (!type) throw Object.assign(new Error('not a recognized Mermaid diagram (expected flowchart/graph, sequenceDiagram, classDiagram, erDiagram or stateDiagram)'), { code: 'DDN-MP01' });
  if (comments) skipped.push(SKIP(0, comments + ' comment marker(s)', 'Mermaid %% comments are not carried into the DDN model'));
  return { type, direction, lines: out.slice(1), skipped };
}

/* --- shared model helpers --- */
function mkModel() {
  return { objects: new Map(), relations: [], frames: [], direction: null, projection: null, skipped: [], notes: [] };
}
function addObject(model, id, label, kind, fields) {
  const clean = id.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'node';
  if (!model.objects.has(clean)) model.objects.set(clean, { id: clean, label: label || clean, kind, fields: fields || [] });
  const o = model.objects.get(clean);
  if (fields && fields.length) for (const f of fields) if (!o.fields.some(x => x.id === f.id)) o.fields.push(f);
  return o;
}
function relId(model) { return 'r' + (model.relations.length + 1); }
function addRelation(model, name, kind, from, to, props) {
  model.relations.push({ id: relId(model), name: name || null, kind, from, to, props: props || {} });
}

/* --- flowchart --- */
const NODE_SHAPES = [
  /* most-specific shapes first — the plain box swallows every other form. */
  [/^([\w-]+)\(\((.+?)\)\)$/, (id, l) => [id, l, 'flow.start', null]],
  [/^([\w-]+)\[\[(.+?)\]\]$/, (id, l) => [id, l, 'flow.subprocess', null]],
  [/^([\w-]+)\[\((.+?)\)\]$/, (id, l) => [id, l, 'flow.datastore', null]],
  [/^([\w-]+)\{(.+?)\}$/, (id, l) => [id, l, 'flow.decision', null]],
  [/^([\w-]+)>(.+?)\]$/, (id, l) => [id, l, 'flow.io', null]],
  [/^([\w-]+)\[\/(.+?)\/\]$/, (id, l) => [id, l, 'flow.process', 'parallelogram shape painted as a process box']],
  [/^([\w-]+)\[\\(.+?)\\\]$/, (id, l) => [id, l, 'flow.process', 'trapezoid shape painted as a process box']],
  [/^([\w-]+)\[(.+?)\]$/, (id, l) => [id, l, 'flow.process', null]],
  [/^([\w-]+)\((.+?)\)$/, (id, l) => [id, l, 'flow.process', 'stadium shape painted as a process box']]
];
function flowNode(model, raw, skipped, lineN) {
  raw = raw.trim();
  for (const [re, fn] of NODE_SHAPES) {
    if (!fn) continue;
    const m = raw.match(re);
    if (m) {
      const [id, label, kind, note] = fn(m[1], m[2].replace(/^"|"$/g, ''));
      if (note) skipped.push(SKIP(lineN, raw, note));
      return addObject(model, id, label, kind).id;
    }
  }
  return addObject(model, raw.replace(/^"|"$/g, ''), raw.replace(/^"|"$/g, ''), 'flow.process').id;
}
function parseFlowchart(p) {
  const model = mkModel();
  model.direction = { TD: 'down', TB: 'down', BT: 'up', LR: 'right', RL: 'left' }[p.direction] || 'down';
  model.skipped = p.skipped;
  const frameStack = [];
  let anonFrame = 0;
  const inFrame = id => { for (const f of frameStack) if (!f.members.includes(id)) f.members.push(id); };
  const ARROWS = ['-.->', '==>', '-->', '---', '-.-.', '=='];
  for (const { n, text } of p.lines) {
    const line = text.trim();
    let m;
    if ((m = line.match(/^subgraph\s+(?:(\w+)\s*)?(?:\[(.+?)\]|"(.+?)"|(\w+))?$/))) {
      const id = m[1] || 'scope' + (++anonFrame);
      frameStack.push({ id, label: m[2] || m[3] || m[4] || id, members: [] });
      continue;
    }
    if (line === 'end') {
      if (frameStack.length) model.frames.push(frameStack.pop());
      else model.skipped.push(SKIP(n, line, 'unmatched end (no open subgraph)'));
      continue;
    }
    if (/^(classDef|class|style|linkStyle)\b/.test(line)) { model.skipped.push(SKIP(n, line, 'Mermaid styling is not portable paint in DDN')); continue; }
    if (/^(click|callback)\b/.test(line)) { model.skipped.push(SKIP(n, line, 'Mermaid click/callback handlers are interactivity the notation does not carry')); continue; }
    if (/^direction\b/.test(line)) { model.skipped.push(SKIP(n, line, 'per-subgraph direction overrides are not supported; the whole view gets one direction')); continue; }
    if (/^accTitle|^accDescr/.test(line)) { model.skipped.push(SKIP(n, line, 'accessibility title/description lines are not imported')); continue; }
    // edge chain: find the first arrow token
    let arrow = null, ai = -1;
    for (const a of ARROWS) { const i = line.indexOf(a); if (i >= 0 && (ai < 0 || i < ai)) { arrow = a; ai = i; } }
    if (arrow) {
      let left = line.slice(0, ai).trim(), right = line.slice(ai + arrow.length).trim();
      let label = null;
      const pipe = right.match(/^\|([^|]*)\|\s*(.*)$/);
      if (pipe) { label = pipe[1].trim(); right = pipe[2].trim(); }
      const lm = left.match(/^(.*?)\s*--\s*"?([^"-]+?)"?\s*--$/);
      if (lm) { left = lm[1].trim(); if (!label) label = lm[2].trim(); }
      if (arrow === '==>' || arrow === '==') model.skipped.push(SKIP(n, line, 'thick-arrow emphasis is styling; imported as a plain flow.next'));
      if (arrow === '-.->' || arrow === '-.-.') model.skipped.push(SKIP(n, line, 'dashed-arrow style is styling; imported as a plain flow.next'));
      if (arrow === '---') model.skipped.push(SKIP(n, line, 'open link (---) imports as a plain flow.next; arrowhead loss is a styling difference'));
      const froms = left.split(/\s*&\s*/), tos = right.split(/\s*&\s*/);
      for (const f of froms) {
        const fid = flowNode(model, f, model.skipped, n);
        inFrame(fid);
        for (const t of tos) {
          const tid = flowNode(model, t, model.skipped, n);
          inFrame(tid);
          /* flow.next's endpoint contract excludes data stores (they are DFD
           * constructs) — store endpoints fall back to the generic uses verb
           * with the loss reported, never a silent downgrade. */
          const storeEnd = ['flow.datastore', 'dfd.store'].includes(model.objects.get(fid).kind) || ['flow.datastore', 'dfd.store'].includes(model.objects.get(tid).kind);
          if (storeEnd) model.skipped.push(SKIP(n, line, "data-store endpoints use the generic 'uses' verb — flow.next's endpoint contract excludes stores"));
          addRelation(model, label, storeEnd ? 'uses' : 'flow.next', fid, tid);
        }
      }
      continue;
    }
    // bare node statement
    inFrame(flowNode(model, line, model.skipped, n));
  }
  while (frameStack.length) { const f = frameStack.pop(); model.skipped.push(SKIP(0, 'subgraph ' + f.id, 'unclosed subgraph — closed at end of input')); model.frames.push(f); }
  for (const f of model.frames) f.members = f.members.filter(id => model.objects.has(id));
  model.frames = model.frames.filter(f => f.members.length);
  return model;
}

/* --- sequenceDiagram --- */
function parseSequence(p) {
  const model = mkModel();
  model.skipped = p.skipped;
  model.projection = { kind: 'sequence', profile: 'uml.sequence@1' };
  for (const { n, text } of p.lines) {
    const line = text.trim();
    let m;
    if ((m = line.match(/^(participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?$/))) {
      addObject(model, m[2], (m[3] || m[2]).trim(), m[1] === 'actor' ? 'uml.actor' : 'application');
      continue;
    }
    let arrowTok = null, arrowAt = -1;
    for (const a of ['-->>', '--x', '->>', '->', '-->', '-x']) { const i = line.indexOf(a); if (i > 0 && (arrowAt < 0 || i < arrowAt)) { arrowTok = a; arrowAt = i; } }
    if (arrowTok) {
      const from = line.slice(0, arrowAt).trim();
      let rest = line.slice(arrowAt + arrowTok.length);
      const cm = rest.match(/^(.*?)\s*:\s*(.+)$/);
      if (from && cm) {
        const to = cm[1].trim(), text2 = cm[2].trim();
        const dashed = arrowTok.startsWith('--');
        if (arrowTok === '--x' || arrowTok === '-x') model.skipped.push(SKIP(n, line, 'failed-message (x) arrowheads are styling; imported as a return message'));
        if (arrowTok === '->' || arrowTok === '-->') model.skipped.push(SKIP(n, line, 'open-arrow message imports as uml.message; arrowhead loss is a styling difference'));
        addObject(model, from, from, 'application');
        addObject(model, to, to, 'application');
        addRelation(model, text2, 'uml.message', from, to, dashed ? { x_return: true } : {});
        continue;
      }
    }
    if (/^(alt|opt|loop|par|and|else|break|critical|end|rect)\b/.test(line)) { model.skipped.push(SKIP(n, line, 'combined fragments (alt/opt/loop/…) are not imported this revision')); continue; }
    if (/^note\b/i.test(line)) { model.skipped.push(SKIP(n, line, 'sequence notes are not imported this revision')); continue; }
    if (/^(activate|deactivate|autonumber|create|destroy|box)\b/.test(line)) { model.skipped.push(SKIP(n, line, 'activation/autonumber/box directives are not imported this revision')); continue; }
    model.skipped.push(SKIP(n, line, 'unsupported sequenceDiagram statement'));
  }
  return model;
}

/* --- classDiagram --- */
function parseClass(p) {
  const model = mkModel();
  model.skipped = p.skipped;
  const RELS = [
    ['<|--', (a, b) => [b, a, 'uml.generalization', null]],
    ['<|..', (a, b) => [b, a, 'uml.realization', null]],
    ['*--', (a, b) => [a, b, 'uml.association', 'composition maps to uml.association (no dedicated composition verb in the registry)']],
    ['o--', (a, b) => [a, b, 'uml.association', 'aggregation maps to uml.association (no dedicated aggregation verb in the registry)']],
    ['..>', (a, b) => [a, b, 'uml.dependency', null]],
    ['-->', (a, b) => [a, b, 'uml.association', null]],
    ['--', (a, b) => [a, b, 'uml.association', null]]
  ];
  let inBlock = null;
  for (const { n, text } of p.lines) {
    const line = text.trim();
    let m;
    if (inBlock) {
      if (line === '}') { inBlock = null; continue; }
      const mm = line.match(/^([+\-#~])?\s*(?:([\w<>\[\]]+)\s+)?([\w]+)\s*(\(([^)]*)\))?\s*(?::\s*(.+))?$/);
      if (mm) {
        const fname = mm[3] + (mm[4] ? mm[4] : '');
        const o = model.objects.get(inBlock);
        if (o && !o.fields.some(f => f.id === fname)) o.fields.push({ id: fname });
        if (mm[1] || mm[2] || mm[6]) model.skipped.push(SKIP(n, line, 'member visibility/types are dropped; DDN fields carry names this revision'));
        continue;
      }
      model.skipped.push(SKIP(n, line, 'unsupported class member line'));
      continue;
    }
    if ((m = line.match(/^class\s+(\w+)\s*\{(.*)\}$/))) {
      /* single-line block: class X { +type name +method() } */
      const o = addObject(model, m[1], m[1], 'uml.class');
      const inner = m[2].trim();
      if (inner) {
        for (const tok of inner.split(/\s+(?=[+\-#~])|\s{2,}/).map(x => x.trim()).filter(Boolean)) {
          const mm = tok.match(/^([+\-#~])?\s*(?:([\w<>\[\]]+)\s+)?([\w]+\s*(\([^)]*\))?)$/);
          if (mm) {
            const fname = mm[3].replace(/\s+/g, '');
            if (!o.fields.some(f => f.id === fname)) o.fields.push({ id: fname });
            if (mm[1] || mm[2]) model.skipped.push(SKIP(n, line, 'member visibility/types are dropped; DDN fields carry names this revision'));
          } else model.skipped.push(SKIP(n, line, 'unsupported class member: ' + tok));
        }
      }
      continue;
    }
    if ((m = line.match(/^class\s+(\w+)\s*\{$/))) {
      addObject(model, m[1], m[1], 'uml.class');
      inBlock = m[1];
      continue;
    }
    if ((m = line.match(/^class\s+(\w+)(?:\s*<<?(.+?)>>?)?$/))) {
      addObject(model, m[1], m[1], 'uml.class');
      if (m[2]) model.skipped.push(SKIP(n, line, 'generics/annotations are dropped from the class label'));
      continue;
    }
    if ((m = line.match(/^(\w+)\s*:\s*(.+)$/))) {
      const member = m[2].trim().replace(/^[+\-#~]\s*/, '').replace(/\s+/g, '_');
      const o = addObject(model, m[1], m[1], 'uml.class');
      if (!o.fields.some(f => f.id === member)) o.fields.push({ id: member });
      continue;
    }
    let done = false;
    for (const [tok, fn] of RELS) {
      const i = line.indexOf(tok);
      if (i > 0) {
        const a = line.slice(0, i).trim();
        let rest = line.slice(i + tok.length).trim();
        let label = null;
        const cm = rest.match(/^(\w+)\s*:\s*(.+)$/);
        if (cm) { rest = cm[1]; label = cm[2].trim(); }
        const b = rest.trim();
        if (!a || !b) break;
        addObject(model, a, a, 'uml.class');
        addObject(model, b, b, 'uml.class');
        const [from, to, kind, note] = fn(a, b);
        if (note) model.skipped.push(SKIP(n, line, note));
        addRelation(model, label, kind, from, to);
        done = true;
        break;
      }
    }
    if (done) continue;
    if (/^(namespace|note|annotation|<<)/i.test(line)) { model.skipped.push(SKIP(n, line, 'namespaces/notes/annotations are not imported this revision')); continue; }
    model.skipped.push(SKIP(n, line, 'unsupported classDiagram statement'));
  }
  if (inBlock) model.skipped.push(SKIP(0, 'class ' + inBlock, 'unclosed class block — closed at end of input'));
  return model;
}

/* --- erDiagram --- */
const CROWFOOT = { '||': 'one', 'o|': 'zeroone', '|{': 'many', '}|': 'many', 'o{': 'zeromany', '{o': 'zeromany', '{|': 'many' };
function parseEr(p) {
  const model = mkModel();
  model.skipped = p.skipped;
  let inBlock = null;
  for (const { n, text } of p.lines) {
    const line = text.trim();
    let m;
    if (inBlock) {
      if (line === '}') { inBlock = null; continue; }
      if ((m = line.match(/^([\w[\]]+)\s+(\w+)\s*(?:(PK|FK|UK)\b)?/))) {
        const o = model.objects.get(inBlock);
        const f = { id: m[2], props: m[3] === 'PK' ? { key: 'primary' } : {} };
        if (o && !o.fields.some(x => x.id === f.id)) o.fields.push(f);
        model.skipped.push(SKIP(n, line, 'attribute types' + (m[3] === 'FK' ? ' and FK markers' : '') + ' are dropped; DDN fields carry names this revision'));
        continue;
      }
      model.skipped.push(SKIP(n, line, 'unsupported entity attribute line'));
      continue;
    }
    if ((m = line.match(/^(\w+)\s*\{(.*)\}$/)) && m[2].trim()) {
      /* single-line entity block: ENTITY { type name [PK|FK] … } */
      const o = addObject(model, m[1], m[1], 'table');
      const inner = m[2].trim();
      const attrRe = /([\w[\]]+)\s+(\w+)\s*(?:(PK|FK|UK)\b)?/g;
      let am;
      while ((am = attrRe.exec(inner))) {
        const f = { id: am[2], props: am[3] === 'PK' ? { key: 'primary' } : {} };
        if (!o.fields.some(x => x.id === f.id)) o.fields.push(f);
        model.skipped.push(SKIP(n, line, 'attribute types' + (am[3] === 'FK' ? ' and FK markers' : '') + ' are dropped; DDN fields carry names this revision'));
      }
      continue;
    }
    if ((m = line.match(/^(\w+)\s*\{$/))) {
      addObject(model, m[1], m[1], 'table');
      inBlock = m[1];
      continue;
    }
    if ((m = line.match(/^(\w+)\s+([|o}{]{2})--([|o}{]{2})\s+(\w+)\s*:\s*(.+)$/))) {
      const [, a, m1, m2, b, label] = m;
      addObject(model, a, a, 'table');
      addObject(model, b, b, 'table');
      const sm = CROWFOOT[m1], tm = CROWFOOT[m2];
      if (!sm || !tm) { model.skipped.push(SKIP(n, line, 'unrecognized crow\'s-foot cardinality token — relation imported without marks')); addRelation(model, label.trim(), 'ref', a, b); continue; }
      addRelation(model, label.trim(), 'ref', a, b, { source_mark: sm, target_mark: tm });
      continue;
    }
    model.skipped.push(SKIP(n, line, 'unsupported erDiagram statement'));
  }
  if (inBlock) model.skipped.push(SKIP(0, inBlock, 'unclosed entity block — closed at end of input'));
  return model;
}

/* --- stateDiagram --- */
function parseState(p) {
  const model = mkModel();
  model.skipped = p.skipped;
  const frameStack = [];
  let anon = 0;
  const seen = new Set();
  function ensureState(raw) {
    let m = raw.match(/^(?:state\s+)?"(.+?)"\s+as\s+(\w+)$/) || raw.match(/^state\s+(\w+)$/);
    if (m) return addObject(model, m[2] || m[1], m[1], 'state.state').id;
    const id = raw.trim().replace(/[^A-Za-z0-9_]/g, '_');
    return addObject(model, id, raw.trim(), 'state.state').id;
  }
  for (const { n, text } of p.lines) {
    const line = text.trim();
    let m;
    if ((m = line.match(/^state\s+(?:(\w+)|"(.+?)")(?:\s+as\s+(\w+))?\s*\{(.*)$/))) {
      const id = m[3] || m[1] || 'region' + (++anon);
      addObject(model, id, m[2] || m[1] || id, 'state.state');
      frameStack.push({ id, label: m[2] || m[1] || id, members: [id] });
      seen.add(id);
      let rest = (m[4] || '').trim();
      if (rest.endsWith('}')) { rest = rest.slice(0, -1).trim(); model.frames.push(frameStack.pop()); }
      if (rest) p.lines.splice(p.lines.indexOf(arguments[0]) + 1, 0, { n, text: rest });
      continue;
    }
    if (line === '}') {
      if (frameStack.length) model.frames.push(frameStack.pop());
      else model.skipped.push(SKIP(n, line, 'unmatched } (no open composite state)'));
      continue;
    }
    if ((m = line.match(/^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.+))?$/))) {
      let [, fromRaw, toRaw, label] = m;
      let from, to;
      if (fromRaw.trim() === '[*]') {
        to = ensureState(toRaw);
        const initId = 'initial' + (seen.has('initial') ? '_' + to : '');
        from = addObject(model, initId, 'Start', 'state.initial').id;
        seen.add('initial');
      } else from = ensureState(fromRaw);
      if (toRaw.trim() === '[*]') {
        const finId = 'final' + (seen.has('final') ? '_' + from : '');
        to = addObject(model, finId, 'Done', 'state.final').id;
        seen.add('final');
      } else to = ensureState(toRaw);
      addObject(model, from, model.objects.get(from).label, model.objects.get(from).kind);
      addObject(model, to, model.objects.get(to).label, model.objects.get(to).kind);
      addRelation(model, (label || '').trim(), 'state.transition', from, to, label ? { x_transition: { event: label.trim() } } : {});
      for (const f of frameStack) for (const id of [from, to]) if (!f.members.includes(id)) f.members.push(id);
      continue;
    }
    if (/^(note|direction|scale)\b/i.test(line)) { model.skipped.push(SKIP(n, line, 'state notes/direction directives are not imported this revision')); continue; }
    if (line === '--') { model.skipped.push(SKIP(n, line, 'concurrent regions (--) are not imported this revision')); continue; }
    model.skipped.push(SKIP(n, line, 'unsupported stateDiagram statement'));
  }
  while (frameStack.length) { const f = frameStack.pop(); model.skipped.push(SKIP(0, 'state ' + f.id, 'unclosed composite state — closed at end of input')); model.frames.push(f); }
  return model;
}

/* parseMermaid(text) → { type, direction, lines, skipped } (low-level); the
 * per-type parsers produce the intermediate model. */
function parseMermaid(text) {
  const p = baseParse(text);
  const model = { flowchart: parseFlowchart, sequence: parseSequence, class: parseClass, er: parseEr, state: parseState }[p.type](p);
  model.type = p.type;
  return model;
}

/* mermaidToDdn(text, { module, viewId, viewName }) → { source, report }. */
function mermaidToDdn(text, opts) {
  const o = opts || {};
  const model = parseMermaid(text);
  const moduleName = (o.module || 'mermaid_import').replace(/[^A-Za-z0-9_.-]/g, '_');
  const viewId = (o.viewId || 'main').replace(/[^A-Za-z0-9_]/g, '_') || 'main';
  const viewName = o.viewName || 'Imported ' + model.type + ' (Mermaid)';
  const L = [];
  L.push('ddn "0.6";', 'module "' + moduleName + '";', '');
  L.push('// Imported from Mermaid (' + model.type + ') by the ddn designer\'s Import… command.');
  L.push('// Layout is automatic — Mermaid coordinates do not exist and nothing else was invented.');
  const objects = [...model.objects.values()];
  const skippedCount = model.skipped.length;
  if (skippedCount) L.push('// Loss report: ' + skippedCount + ' construct(s) skipped — see the bottom of this file for the exact list.');
  L.push('', 'data model {');
  for (const ob of objects) {
    let decl = '    object ' + ob.id + ' ' + JSON.stringify(ob.label) + ' { kind: ' + JSON.stringify(ob.kind) + ';';
    if (ob.fields && ob.fields.length) {
      decl += '\n        fields {';
      for (const f of ob.fields) {
        const fid = f.id.replace(/[^A-Za-z0-9_]/g, '').replace(/^(\d)/, '_$1') || 'member';
        decl += '\n            field ' + fid + (fid !== f.id ? ' ' + JSON.stringify(f.id) : '') + (f.props && f.props.key ? ' { key: ' + JSON.stringify(f.props.key) + '; }' : '') + ';';
      }
      decl += '\n        }';
    }
    decl += ' }';
    L.push(decl);
  }
  for (const r of model.relations) {
    let decl = '    relation ' + r.id + (r.name ? ' ' + JSON.stringify(r.name) : '') + ' @' + r.from + ' -> @' + r.to + ' { kind: ' + JSON.stringify(r.kind) + ';';
    for (const [k, v] of Object.entries(r.props || {})) decl += ' ' + k + ': ' + propValue(v) + ';';
    decl += ' }';
    L.push(decl);
  }
  L.push('}', '');
  L.push('view ' + viewId + ' ' + JSON.stringify(viewName) + ' {');
  L.push('    data: [@model];');
  if (model.direction) L.push('    layout { direction: ' + JSON.stringify(model.direction) + '; gap: 96px; row_gap: 96px; }');
  if (model.projection) L.push('    projection { kind: ' + JSON.stringify(model.projection.kind) + '; profile: ' + JSON.stringify(model.projection.profile) + '; }');
  L.push('    publication { size: content; fit: none; }');
  for (const f of model.frames) {
    L.push('    frame ' + f.id + ' ' + JSON.stringify(f.label.toUpperCase()) + ' { members: [' + f.members.map(id => '@model.' + id).join(', ') + ']; }');
  }
  L.push('}');
  if (skippedCount) {
    L.push('', '// ---- Import loss report (' + skippedCount + ' skipped construct(s)) ----');
    for (const s of model.skipped) L.push('//' + (s.line ? ' line ' + s.line + ':' : '') + ' ' + s.reason + ' — ' + s.text.replace(/\n/g, ' '));
  }
  const source = L.join('\n') + '\n';
  return {
    source,
    report: {
      type: model.type,
      created: { objects: objects.length, relations: model.relations.length, frames: model.frames.length },
      skipped: model.skipped
    }
  };
}
function propValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return '[' + v.map(propValue).join(', ') + ']';
  if (v && v.$ref) return '@' + v.$ref;
  if (v && v.$quantity !== undefined) return String(v.$quantity) + v.unit;
  return '{ ' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + propValue(x)).join(', ') + ' }';
}

const api = { parseMermaid, mermaidToDdn };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNMermaidImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
