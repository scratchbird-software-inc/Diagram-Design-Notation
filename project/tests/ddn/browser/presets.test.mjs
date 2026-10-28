import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const {parsePresetPack,serializePresetPack,mergePresetPacks,standardPresets,readLocalPresets,writeLocalPresets}=await import(pathToFileURL(join(root,'.work/builds/ddn/ddn/packages/designer/src/presets.js')));
const preset={id:'company-paper',name:'Company letter paper',scope:'company',target:'view',profile:'ddn@1',properties:{'background.color':'#fff8ea','background.texture':{kind:'paper',scale:24,seed:17},'style.font':'Inter'}};
test('portable company/user presets round trip only declared appearance properties',()=>{
 const text=serializePresetPack([preset]),parsed=parsePresetPack(text);assert.deepEqual(parsed.presets,[preset]);parsed.presets[0].properties['background.color']='#000';assert.equal(preset.properties['background.color'],'#fff8ea');
 const combined=mergePresetPacks([preset],[{...preset,id:'personal-copy',scope:'user'}]);assert.equal(combined.length,2);assert.equal(combined[0].scope,'company');
 assert.throws(()=>mergePresetPacks([preset],[preset]),/already exists/);
});
test('preset imports reject semantic, executable, oversized and invalid data atomically',()=>{
 const input=properties=>JSON.stringify({format:'ddn-appearance-presets',version:1,presets:[{...preset,properties}]});
 for(const value of [{'design.state':'accepted'},{'background.image':'https://evil.invalid/image'},{'background.texture':{kind:'paper',scale:999}},{'style.font_size':-1},{'background.color':'url(https://evil.invalid/)'}])assert.throws(()=>parsePresetPack(input(value)));
 assert.throws(()=>parsePresetPack(' '.repeat(262145)),/limited/);
 assert.throws(()=>serializePresetPack([{...preset,id:'standard-impersonation'}]),/reserved/);
});
test('standard presets cover each surface without changing font defaults globally',()=>{
 for(const target of ['element','view','workarea']){
  const presets=standardPresets(target);assert.equal(presets.length,3);assert.equal(presets[2].properties['background.texture'].kind,'paper');
  for(const p of presets)assert.equal(p.target,target);
  if(target==='workarea')assert.equal(presets[0].properties['style.font'],undefined);else assert.equal(presets[0].properties['style.font'],'sans');
 }
});
test('browser persistence is explicit and reports storage failures to its caller',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 assert.deepEqual(readLocalPresets(storage),[]);writeLocalPresets(storage,[preset]);assert.deepEqual(readLocalPresets(storage),[preset]);
 assert.throws(()=>writeLocalPresets({setItem(){throw Error('storage unavailable');}},[preset]),/unavailable/);
});
