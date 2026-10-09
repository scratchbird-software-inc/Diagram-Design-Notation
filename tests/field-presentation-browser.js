/* SPDX-License-Identifier: GPL-2.0-or-later. Exercise the shipped browser SDK,
 * actual SVG text nodes, cell clips and accessible full values in Chromium. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{findBrowser}=require('./browser');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ddn-field-browser-'));
const source=`ddn "0.6"; module "browser.fields";
data m { object customer "Customer records" { kind: table;
 columns { name {width: 35%;} datatype {width: 25%;} notes {path: "description"; width: equal;} }
 fields { id "Customer identifier" {datatype: integer; description: "Primary identifier for the customer";}
 name "Customer display name" {datatype: varchar; description: "Unicode display name with an intentionally long explanation that must clip";} }
 description: "Full field values remain accessible when the table cells clip.";
} }
view v {data: [@m]; place @m.customer {size: [600px, 200px];} publication {size: content;} }`;
const html=`<!doctype html><meta charset="utf-8"><style>body{font-family:sans-serif}svg{max-width:100%}</style>
<script src="${pathToFileURL(path.join(root,'notation/dist/ddn.global.js'))}"></script><main id="drawing"></main><pre id="result">pending</pre>
<script>
try {
 const source=${JSON.stringify(source)};
 const ws=DDNLive.createWorkspace({'m.ddn':source});const r=ws.renderSync({entry:'m.ddn',view:'v'});
 document.getElementById('drawing').innerHTML=r.svg;
 const rows=[...document.querySelectorAll('.ddn-column-row')];
 const checks={rows:rows.length===2,completeName:[...rows[0].querySelectorAll('text')].some(t=>t.textContent==='Customer identifier'),
 clipped:[...rows[1].querySelectorAll('text')].some(t=>t.textContent.endsWith('…')),
 accessible:[...rows[1].querySelectorAll('title')].some(t=>t.textContent.includes('intentionally long explanation')),
 clipReferences:[...document.querySelectorAll('[clip-path]')].every(e=>!!document.getElementById(e.getAttribute('clip-path').slice(5,-1))),
 finiteText:[...document.querySelectorAll('.ddn-columns text')].every(e=>{const b=e.getBBox();return Number.isFinite(b.width)&&b.height>0}),
 deterministic:ws.renderSync({entry:'m.ddn',view:'v'}).svg===r.svg,
 sourceUnchanged:ws.getFiles()['m.ddn']===source};
 document.getElementById('result').textContent=JSON.stringify(checks);
}catch(e){document.getElementById('result').textContent=JSON.stringify({error:e.message});}
</script>`;
try{
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,html);
 const args=['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=1000','--window-size=1000,650','--dump-dom'];
 if(process.env.DDN_FIELD_SCREENSHOT)args.push('--screenshot='+process.env.DDN_FIELD_SCREENSHOT);
 args.push(pathToFileURL(file).href);
 const output=cp.execFileSync(findBrowser(),args,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 const found=output.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(found,'browser returned results');
 const result=JSON.parse(found[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
 assert.ok(!result.error,result.error);for(const [name,ok]of Object.entries(result)){assert.equal(ok,true,name);console.log('PASS browser field '+name);}
 console.log('Browser field presentation '+Object.keys(result).length+'/'+Object.keys(result).length);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
