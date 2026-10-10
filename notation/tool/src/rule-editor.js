/* SPDX-License-Identifier: GPL-2.0-or-later. Visual authoring of bounded DDNA rules. */
(function(host){
'use strict';
function rewrite(text,features,parse,lex,value){
 const doc=parse(text,'rules.ddna'),edits=[],expressions=new Map(features.keel.map(k=>[k.id,k]));let profiles=0;
 const property=(n,key,next)=>{const ts=lex(text,'rules.ddna').filter(t=>t.start>=n.bodyStart&&t.end<=n.bodyEnd);let depth=0;for(let i=0;i<ts.length;i++){const t=ts[i];if(depth===0&&t.value===key&&ts[i+1]?.type===':'){let d=0;for(let j=i+2;j<ts.length;j++){const q=ts[j];if(q.type===';'&&d===0){edits.push({start:t.start,end:q.end,text:next===undefined?'':key+': '+value(next)+';'});return;}if(['{','['].includes(q.type))d++;if(['}',']'].includes(q.type))d--;}}if(['{','['].includes(t.type))depth++;if(['}',']'].includes(t.type))depth--; }throw Error('Cannot locate '+key+' source');};
 const walk=n=>{if(n.props?.x_profile){profiles++;property(n,'x_profile',features.profile);}if(n.props?.x_keel){const id=n.props.x_keel.id||n.id,next=expressions.get(id);property(n,'x_keel',next?{...n.props.x_keel,...next}:undefined);expressions.delete(id);}for(const c of n.children||[])walk(c);};for(const n of doc.declarations)walk(n);
 if(profiles!==1)throw Error('Rule editing requires exactly one profile carrier');
 for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.text+text.slice(e.end);
 if(expressions.size){let id='rule_expressions',i=2;while(doc.declarations.some(n=>n.id===id))id='rule_expressions_'+i++;text+='\ndata '+id+' {\n'+[...expressions.values()].map((k,j)=>' object expression_'+j+' { x_keel: '+value(k)+'; }').join('\n')+'\n}\n';}
 parse(text,'rules.ddna');return text;
}
function render(root,features,save,onDraft=()=>{}){
 let initialized=false;const changed=()=>onDraft(JSON.parse(JSON.stringify(draft)));
 const draft=JSON.parse(JSON.stringify(features));root.replaceChildren();
 const fresh=(rows,prefix)=>{const used=new Set(rows.map(x=>x.id));let n=1;while(used.has(prefix+n))n++;return prefix+n;};
 const input=(parent,label,value,change,multi=false)=>{const wrap=document.createElement('label');wrap.className='ddn-field';const title=document.createElement('span');title.textContent=label;const el=document.createElement(multi?'textarea':'input');el.value=value;el.setAttribute('aria-label',label);const update=()=>{change(el.value);changed();};el.addEventListener('input',update);el.addEventListener('change',update);wrap.append(title,el);parent.append(wrap);return el;};
 const button=(parent,label,fn)=>{const b=document.createElement('button');b.type='button';b.className='ddn-mini';b.textContent=label;b.addEventListener('click',fn);parent.append(b);};
 const select=(parent,label,values,current,change)=>{const el=document.createElement('select');el.setAttribute('aria-label',label);el.append(...values.map(v=>new Option(v,v)));el.value=current;el.addEventListener('change',()=>{change(el.value);changed();});parent.append(el);};
 const refresh=()=>{
 root.replaceChildren();input(root,'Rule inputs',draft.profile.inputs.join(', '),v=>draft.profile.inputs=v.split(',').map(x=>x.trim()).filter(Boolean));
 select(root,'Rule replay mode',['verified','faithful'],draft.profile.replay,v=>draft.profile.replay=v);
 for(const [index,n]of draft.profile.nodes.entries()){
 const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Decision '+(index+1);box.append(legend);root.append(box);
 input(box,'Decision '+(index+1)+' ID',n.id,v=>n.id=v);input(box,'Decision '+(index+1)+' target',n.target,v=>n.target=v);input(box,'Decision '+(index+1)+' dependencies',(n.depends_on||[]).join(', '),v=>n.depends_on=v.split(',').map(x=>x.trim()).filter(Boolean));
 select(box,'Decision '+(index+1)+' form',['expression','table'],n.table?'table':'expression',v=>{if(v==='table'){delete n.expr;n.table={hit_policy:'unique',rows:[]};draft.profile.name='ddna.em2.tables-l0@1';}else{delete n.table;n.expr='';}refresh();});
 if(n.table){select(box,'Decision '+(index+1)+' hit policy',['unique','first','collect'],n.table.hit_policy,v=>n.table.hit_policy=v);for(const [i,r]of n.table.rows.entries()){const row=document.createElement('div');box.append(row);for(const key of ['id','when','then'])input(row,'Decision '+(index+1)+' row '+(i+1)+' '+key,r[key],v=>r[key]=v);button(row,'Move row up',()=>{if(i){[n.table.rows[i-1],n.table.rows[i]]=[n.table.rows[i],n.table.rows[i-1]];refresh();}});button(row,'Delete row',()=>{n.table.rows.splice(i,1);refresh();});}button(box,'Add rule row',()=>{n.table.rows.push({id:fresh(n.table.rows,'row'),when:'',then:''});refresh();});}
 else input(box,'Decision '+(index+1)+' expression',n.expr||'',v=>n.expr=v);
 button(box,'Delete decision',()=>{draft.profile.nodes.splice(index,1);refresh();});
 }
 button(root,'Add decision',()=>{draft.profile.nodes.push({id:fresh(draft.profile.nodes,'decision'),target:'',expr:''});refresh();});
 for(const [i,k]of draft.keel.entries()){const box=document.createElement('fieldset');root.append(box);input(box,'Expression '+(i+1)+' ID',k.id,v=>k.id=v);input(box,'Expression '+(i+1)+' body',k.body,v=>k.body=v,true);button(box,'Delete expression',()=>{draft.keel.splice(i,1);refresh();});}
 button(root,'Add expression',()=>{draft.keel.push({id:fresh(draft.keel,'expression'),language:'keel-l0@1',body:'0'});refresh();});
 const message=document.createElement('p');message.setAttribute('role','status');button(root,'Save rules',()=>{try{save(draft);message.textContent='Rules saved; undo restores the previous companion.';}catch(e){message.textContent=(e.code?e.code+': ':'')+e.message;}});root.append(message);if(initialized)changed();initialized=true;
 };refresh();
}
const api={rewrite,render};if(typeof module==='object'&&module.exports)module.exports=api;host.DDNToolRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
