/* SPDX-License-Identifier: GPL-2.0-or-later. Chapter 04/54 field presentation.
 * Measurement and paint share the same column geometry and text properties. */
import Text from './ddn-text.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function clip(value,width,size,font,weight=400,spec=null){
 const full=String(value??'');
 if(Text.measure(full,size,font,spec?.weight??weight,spec).width<=width)return full;
 const ell='…',budget=width-Text.measure(ell,size,font,spec?.weight??weight,spec).width;
 const gs=Text.graphemes(full);let lo=0,hi=gs.length;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(Text.measure(gs.slice(0,mid).join(''),size,font,spec?.weight??weight,spec).width<=budget)lo=mid;else hi=mid-1;}
 return gs.slice(0,lo).join('')+ell;
}
function columns(schema,available,advance,fail){
 const cols=schema.map(e=>({...e}));
 const clamp=(e,v)=>Math.min(e.max_chars===undefined?Infinity:e.max_chars*advance,Math.max((e.min_chars??0)*advance,v));
 const fixed=cols.filter(e=>e.width.kind==='chars'),percent=cols.filter(e=>e.width.kind==='percent'),equal=cols.filter(e=>e.width.kind==='equal');
 for(const e of fixed)e._px=clamp(e,e.width.n*advance);
 let remaining=available-fixed.reduce((sum,e)=>sum+e._px,0);
 if(remaining<-.001||!Number.isFinite(remaining))fail('DDN-CL02','Fixed column widths exceed the element width');
 remaining=Math.max(0,remaining);
 const sum=percent.reduce((n,e)=>n+e.width.n,0),denominator=equal.length?Math.max(100,sum):(sum||1);
 for(const e of percent)e._px=clamp(e,remaining*e.width.n/denominator);
 remaining-=percent.reduce((n,e)=>n+e._px,0);
 if(remaining<-.001)fail('DDN-CL02','Column minimum widths exceed the element width');
 // Find a shared width after bounds. Freezing opposing min/max violations
 // together can reject feasible layouts (e.g. min 80 + max 30 in 100px).
 if(equal.length){
  if(equal.reduce((n,e)=>n+clamp(e,0),0)>remaining+.001)fail('DDN-CL02','Column minimum widths exceed the element width');
  let lo=0,hi=Math.max(0,remaining);
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(equal.reduce((n,e)=>n+clamp(e,mid),0)>remaining)hi=mid;else lo=mid;}
  for(const e of equal)e._px=clamp(e,lo);
 }
 let x=0;for(const e of cols){if(!Number.isFinite(e._px)||e._px<0)fail('DDN-CL02','Column width is not finite');e._x=x;x+=e._px;}
 if(x>available+.001)fail('DDN-CL02','Column minimum widths exceed the element width');
 return cols;
}
function paint(g,text,line){
 const {x,y,w,scale:s,columnLayout:cl}=g;let out='<g class="ddn-columns" data-columns="'+esc(cl.cols.map(e=>e.id).join(' '))+'">';
 const clipId=(suffix)=>'ddn-cell-'+Array.from(g.id+'::'+suffix,c=>c.codePointAt(0).toString(16)).join('-');
 const cell=(value,full,col,yy,size,weight,indent,suffix)=>{
  const xx=x+15*s+col._x+4*s+indent,width=Math.max(0,col._px-8*s-indent),id=clipId(suffix);
  return `<g><title>${esc(full)}</title><clipPath id="${id}"><rect x="${xx}" y="${yy-size}" width="${width}" height="${size*1.4}"/></clipPath><g clip-path="url(#${id})">${text(xx,yy,value,size,weight)}</g></g>`;
 };
 cl.cols.forEach((e,i)=>{out+=cell(e.header,e.label??e.id,e,y+cl.top+14*s,10.5*s,650,0,'h'+i);});
 out+=line(x,y+cl.top+18*s,x+w,y+cl.top+18*s);
 for(const row of g.fieldRows){out+=`<g class="ddn-field ddn-column-row" data-member="${esc(row.id)}">`;
  row.cells.forEach((value,i)=>{out+=cell(value,row.fullCells[i],cl.cols[i],y+row.top+18*s,13.5*s,400,i===0?row.depth*16*s:0,row.id+':'+i);});out+='</g>';}
 return out+'</g>';
}
export default {clip,columns,paint};
