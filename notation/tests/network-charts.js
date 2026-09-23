/* SPDX-License-Identifier: GPL-2.0-or-later. B1-024 network chart marks (chart.arc/force/edgebundle@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const HEAD=`ddn "0.5";
module "test.networkcharts";

data calls {
    object e1 "a→b" { kind: record; x_record: {"from": "a", "to": "b", "n": 30}; }
    object e2 "b→c" { kind: record; x_record: {"from": "b", "to": "c", "n": 20}; }
    object e3 "a→c" { kind: record; x_record: {"from": "a", "to": "c", "n": 10}; }
    object e4 "c→a" { kind: record; x_record: {"from": "c", "to": "a", "n": 40}; }
}

data routes {
    object r1 "p1" { kind: record; x_record: {"from": "eu.be.api", "to": "eu.be.auth", "n": 18}; }
    object r2 "p2" { kind: record; x_record: {"from": "eu.fe.web", "to": "eu.be.api", "n": 32}; }
    object r3 "p3" { kind: record; x_record: {"from": "us.be.api", "to": "us.be.store", "n": 24}; }
    object r4 "p4" { kind: record; x_record: {"from": "eu.be.api", "to": "us.be.store", "n": 12}; }
}
`;
const CALLS=['e1','e2','e3','e4'].map(i=>'@calls.'+i).join(', '),ROUTES=['r1','r2','r3','r4'].map(i=>'@routes.'+i).join(', ');
const view=(mark,ids,bindings)=>`
view ${mark} "t / ${mark}" {
    data: [@calls, @routes];
    projection { kind:chart; profile:"chart.${mark}@1"; records:[${ids}]; mark:${mark}; ${bindings} width:1000px; height:600px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const CB='x:"x_record.from"; target:"x_record.to"; y:"x_record.n";';
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(mark,ids,bindings=CB,head=HEAD){const ws=A.createWorkspace({'main.ddn':head+view(mark,ids,bindings)});return ws.renderSync({entry:'main.ddn',view:mark});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Arc: 3 nodes + 4 links; nodes ordered by total weight (a:80, c:70, b:50)',()=>{
 const r=run('arc',CALLS);
 assert.equal([...r.svg.matchAll(/<circle class="ddn-arc-node"/g)].length,3);
 assert.equal([...r.svg.matchAll(/<path class="ddn-arc-link"/g)].length,4);
 const weights=[...r.svg.matchAll(/<circle class="ddn-arc-node" data-weight="(\d+)" cx="([\d.]+)"/g)].map(m=>({w:Number(m[1]),x:Number(m[2])})).sort((p,q)=>p.x-q.x);
 assert.deepEqual(weights.map(o=>o.w),[80,70,50],'weight order on the axis');
 assert.equal(r.svg,run('arc',CALLS).svg,'deterministic');
});

test('Force: seeded layout is deterministic and matches a re-run of the kernel',()=>{
 const a=run('force',CALLS),b=run('force',CALLS);
 assert.equal(a.svg,b.svg,'deterministic fixed-seed layout');
 assert.equal([...a.svg.matchAll(/<circle class="ddn-force-node"/g)].length,3);
 assert.equal([...a.svg.matchAll(/<path class="ddn-force-link"/g)].length,4);
 const coords=[...a.svg.matchAll(/<circle class="ddn-force-node" data-weight="\d+" cx="([-\d.]+)" cy="([-\d.]+)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
 for(let i=0;i<coords.length;i++)for(let j=i+1;j<coords.length;j++)assert.ok(Math.hypot(coords[i][0]-coords[j][0],coords[i][1]-coords[j][1])>1,'nodes do not collapse to one point');
});

test('Edge bundling: links route through the LCA; eu-internal links share eu segments',()=>{
 const r=run('edgebundle',ROUTES);
 assert.equal([...r.svg.matchAll(/<path class="ddn-bundle-link"/g)].length,4);
 assert.equal([...r.svg.matchAll(/<circle class="ddn-bundle-leaf"/g)].length,5);
 const internal=r.svg.match(/<path class="ddn-bundle-link" data-value="18" d="([^"]+)"/);
 const cross=r.svg.match(/<path class="ddn-bundle-link" data-value="12" d="([^"]+)"/);
 assert.ok(internal&&cross,'links present');
 const q=d=>(d.match(/Q/g)||[]).length;
 assert.ok(q(cross[1])>q(internal[1]),'cross-region route passes more hierarchy segments ('+q(internal[1])+' vs '+q(cross[1])+')');
 assert.equal(r.svg,run('edgebundle',ROUTES).svg,'deterministic');
});

test('Network marks refuse bad bindings with coded diagnostics',()=>{
 throws(()=>run('arc',CALLS,'x:"x_record.from"; y:"x_record.n";'),'DDN-PJ030');
 throws(()=>run('force',CALLS,CB+' series:"x_record.from";'),'DDN-PJ030');
 throws(()=>run('arc',CALLS,CB+' aggregate:sum;'),'DDN-PJ031');
 const self=HEAD.replace('"to": "b", "n": 30','"to": "a", "n": 30');
 throws(()=>run('arc',CALLS,CB,self),'DDN-PJ032');
 const neg=HEAD.replace('"to": "b", "n": 30','"to": "b", "n": 0');
 throws(()=>run('force',CALLS,CB,neg),'DDN-PJ108');
 const deep=HEAD.replace('"from": "eu.be.api", "to": "eu.be.auth", "n": 18','"from": "eu.be.api.v2", "to": "eu.be.auth", "n": 18');
 throws(()=>run('edgebundle',ROUTES,CB,deep),'DDN-PJ030');
});

const passed=results.filter(t=>t.pass).length;console.log('Network charts',passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
