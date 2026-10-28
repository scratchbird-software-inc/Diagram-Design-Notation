import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/ddn');
const { publicationScene } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/publication.js')));
const ref = id => ({ file: 'main.ddn', id });
const item = (bounds, clip) => ({ occurrence: 'bounded-child', target: ref('child'), view: ref('view'), layer: 'content', bounds, ...(clip ? { clip } : {}), transform: [1, 0, 0, 1, 0, 0], primitives: [{ kind: 'rect', bounds, paint: { fill: '#123456' } }], hitTargets: [], accessible: { role: 'graphics-symbol', label: 'Bounded child' }, evidence: 'current' });
const publication = record => ({ file: 'main.ddn', ref: ref('publication'), owner: 'publication', record });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`);
const intersection = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) }; };

for (const fit of ['contain', 'none']) {
    test(`publication ${fit} preserves a child's clip while intersecting its page`, () => {
        const content = { x: 20, y: 30, width: 1000, height: 500 }, clip = { x: 120, y: 90, width: 400, height: 160 };
        const result = publicationScene([item(content, clip)], content, publication({ page: { size: 'a4', fit, margin: { left: 30, right: 40, top: 50, bottom: 60 } } }), 'Design', '2026-10-23');
        const output = result.items[1], [scale, , , , tx, ty] = output.transform;
        const moved = { x: clip.x * scale + tx, y: clip.y * scale + ty, width: clip.width * scale, height: clip.height * scale };
        const expected = intersection(moved, { x: 30, y: 50, width: result.bounds.width - 70, height: result.bounds.height - 110 });
        assert.ok(output.clip);
        for (const key of ['x', 'y', 'width', 'height']) close(output.clip[key], expected[key]);
        assert.ok(output.clip.width < result.bounds.width - 70, 'page composition must not expose clipped child content');
    });
}
test('publication footer stays inside its reserved band with a zero bottom margin', () => {
    const content = { x: 0, y: 0, width: 600, height: 400 };
    const result = publicationScene([item(content)], content, publication({ page: { size: 'content', margin: { left: 0, right: 0, top: 0, bottom: 0 } }, footer: { runs: { left: { text: 'Visible footer', size: 12 } } } }), 'Design', '2026-10-23');
    const footer = result.items[0].primitives.flatMap(p => p.kind === 'text' ? p.runs : []).find(run => run.text === 'Visible footer');
    const contentBottom = result.items[1].clip.y + result.items[1].clip.height;
    assert.ok(footer.y - footer.style['font-size'] >= contentBottom);
    assert.ok(footer.y + footer.style['font-size'] * .25 <= result.bounds.height);
});
test('content-sized publication honors margins, background and border without a header', () => {
    const content = { x: 15, y: 25, width: 300, height: 200 };
    const result = publicationScene([item(content)], content, publication({ page: { size: 'content', margin: { left: 10, right: 20, top: 30, bottom: 40 } }, background: { color: '#abcdef' }, border: { color: '#123456', width: 2 } }), 'Design', '2026-10-23');
    assert.deepEqual(result.bounds, { x: 0, y: 0, width: 330, height: 270 });
    assert.deepEqual(result.items[1].bounds, { x: 10, y: 30, width: 300, height: 200 });
    const rectangles = result.items[0].primitives.filter(p => p.kind === 'rect');
    assert.ok(rectangles.some(p => p.paint.fill === '#abcdef'));
    assert.ok(rectangles.some(p => p.paint.stroke === '#123456' && p.paint['stroke-width'] === 2));
});

test('publication measures valid 24px header text instead of clipping it at the page edge', () => {
    const content = { x: 0, y: 0, width: 600, height: 400 };
    const result = publicationScene([item(content)], content, publication({ page: { size: 'content', margin: { left: 0, right: 0, top: 0, bottom: 0 } }, header: { runs: { left: { text: 'Large heading', size: 24 } } } }), 'Design', '2026-10-23');
    const header = result.items[0].primitives.flatMap(p => p.kind === 'text' ? p.runs : []).find(run => run.text === 'Large heading');
    assert.ok(header.y - header.style['font-size'] >= 0, 'header ascent stays on the page');
    assert.ok(header.y + header.style['font-size'] * .25 <= result.items[1].clip.y, 'content starts below header');
});

test('publication resolves view identity and local page numbering as inert text', () => {
    const content = { x: 0, y: 0, width: 600, height: 400 };
    const result = publicationScene([item(content)], content, publication({ page: { size: 'content', number_start: 7 }, footer: { runs: { left: { text: '$view_id · Page $page of $pages' } } } }), 'Design', '2026-10-23');
    const text = result.items[0].primitives.flatMap(p => p.kind === 'text' ? p.runs.map(run => run.text) : []).join(' ');
    assert.equal(text, 'view · Page 7 of 1');
});
test('wrapped publication headings reserve room for every displayed line', () => {
    const content = { x: 0, y: 0, width: 260, height: 200 };
    const result = publicationScene([item(content)], content, publication({ page: { size: 'content', margin: { left: 0, right: 0, top: 0, bottom: 0 } }, header: { runs: { left: { text: 'A detailed design heading that wraps over several readable lines', size: 24, lines: 4 } } } }), 'Design', '2026-10-23');
    const runs = result.items[0].primitives.flatMap(p => p.kind === 'text' ? p.runs : []);
    assert.ok(runs.length > 1);
    assert.ok(runs.every(run => run.y - run.style['font-size'] >= 0 && run.y + run.style['font-size'] * .25 < result.items[1].clip.y));
});

test('publication content scale changes geometry and embedding scale qualifies final text',()=>{
 const bounds={x:0,y:0,width:200,height:100},source=item(bounds);source.primitives.push({kind:'text',runs:[{text:'Readable',x:10,y:20,fontKey:'sans',style:{'font-size':16}}]});
 const page=publication({page:{size:'content',fit:'none',content_scale:2,embedding_scale:.25,minimum_text:10.67,margin:{left:0,right:0,top:0,bottom:0}}});
 const result=publicationScene([source],bounds,page,'Design','2026-10-23');assert.equal(result.items[1].transform[0],2);assert.equal(result.bounds.width,400);assert.ok(result.diagnostics.some(d=>d.code==='publication-minimum-text'));
});
test('simultaneous left and center publication runs occupy separate slots',()=>{
 const bounds={x:0,y:0,width:600,height:100},text='MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
 const result=publicationScene([item(bounds)],bounds,publication({page:{size:'content',margin:{left:0,right:0,top:0,bottom:0}},header:{runs:{left:{text,size:12,lines:4},center:{text,size:12,lines:4}}}}),'Design','2026-10-23');
 const runs=result.items[0].primitives.filter(p=>p.kind==='text').map(p=>p.runs);const leftRight=Math.max(...runs[0].map(r=>r.x+r.text.length*12*.6)),centerLeft=Math.min(...runs[1].map(r=>r.x-r.text.length*12*.6/2));assert.ok(leftRight<centerLeft);
});
