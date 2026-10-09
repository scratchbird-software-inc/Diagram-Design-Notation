/* SPDX-License-Identifier: GPL-2.0-or-later. Private scratch-workspace context. */
export const draftWorkspaces=new WeakSet();
export function authoringBuild(D,ws,entry,view,registry){
 if(!draftWorkspaces.has(ws))return D.build(ws.getFiles(),entry,view,registry);
 const result=D.buildDraft(ws.getFiles(),entry,view,registry);
 if(!result.ir){const d=result.diagnostics.find(x=>x.severity==='error');throw new D.DDNError(d.code,d.message,d.source,d.offset);}
 return result;
}
