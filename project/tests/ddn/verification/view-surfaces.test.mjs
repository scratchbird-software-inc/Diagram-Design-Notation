import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build = process.env.DDN_BUILD_ROOT || path.resolve('.work/builds/ddn');
const mod = name => import(pathToFileURL(path.join(build, 'ddn/packages', name, 'src/index.js')));
const {decodeSources, patchProperty, applySourcePatches} = await mod('language');
const {createNativePack, indexRecords} = await mod('profiles');
const {resolve, resolveProperties, validateProperty} = await mod('defaults');
const {createVerifier} = await mod('verifier');
const {VIEW_SURFACE_PRESETS, getViewSurfacePreset} = await import(pathToFileURL(path.join(build, 'ddn/packages/profiles/src/view-surfaces.js')));
const versions = {api:'1.0', language:'ddn-next-1', defaults:'ddn-next-1', packs:{'ddn-native':'1.0.0'}};
const source = text => ({entry:'main.ddn', files:[{id:'main.ddn',text,revision:'r1',encoding:'utf-8',writable:true}]});
const snapshot = text => ({rootFile:'main.ddn',normalized:decodeSources(source(text)).normalized});
const verify = text => createVerifier({versions,packs:[createNativePack()]}).verifySources(source(text),{scope:{kind:'workarea'},level:'review',purpose:'design'});

test('dynamic omission retains profile behavior and surface recipe selection is explicit', () => {
    const empty = resolve({profile:'ddn@1'},'view_definition',{profile:'ddn@1'});
    const explicit = resolve({profile:'ddn@1',surface:{preset:'dynamic'}},'view_definition',{profile:'ddn@1'});
    assert.deepEqual(empty.values, explicit.values);
    assert.deepEqual(empty.values.surface, {preset:'dynamic',width:null,height:null,scale:1,fit:'contain',padding:32});
    assert.equal(empty.values.style.font_size,16);
    assert.equal(empty.values.chrome.banner,true);assert.equal(empty.values.chrome.footer,true);
    for (const tier of ['styles','fileDefaults','workareaDefaults','viewDefaults']) {
        const result = resolve({},'view_definition',{[tier]:[{selector:{owner:'view_definition'},declarations:{'surface.preset':'tv-4k'}}]});
        assert.equal(result.values.surface.preset,'dynamic');
        assert.ok(result.diagnostics.some(d=>d.code==='DDN-DEFAULT-INELIGIBLE'));
    }
});

test('TV recipes resolve exact fixed dimensions and consistent logical typography', () => {
    const sizes = {'tv-hd':[1280,720,2/3],'tv-fhd':[1920,1080,1],'tv-2k':[2048,1080,1],'tv-qhd':[2560,1440,4/3],'tv-4k':[3840,2160,2],'tv-8k':[7680,4320,4]};
    assert.equal(VIEW_SURFACE_PRESETS.length,7);assert.equal(getViewSurfacePreset('paper-a4'),undefined);
    for (const [preset,[width,height,scale]] of Object.entries(sizes)) {
        assert.ok(Object.isFrozen(getViewSurfacePreset(preset)));
        const result = resolve({surface:{preset}},'view_definition');
        assert.deepEqual(result.diagnostics,[]);
        assert.deepEqual(result.values.surface,{preset,width,height,scale,fit:'contain',padding:32});
        assert.equal(result.values.style.font,'sans');assert.equal(result.values.style.font_size,24);
        assert.equal(result.values.style.theme,'neutral');assert.equal(result.values.text.color,'#222222');assert.equal(result.values.background.color,'#ffffff');
        assert.equal(result.values.chrome.banner,false);assert.equal(result.values.chrome.footer,false);assert.equal(result.values.chrome.title,true);
        assert.match(result.properties.find(p=>p.path==='surface.width').origin,/^standard:surface/);
    }
});

test('TV settings keep file above CSS above recipe standards, including ordinary appearance', () => {
    const css={selector:{owner:'view_definition'},declarations:{'surface.width':1600,'surface.height':900,'surface.scale':.8,'surface.padding':40,'surface.fit':'none','style.font_size':28,'background.color':'#ddeeff'}};
    const result=resolve({surface:{preset:'tv-fhd',width:1700},style:{font_size:32},background:{color:'#aabbcc'}},'view_definition',{styles:[css]});
    assert.deepEqual(result.diagnostics,[]);
    assert.equal(result.values.surface.width,1700);assert.equal(result.values.surface.height,900);assert.equal(result.values.surface.scale,.8);assert.equal(result.values.surface.fit,'none');
    assert.equal(result.values.style.font_size,32);assert.equal(result.values.background.color,'#aabbcc');
    assert.equal(result.properties.find(p=>p.path==='surface.width').origin,'file:definition');
    assert.equal(result.properties.find(p=>p.path==='surface.height').origin,'css');
    assert.equal(result.properties.find(p=>p.path==='surface.scale').origin,'css');
});

test('TV view fonts reach contained items only as a fallback; item CSS and file settings win', () => {
    const text='element Customer as entity\nerd Board\n    with\n        surface.preset tv-4k\n        style.font mono\n        style.font_size 30\n    use Customer named Display\n';
    const model=snapshot(text), all=indexRecords(model.normalized), appearance=all.find(r=>r.record.name==='Display');
    const inherited=resolveProperties(model,appearance.ref);
    assert.equal(inherited.values.style.font,'mono');assert.equal(inherited.values.style.font_size,30);assert.equal(inherited.values.style.theme,'neutral');
    const css=[{selector:{owner:'appearance'},declarations:{'style.font':'serif','style.font_size':18,'text.color':'#123456'}}];
    const styled=resolveProperties(model,appearance.ref,{styles:css});
    assert.equal(styled.values.style.font,'serif');assert.equal(styled.values.style.font_size,18);assert.equal(styled.values.text.color,'#123456');
    const authored=snapshot(text+'        with\n            style.font sans\n            style.font_size 20\n');
    const overridden=resolveProperties(authored,indexRecords(authored.normalized).find(r=>r.record.name==='Display').ref,{styles:css});
    assert.equal(overridden.values.style.font,'sans');assert.equal(overridden.values.style.font_size,20);
    const dynamic=snapshot(text.replace('        surface.preset tv-4k\n',''));
    assert.equal(resolveProperties(dynamic,indexRecords(dynamic.normalized).find(r=>r.record.name==='Display').ref).values.style.font_size,16);
});

test('compact surface source survives editing without materializing recipe defaults', () => {
    const input=source('erd Board\n    with\n        surface.preset tv-8k\n    Customer\n');
    const decoded=decodeSources(input);assert.deepEqual(decoded.diagnostics,[]);
    const view=indexRecords(decoded.normalized).find(r=>r.owner==='view_definition');
    assert.deepEqual(view.record.surface,{preset:'tv-8k'});
    const patched=applySourcePatches(input,patchProperty(decoded,view.ref,'surface.preset','tv-hd'));
    assert.doesNotMatch(patched.files[0].text,/surface\.(width|height)|style\.font|background/);
    const reopened=decodeSources(patched);assert.deepEqual(reopened.diagnostics,[]);
    assert.equal(indexRecords(reopened.normalized).find(r=>r.owner==='view_definition').record.surface.preset,'tv-hd');
});

test('surface validation rejects unsupported recipes, malformed dimensions and empty drawable areas', async () => {
    const accepted=await verify('erd Board\n    with\n        surface.preset tv-4k\n    Customer\n');
    assert.equal(accepted.outcome,'valid',JSON.stringify(accepted.diagnostics));
    for (const [path,value] of [['surface.preset','paper-a4'],['surface.preset','tv-16k'],['surface.width',0],['surface.height',-1],['surface.scale',0],['surface.fit','cover'],['surface.padding',-1]]) assert.ok(validateProperty('view_definition',path,value).length);
    for (const [settings,code] of [
        ['surface.width 200','DDN-SURFACE-SIZE'],
        ['surface.preset tv-hd\n        surface.height null','DDN-SURFACE-SIZE'],
        ['surface.preset tv-hd\n        surface.padding 600','DDN-SURFACE-PADDING'],
    ]) {
        const report=await verify('erd Board\n    with\n        '+settings+'\n    Customer\n');
        assert.equal(report.outcome,'invalid',JSON.stringify(report.diagnostics));
        assert.ok(report.diagnostics.some(d=>d.code===code),JSON.stringify(report.diagnostics));
    }
});
