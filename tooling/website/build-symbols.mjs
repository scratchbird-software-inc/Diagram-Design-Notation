/** Generate catalogue contour previews with the new DDN presentation module. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const option = process.argv.indexOf('--compiled');
const compiled = option >= 0 ? resolve(process.argv[option + 1]) : resolve(root, '.work/builds/ddn/ddn/packages');
const { nodeGlyph, arrowMarker, line } = await import(pathToFileURL(join(compiled, 'presentation/src/graph-glyphs.js')));
const contracts = resolve(root, 'standard/codex');
const roles = JSON.parse(readFileSync(join(contracts, 'role-contracts.json'), 'utf8'));
const profiles = JSON.parse(readFileSync(join(contracts, 'profile-contracts.json'), 'utf8'));
const output = resolve(root, 'website/assets/symbols');
mkdirSync(output, { recursive: true });
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const attributes = record => Object.entries(record || {}).map(([key, value]) => ` ${key}="${escape(value)}"`).join('');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function primitive(item) {
    if (item.kind === 'path') return `<path d="${escape(item.d)}"${attributes(item.paint)}/>`;
    if (item.kind === 'rect') return `<rect${attributes(item.bounds)}${attributes(item.paint)}/>`;
    if (item.kind === 'ellipse') {
        const b = item.bounds;
        return `<ellipse cx="${b.x + b.width / 2}" cy="${b.y + b.height / 2}" rx="${b.width / 2}" ry="${b.height / 2}"${attributes(item.paint)}/>`;
    }
    if (item.kind === 'text') return item.runs.map(run => `<text x="${run.x}" y="${run.y}" font-family="Arial,sans-serif"${attributes(run.style)}>${escape(run.text)}</text>`).join('');
    throw new Error('Unsupported contour primitive: ' + item.kind);
}
const manifest = { contract: 'ddn-next-1', description: 'Base role contours and default relation endpoint marks produced by the new presentation module. These omit instance metadata, compartments and optional illustrations; the complete profile example supplies those contexts.', symbols: {} };
for (const [key, role] of Object.entries(roles)) {
    const profile = Object.values(profiles).find(profile => role.category === 'element' && profile.primary_palette?.includes(role.role))?.id || 'ddn@1';
    const style = role.standard || {};
    let primitives;
    if (role.category === 'relation') {
        const source = [28, 70], target = [192, 70], color = style.colour || '#334155';
        primitives = [line(source, target, color, style.width || 2, style.pattern || undefined), ...arrowMarker(source, target, style.start || 'none', color), ...arrowMarker(target, source, style.end || 'none', color)];
    } else {
        const round = /^(state\.(initial|final|junction|history_deep|history_shallow|entrypoint|exitpoint)|petri\.place|flow\.(start|end|intermediate|flowfinal))$/.test(role.role);
        const bounds = round ? { x: 70, y: 30, width: 80, height: 80 } : { x: 35, y: 30, width: 150, height: 90 };
        primitives = nodeGlyph(role.role, { id: 'preview', role: role.role, metadata: {} }, bounds, { profile, title: '', fill: style.fill || '#fff', stroke: style.colour || '#475569', width: 1.5 });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" role="img"><title>${escape(role.role)} — base ${role.category} contour</title><g>${primitives.map(primitive).join('')}</g></svg>\n`;
    if (/NaN|Infinity|undefined/.test(svg)) throw new Error('Nonfinite or incomplete contour: ' + key);
    const file = slug(key) + '.svg';
    writeFileSync(join(output, file), svg);
    manifest.symbols[key] = { file: 'assets/symbols/' + file, role: role.role, category: role.category, profile, sha256: createHash('sha256').update(svg).digest('hex') };
}
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated ${Object.keys(manifest.symbols).length} current DDN contour previews`);
