#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Designer redesign phase 4: generates designer/contracts/form-descriptors.json —
 * the property descriptor registry the tool's descriptor-driven form generator
 * (notation/tool/src/forms.js) renders. Sources of truth:
 *   · standard/registry/data-properties.json — model property contracts
 *     (path/group/targets/value_shape/constraint) for element/relation/field
 *     targets
 *   · notation/runtime/ddn-profiles.js extension_contracts — closed x_* record
 *     schemas (only contracts expressible as a one-level structured group are
 *     emitted; free-form records stay read-only in the inspector)
 * so the form surface stays in lockstep with the registry: when the registry
 * gains a property, the descriptors regenerate and the freshness gate fails
 * until this script is re-run. Deterministic: same inputs, same bytes.
 *   node designer/contracts/build-form-descriptors.mjs [--check]
 * --check verifies freshness without writing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import Profiles from '../../notation/runtime/ddn-profiles.js';
import baseCatalogue from '../../notation/runtime/assets/catalogue.js';

const require = createRequire(import.meta.url);
const FORMS = require('../../notation/tool/src/forms.js'); // CJS pure layer (widgetForShape/choicesForShape)
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const check = process.argv.includes('--check');

const dataProperties = JSON.parse(readFileSync(join(root, 'standard/registry/data-properties.json'), 'utf8'));
const INSPECTOR_TARGETS = ['element', 'relation', 'field'];
const humanize = p => p.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/* value_shape → numeric bounds/integrality hints for number/quantity widgets. */
function numberHints(shape) {
  const s = String(shape || '').toLowerCase(), out = {};
  if (/nonnegative integer/.test(s)) { out.integer = true; out.min = 0; }
  else if (/positive integer/.test(s)) { out.integer = true; out.min = 1; }
  else if (/\binteger\b/.test(s)) out.integer = true;
  const range = s.match(/(\d+)\.\.(\d+)/) || s.match(/\[(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]/);
  if (range) { out.min = Number(range[1]); out.max = Number(range[2]); }
  const bound = s.match(/<=?\s*(\d+)\s*(px|pt)/) || s.match(/<=(\d+)(px|pt)/);
  if (bound && out.max === undefined) out.max = Number(bound[1]);
  return out;
}
function quantityUnits(shape) {
  const s = String(shape || '');
  if (/\(px\/s\)/.test(s)) return ['px/s'];
  if (/\(pt\)/.test(s)) return ['pt'];
  return ['px'];
}

const descriptors = [];
const seenGroups = [];
for (const p of dataProperties.properties) {
  const targets = (p.targets || []).filter(t => INSPECTOR_TARGETS.includes(t));
  if (!targets.length || p.path === 'uid') continue; // uid is identity, not an editable property
  const widget = FORMS.widgetForShape(p.value_shape);
  const d = {
    id: 'ddn.prop.' + p.path,
    key: p.path,
    label: humanize(p.path),
    help: p.constraint || '',
    targets,
    scope: 'model',
    widget,
    states: ['unset', 'value'],
    group: p.group || 'Other',
    removable: true,
    validation: {},
    provenance: { source: 'standard/registry/data-properties.json', version: dataProperties.version }
  };
  const choices = FORMS.choicesForShape(p.value_shape);
  if (widget === 'select' && choices) d.choices = choices;
  if (widget === 'number') Object.assign(d, numberHints(p.value_shape));
  if (widget === 'quantity') { d.units = quantityUnits(p.value_shape); Object.assign(d, numberHints(p.value_shape)); }
  if (!seenGroups.includes(d.group)) seenGroups.push(d.group);
  descriptors.push(d);
}

/* x_* extension contracts (closed records only): one structured-group
 * descriptor per contract. Sub-field widget derivation from the JSON-schema-
 * ish contract properties; contracts with unhandled member shapes are skipped
 * (they stay read-only extension rows in the inspector). */
const registry = Profiles.registry(JSON.parse(JSON.stringify(baseCatalogue)));
function subDescriptor(key, schema) {
  if (!schema || typeof schema !== 'object') return null;
  const d = { key, label: humanize(key) };
  if (schema.enum) { d.widget = 'select'; d.choices = schema.enum.slice(); return d; }
  if (schema.type === 'boolean') { d.widget = 'optional-boolean'; return d; }
  if (schema.type === 'string') { d.widget = 'text'; return d; }
  if (schema.type === 'number' || schema.type === 'integer') { d.widget = 'number'; if (schema.type === 'integer') d.integer = true; return d; }
  if (schema.type === 'array' && schema.items && schema.items.type === 'string') { d.widget = 'string-list'; return d; }
  return null; // nested records / reference arrays stay out of phase 4
}
const skippedExtensions = [];
for (const [key, contract] of Object.entries(registry.extension_contracts).sort(([a], [b]) => a.localeCompare(b))) {
  const targets = Object.keys(contract.targets || {}).map(t => t === 'object' ? 'element' : t).filter(t => INSPECTOR_TARGETS.includes(t));
  if (!targets.length) continue;
  const schema = Object.values(contract.targets)[0];
  if (schema.type === 'boolean') {
    descriptors.push({
      id: 'ddn.ext.' + key, key, label: key, targets, scope: 'model',
      widget: 'optional-boolean', states: ['unset', 'value'], group: 'Extensions',
      removable: true, validation: {}, help: 'Extension contract ' + key + ' (ddn-profiles.js).',
      provenance: { source: 'notation/runtime/ddn-profiles.js', version: registry.version || null }
    });
    continue;
  }
  if (schema.type === 'array' && schema.items && schema.items.type === 'string') {
    descriptors.push({
      id: 'ddn.ext.' + key, key, label: key, targets, scope: 'model',
      widget: 'string-list', states: ['unset', 'value'], group: 'Extensions',
      removable: true, validation: {}, help: 'Extension contract ' + key + ' (ddn-profiles.js).',
      provenance: { source: 'notation/runtime/ddn-profiles.js', version: registry.version || null }
    });
    continue;
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false || !schema.properties) { skippedExtensions.push(key); continue; }
  const fields = [];
  let ok = true;
  for (const [fk, fs2] of Object.entries(schema.properties)) {
    const sub = subDescriptor(fk, fs2);
    if (!sub) { ok = false; break; }
    fields.push(sub);
  }
  if (!ok || !fields.length) { skippedExtensions.push(key); continue; }
  descriptors.push({
    id: 'ddn.ext.' + key, key, label: key, targets, scope: 'model',
    widget: 'record', fields, states: ['unset', 'value'], group: 'Extensions',
    removable: true, validation: {}, help: 'Extension contract ' + key + ' (ddn-profiles.js).',
    provenance: { source: 'notation/runtime/ddn-profiles.js', version: registry.version || null }
  });
}

const out = {
  version: 1,
  generated_by: 'designer/contracts/build-form-descriptors.mjs — do not hand-edit',
  sources: ['standard/registry/data-properties.json@' + dataProperties.version, 'notation/runtime/ddn-profiles.js extension_contracts'],
  skipped_extensions: skippedExtensions,
  descriptors
};
const text = JSON.stringify(out, null, 2) + '\n';
const target = join(here, 'form-descriptors.json');
if (check) {
  if (readFileSync(target, 'utf8') !== text) throw new Error('form-descriptors.json is stale — run node designer/contracts/build-form-descriptors.mjs');
  console.log('build-form-descriptors: contract is fresh (' + descriptors.length + ' descriptors)');
} else {
  writeFileSync(target, text);
  console.log('build-form-descriptors: wrote ' + descriptors.length + ' descriptors (' + skippedExtensions.length + ' free-form extensions skipped: ' + skippedExtensions.join(', ') + ')');
}
