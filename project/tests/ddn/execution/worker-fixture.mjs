import {parentPort,workerData} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {bootComputeWorker}=await import(pathToFileURL(path.join(workerData.build,'ddn/packages/execution/src/worker-entry.js')));
const listeners=new Map();
const port={postMessage:data=>parentPort.postMessage(data),addEventListener(type,fn){const listener=data=>fn({data});listeners.set(fn,listener);parentPort.on(type,listener);},removeEventListener(type,fn){const listener=listeners.get(fn);if(listener)parentPort.off(type,listener);listeners.delete(fn);}};
bootComputeWorker(workerData.options,port);
