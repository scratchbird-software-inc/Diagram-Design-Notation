import { mkdirSync, realpathSync, existsSync, readdirSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && rel !== '..' && !isAbsolute(rel));
};

/** Resolve output beneath the project work area, including existing symlink ancestors. */
export function outputPath(value, base = root) {
  const path = resolve(base, value);
  const area = resolve(base, '.work');
  if (existsSync(area) && lstatSync(area).isSymbolicLink()) throw new Error('The .work directory cannot be a symlink');
  if (!inside(area, path)) throw new Error(`Output must stay beneath .work: ${value}`);
  let ancestor = path;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (!inside(base, realpathSync(ancestor))) throw new Error(`Output follows an external symlink: ${value}`);
  if (existsSync(area) && !inside(realpathSync(area), realpathSync(ancestor)) && ancestor !== base) {
    throw new Error(`Output escapes the work area through a symlink: ${value}`);
  }
  return path;
}

export function environment() {
  const workarea = outputPath(process.env.DDN_BUILD_WORKAREA || '.work');
  const artifacts = outputPath(process.env.ARTIFACT_ROOT || workarea);
  const ddnBuildRoot = outputPath(process.env.DDN_BUILD_ROOT || join(artifacts, 'builds/ddn'));
  const temp = process.env.DDN_TEMP_ROOT ? resolve(process.env.DDN_TEMP_ROOT) : outputPath(join(workarea, 'tmp'));
  if (existsSync(temp) && lstatSync(temp).isSymbolicLink()) throw new Error('Temporary directory cannot be a symlink');
  const cache = outputPath(join(workarea, 'cache'));
  for (const p of [workarea, artifacts, temp, cache]) mkdirSync(p, { recursive: true });
  return {
    ...process.env, DDN_ROOT: root, DDN_BUILD_WORKAREA: workarea, ARTIFACT_ROOT: artifacts,
    DDN_BUILD_ROOT: ddnBuildRoot, TMPDIR: temp, TMP: temp, TEMP: temp,
    XDG_CACHE_HOME: join(cache, 'xdg'), npm_config_cache: join(cache, 'npm'),
    PNPM_HOME: join(workarea, 'tools/pnpm-home'), PYTHONDONTWRITEBYTECODE: '1',
  };
}

export function files(directory, accept = () => true) {
  if (!existsSync(directory)) return [];
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`Source symlinks are not supported: ${relative(root, directory)}`);
  const result = [];
  for (const item of readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const path = join(directory, item.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Source symlinks are not supported: ${relative(root, path)}`);
    if (item.isDirectory()) result.push(...files(path, accept));
    else if (accept(path)) result.push(path);
  }
  return result;
}

export function packages() {
  return ['project/ddn/packages'].flatMap(base => {
    const directory = join(root, base);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => join(directory,x.name))
      .filter(p => existsSync(join(p,'package.json'))).map(path => ({path, manifest: readJSON(join(path,'package.json'))}));
  });
}
