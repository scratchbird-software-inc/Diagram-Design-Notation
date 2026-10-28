import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { bundle, collectModules, moduleClosure, moduleReport, runtimeScript, chunkManifest, chunkScript, entryScript } from '../../../../tooling/workspace/ddn-bundle.mjs';
const root = fileURLToPath(new URL('../../../..', import.meta.url));
const work = process.env.DDN_BUILD_WORKAREA ?? resolve(root, '.work');
const require = createRequire(import.meta.url);
const ts = require(process.env.DDN_TYPESCRIPT_PATH ?? join(work, 'tools/toolchain/typescript/lib/typescript.js'));
mkdirSync(join(work, 'tmp'), { recursive: true });
function fixture(files) {
    const built = mkdtempSync(join(work, 'tmp/ddn-bundler-'));
    for (const [name, value] of Object.entries(files)) {
        const target = join(built, name); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value);
    }
    return { built, graph: entries => collectModules(Object.fromEntries(entries.map(name => [name, join(built, name)])), { built, ts }) };
}
function context() {
    const blobs = [], workers = [], revoked = [];
    const global = vm.createContext({
        Blob: class { constructor(parts, options) { this.source = parts.join(''); this.type = options.type; blobs.push(this); } },
        URL: { createObjectURL: blob => 'blob:' + blobs.indexOf(blob), revokeObjectURL: url => revoked.push(url) },
        Worker: class { constructor(url, options) { this.url = url; this.options = options; workers.push(this); } },
    });
    return { global, blobs, workers, revoked, run: source => vm.runInContext(source, global) };
}
const options = { id: 'main', releaseHash: 'release-1' };
const install = (c,graph,specs=[{ids:[...graph.modules.keys()],...options}]) => c.run(runtimeScript({hash:options.releaseHash,chunks:specs.map(({ids,graph:input=graph,...spec})=>chunkManifest(input,ids,spec))}));
const plain = value => JSON.parse(JSON.stringify(value));

test('AST collection preserves imports, re-exports, cycles and literal require text', () => {
    const f = fixture({
        'shared.js': 'globalThis.runs=(globalThis.runs||0)+1; export const value=7;',
        'a.js': 'import { b } from "./b.js"; export const a=2; export function sum(){return a+b;}',
        'b.js': 'import { a } from "./a.js"; export const b=3; export function readA(){return a;}',
        'index.js': 'export {value as answer} from "./shared.js"; export * from "./a.js";',
        'entry.js': 'import {answer,sum} from "./index.js"; globalThis.result=[answer,sum(),\'require("./missing.js")\'];',
    });
    const graph = f.graph(['entry.js']), c = context(); install(c,graph);
    assert.equal(graph.modules.size, 5);
    assert.ok(moduleClosure(graph, 'a.js').includes('b.js'));
    assert.equal(moduleReport(graph).length, 5);
    c.run(chunkScript(graph, graph.modules.keys(), options)); c.run(entryScript('entry.js'));
    assert.deepEqual(plain(c.global.result), [7, 5, 'require("./missing.js")']);
    assert.equal(c.global.runs, 1);
    c.run(entryScript('entry.js')); assert.equal(c.global.runs, 1);
});

test('collection rejects nonlocal, nonliteral and escaping dependencies', () => {
    for (const [source, pattern] of [['import "package";', /Nonlocal runtime import/], ['const path="./x.js";require(path);', /Dynamic runtime import/], ['const path="./x.js";import(path);', /Untrusted dynamic import/], ['import("https://example.com/x.js");', /Untrusted dynamic import/]]) {
        const f = fixture({ 'entry.js': source }); assert.throws(() => f.graph(['entry.js']), pattern);
    }
    const f = fixture({ 'entry.js': 'import "./outside.js";' }), external = join(work, 'tmp/ddn-bundler-external.js');
    writeFileSync(external, 'export const value=1;'); symlinkSync(external, join(f.built, 'outside.js'));
    assert.throws(() => f.graph(['entry.js']), /escaped DDN/);
});

test('chunks share one module instance and cannot mix releases or replace modules', () => {
    const f = fixture({ 'shared.js': 'globalThis.count=(globalThis.count||0)+1;export const value=9;', 'entry.js': 'import{value}from"./shared.js";globalThis.result=value;' });
    const graph = f.graph(['entry.js']), c = context();
    const common = { ...options, id: 'core' }, app = { ...options, id: 'app', dependencies: ['core'] };
    const different = { ...graph, modules: new Map(graph.modules) };
    different.modules.set('shared.js', { ...graph.modules.get('shared.js'), sha256: 'different', code: 'exports.value=10;' });
    install(c,graph,[{...common,ids:['shared.js']},{...app,ids:['entry.js']}, {...options,id:'other',graph:different,ids:['shared.js']}]);
    // Authorize the altered chunk's metadata separately; module conflicts remain checked.
    assert.throws(() => c.run(chunkScript(graph, ['entry.js'], app)), /Missing DDN chunk dependency core/);
    assert.equal(c.global.DDN_MODULES.describe().modules.length, 0);
    c.run(chunkScript(graph, ['shared.js'], common)); c.run(chunkScript(graph, ['entry.js'], app));
    c.run(entryScript('entry.js')); c.run(chunkScript(graph, ['shared.js'], common)); c.run(runtimeScript({ hash: options.releaseHash }));
    assert.equal(c.global.count, 1); assert.equal(c.global.result, 9);
    assert.throws(() => c.run(runtimeScript({ hash: 'other' })), /Incompatible DDN module runtime/);
    assert.throws(() => c.run(chunkScript(graph, ['entry.js'], { ...options, id: 'other', releaseHash: 'other' })), /Incompatible/);
    assert.throws(() => c.run(chunkScript(different, ['shared.js'], { ...options, id: 'other' })), /Conflicting DDN module shared.js/);
    assert.deepEqual(plain(c.global.DDN_MODULES.describe().chunks.map(v => v.id)), ['core', 'app']);
});

test('unavailable optional modules fail explicitly and can be loaded before retry', () => {
    const f = fixture({ 'entry.js': 'import{value}from"./optional.js";globalThis.result=value;', 'optional.js': 'export const value=11;' });
    const graph = f.graph(['entry.js']), c = context(); install(c,graph,[{...options,ids:['entry.js']},{...options,id:'optional',ids:['optional.js']}]);
    c.run(chunkScript(graph, ['entry.js'], options));
    assert.throws(() => c.run(entryScript('entry.js')), /Missing bundled module optional.js/);
    assert.deepEqual(plain(c.global.DDN_MODULES.describe().executed), []);
    c.run(chunkScript(graph, ['optional.js'], { ...options, id: 'optional' })); c.run(entryScript('entry.js'));
    assert.equal(c.global.result, 11);
});

test('chunk installation is atomic and duplicate content uses deterministic hashes', () => {
    const f = fixture({ 'entry.js': 'export const value=1;' }), graph = f.graph(['entry.js']), c = context(); install(c,graph);
    const manifest = chunkManifest(graph, ['entry.js'], options);
    assert.deepEqual(manifest, chunkManifest(graph, ['entry.js'], options));
    const broken = { ...manifest, modules: [...manifest.modules, { id: 'missing.js', dependencies: [], sha256: 'missing' }] };
    assert.throws(() => c.global.DDN_MODULES.register(broken, { 'entry.js': () => {} }), /Malformed DDN module/);
    assert.equal(c.global.DDN_MODULES.describe().modules.length, 0);
    assert.throws(() => chunkManifest(graph, ['entry.js', 'entry.js'], options), /Duplicate module/);
});

test('modular workers contain only compute closure and selected initializers', () => {
    const f = fixture({
        'compute.js': 'export const value=5;',
        'worker.js': 'import{value}from"./compute.js";globalThis.result=value+globalThis.extra;',
        'initializer.js': 'globalThis.extra=8;',
        'designer.js': 'globalThis.UI_ONLY_SENTINEL=document.createElement("div");',
    });
    const graph = f.graph(['worker.js', 'initializer.js', 'designer.js']), c = context(); install(c,graph);
    c.run(chunkScript(graph, graph.modules.keys(), options));
    c.global.DDN_MODULES.worker('worker.js', ['initializer.js']);
    assert.equal(c.blobs.length, 1); assert.equal(c.workers.length, 1); assert.deepEqual(c.revoked, ['blob:0']);
    assert.ok(c.blobs[0].source.includes('compute.js')); assert.ok(!c.blobs[0].source.includes('UI_ONLY_SENTINEL'));
    assert.ok(!c.blobs[0].source.includes('designer.js')); assert.equal(c.blobs[0].type, 'text/javascript');
    const worker = context(); worker.run(c.blobs[0].source); assert.equal(worker.global.result, 13);
    assert.throws(() => c.global.DDN_MODULES.worker('worker.js', ['uninstalled.js']), /Missing bundled module uninstalled.js/);
});

test('single-file worker retains computation but excludes application and editor code', () => {
    const f = fixture({
        'main.js': 'import "./designer.js";globalThis.ready=true;',
        'designer.js': 'globalThis.UI_ONLY_SENTINEL=true;',
        'compute.js': 'export const value=17;',
        'standalone/src/worker-bootstrap.js': 'import{value}from"../../compute.js";globalThis.result=value;',
        'standalone/src/complete-worker-bootstrap.js': 'import{value}from"../../compute.js";globalThis.result=value+1;',
    });
    for (const edition of ['native', 'complete']) {
        const c = context(); c.run(bundle(join(f.built, 'main.js'), edition, { built: f.built, ts }));
        assert.equal(c.global.ready, true); c.global.__ddnCreateWorker();
        assert.ok(!c.blobs[0].source.includes('UI_ONLY_SENTINEL')); assert.ok(!c.blobs[0].source.includes('designer.js'));
        const worker = context(); worker.run(c.blobs[0].source); assert.equal(worker.global.result, edition === 'native' ? 17 : 18);
    }
});

test('literal local dynamic imports remain outside the static closure and execute asynchronously',async()=>{
 const f=fixture({'entry.js':'globalThis.ready=import("./feature.js").then(m=>m.answer);','feature.js':'export const answer=42;'}),graph=f.graph(['entry.js']),c=context();install(c,graph);
 assert.deepEqual(moduleClosure(graph,'entry.js'),['entry.js']);
 c.run(chunkScript(graph,graph.modules.keys(),options));
 c.global.DDN_MODULES.setImporter(id=>Promise.resolve(c.global.DDN_MODULES.require(id)));c.run(entryScript('entry.js'));assert.equal(await c.global.ready,42);
});
