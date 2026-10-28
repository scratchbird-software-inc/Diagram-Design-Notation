import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const site=join(root,'website');
const read=path=>readFileSync(join(site,path),'utf8');
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):[join(directory,entry.name)]);
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const company=/href=["']https:\/\/scratchbird\.ca\/?["']/;
const gpl2=/GPL(?:[\s-]*v)?[\s-]*2(?:\.0)?/i;

test('public DDN pages retain GPL identity and sponsorship independently of the commercial host repository',()=>{
    const pages=files(site).filter(file=>file.endsWith('.html')).map(file=>({file,html:readFileSync(file,'utf8')})).filter(page=>page.html.includes('class="site-footer"'));
    assert.ok(pages.length>800,'check the generated guides and reference pages as well as the landing page');
    for(const {file,html} of pages){
        const name=relative(site,file),footer=/<footer\b[^>]*>[\s\S]*?<\/footer>/.exec(html)?.[0]??'';
        assert.match(text(footer),gpl2,name+' must retain a visible GPLv2 notice');
        assert.match(footer,company,name+' must link the sponsor');
        assert.doesNotMatch(text(html),/private review (?:edition|copy)|private\s*[—–-]\s*authorized use only/i,name+' must not inherit private repository licensing');
        assert.doesNotMatch(html,/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i,name+' must not retain the review-only search exclusion');
    }
    const home=read('index.html'),license=read('license/index.html'),download=read('download/index.html');
    assert.match(text(home),/open[ -]source/i);assert.match(text(home),/sponsor(?:ed|ship)/i);
    assert.match(text(home),/ScratchBird Software Inc\./);
    for(const path of ['weaver','bird','robin'])assert.match(home,new RegExp('href=["\']https://scratchbird\\.ca/'+path+'/?["\']'),'suite link '+path);
    assert.match(text(home),/ScratchBird CDE/);assert.match(text(home),/ScratchRobin/);
    assert.match(text(license),/GNU General Public License/i);assert.match(text(license),/GPL-2\.0-or-later/);
    assert.match(text(license),/(?:Weaver[\s\S]{0,160}commercial|commercial[\s\S]{0,160}Weaver)/i);
    assert.match(text(download),gpl2);
    // Third-party artwork and font notices are retained under their own terms.
    assert.match(read('assets/icons/tabler-infra-1/NOTICE.txt'),/MIT License/);
    assert.match(read('assets/icons/iconoir-infra-1/NOTICE.txt'),/MIT License/);
    assert.match(read('assets/ddn-fonts-LICENSES.txt'),/SIL OPEN FONT LICENSE Version 1\.1/);
});
