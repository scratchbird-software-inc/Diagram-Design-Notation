import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { root, outputPath } from './context.mjs';

const assets = join(root, 'project/ddn/assets/fonts');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function checkedFile(path, hash) {
    const absolute = resolve(assets, path), rel = relative(assets, absolute);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Font manifest path escapes assets.');
    const bytes = readFileSync(absolute);
    if (digest(bytes) !== hash) throw new Error('Font asset integrity mismatch: ' + path);
    return bytes;
}
/** Build the optional local font pack. The core runtime does not import any font binary. */
export function buildFontPack(outputDirectory) {
    const directory = outputPath(outputDirectory);
    const manifest = JSON.parse(readFileSync(join(assets, 'manifest.json'), 'utf8'));
    if (manifest.format !== 'ddn-font-resources-1') throw new Error('Unsupported font manifest.');
    const resources = [], notices = [];
    for (const family of manifest.families) {
        const license = checkedFile(family.licensePath, family.licenseSha256).toString('utf8');
        notices.push(`${family.family}\n${family.repository}\nPinned commit: ${family.commit}\n\n${license}`);
        for (const face of family.files) {
            const bytes = checkedFile(face.path, face.sha256);
            if (bytes.toString('ascii', 0, 4) !== 'wOF2' || bytes.length !== face.bytes) throw new Error('Invalid WOFF2 font: ' + face.path);
            resources.push({ family: family.family, category: family.category, source: 'standard', license, style: face.style, weight: face.weight, dataURL: 'data:font/woff2;base64,' + bytes.toString('base64') });
        }
    }
    const licenses = notices.join('\n\n' + '='.repeat(72) + '\n\n');
    const code = '/* DDN optional offline font resources. Fonts retain their individual OFL licenses.\n' + licenses.replaceAll('*/', '* /') + '\n*/\n' +
        '(()=>{"use strict";const resources=' + JSON.stringify(resources) + ';globalThis.DDN_FONT_RESOURCES=Object.freeze([...(globalThis.DDN_FONT_RESOURCES??[]),...resources.map(Object.freeze)]);})();\n';
    mkdirSync(directory, { recursive: true });
    const script = join(directory, 'ddn-fonts.js'), manifestPath = join(directory, 'ddn-fonts-manifest.json'), licensePath = join(directory, 'ddn-fonts-LICENSES.txt');
    writeFileSync(script, code); writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); writeFileSync(licensePath, licenses + '\n');
    return { script, manifest: manifestPath, licenses: licensePath, bytes: Buffer.byteLength(code) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(JSON.stringify(buildFontPack(process.argv[2] ?? join(root, '.work/builds/ddn-fonts'))));
}
