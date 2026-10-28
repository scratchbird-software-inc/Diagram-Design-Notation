import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const sourceDirectory = 'standard/utilities/contracts';
const packageDirectory = 'project/ddn/packages/types';
const declarations = ['core.d.ts', 'scene.d.ts', 'browser.d.ts'];
const index = "export type * from './core.js';\nexport type * from './scene.js';\n";
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function localPath(root, relative) {
  const target = path.resolve(root, relative);
  if (path.relative(root, target).startsWith('..') || path.isAbsolute(relative)) throw new Error(`Invalid contract path: ${relative}`);
  for (let ancestor = target; ancestor !== root; ancestor = path.dirname(ancestor)) {
    if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink()) throw new Error(`Contract paths cannot use symlinks: ${relative}`);
  }
  return target;
}

/** Copy only the adopted declarations; --check never mutates maintained files. */
export function syncContracts({ root = repository, check = true } = {}) {
  root = realpathSync(root);
  const identitySource = `${sourceDirectory}/modules.json`;
  const identityBytes = readFileSync(localPath(root, identitySource));
  const modules = JSON.parse(identityBytes.toString('utf8'));
  const expected = new Map();
  const files = declarations.map(name => {
    const source = `${sourceDirectory}/${name}`;
    const target = `${packageDirectory}/src/${name}`;
    const bytes = readFileSync(localPath(root, source));
    expected.set(target, bytes);
    return { source, target, sha256: digest(bytes) };
  });
  const indexTarget = `${packageDirectory}/src/index.d.ts`;
  expected.set(indexTarget, Buffer.from(index));
  const manifest = {
    format: 1,
    specification: 'WIS1.1',
    api: modules.api,
    language: modules.language,
    identitySource: { source: identitySource, sha256: digest(identityBytes) },
    scope: 'Declaration-only DDN utility ABI. No parser, renderer or factory implementation is included.',
    files,
    entry: { target: indexTarget, sha256: digest(index), scope: 'Core and scene types without DOM dependencies; browser types use the separate browser subpath.' },
  };
  expected.set(`${packageDirectory}/contract-manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  const differences = [];
  for (const [relative, bytes] of expected) {
    const target = localPath(root, relative);
    if (!existsSync(target) || !readFileSync(target).equals(bytes)) {
      differences.push(relative);
      if (!check) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, bytes);
      }
    }
  }
  return { passed: !check || differences.length === 0, mode: check ? 'check' : 'write', declarations: declarations.length, differences };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--check';
  if (!['--check', '--write'].includes(mode) || process.argv.length > 3) {
    console.error('Usage: node project/ddn/tooling/sync-contracts.mjs --check|--write');
    process.exitCode = 2;
  } else {
    try {
      const result = syncContracts({ check: mode === '--check' });
      console.log(JSON.stringify(result));
      if (!result.passed) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
