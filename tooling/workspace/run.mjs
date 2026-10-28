import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync, statSync, lstatSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { root, readJSON, environment, outputPath, files, packages, inside } from './context.mjs';

import { verifyDdnGraph } from './ddn-boundary.mjs';
import { stageRuntimePackages } from './runtime-packages.mjs';

const env = environment();
const command = process.argv[2] || 'check';
const target = join(env.DDN_BUILD_WORKAREA,'tools/toolchain');
const node = join(target,'node/bin/node');
const tsc = join(target,'typescript/bin/tsc');
const expectedNode=readJSON(join(root,'tooling/bootstrap/library-lock.json')).node;
if (!existsSync(node) || !existsSync(tsc)) {
  throw new Error('Toolchain missing. Run node tooling/bootstrap/bootstrap.mjs (or add --offline with a populated cache).');
}
if (process.execPath !== node) {
  const result=spawnSync(node,[...process.argv.slice(1)],{cwd:root,env,stdio:'inherit'});
  process.exit(result.status ?? 1);
}
if (process.versions.node !== expectedNode) throw new Error(`Expected Node ${expectedNode}, found ${process.versions.node}`);

function run(executable,args,overrides={}) {
  const result=spawnSync(executable,args,{cwd:root,env:{...env,...overrides},stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status ?? 1);
}
function copy(source,destination) {
  outputPath(destination); mkdirSync(dirname(destination),{recursive:true}); copyFileSync(source,destination);
}
function compile(scope='all',emit=false) {
  const selected=packages();
  const buildRoot=scope==='ddn' ? env.DDN_BUILD_ROOT : env.DDN_BUILD_ROOT;
  const sources=selected.flatMap(p=>files(join(p.path,'src'),p=>p.endsWith('.ts')));
  const typeTests=files(join(root,'project/tests/ddn'),p=>p.endsWith('.test.ts'));
  sources.push(...typeTests);
  if (!sources.length) throw new Error(`No TypeScript packages exist for ${scope}; no build is claimed.`);
  const aliases={};
  for(const item of scope==='ddn' ? selected : packages()) {
    for(const [subpath,entry] of Object.entries(item.manifest.exports || {})) {
      const declared=typeof entry==='string' ? entry : entry.types;
      if(typeof declared!=='string' || !subpath.startsWith('.')) continue;
      const candidates=[declared,declared.replace(/\.d\.ts$/,'.ts'),declared.replace(/\.js$/,'.ts')].map(p=>join(item.path,p));
      if(candidates.some(p=>!inside(item.path,p))) throw new Error(`Package export escapes source: ${item.manifest.name}`);
      const source=candidates.find(p=>existsSync(p));
      if(source) aliases[item.manifest.name+subpath.slice(1)]=[source];
    }
  }
  const config=outputPath(join(env.ARTIFACT_ROOT,`config/tsconfig-${scope}.json`));
  mkdirSync(dirname(config),{recursive:true});
  writeFileSync(config,JSON.stringify({extends:join(root,'tsconfig.base.json'),compilerOptions:{rootDir:join(root,'project'),outDir:buildRoot,noEmit:!emit,paths:aliases},files:sources},null,2)+'\n');
  if(scope==='ddn') {
    verifyDdnGraph({node,tsc,config,sourceRoots:selected.map(p=>join(p.path,'src')),testRoot:join(root,'project/tests/ddn'),cwd:root,env});
    for(const file of files(buildRoot)) {
      const rel=relative(buildRoot,file).replaceAll('\\','/');
      if(!rel.startsWith('ddn/') && !rel.startsWith('tests/ddn/') && !rel.startsWith('node_modules/@ddn/')) throw new Error(`Non-DDN file in standalone build output: ${rel}`);
    }
  }
  if(emit) for(const item of selected) {
    const out=outputPath(join(buildRoot,relative(join(root,'project'),item.path)));
    rmSync(out,{recursive:true,force:true});
  }
  run(node,[tsc,'-p',config]);
  if(emit) for(const item of selected) {
    const out=outputPath(join(buildRoot,relative(join(root,'project'),item.path)));
    copy(join(item.path,'package.json'),join(out,'package.json'));
    for(const asset of item.manifest.files || ['src','schemas']) {
      const source=join(item.path,asset);
      if(!inside(item.path,source)) throw new Error(`Package asset escapes source: ${item.manifest.name}`);
      if(!existsSync(source)) throw new Error(`Declared package asset is missing: ${relative(root,source)}`);
      if(lstatSync(source).isSymbolicLink()) throw new Error(`Package asset cannot be a symlink: ${relative(root,source)}`);
      const assets=statSync(source).isDirectory() ? files(source,p=>!p.endsWith('.ts') || p.endsWith('.d.ts')) : [source];
      for(const path of assets) copy(path,join(out,relative(item.path,path)));
    }
  }
  if (emit) stageRuntimePackages({repository: root, buildRoot, selected});
  console.log(`${emit?'Built':'Typechecked'} ${selected.length} package(s).`);
}
function tests(scope,buildRoot=env.DDN_BUILD_ROOT) {
  const suites=files(join(root,'project/tests'),p=>p.endsWith('.test.mjs')).filter(p=>!scope || p.includes(`/tests/${scope}/`));
  if(!suites.length) throw new Error('No tests found; refusing a vacuous pass.');
  run(node,['--test','--test-concurrency=2',...suites],{DDN_BUILD_ROOT:buildRoot});
}

switch(command) {
 case 'check':
 case 'test:contracts':
   run(node,['project/ddn/tooling/sync-contracts.mjs','--check']); compile('ddn',false); break;
 case 'typecheck': compile('ddn',false); break;
 case 'build:open': compile('ddn',true); break;
 case 'build':
 case 'build:ddn':
   compile('ddn',true); run(node,['tooling/workspace/ddn-distribution.mjs']); break;
 case 'build:ddn:website':
   compile('ddn',true);
   run(node,['tooling/workspace/ddn-distribution.mjs']);
   run(node,['tooling/website/build-symbols.mjs']);
   run('python3',['tooling/website/build-ai-reference.py']);
   run('python3',['tooling/website/build-content.py']);
   run(node,['tooling/website/build-sources.mjs']);
   run(node,['tooling/website/build-runtime.mjs']);
   run(node,['tooling/website/render-gallery.mjs'],{PLAYWRIGHT_BROWSERS_PATH:join(env.DDN_BUILD_WORKAREA,'browsers')});
   break;
 case 'test:ddn:website':
   run(node,['--test','--test-concurrency=2',...files(join(root,'project/tests/ddn/website'),p=>p.endsWith('.test.mjs')||p.endsWith('.browser.mjs'))],{PLAYWRIGHT_BROWSERS_PATH:join(env.DDN_BUILD_WORKAREA,'browsers')});
   break;
 case 'test:ddn:browser':
   compile('ddn',true);
   run(node,['tooling/workspace/ddn-distribution.mjs']);
   run(node,['--test','--test-concurrency=2',...files(join(root,'project/tests/ddn/browser'),p=>p.endsWith('.browser.mjs'))],{PLAYWRIGHT_BROWSERS_PATH:join(env.DDN_BUILD_WORKAREA,'browsers')});
   break;

 case 'test':
 case 'test:unit':
 case 'test:ddn': compile('ddn',true); tests('ddn',env.DDN_BUILD_ROOT); break;
 default: throw new Error(`Unsupported DDN command: ${command}`);
}
