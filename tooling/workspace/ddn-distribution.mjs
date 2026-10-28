import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { bundle } from './ddn-bundle.mjs';
import { buildModularDistribution } from './ddn-modular.mjs';
import {buildFontPack} from './ddn-fonts.mjs';
import {copyDdnLicense, ddnLicenseMetadata, ddnScriptNotice, ddnHtmlNotice} from './ddn-license.mjs';
import { root, environment, outputPath } from './context.mjs';

const env = environment();
const built = resolve(env.DDN_BUILD_ROOT, 'ddn/packages');
const output = outputPath(join(env.DDN_BUILD_WORKAREA, 'builds/ddn-distribution'));
const require = createRequire(import.meta.url);
const ts = require(join(env.DDN_BUILD_WORKAREA, 'tools/toolchain/typescript/lib/typescript.js'));
mkdirSync(output, { recursive: true });


const profileSource = JSON.parse(readFileSync(join(root, 'standard/codex/profile-contracts.json'), 'utf8'));
const nativeProfiles = ['ddn@1', 'mindmap.basic@1', 'concept.map@1', 'table.records@1'];
const modulesOut = outputPath(join(output, 'modules'));
mkdirSync(modulesOut, { recursive: true });
// All copied code is the isolated DDN compilation; tests and Weaver never enter this tree.
cpSync(built, modulesOut, { recursive: true, filter: path => !path.endsWith('.map') });
copyDdnLicense(modulesOut);
for (const edition of ['native', 'complete']) {
const destination = edition === 'native' ? output : outputPath(join(output, 'complete'));
mkdirSync(destination, { recursive: true });
const fontPack=buildFontPack(destination);
copyDdnLicense(destination);
const manifest = { contract: 'ddn-next-1', edition, ...ddnLicenseMetadata, profiles: edition === 'native' ? nativeProfiles : Object.keys(profileSource), resources: [{file:'ddn-fonts.js',optional:true,rawBytes:fontPack.bytes,sha256:createHash('sha256').update(readFileSync(fontPack.script)).digest('hex'),provenance:'ddn-fonts-manifest.json',licenses:'ddn-fonts-LICENSES.txt'}], artifacts: [] };
const modulePrefix = edition === 'native' ? './modules' : '../modules';
for (const [name, entry, moduleEntry, rawLimit, gzipLimit] of [
    ['ddn-viewer', 'viewer-entry', 'viewer', 2 * 1024 * 1024, 250 * 1024],
    ['ddn-visual-designer', 'designer-entry', 'designer', 3 * 1024 * 1024, 400 * 1024],
    ['ddn-verifier', 'verifier-entry', 'verifier', 1024 * 1024, 100 * 1024],
]) {
    const script = ddnScriptNotice + bundle(join(built, 'standalone/src', (edition === 'complete' ? 'complete-' : '') + entry + '.js'), edition, { built, ts }).replace(/<\/script/gi, '<\\/script');
    const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DDN</title>'+ddnHtmlNotice()+(moduleEntry==='verifier'?'':'<script src="ddn-fonts.js"></script>')+'</head><body><noscript>This local DDN utility needs JavaScript enabled.</noscript><script>\n' + script + '\n</script></body></html>\n';
    writeFileSync(outputPath(join(destination, name + '.html')), html);
    const native = edition === 'native';
    const utilityEntry = moduleEntry === 'viewer' && native ? 'viewer/src/native.js' : moduleEntry + '/src/index.js';
    const moduleSource = ddnScriptNotice + `export * from '${modulePrefix}/${utilityEntry}';\n` +
        (native ? `export { createNativePack } from '${modulePrefix}/profiles/src/native.js';\nexport { createRuntime, createNativeRuntimeOptions } from '${modulePrefix}/runtime/src/native.js';\n` :
        `export { analyzeProfile, createNativePack, createCompletePack } from '${modulePrefix}/profiles/src/index.js';\nexport { createRuntime, createNativeRuntimeOptions, createCompleteRuntimeOptions } from '${modulePrefix}/runtime/src/index.js';\n` +
        (moduleEntry === 'verifier' ? '' : `export { createCompletePresentationPack } from '${modulePrefix}/presentation/src/pack.js';\n`)) +
        (moduleEntry === 'designer' ? `export { createCommandService, createNativeCommandPack } from '${modulePrefix}/runtime/src/commands.js';\nexport { createViewer } from '${modulePrefix}/viewer/src/${native ? 'native' : 'index'}.js';\n` : '');
    writeFileSync(outputPath(join(destination, name + '.js')), moduleSource);
    const rawBytes = Buffer.byteLength(html), gzipBytes = gzipSync(html, { level: 9 }).length;
    manifest.artifacts.push({ file: name + '.html', sha256: createHash('sha256').update(html).digest('hex'), rawBytes, gzipBytes, rawLimit: edition === 'native' ? rawLimit : null, gzipLimit: edition === 'native' ? gzipLimit : null, sizeGate: edition === 'native' ? rawBytes <= rawLimit && gzipBytes <= gzipLimit ? 'pass' : 'fail' : 'observation' });
    console.log(`${edition}/${name}: ${rawBytes} bytes, ${gzipBytes} gzip; size gate ${manifest.artifacts.at(-1).sizeGate}`);
}
writeFileSync(outputPath(join(destination, 'manifest.json')), JSON.stringify(manifest, null, 2) + '\n');
}
console.log('Standalone DDN distribution: ' + relative(root, output));

const modular = outputPath(join(output, 'modular'));
const modularManifest = buildModularDistribution({ built, ts, destination: modular });
buildFontPack(modular);
for (const mode of ['viewer', 'designer']) {
    const file = join(modular, mode + '.html');
    writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', '<script src="ddn-fonts.js"></script></head>'));
}
for (const [mode, value] of Object.entries(modularManifest.startup)) console.log(`modular/${mode}: ${value.rawBytes} startup bytes, ${value.gzipBytes} gzip; ${value.chunks.length} chunks (fonts separate)`);
console.log(`Modular DDN distribution: ${modularManifest.totals.modules} modules in ${modularManifest.totals.chunks} unique chunks`);
