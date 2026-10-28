import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const build=process.env.DDN_BUILD_ROOT||resolve('.work/builds/ddn');
const {normalizeTexture,textureBackground}=await import(pathToFileURL(resolve(build,'ddn/packages/viewer/src/texture.js')));
const {decoratePaper}=await import(pathToFileURL(resolve(build,'ddn/packages/presentation/src/stationery.js')));
const tile=(value,fill)=>decodeURIComponent(textureBackground(value,fill).image.slice('url("data:image/svg+xml,'.length,-2));
const rect={kind:'rect',bounds:{x:0,y:0,width:240,height:160},paint:{fill:'#fff2ab',stroke:'#123456'}};
function fixture(primitive=rect,paper='plain'){
 const bounds={x:0,y:0,width:240,height:160};
 return {definition:{owner:'definition',record:{category:'element'}},effective:{style:{paper},background:{texture:{kind:'paper',seed:42}}},item:{bounds,clip:{x:0,y:0,width:200,height:150},layer:'content',transform:[1,0,0,1,0,0],hitTargets:[{bounds}],primitives:[primitive,{kind:'text',runs:[{text:'Kept content'}]}]}};
}

test('texture defaults and deterministic seeds produce bounded self-contained vector tiles',()=>{
 assert.deepEqual(normalizeTexture({}),{kind:'paper',color:'#725d43',opacity:.12,scale:32,seed:1});
 for(const value of [null,undefined,[],'paper',{kind:'script'}])assert.equal(textureBackground(value),undefined);
 const options={kind:'paper',seed:42,color:'#9b7952',scale:32};
 assert.equal(tile(options),tile(options));assert.notEqual(tile(options),tile({...options,seed:43}));
 for(const kind of ['paper','linen','grid','dots']){
  const svg=tile({...options,kind},'#fff2ab');assert.match(svg,/<svg /);assert.match(svg,/fill="#fff2ab"/);assert.match(svg,/#9b7952/);
  assert.doesNotMatch(svg,/<(?:filter|script|image|foreignObject)|href=|url\(/);assert.ok(svg.length<12000);
 }
 assert.equal(textureBackground(options).size,'32px 32px');
 assert.match(tile({color:'<script>',opacity:Infinity,scale:Infinity,seed:Infinity},'<svg>'),/fill="transparent"/);
 assert.doesNotMatch(tile({color:'transparent'}),/stroke=/);assert.doesNotMatch(tile({opacity:0}),/stroke=/);
 assert.match(tile({color:'#12345680'},'transparent'),/#12345680/);
});

test('texture marks only the original outer surface and preserves semantic geometry, clips and content',()=>{
 for(const primitive of [rect,{kind:'ellipse',bounds:rect.bounds,paint:rect.paint},{kind:'path',d:'M0 80L120 0L240 80L120 160Z',paint:rect.paint}]){
  const input=fixture(primitive),before=structuredClone(input),output=decoratePaper(input);
  assert.deepEqual(input,before);assert.deepEqual(output.item.bounds,input.item.bounds);assert.equal(output.item.clip,input.item.clip);assert.equal(output.item.hitTargets,input.item.hitTargets);assert.equal(output.item.primitives[1],input.item.primitives[1]);
  assert.deepEqual(output.item.primitives[0],{...primitive,paint:{...primitive.paint,'ddn-texture':{kind:'paper',seed:42}}});
  assert.equal(decoratePaper(output),output);
 }
 const handdrawn=fixture({kind:'path',d:'M1 1L239 0L240 159L0 160Z',paint:rect.paint},'pad');handdrawn.effective.style.look='handdrawn';
 const output=decoratePaper(handdrawn),textured=output.item.primitives.filter(p=>p.paint?.['ddn-texture']);assert.equal(textured.length,1);assert.equal(textured[0].d,handdrawn.item.primitives[0].d);
 const relation=fixture();relation.definition.record.category='relation';assert.equal(decoratePaper(relation),relation);
 const data=fixture();data.definition.owner='view';assert.equal(decoratePaper(data),data);
});
