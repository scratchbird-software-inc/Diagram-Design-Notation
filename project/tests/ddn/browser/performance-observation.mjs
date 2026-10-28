/** Explicit observation run; not a unit test or a hardware-independent release assertion. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const reports=process.env.DDN_BENCHMARK_REPORTS??resolve(root,'.work/reports/ddn-performance');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const font=process.env.DDN_BENCHMARK_FONT??resolve(root,'project/tests/ddn/fixtures/fonts/DejaVuSans.ttf');
await mkdir(join(reports,'assets'),{recursive:true});
const fontBytes=await readFile(font);
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
const browser=await chromium.launch({headless:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(count){
 const columns=count===4?2:8,lines=['erd Benchmark'];
 for(let i=0;i<count;i++)lines.push('    Node'+i,'        with','            style.font DDNBenchmark','            position.x '+(32+i%columns*310),'            position.y '+(64+Math.floor(i/columns)*140));
 for(let i=1;i<count;i++)lines.push(`    connect Node${i-1} to Node${i}`);
 return lines.join('\n')+'\n';
}
const workloads=[{id:'W1',nodes:4,edges:3,text:fixture(4)},{id:'W2',nodes:32,edges:31,text:fixture(32)}];
for(const workload of workloads)await writeFile(join(reports,workload.id+'.ddn'),workload.text);
const distributionHash=hash(await readFile(join(distribution,'ddn-visual-designer.html')));
const samples=[],network=[];
try{
 for(const workload of workloads)for(let contextIndex=0;contextIndex<3;contextIndex++){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  await context.addInitScript(()=>{
    window.__ddnTimings={workers:[],operations:[],longTasks:[]};
    const NativeWorker=Worker;
    window.Worker=class extends NativeWorker{
      constructor(url,options){super(url,options);this.started=performance.now();this.jobs=new Map();window.__ddnTimings.workers.push({url:String(url),at:this.started});this.addEventListener('message',event=>{if(event.data?.type!=='result')return;const job=this.jobs.get(event.data.id);if(!job)return;window.__ddnTimings.operations.push({kind:job.kind,ms:performance.now()-job.at,bootToResultMs:performance.now()-this.started});this.jobs.delete(event.data.id);});}
      postMessage(value,...args){if(value?.type==='run')this.jobs.set(value.id,{kind:value.request.kind,at:performance.now()});return super.postMessage(value,...args);}
    };
    if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>window.__ddnTimings.longTasks.push(...list.getEntries().map(entry=>({at:entry.startTime,ms:entry.duration})))).observe({entryTypes:['longtask']});
  });
  const page=await context.newPage();await page.goto(pathToFileURL(join(distribution,'ddn-visual-designer.html')).href);
  await page.locator('.app-status').filter({hasText:/ready/}).waitFor();
  await page.evaluate(async encoded=>{window.dispatchEvent(new PageTransitionEvent('pagehide'));document.body.replaceChildren();const font=new FontFace('DDNBenchmark','url(data:font/ttf;base64,'+encoded+')');await font.load();document.fonts.add(font);await document.fonts.ready;},fontBytes.toString('base64'));
  for(let index=-5;index<10;index++){
   const sample=await page.evaluate(async({text,trial})=>{
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));const element=document.createElement('div');element.style.cssText='width:1440px;height:900px';document.body.append(element);
    const timings=window.__ddnTimings;timings.operations=[];timings.longTasks=[];
    const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions());const viewer=DDN.createViewer(element,{runtime,controls:'host'});const handle=DDN.getViewerHandle(viewer);let firstPending;
    const start=performance.now();viewer.subscribe(event=>{if(event.kind==='pending'&&firstPending===undefined)firstPending=performance.now()-start;});
    const opened=await viewer.open({entry:'benchmark.ddn',files:[{id:'benchmark.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
    if(!opened.snapshot||opened.diagnostics.some(d=>d.severity==='error'))throw Error(JSON.stringify(opened.diagnostics));
    const settled=performance.now();await frame();await frame();const open=performance.now()-start;
    const openPhases=timings.operations.slice();timings.operations=[];
    const designer=DDN.createDesigner(viewer,{controls:'host',authority:{authorize:async action=>({allowed:true,principal:'benchmark',grants:[action]})}});
    const target=handle.scene().entries.find(entry=>entry.definition.record.name==='Node0').definition.ref;
    const prepareStart=performance.now();const prepared=await designer.commands.prepare({kind:'set-property',target,path:'title',value:'Edited '+trial});const prepare=performance.now()-prepareStart;if(!prepared.ok)throw Error(JSON.stringify(prepared));
    const commitStart=performance.now();const committed=await designer.commands.commit(prepared.command.id);if(!committed.ok)throw Error(JSON.stringify(committed));await handle.whenRendered();const commitSettled=performance.now()-commitStart;await frame();await frame();const edit=performance.now()-commitStart;
    const editPhases=timings.operations.slice(),pan=[];
    for(let step=0;step<10;step++){const current=handle.viewport();const before=performance.now();viewer.setViewport({...current,bounds:{...current.bounds,x:current.bounds.x+1}});pan.push(performance.now()-before);await frame();}
    const result={openMs:open,openSettledMs:settled-start,firstPendingMs:firstPending,prepareMs:prepare,editMs:edit,editSettledMs:commitSettled,panMainThreadMs:pan,openPhases,editPhases,longTasks:timings.longTasks.slice()};
    designer.destroy();viewer.destroy();runtime.destroy();element.remove();return result;
   },{text:workload.text,trial:index});
   if(index>=0)samples.push({workload:workload.id,context:contextIndex,sample:index,...sample});
  }
  await context.close();process.stdout.write(`${workload.id} context ${contextIndex+1}/3 complete\n`);
 }
 const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
 const results=workloads.map(workload=>{
  const selected=samples.filter(sample=>sample.workload===workload.id);const open=stats(selected.map(sample=>sample.openMs)),edit=stats(selected.map(sample=>sample.editMs)),pan=stats(selected.flatMap(sample=>sample.panMainThreadMs));
  return {workload:workload.id,open,edit,pan,prepare:stats(selected.map(sample=>sample.prepareMs)),workerDecode:stats(selected.flatMap(sample=>sample.openPhases.filter(phase=>phase.kind==='decode').map(phase=>phase.ms))),workerVerify:stats(selected.flatMap(sample=>sample.openPhases.filter(phase=>phase.kind==='verify').map(phase=>phase.ms))),firstPending:stats(selected.map(sample=>sample.firstPendingMs)),gates:{open:open.p95<=(workload.id==='W1'?250:1000),edit:edit.p95<=150,pan:pan.p95<=8,progress:workload.id==='W1'||selected.every(sample=>sample.firstPendingMs<=100)}};
 });
 let governor='unavailable',physicalCores=null;
 try{governor=(await readFile('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor','utf8')).trim();}catch{}
 try{const blocks=(await readFile('/proc/cpuinfo','utf8')).split('\n\n');physicalCores=new Set(blocks.filter(block=>/processor\s*:/.test(block)).map(block=>(/physical id\s*:\s*(\d+)/.exec(block)?.[1]??'0')+':'+(/core id\s*:\s*(\d+)/.exec(block)?.[1]??block))).size;}catch{}
 const report={schema:1,recordedAt:new Date().toISOString(),distributionSHA256:distributionHash,qualification:'Observations on this host only; not release qualification or a comparison with other machines.',hardware:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,physicalCores,memoryBytes:os.totalmem(),governor,thermal:'not measured',graphics:'headless Chromium; display composition not qualified'},browser:{version:browser.version(),headless:true,viewport:{width:1440,height:900},deviceScaleFactor:1},protocol:{contexts:3,measuredPerContext:10,warmupsPerContext:5,font:'DDNBenchmark',fontSHA256:hash(fontBytes),network:'HTTP(S) blocked',mode:'Production Blob-worker adapter; fresh runtime and worker for every sample; page/font warm within each fresh context',timing:'Open/commit through settled scene and two animation frames; prepare recorded separately',limitations:['No cold page-startup or first-font-load qualification.','Worker timings include serialization, transfer and worker startup as applicable; metrics/layout/routing/DOM subphases are not independently instrumented.','No lower-resource machine, thermal control, GPU/display timing, W3-W8 or full browser matrix qualification.']},fixtures:workloads.map(({text,...workload})=>({...workload,sha256:hash(text),file:workload.id+'.ddn'})),networkRequests:network,results,samples};
 await writeFile(join(reports,'W1-W2-observation.json'),JSON.stringify(report,null,2)+'\n');
 const lines=['# DDN W1/W2 browser observations','',report.qualification,'',`Chromium ${browser.version()}; ${report.hardware.cpu}; ${report.hardware.memoryBytes} bytes RAM; ${report.hardware.logicalCPUs} logical CPUs.`,`Three fresh contexts per workload, five warmups and ten measured samples per context. All HTTP(S) requests blocked; observed requests: ${network.length}.`,'','| Workload | Open p95 ms / gate | Title edit p95 ms / gate | Pan main-thread p95 ms / gate |','|---|---:|---:|---:|',...results.map(result=>`| ${result.workload} | ${result.open.p95.toFixed(2)} / ${result.gates.open?'pass':'fail'} | ${result.edit.p95.toFixed(2)} / ${result.gates.edit?'pass':'fail'} | ${result.pan.p95.toFixed(2)} / ${result.gates.pan?'pass':'fail'} |`),'','The JSON report contains all samples, fixture/font hashes, phase observations, progress gates, long tasks and qualification limits.'];
 await writeFile(join(reports,'W1-W2-observation.md'),lines.join('\n')+'\n');process.stdout.write(JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
