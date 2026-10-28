// Read-only probe of the existing distributable, not a new runtime prototype.
import fs from 'node:fs';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const repo='docs/Weaver-Specifications/reference/upstream/ddn';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../evidence/current-runtime.json');
const DDN=(await import(pathToFileURL(repo+'/notation/dist/ddn.global.js'))).default;
function source(n){
 const s=['ddn "0.5";','module "probe.plugins";','data model {'];
 for(let i=1;i<=n;i++)s.push(`object n${i} "Node ${i}" { kind: application; }`);
 for(let i=2;i<=n;i++)s.push(`relation r${i} @n${Math.floor((i-2)/2)+1} -> @n${i} { kind: flow; }`);
 s.push('}','view main { data: [@model]; layout { algorithm: tree; routing: orthogonal; } publication { size: content; fit: none; } }');
 return s.join('\n');
}
const results=[];
for(const n of [4,32]){
 const samples=[];
 for(let i=0;i<3;i++){
  const text=source(n),t0=performance.now(),ws=DDN.createWorkspace({'main.ddn':text});
  const created=performance.now();
  const first=ws.renderSync({entry:'main.ddn',view:'main'}),t1=performance.now();
  ws.renderSync({entry:'main.ddn',view:'main'});const t2=performance.now();
  ws.updateFiles({'main.ddn':text+'\n// source comment change\n'});const updated=performance.now();
  ws.renderSync({entry:'main.ddn',view:'main'});const t3=performance.now();
  samples.push({constructMs:created-t0,coldIncludingConstructMs:t1-t0,warmMs:t2-t1,commentUpdateMs:updated-t2,renderAfterCommentMs:t3-updated,svgBytes:Buffer.byteLength(first.svg)});
  ws.destroy();
 }
 const median=k=>samples.map(x=>x[k]).sort((a,b)=>a-b)[1];
 results.push({nodes:n,edges:n-1,samples,median:Object.fromEntries(['constructMs','coldIncludingConstructMs','warmMs','commentUpdateMs','renderAfterCommentMs','svgBytes'].map(k=>[k,median(k)]))});
}
const report={runtime:DDN.VERSION??'read package 0.8.0',package:JSON.parse(fs.readFileSync(repo+'/package.json','utf8')).version,node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,iterations:3,scope:'Current installed distributable; Node compute timings only. Not browser frame/DOM measurements, not comparable hardware to the committed old baseline, and not a benchmark of the proposed design.',results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.package,results:results.map(x=>({nodes:x.nodes,median:x.median}))}));
