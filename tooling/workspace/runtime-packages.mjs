/** Stage declared workspace dependencies as ordinary compiled package copies. */
import {existsSync, lstatSync, mkdirSync, readFileSync, copyFileSync, rmSync} from 'node:fs';
import {join, relative, resolve, dirname, sep} from 'node:path';
import {outputPath, files, inside} from './context.mjs';

const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
function noSymlinks(root, path) {
  if (!inside(root, path)) throw Error('Runtime dependency path escapes build');
  let part = root;
  for (const component of ['', ...relative(root, path).split(sep).filter(Boolean)]) {
    if (component) part = join(part, component);
    try {if (lstatSync(part).isSymbolicLink()) throw Error('Runtime package paths cannot contain symlinks');}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}

/** Package list is the actual compile selection, never an ambient installation. */
export function stageRuntimePackages({repository, buildRoot, selected}) {
  repository = resolve(repository); buildRoot = outputPath(buildRoot, repository);
  noSymlinks(repository, buildRoot);
  const byName = new Map();
  for (const item of selected) {
    const name = item.manifest.name;
    if (!packageName.test(name) || byName.has(name)) throw Error('Invalid or duplicate runtime package name');
    const source = resolve(item.path);
    if (!inside(join(repository, 'project'), source)) throw Error('Runtime package source must belong to project');
    const built = join(buildRoot, relative(join(repository, 'project'), source));
    noSymlinks(buildRoot, built);
    byName.set(name, {...item, built});
  }
  const needed = new Set();
  for (const item of selected) {
    const dependencies = {...item.manifest.dependencies, ...item.manifest.optionalDependencies, ...item.manifest.peerDependencies};
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version !== 'string' || !version.startsWith('workspace:')) continue;
      if (!packageName.test(name) || !byName.has(name)) throw Error(`Workspace dependency is absent from compilation: ${name}`);
      if (item.manifest.name.startsWith('@ddn/') && name.startsWith('@weaver/')) throw Error('DDN runtime cannot depend on Weaver');
      needed.add(name);
    }
  }
  const directory = join(buildRoot, 'node_modules');
  noSymlinks(buildRoot, directory);
  // Materialize the full copy plan before deleting previous generated staging.
  // No symlinks, package-manager lifecycle scripts or network are involved.
  const plan = [];
  for (const name of [...needed].sort()) {
    const item = byName.get(name);
    const manifestPath = join(item.built, 'package.json');
    const builtManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (JSON.stringify(builtManifest) !== JSON.stringify(item.manifest)) throw Error(`Stale compiled package manifest: ${name}`);
    const entries = files(item.built);
    if (entries.some(path => relative(item.built, path).split(sep).includes('node_modules'))) throw Error('Compiled package contains an ambient installation');
    for (const source of entries) plan.push({source, destination: join(directory, name, relative(item.built, source))});
  }
  if (existsSync(directory)) files(directory); // Reject redirected old output before removal.
  rmSync(directory, {recursive: true, force: true});
  for (const {source, destination} of plan) {
    mkdirSync(dirname(destination), {recursive: true});
    copyFileSync(source, destination);
  }
  return [...needed].sort();
}
