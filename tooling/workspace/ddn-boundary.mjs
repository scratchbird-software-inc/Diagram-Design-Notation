import { spawnSync } from 'node:child_process';
import { realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, basename, isAbsolute } from 'node:path';
import { inside } from './context.mjs';

/** Inspect the compiler's resolved graph, including imports and declaration references. */
export function verifyDdnGraph({ node, tsc, config, sourceRoots, testRoot, cwd, env }) {
  const result=spawnSync(node,[tsc,'-p',config,'--noEmit','--listFilesOnly','--pretty','false','--allowJs','--resolveJsonModule'],{
    cwd,env,encoding:'utf8',maxBuffer:16*1024*1024,
  });
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`Cannot inspect standalone DDN dependency graph:\n${result.stdout}${result.stderr}`);
  const allowed=[...sourceRoots,testRoot].filter(existsSync).map(p=>realpathSync(p));
  const libraries=realpathSync(resolve(dirname(tsc),'../lib'));
  const graph=result.stdout.split(/\r?\n/).filter(Boolean);
  if(!graph.length) throw new Error('Standalone DDN dependency graph is empty');
  for(const file of graph) {
    if(!isAbsolute(file) || !existsSync(file)) throw new Error(`Unexpected compiler file listing: ${file}`);
    const physical=realpathSync(file);
    const standardLibrary=dirname(physical)===libraries && /^lib(?:\..+)?\.d\.ts$/.test(basename(physical));
    if(!standardLibrary && !allowed.some(area=>inside(area,physical))) {
      throw new Error(`DDN dependency boundary violation: ${file}`);
    }
  }
  return graph;
}
