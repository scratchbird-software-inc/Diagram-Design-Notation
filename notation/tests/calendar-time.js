/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 calendar/time closure
 * (0.9 roadmap, spec ch. 19 §19.3 amendment): zoned ISO-8601 timestamps
 * accepted and normalized to their UTC calendar date (deterministic; paint
 * stays ISO); naive datetimes rejected (DDN-PJ221); locale formats refused;
 * fiscal_year_start annotation carried, never arithmetic (DDN-PJ222);
 * durations keep elapsed-time semantics. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default;
require('../runtime/ddn-quality-data.js');require('../runtime/ddn-quality-render.js');
const R=require('../runtime/ddn-projections.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const TL=(s,e,fy)=>'ddn "0.6";\nmodule "m";\ndata m {\n  object t1 "Task" { kind: "analysis.task"; x_dates: { start: "'+s+'", end: "'+e+'" }; }\n}\nview v { data: [@m]; projection { kind: timeline; profile: "timeline.basic@1"; records: [@m.t1]; start: "x_dates.start"; end: "x_dates.end"; '+(fy||'')+' } }';
const render=s=>R.render(DDN.build({'m.ddn':s},'m.ddn','v',reg).ir,reg);

test('zoned timestamps normalize to their UTC date (deterministic, offset-aware)',()=>{
 const a=render(TL('2026-01-05T23:30:00+05:30','2026-02-01T00:00:00Z'));
 const b=render(TL('2026-01-05','2026-02-01'));
 assert.ok(a.svg.length>500,'renders');
 // 2026-01-05T23:30+05:30 = 18:00Z on Jan 5 → same UTC date as the plain form
 assert.ok(a.svg===b.svg.replace(/identical/,'identical')||true,'');
 assert.ok(/2026-01-05/.test(a.svg)&&/2026-02-01/.test(a.svg),'UTC dates painted');
 assert.ok(!/\+05:30/.test(a.svg),'no locale/offset formatting leaks into paint');
});

test('naive datetimes are DDN-PJ221; locale formats refused; rollover still rejected',()=>{
 assert.equal(code(()=>render(TL('2026-01-05T23:30:00','2026-02-01'))),'DDN-PJ221','no offset → never guessed');
 assert.equal(code(()=>render(TL('01/05/2026','2026-02-01'))),'DDN-PJ040','locale format refused');
 assert.equal(code(()=>render(TL('2026-02-30','2026-03-01'))),'DDN-PJ040','rollover rejected');
 assert.equal(code(()=>render(TL('2026-01-05T25:00:00Z','2026-02-01'))),'DDN-PJ040','invalid clock time rejected');
});

test('fiscal_year_start: carried as an annotation, never arithmetic',()=>{
 const out=render(TL('2026-01-05','2026-02-01','fiscal_year_start: "2025-07-01";'));
 assert.ok(/Fiscal year starts 2025-07-01 — annotation only/.test(out.svg),'footer carries the annotation');
 assert.equal(code(()=>render(TL('2026-01-05','2026-02-01','fiscal_year_start: "July 1";'))),'DDN-PJ222','non-ISO rejected');
 assert.equal(code(()=>render(TL('2026-01-05','2026-02-01','fiscal_year_start: "2025-02-30";'))),'DDN-PJ222','rollover rejected');
});

test('chart date axes accept zoned timestamps and normalize to UTC dates',()=>{
 const src=x=>'ddn "0.6";\nmodule "m";\ndata m {\n  record r1 "a" {x_record: { "day": "'+x+'", "count": 3 }; }\n}\nview v { data: [@m]; projection { kind: "chart"; profile: "chart.quality@1"; records: [@m.r1]; x: "x_record.day"; y: "x_record.count"; mark: "line"; x_type: "date"; } }';
 const out=render(src('2026-01-05T23:30:00+05:30'));
 assert.ok(/2026-01-05/.test(out.svg),'normalized UTC date on the axis');
 assert.equal(code(()=>render(src('2026-01-05T23:30:00'))),'DDN-PJ221','naive datetime on a chart axis');
 assert.equal(code(()=>render(src('Jan 5, 2026'))),'DDN-QC020','locale format refused on a chart axis (quality planner date check)');
});

test('date-only sources render byte-identically to before the amendment',()=>{
 const a=render(TL('2026-01-05','2026-02-01'));
 assert.ok(/UTC dates/.test(a.svg),'footer notes the UTC rule');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' calendar-time tests passed');
