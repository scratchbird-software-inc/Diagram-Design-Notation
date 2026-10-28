import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, readJSON, environment, outputPath } from '../workspace/context.mjs';

const env = environment();
const lock = readJSON(join(root, 'tooling/bootstrap/toolchain-lock.json'));
const selected = readJSON(join(root, 'tooling/bootstrap/library-lock.json'));
const offline = process.argv.includes('--offline');
if (`${process.platform}-${process.arch}` !== lock.nodePlatform) {
  throw new Error(`Bootstrap currently admits ${lock.nodePlatform}; this host needs a reviewed Node artifact pin.`);
}
const target = outputPath(join(env.DDN_BUILD_WORKAREA, 'tools/toolchain'));
const cache = outputPath(join(env.DDN_BUILD_WORKAREA, 'cache/toolchain'));
mkdirSync(target, {recursive:true}); mkdirSync(cache, {recursive:true});
for (const item of lock.packages) {
  const spec = selected.libraries.find(x=>x.package===item.package);
  if (item.package.startsWith('node-')) {
    if (item.version !== selected.node) throw new Error('Node pin differs from specification');
  } else if (!spec || item.version!==spec.version || item.integrity!==spec.integrity) {
    throw new Error(`Tool pin differs from specification: ${item.package}`);
  }
  const archive = outputPath(join(cache, `${item.package}-${item.version}.tgz`));
  if (!existsSync(archive)) {
    if (offline) throw new Error(`Offline cache miss: ${item.package}@${item.version}`);
    const url = new URL(item.tarball);
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Untrusted tool archive source');
    console.log(`Downloading ${item.package}@${item.version}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${item.package}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (`sha512-${createHash('sha512').update(data).digest('base64')}` !== item.integrity) throw new Error(`Archive integrity mismatch: ${item.package}`);
    writeFileSync(archive, data);
  }
  const actual = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
  if (actual !== item.integrity) throw new Error(`Cached archive integrity mismatch: ${item.package}`);
  const name = item.package.startsWith('node-') ? 'node' : item.package;
  const destination = outputPath(join(target, name));
  const receipt = join(destination, '.weaver-integrity');
  if (existsSync(receipt) && readFileSync(receipt,'utf8').trim()===item.integrity) continue;
  const staging = outputPath(join(target, `${name}.pending`));
  rmSync(staging,{recursive:true,force:true}); mkdirSync(staging,{recursive:true});
  const listing = spawnSync('tar',['-tzf',archive],{encoding:'utf8',env,maxBuffer:8*1024*1024});
  if (listing.status!==0) throw new Error(`Cannot inspect ${item.package}: ${listing.stderr}`);
  for (const entry of listing.stdout.trim().split('\n')) {
    if (!entry.startsWith('package/') || entry.split('/').includes('..')) throw new Error(`Unsafe archive entry: ${entry}`);
  }
  const result=spawnSync('tar',['-xzf',archive,'--strip-components=1','-C',staging],{stdio:'inherit',env});
  if(result.status!==0) throw new Error(`Cannot unpack ${item.package}`);
  writeFileSync(join(staging,'.weaver-integrity'),`${item.integrity}\n`);
  rmSync(destination,{recursive:true,force:true}); renameSync(staging,destination);
}
const node=join(target,'node/bin/node');
for (const [label,args,version] of [
 ['Node',['--version'],`v${selected.node}`],
 ['pnpm',[join(target,'pnpm/bin/pnpm.cjs'),'--version'],'10.34.7'],
 ['TypeScript',[join(target,'typescript/bin/tsc'),'--version'],'Version 5.9.3'],
]) {
 const result=spawnSync(node,args,{encoding:'utf8',env});
 if(result.status!==0 || result.stdout.trim()!==version) throw new Error(`${label} verification failed: ${result.stdout} ${result.stderr}`);
 console.log(`${label}: ${result.stdout.trim()}`);
}
console.log('Toolchain is ready under .work. This does not qualify the full BOOT01 dependency/release gate.');
