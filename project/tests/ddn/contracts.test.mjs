import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { syncContracts } from '../../ddn/tooling/sync-contracts.mjs';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const sourceDirectory = 'standard/utilities/contracts';
const packageDirectory = 'project/ddn/packages/types';
function fixture(t) {
  const area = path.join(repository, '.work/tests/ddn-contracts');
  mkdirSync(area, { recursive: true });
  const root = mkdtempSync(path.join(area, 'case-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, sourceDirectory), { recursive: true });
  for (const name of ['core.d.ts', 'scene.d.ts', 'browser.d.ts', 'modules.json']) {
    copyFileSync(path.join(repository, sourceDirectory, name), path.join(root, sourceDirectory, name));
  }
  return root;
}

test('maintained new-language ABI exactly matches the adopted contracts', () => {
  assert.deepEqual(syncContracts().differences, []);
  const packageJSON = JSON.parse(readFileSync(path.join(repository, packageDirectory, 'package.json'), 'utf8'));
  assert.equal(packageJSON.name, '@ddn/types');
  assert.equal(packageJSON.private, true);
  for (const entry of Object.values(packageJSON.exports)) assert.deepEqual(Object.keys(entry), ['types']);
});

test('sync is deterministic and check mode exposes drift without rewriting it', t => {
  const root = fixture(t);
  assert.equal(syncContracts({ root }).passed, false);
  assert.equal(existsSync(path.join(root, 'project')), false);
  assert.equal(syncContracts({ root, check: false }).passed, true);
  assert.deepEqual(syncContracts({ root, check: false }).differences, []);
  const target = path.join(root, packageDirectory, 'src/core.d.ts');
  writeFileSync(target, '// unexpected ABI change\n');
  const result = syncContracts({ root });
  assert.equal(result.passed, false);
  assert.deepEqual(result.differences, [`${packageDirectory}/src/core.d.ts`]);
  assert.equal(readFileSync(target, 'utf8'), '// unexpected ABI change\n');
});

test('sync refuses symlink redirection of maintained contract output', t => {
  const root = fixture(t);
  mkdirSync(path.join(root, 'project/ddn/packages/types'), { recursive: true });
  const other = path.join(root, 'other'); mkdirSync(other);
  symlinkSync(other, path.join(root, packageDirectory, 'src'), 'dir');
  assert.throws(() => syncContracts({ root, check: false }), /cannot use symlinks/);
  assert.equal(existsSync(path.join(other, 'core.d.ts')), false);
});

for (const config of ['tsconfig.json', 'tsconfig.headless.json']) {
  test(`type boundaries compile with ${config}`, () => {
    const work = process.env.DDN_BUILD_WORKAREA ?? path.join(repository, '.work');
    const compiler = path.join(work, 'tools/toolchain/typescript/bin/tsc');
    assert.ok(existsSync(compiler), 'Run the repository bootstrap to install the pinned TypeScript toolchain');
    const result = spawnSync(process.execPath, [compiler, '-p', path.join(repository, 'project/tests/ddn', config)], { cwd: repository, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}
