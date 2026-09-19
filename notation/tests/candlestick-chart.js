/* SPDX-License-Identifier: GPL-2.0-or-later. Candlestick/OHLC chart mark (chart.candlestick@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.candlestick";

data trading {
    object d1 "Session 2026-03-02" { kind: record; x_record: {"day": "2026-03-02", "open": 50, "high": 52, "low": 49, "close": 51.5, "unit": "CAD"}; }
    object d2 "Session 2026-03-03" { kind: record; x_record: {"day": "2026-03-03", "open": 51.5, "high": 53, "low": 50.5, "close": 50.75, "unit": "CAD"}; }
    object d3 "Session 2026-03-04" { kind: record; x_record: {"day": "2026-03-04", "open": 50.75, "high": 52.5, "low": 50, "close": 52.25, "unit": "CAD"}; }
    object d4 "Session 2026-03-05" { kind: record; x_record: {"day": "2026-03-05", "open": 52.25, "high": 54, "low": 51.75, "close": 53.5, "unit": "CAD"}; }
    object d5 "Session 2026-03-06" { kind: record; x_record: {"day": "2026-03-06", "open": 53.5, "high": 54.25, "low": 52, "close": 52.5, "unit": "CAD"}; }
    object d6 "Session 2026-03-09" { kind: record; x_record: {"day": "2026-03-09", "open": 52.5, "high": 55, "low": 52.25, "close": 54.75, "unit": "CAD"}; }
    object d7 "Session 2026-03-10" { kind: record; x_record: {"day": "2026-03-10", "open": 54.75, "high": 56.5, "low": 54, "close": 55.5, "unit": "CAD"}; }
    object d8 "Session 2026-03-11" { kind: record; x_record: {"day": "2026-03-11", "open": 55.5, "high": 57, "low": 54.5, "close": 55, "unit": "CAD"}; }
}

view candlestick "Synthetic trading sessions / candlestick" {
    data: [@trading];
    projection { kind:chart; profile:"chart.candlestick@1"; records:[@trading.d1, @trading.d2, @trading.d3, @trading.d4, @trading.d5, @trading.d6, @trading.d7, @trading.d8]; mark:candlestick; x:"x_record.day"; x_type:date; open:"x_record.open"; high:"x_record.high"; low:"x_record.low"; close:"x_record.close"; unit:"CAD"; width:1120px; height:620px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const OHLC=[[50,52,49,51.5],[51.5,53,50.5,50.75],[50.75,52.5,50,52.25],[52.25,54,51.75,53.5],[53.5,54.25,52,52.5],[52.5,55,52.25,54.75],[54.75,56.5,54,55.5],[55.5,57,54.5,55]];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'candlestick',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Candlestick renders 8 candle marks, each with a wick path and body rect, plus 8 date tick labels',()=>{
 const r=run();
 assert.equal(r.scene.marks.length,8,'scene.marks.length');
 assert.equal([...r.svg.matchAll(/<path class="ddn-candle-wick"/g)].length,8,'8 wick paths');
 assert.equal([...r.svg.matchAll(/<rect class="ddn-candle-body"/g)].length,8,'8 body rects');
 assert.equal([...r.svg.matchAll(/>2026-03-\d{2}<\/text>/g)].length,8,'8 date tick labels');
});

test('Geometry: wick spans fy(low)..fy(high) and body spans fy(max(o,c))..fy(min(o,c))',()=>{
 const r=run(),wicks=[...r.svg.matchAll(/<path class="ddn-candle-wick"[^>]* d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)"/g)],bodies=[...r.svg.matchAll(/<rect class="ddn-candle-body"[^>]* x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)];
 assert.equal(wicks.length,8);assert.equal(bodies.length,8);
 r.scene.marks.forEach((m,i)=>{
  const fy=v=>m.y+(m.high-v)/(m.high-m.low)*m.h; // linear map recomputed from the mark's own low/high box
  const [,wx,wy1,wx2,wy2]=wicks[i].map(Number);
  assert.ok(Math.abs(wy1-fy(m.high))<=0.5&&Math.abs(wy2-fy(m.low))<=0.5,'wick '+i+' spans fy(high)..fy(low)');
  assert.ok(Math.abs(wx-wx2)<=0.5,'wick '+i+' vertical');
  const [,bx,by,bw,bh]=bodies[i].map(Number);
  assert.ok(Math.abs(by-fy(Math.max(m.open,m.close)))<=0.5,'body '+i+' top = fy(max(o,c))');
  assert.ok(Math.abs(by+bh-fy(Math.min(m.open,m.close)))<=0.5,'body '+i+' bottom = fy(min(o,c))');
  assert.ok(Math.abs(bx+bw/2-wx)<=0.5,'body '+i+' centred on wick');
 });
});

test('Direction colours: close >= open uses the up colour, close < open the down colour (5 up / 3 down)',()=>{
 const r=run(),bodies=[...r.svg.matchAll(/<rect class="ddn-candle-body"[^>]* fill="(#[0-9A-Fa-f]{6})"/g)].map(m=>m[1]);
 assert.equal(bodies.length,8);
 const ups=r.scene.marks.map((m,i)=>m.close>=m.open?bodies[i]:null).filter(Boolean),downs=r.scene.marks.map((m,i)=>m.close<m.open?bodies[i]:null).filter(Boolean);
 assert.equal(ups.length,5,'5 up candles');assert.equal(downs.length,3,'3 down candles');
 assert.ok(ups.every(c=>c===ups[0]),'one up colour');assert.ok(downs.every(c=>c===downs[0]),'one down colour');
 assert.notEqual(ups[0],downs[0],'up and down colours differ');
});

test('Mark boxes carry open/high/low/close values identical to the fixture data',()=>{
 const r=run();
 r.scene.marks.forEach((m,i)=>{const[o,h,l,c]=OHLC[i];assert.deepEqual([m.open,m.high,m.low,m.close],[o,h,l,c],'mark '+i);});
});

test('Missing or non-numeric high rejected as DDN-PJ076',()=>{
 throws(()=>run(edit('"high": 52,','"peak": 52,')),'DDN-PJ076');
 throws(()=>run(edit('"high": 52,','"high": "51",')),'DDN-PJ076');
});

test('Inverted or out-of-range OHLC rejected as DDN-PJ077',()=>{
 throws(()=>run(edit('"high": 52,','"high": 48.5,')),'DDN-PJ077');
 throws(()=>run(edit('"open": 50,','"open": 58,')),'DDN-PJ077');
 throws(()=>run(edit('"close": 51.5,','"close": 48,')),'DDN-PJ077');
});

test('Duplicate day, aggregation, series and numeric x rejected',()=>{
 throws(()=>run(edit('"day": "2026-03-11"','"day": "2026-03-10"')),'DDN-PJ036');
 throws(()=>run(edit('mark:candlestick;','mark:candlestick; aggregate:mean;')),'DDN-PJ031');
 throws(()=>run(edit('mark:candlestick;','mark:candlestick; series:"x_record.day";')),'DDN-PJ030');
 throws(()=>run(edit('x_type:date;','x_type:number;')),'DDN-PJ030');
});

test('Vega-Lite adapter rejects candlestick explicitly',()=>throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'candlestick'}),'DDN-PJ070'));

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Profile registered in the published catalogue; chart.basic@1 still lists candlestick as unsupported',()=>{
 assert.ok(A.profileCatalogue.profiles.some(x=>x.id==='chart.candlestick@1'));
 assert.ok(A.profileCatalogue.profiles.find(x=>x.id==='chart.basic@1').unsupported.includes('candlestick'),'chart.basic@1 unchanged');
});

const report={runtime:A.VERSION,scope:'Candlestick/OHLC chart mark chart.candlestick@1; native SVG wick+body candles coloured by direction over category/date x; negative and determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/candlestick-chart-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Candlestick chart',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
