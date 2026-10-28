(()=>{'use strict';const query=new URLSearchParams(location.search),catalogue=window.DDN_WEBSITE_CATALOGUE;const allowed=new Set(catalogue.corpus.map(e=>e.entry));
/* UX revision 2026-10-24: the designer opens on a blank document unless an example is requested
   (File ▸ Open a sample… lists the starters and the field-guide corpus); the viewer and verifier keep
   the first corpus entry as their default so the website embeds still show a diagram. */
const mode=query.get('mode');const requested=query.get('example')||(mode==='design'?null:catalogue.corpus[0].entry);
if(requested!==null&&!allowed.has(requested)){document.querySelector('[role="status"]').textContent='Unknown example: '+requested;return;}
const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('Unable to load '+src));document.body.append(script);});
(requested===null?Promise.resolve():load('../'+requested+'.js')).then(()=>load('../assets/ddn-fonts.js')).then(()=>load('../assets/ddn-runtime.js')).catch(error=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=error.message;document.body.append(p);});})();
