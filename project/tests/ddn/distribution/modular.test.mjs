import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import {execFileSync} from 'node:child_process';
import { buildModularDistribution } from '../../../../tooling/workspace/ddn-modular.mjs';
import { collectModules, moduleClosure } from '../../../../tooling/workspace/ddn-bundle.mjs';
import { modularFixture } from './modular-fixture.mjs';
const root = fileURLToPath(new URL('../../../..', import.meta.url));
const work = process.env.DDN_BUILD_WORKAREA ?? resolve(root, '.work');
const ts = createRequire(import.meta.url)(process.env.DDN_TYPESCRIPT_PATH ?? join(work, 'tools/toolchain/typescript/lib/typescript.js'));

test('modular distribution emits every module once and records exact entry dependency sizes', () => {
    const f = modularFixture(work), manifest = buildModularDistribution({ ...f, ts });
    assert.equal(manifest.license, 'GPL-2.0-or-later');
    assert.equal(manifest.sponsor, 'https://scratchbird.ca');
    const ids = manifest.chunks.flatMap(chunk => chunk.moduleIds);
    assert.equal(ids.length, new Set(ids).size); assert.ok(ids.length<=Object.keys(f.files).length); assert.deepEqual(new Set(Object.values(manifest.sourceModules).flat().map(input=>input.id)),new Set(Object.keys(f.files)));  assert.equal(manifest.totals.modules, ids.length);
    const registered = new Set();
    for (const chunk of manifest.chunks) {
        assert.ok(chunk.dependencies.every(id => registered.has(id)), 'Chunks are ordered after their prerequisites');
        registered.add(chunk.id);
        const code = readFileSync(join(f.destination, chunk.file));
        assert.equal(chunk.rawBytes, code.length); assert.equal(chunk.gzipBytes, gzipSync(code, { level: 9 }).length);
        assert.ok(!code.includes(f.root));
        assert.match(code.toString(), /SPDX-License-Identifier: GPL-2\.0-or-later/);
    }
    for (const entry of Object.values(manifest.entries)) {
        const chunks = entry.chunks.map(id => manifest.chunks.find(chunk => chunk.id === id));
        assert.ok(chunks.some(chunk=>chunk.moduleIds.includes(entry.moduleId)));
        assert.ok(chunks.every(chunk=>chunk.dependencies.every(id=>entry.chunks.includes(id))));
        assert.equal(entry.rawBytes, chunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0));
        assert.equal(entry.moduleCount, chunks.reduce((sum, chunk) => sum + chunk.moduleIds.length, 0));
    }
    assert.ok(manifest.entries.verifier.rawBytes < manifest.totals.rawBytes);
    assert.ok(!manifest.entries['verify:charts'].chunks.some(id => manifest.chunks.find(chunk => chunk.id === id).moduleIds.includes(manifest.entries['render:charts'].moduleId)));
    for (const [alias, startup] of Object.entries(manifest.startup)) {
        const required = new Set([...manifest.entries.worker.chunks, ...manifest.entries[alias].chunks]);
        assert.deepEqual(new Set(startup.chunks), required);
        assert.equal(startup.rawBytes, manifest.loader.rawBytes + manifest.chunks.filter(chunk => required.has(chunk.id)).reduce((sum, chunk) => sum + chunk.rawBytes, 0));
    }
});

test('modular output is deterministic and unchanged content retains its cache URL across releases', () => {
    const f = modularFixture(work), first = buildModularDistribution({ ...f, ts }), second = buildModularDistribution({ ...f, ts });
    assert.deepEqual(first, second);
    const isolated=modularFixture(work);assert.deepEqual(buildModularDistribution({...isolated,ts}),first,'Checkout paths must not change emitted bytes or hashes');
    writeFileSync(join(f.built, 'shared.js'), f.files['shared.js'].replace('value=7', 'value=8'));
    const third = buildModularDistribution({ ...f, ts });
    assert.notEqual(third.releaseHash, first.releaseHash);
    const retained=third.chunks.filter(chunk=>first.chunks.some(old=>old.file===chunk.file));
    assert.ok(retained.length>0); assert.ok(retained.length<third.chunks.length);
    for(const chunk of retained)assert.deepEqual(chunk,first.chunks.find(old=>old.file===chunk.file));
    assert.equal(third.entries.worker.kind, 'worker');
    assert.equal(third.entries['verify:graphs'].kind, 'verification');
    assert.equal(third.entries['render:graphs'].kind, 'rendering');
});

test('loader deadlines are bounded and generated pages select only trusted utility aliases', () => {
    const f = modularFixture(work);
    for (const timeoutMs of [0, 99, 60001, Infinity, 1.5]) assert.throws(() => buildModularDistribution({ ...f, ts, timeoutMs }), /timeout/);
    const manifest = buildModularDistribution({ ...f, ts });
    for (const mode of ['viewer', 'designer', 'verifier']) assert.match(readFileSync(join(f.destination, mode + '.html'), 'utf8'), new RegExp('data-entry="' + mode + '"'));
    const loader = readFileSync(join(f.destination, manifest.loader.file));
    assert.equal(manifest.loader.rawBytes, loader.length);
    assert.doesNotMatch(loader.toString(), /\bfetch\(|\beval\(|new Function\(/);
});

test('portable modular downloads retain GPL and resource notices independently of Weaver', () => {
    const f = modularFixture(work);
    buildModularDistribution({...f, ts});
    const license = readFileSync(join(root, 'project/ddn/LICENSE'), 'utf8');
    const notice = readFileSync(join(root, 'project/ddn/NOTICE.md'), 'utf8');
    assert.equal(readFileSync(join(f.destination, 'LICENSE'), 'utf8'), license);
    assert.equal(readFileSync(join(f.destination, 'NOTICE.md'), 'utf8'), notice);
    for (const mode of ['viewer', 'designer', 'verifier']) {
        const html = readFileSync(join(f.destination, mode + '.html'), 'utf8');
        assert.ok(html.includes(license), 'A single HTML download retains the full licence');
        assert.match(html, /<script type="text\/plain" id="ddn-license">/);
        assert.doesNotMatch(html, /Private — authorized use only|Private License/);
    }
    for (const [name, contents] of [['ddn-fonts.js', '// optional font fixture'], ['ddn-fonts-manifest.json', '{}'], ['ddn-fonts-LICENSES.txt', 'SIL OPEN FONT LICENSE Version 1.1']])
        writeFileSync(join(f.destination, name), contents);
    const archive = join(f.root, 'ddn-modular.zip');
    execFileSync('python3', [join(root, 'tooling/website/package-modular.py'), f.destination, archive], {env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}});
    const packed = JSON.parse(execFileSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:z.read(n).decode() for n in z.namelist() if n.endswith(("LICENSE","NOTICE.md","LICENSES.txt"))}))', archive], {encoding: 'utf8', env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}}));
    assert.equal(packed['ddn-modular/LICENSE'], license);
    assert.equal(packed['ddn-modular/NOTICE.md'], notice);
    assert.equal(packed['ddn-modular/ddn-fonts-LICENSES.txt'], 'SIL OPEN FONT LICENSE Version 1.1');
});
