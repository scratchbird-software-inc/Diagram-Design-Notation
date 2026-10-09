/* SPDX-License-Identifier: GPL-2.0-or-later. Browser-local publication tiling. */
(function(host){
'use strict';
const fail=message=>{throw Object.assign(new Error(message),{code:'DDN-PG01'});};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function plan(scene,{width=800,height=600,overlap=0}={}){
 if(![width,height,overlap,scene.width,scene.height].every(Number.isFinite)||width<128||height<128||width>8192||height>8192||overlap<0||overlap>=Math.min(width,height)/2||scene.width<=0||scene.height<=0)fail('Tile sizes must be 128..8192 px; overlap is nonnegative and less than half a tile');
 const dx=width-overlap,dy=height-overlap,cols=Math.max(1,Math.ceil((scene.width-overlap)/dx)),rows=Math.max(1,Math.ceil((scene.height-overlap)/dy));if(cols*rows>256)fail('Publication exceeds 256 tiles');
 const pages=[],scale=scene.scale??1,origin=scene.origin||[0,0],file=i=>'page-'+String(i+1).padStart(3,'0')+'.svg';
 const routes=(scene.routes||[]).map((r,index)=>({id:r.id,label:'R'+(index+1),points:(r.points||[]).map(([x,y])=>[origin[0]+x*scale,origin[1]+y*scale])}));
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const index=row*cols+col,x=col*dx,y=row*dy,page={index:index+1,file:file(index),row:row+1,column:col+1,x,y,width,height,continuations:[]},seen=new Set();
  const edges=[['left',x,y,y+height,col>0?index-1:null],['right',x+width,y,y+height,col+1<cols?index+1:null],['top',y,x,x+width,row>0?index-cols:null],['bottom',y+height,x,x+width,row+1<rows?index+cols:null]];
  for(const route of routes)for(let i=1;i<route.points.length;i++)for(const [side,value,lo,hi,next]of edges){
   if(next===null)continue;const a=route.points[i-1],b=route.points[i],vertical=side==='left'||side==='right',axis=vertical?0:1,other=1-axis,delta=b[axis]-a[axis];if(Math.abs(delta)<1e-9)continue;
   const t=(value-a[axis])/delta;if(t<0||t>1)continue;const along=a[other]+t*(b[other]-a[other]);if(along<lo||along>hi)continue;
   const point=vertical?[value,along]:[along,value],key=route.id+':'+next+':'+point.map(n=>Math.round(n*1000)).join(',');if(seen.has(key))continue;seen.add(key);
   page.continuations.push({relation:route.id,label:route.label,to:next+1,file:file(next),side,x:point[0]-x,y:point[1]-y});
  }
  pages.push(page);
 }
 return {format:'ddn-publication-tiles@1',width,height,overlap,rows,columns:cols,pages};
}
function render(svg,scene,options){
 const publication=plan(scene,options),source=String(svg).replace(/^\s*<\?xml[^>]*>\s*/,'');if(!/^\s*<svg\b/.test(source))fail('Tiling requires a rendered SVG');
 if(new TextEncoder().encode(source).length*publication.pages.length>67108864)fail('Tiled SVG output exceeds 64 MiB');
 const files={};for(const page of publication.pages){
  const marks=page.continuations.map(c=>{const x=Math.max(16,Math.min(page.width-16,c.x)),y=Math.max(12,Math.min(page.height-12,c.y))+32;return '<a href="'+c.file+'"><rect x="'+(x-15)+'" y="'+(y-10)+'" width="30" height="20" rx="3" fill="white" stroke="#384f74"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-size="10" fill="#182a46">'+esc(c.label)+'</text><title>'+esc(c.relation+' continues on page '+c.to)+'</title></a>';}).join('');
  const nav=[page.column>1?[page.index-1,'left']:null,page.column<publication.columns?[page.index+1,'right']:null,page.row>1?[page.index-publication.columns,'above']:null,page.row<publication.rows?[page.index+publication.columns,'below']:null].filter(Boolean).map(([n,label])=>'<a href="'+publication.pages[n-1].file+'"><tspan>'+label+' '+n+' · </tspan></a>').join('');
  files[page.file]='<svg xmlns="http://www.w3.org/2000/svg" width="'+page.width+'" height="'+(page.height+64)+'" viewBox="0 0 '+page.width+' '+(page.height+64)+'"><title>Diagram page '+page.index+' of '+publication.pages.length+'</title><rect width="100%" height="100%" fill="white"/><text x="12" y="22" font-family="sans-serif" font-size="12">Page '+page.index+' / '+publication.pages.length+' · row '+page.row+', column '+page.column+'</text><svg x="0" y="32" width="'+page.width+'" height="'+page.height+'" viewBox="'+page.x+' '+page.y+' '+page.width+' '+page.height+'" overflow="hidden">'+source+'</svg>'+marks+'<text x="12" y="'+(page.height+54)+'" font-family="sans-serif" font-size="12">'+nav+'</text></svg>';
 }
 files['publication.json']=JSON.stringify(publication,null,2)+'\n';return {publication,files};
}
const api={plan,render};if(typeof module==='object'&&module.exports)module.exports=api;host.DDNToolTiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);
