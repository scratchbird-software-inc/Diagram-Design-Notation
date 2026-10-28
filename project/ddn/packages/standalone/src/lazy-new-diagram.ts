import type {Viewer} from '../../types/src/browser.js';
import {getViewerHandle} from '../../viewer/src/native.js';
export function newDiagramDialog(viewer:Viewer,create:(text:string)=>Promise<void>):void{
 const handle=getViewerHandle(viewer),snapshot=handle.runtime.snapshot();
 void import('../../designer/src/new-diagram.js').then(module=>{
  if(handle.runtime.snapshot()===snapshot)module.newDiagramDialog(viewer,create);
 }).catch(error=>handle.announce('Unable to open the diagram chooser: '+String(error.message??error)));
}
