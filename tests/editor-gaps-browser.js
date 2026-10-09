/* SPDX-License-Identifier: GPL-2.0-or-later. Composed sections, sidecars and scrolling in the real tool. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "viewmod";data local {object a {kind:object;}} view v {data:[@local];publication {size:content;}}';
const side='';
const driver=`<script>(async()=>{
 const lines=[],errors=[],get=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));window.addEventListener('error',e=>errors.push(e.message));window.confirm=()=>true;
 const stage=()=>{const h=get('ddn-diagram');return (h?.shadowRoot||h?.firstElementChild?.shadowRoot)?.querySelector('.stage');};
 const wait=async(f,n)=>{for(let i=0;i<240;i++){if(f())return;await sleep(100);}throw Error('Timeout '+n);};
 const check=(v,n)=>{if(!v)throw Error(n);lines.push('PASS '+n);};
 try{
 await wait(()=>window.DDNTool&&stage(),'boot');
 const files={'m.ddn':${JSON.stringify(fixture)},'models/data.ddn':'ddn "0.7";module "model";data shared {object unrelated {kind:object;}}'};
 await DDNTool.setSource(files,{entry:'m.ddn',view:'v'});
 DDNTool.setDrawer('creator','open');const dest=get('ddn-create-destination');dest.value=[...dest.options].find(o=>o.textContent.includes('models/data.ddn')).value;
 get('ddn-add-element').click();get('ddn-ae-id').value='created';get('ddn-ae-name').value='Created';get('ddn-ae-create').click();
 await wait(()=>stage()?.querySelectorAll('.ddn-node').length===2,'created appearance');
 check(DDNTool.getSource().files['models/data.ddn'].includes('object created'),'definition is in chosen model file');
 check(!stage().textContent.includes('unrelated'),'unrelated destination objects stay hidden');get('ddn-undo').click();await wait(()=>stage()?.querySelectorAll('.ddn-node').length===1,'undo');check(JSON.stringify(DDNTool.getSource().files)===JSON.stringify(files),'one undo restores both files');
 stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));DDNTool.setDrawer('style','open');
 const target=document.querySelector('[aria-label="Sizing target"]');target.value=[...target.options].find(o=>o.value.startsWith('def:')).value;target.dispatchEvent(new Event('change'));
 let width=document.querySelector('[aria-label="element Max text width (px)"]');width.value='320';width.dispatchEvent(new Event('change'));
 await wait(()=>DDNTool.getSource().files['m.ddn'].includes('max_width: 320px'),'definition sizing');
 check(!DDNTool.getSource().files['m.ddn'].includes('place @'),'definition sizing is shared source');
 target.value=[...target.options].find(o=>o.value.startsWith('el:')).value;target.dispatchEvent(new Event('change'));width=document.querySelector('[aria-label="element Max text width (px)"]');check(width.value==='','appearance displays inheritance when unset');width.value='250';width.dispatchEvent(new Event('change'));
 await wait(()=>DDNTool.getSource().files['m.ddn'].includes('place @'),'appearance sizing');check(document.querySelector('[aria-label="element Max text width (px)"]').value==='250','appearance sizing reads its own override');
 const tableSource='ddn "0.7";module "cols";data d {object a {kind:table;fields {f "A very long field" {datatype:"int";}}}}view v {data:[@d];publication {size:content;}}';
 await DDNTool.setSource({'m.ddn':tableSource},{entry:'m.ddn',view:'v'});stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
 const mode=document.querySelector('[aria-label="Field column mode"]');mode.value='custom';mode.dispatchEvent(new Event('change'));const colWidth=document.querySelector('[aria-label="Column 1 width"]');colWidth.value='30%';colWidth.dispatchEvent(new Event('change'));
 [...document.querySelectorAll('#ddn-inspector-tab-meaning button')].find(b=>b.textContent==='Apply columns').click();await wait(()=>DDNTool.getSource().files['m.ddn'].includes('width: 30%'),'column spreadsheet apply');await wait(()=>stage()?.querySelector('.ddn-columns'),'column rendered');check(true,'column layout renders after spreadsheet edit');
 stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));const wrapping=document.querySelector('[aria-label="Field A very long field wrapping"]');wrapping.value='on';wrapping.dispatchEvent(new Event('change'));await wait(()=>DDNTool.getSource().files['m.ddn'].includes('text_wrap:'),'field wrapping');check(DDNTool.getSource().files['m.ddn'].includes('text_wrap: "on"'),'field wrapping writes source');
 stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));const dtype=document.querySelector('[aria-label="Field f datatype"]');dtype.value='varchar';dtype.dispatchEvent(new Event('change'));[...document.querySelectorAll('#ddn-inspector-tab-meaning button')].find(b=>b.textContent==='Apply field values').click();await wait(()=>DDNTool.getSource().files['m.ddn'].includes('varchar'),'cell edit');check(true,'field spreadsheet edits cell values');
 stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));get('ddn-create-rules').click();await wait(()=>Object.keys(DDNTool.getSource().files).some(f=>f.endsWith('.ddna')),'new rule companion');check(!get('ddn-rule-editor').hidden,'new companion opens visual rules');const ruleBody=document.querySelector('[aria-label="Expression 1 body"]');ruleBody.value='42';ruleBody.dispatchEvent(new Event('change'));[...document.querySelectorAll('#ddn-rule-editor button')].find(b=>b.textContent==='Save rules').click();await wait(()=>Object.entries(DDNTool.getSource().files).some(([f,t])=>f.endsWith('.ddna')&&t.includes('42')),'rule saved');check(true,'rule editor saves validated L0 expression');get('ddn-undo').click();await wait(()=>Object.entries(DDNTool.getSource().files).some(([f,t])=>f.endsWith('.ddna')&&!t.includes('42')),'undo rules');get('ddn-undo').click();await wait(()=>!Object.keys(DDNTool.getSource().files).some(f=>f.endsWith('.ddna')),'undo companion');check(true,'rule companion and association creation undo together');stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
 const rename=document.querySelector('[aria-label="Definition identifier"]');rename.value='renamed';[...document.querySelectorAll('#ddn-inspector-tab-meaning button')].find(b=>b.textContent==='Rename identifier').click();await wait(()=>DDNTool.getSource().files['m.ddn'].includes('object renamed'),'rename definition');check(true,'identifier editor renames shared definition');
 const comparisonSource='ddn "0.7";module "compare";data d {object a {kind:object;}}view before {data:[@d];publication {size:content;}}view after {data:[@d];place @d.a {opacity:0.5;}publication {size:content;}}';
 await DDNTool.setSource({'m.ddn':comparisonSource},{entry:'m.ddn',view:'before'});get('ddn-diff-refresh').click();get('ddn-diff-scope').value='appearance';get('ddn-diff-create').click();await wait(()=>DDNTool.state.entry==='comparison.ddn'&&stage()?.querySelector('.ddn-node'),'comparison created');check(DDNTool.getSource().files['comparison.ddn'].includes('diff_scope: appearance'),'comparison UI saves appearance scope');get('ddn-undo').click();await wait(()=>!DDNTool.getSource().files['comparison.ddn']&&DDNTool.state.entry==='m.ddn','comparison undo');check(true,'comparison undo removes file and returns to a surviving view');
 get('ddn-tile-width').value='128';get('ddn-tile-height').value='256';get('ddn-tile-save').click();await wait(()=>DDNTool.getSource().files['m.ddn'].includes('tiles:'),'saved tiles');const tiled=DDNTool.exportTiles();check(tiled.publication.pages.length>0&&Object.keys(tiled.files).includes('publication.json'),'client-side tile export includes manifest');for(const page of tiled.publication.pages){const xml=new DOMParser().parseFromString(tiled.files[page.file],'image/svg+xml');check(!xml.querySelector('parsererror'),'tile '+page.index+' is valid SVG XML');}

 const timelineSource='ddn "0.7";module "time";data d {object t {kind:object;x_record:{start:"2026-10-09",end:"2026-10-13"};}}view v {data:[@d];projection {kind:timeline;profile:"timeline.basic@1";records:[@d.t];start:"x_record.start";end:"x_record.end";}publication {size:content;}}';
 await DDNTool.setSource({'m.ddn':timelineSource},{entry:'m.ddn',view:'v'});DDNTool.setDrawer('typesheet','open');const tz=document.querySelector('[aria-label="Timeline timezone"]');tz.value='America/Toronto';document.querySelector('[aria-label="Timeline calendar"]').value='business';document.querySelector('[aria-label="Calendar holidays"]').value='2026-10-12';[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply calendar').click();await wait(()=>DDNTool.getSource().files['m.ddn'].includes('America/Toronto'),'calendar saved');check(true,'calendar controls write explicit local settings');const move=document.querySelector('[aria-label="Move t schedule"]');move.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(()=>DDNTool.getSource().files['m.ddn'].includes('2026-10-14'),'timeline schedule shift');check(DDNTool.getSource().files['m.ddn'].includes('2026-10-10'),'timeline shift changes both endpoints atomically');get('ddn-undo').click();await wait(()=>!DDNTool.getSource().files['m.ddn'].includes('2026-10-14'),'timeline shift undo');
 await sleep(150);const dragbar=document.querySelector('[aria-label="Move t schedule"]'),dx=dragbar.parentElement.getBoundingClientRect().width/4,original=DDNTool.getSource().files['m.ddn'];
 const pointer=(type,x)=>dragbar.dispatchEvent(new PointerEvent(type,{pointerId:7,button:0,clientX:x,bubbles:true}));pointer('pointerdown',10);pointer('pointermove',10+dx);pointer('pointercancel',10+dx);check(DDNTool.getSource().files['m.ddn']===original,'cancelled timeline drag preserves source');
 pointer('pointerdown',10);pointer('pointermove',10+dx);pointer('pointerup',10+dx);await wait(()=>DDNTool.getSource().files['m.ddn'].includes('2026-10-14'),'timeline pointer shift');check(DDNTool.getSource().files['m.ddn'].includes('2026-10-10'),'pointer drag changes both endpoints');get('ddn-undo').click();await wait(()=>DDNTool.getSource().files['m.ddn']===original,'timeline pointer undo');

 const noteSource='ddn "0.7";module "notes";data d {object a {kind:object;document {file:"body.ddnn";id:"body";}}}view v {data:[@d];publication {size:content;}}',note=JSON.stringify({format:'ddnn@1',documents:{body:{format:'plain',text:'Loaded through browser host'}}});let calls=0;
 DDNTool.setDocumentLoader(async({path,signal})=>{check(path==='body.ddnn'&&!signal.aborted,'host receives workspace path and live signal');calls++;return note;});
 await DDNTool.setSource({'m.ddn':noteSource},{entry:'m.ddn',view:'v'});check(calls===1&&DDNTool.getSource().files['body.ddnn']===note,'host-loaded notes persist for export');check(stage().textContent.includes('Loaded through browser host'),'host-loaded notes render');
 const before=JSON.stringify(DDNTool.getSource().files);DDNTool.setDocumentLoader(()=>'{invalid');let rejected=false;try{await DDNTool.setSource({'m.ddn':noteSource},{entry:'m.ddn',view:'v'});}catch{rejected=true;}check(rejected&&JSON.stringify(DDNTool.getSource().files)===before,'failed host load retains current workspace');
 DDNTool.setDocumentLoader(()=>new Promise(()=>{}));const pending=DDNTool.setSource({'m.ddn':noteSource},{entry:'m.ddn',view:'v'}).then(()=>false,e=>e.code==='DDN-T109');DDNTool.setDocumentLoader(null);check(await pending,'host loading cancels without waiting for callback');
 check(errors.length===0,'no browser errors: '+errors.join('; '));await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
 }catch(e){lines.push('FAIL '+e.message);await fetch('/result',{method:'POST',body:JSON.stringify({pass:false,lines})});}
})();</script>`;
let resolveResult;const hanging=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/fixtures/m.ddn'||url.pathname==='/fixtures/project.ddnn'){res.end(url.pathname.endsWith('m.ddn')?fixture:side);return;}
 if(url.pathname==='/hang'){hanging.push(res);return;}
 if(url.pathname==='/result'){let text='';req.on('data',x=>text+=x);req.on('end',()=>{res.end();for(const h of hanging.splice(0))h.end();resolveResult(JSON.parse(text));});return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return;}
 let bytes=fs.readFileSync(file);if(file.endsWith('notation/tool/ddn-tool.html'))bytes=Buffer.from(bytes.toString().replace('</body>',()=>driver+'<img src="/hang" hidden>\n</body>'));
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(bytes);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const worker of ['off','on']){
  let timer;const result=new Promise((resolve,reject)=>{resolveResult=resolve;timer=setTimeout(()=>reject(new Error('Browser report timeout')),90000);});
  const chrome=cp.spawn(bin,['--headless','--no-sandbox','--disable-gpu','--window-size=1500,950','--dump-dom',`http://127.0.0.1:${server.address().port}/notation/tool/ddn-tool.html?mode=design&worker=${worker}&src=../../fixtures/m.ddn`],{stdio:'ignore'});
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'editor gaps test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Editor gaps browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
