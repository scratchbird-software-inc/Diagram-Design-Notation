/** Specialize the shared shell's mode branches before production tree shaking. */
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createRequire} from 'node:module';
import {environment,outputPath} from './context.mjs';
export function shellInputs(entries,built,label){
 if(!existsSync(join(built,'standalone/src/shell.js')))return {entries,built};
 const env=environment(),ts=createRequire(import.meta.url)(join(env.DDN_BUILD_WORKAREA,'tools/toolchain/typescript/lib/typescript.js'));
 const staged=outputPath(join(env.DDN_BUILD_WORKAREA,'builds/optimizer-input',label));
 rmSync(staged,{recursive:true,force:true});mkdirSync(staged,{recursive:true});
 cpSync(built,staged,{recursive:true,filter:path=>!path.endsWith('.map')&&!path.endsWith('.d.ts')});
 function specialize(source,mode){
  const file=ts.createSourceFile('shell.js',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
  const result=ts.transform(file,[context=>{
   const visit=node=>{
    if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='factories'){
     const key=node.name.text;
     if(key==='mode')return ts.factory.createStringLiteral(mode);
     if(key==='edition')return ts.factory.createStringLiteral(label.startsWith('native-')?'native':'complete');
     const absent=mode==='verifier'?['viewer','designer','newDiagram','getRuntime']:mode==='viewer'?['designer','newDiagram']:[];
     if(!label.startsWith('modular-'))absent.push('initial','ready');
     if(absent.includes(key))return ts.factory.createVoidZero();
    }
    return ts.visitEachChild(node,visit,context);
   };
   return root=>ts.visitNode(root,visit);
  }]);
  try{return ts.createPrinter().printFile(result.transformed[0]);}finally{result.dispose();}
 }
 const standalone=join(staged,'standalone/src');
 // Specialization is valid only for the factory objects actually supplied by
 // these entry points. Refuse future additions rather than silently pruning them.
 for(const mode of ['viewer','designer','verifier'])for(const prefix of ['', 'complete-', 'modular-']){
  const path=join(standalone,prefix+mode+'-entry.js');if(!existsSync(path))continue;
  const file=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
  let found=false;
  function inspect(node){
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['mountShell','bootModularShell'].includes(node.expression.text)){
    const argument=node.arguments[0];
    if(!argument||!ts.isObjectLiteralExpression(argument)||argument.properties.some(property=>ts.isSpreadAssignment(property)))throw Error('Review dynamic shell factories before specialization: '+path);
    const fields=new Map(argument.properties.map(property=>[property.name?.text,property]));
    const modeField=fields.get('mode');if(!modeField||!ts.isPropertyAssignment(modeField)||!ts.isStringLiteral(modeField.initializer)||modeField.initializer.text!==mode)throw Error('Shell mode differs from its entry point: '+path);
    const absent=mode==='verifier'?['viewer','designer','newDiagram','getRuntime']:mode==='viewer'?['designer','newDiagram']:[];
    if(prefix!=='modular-')absent.push('initial','ready');
    if(absent.some(key=>fields.has(key)))throw Error('Review added shell factories before specialization: '+path);
    found=true;
   }
   ts.forEachChild(node,inspect);
  }
  inspect(file);if(!found)throw Error('Missing static shell factories: '+path);
 }

 if(label.startsWith('modular-'))writeFileSync(join(staged,'profiles/src/generated-native.js'),readFileSync(join(staged,'profiles/src/generated-native-light.js')));
 for(const mode of ['viewer','designer','verifier']){
  writeFileSync(join(standalone,'shell-'+mode+'.js'),specialize(readFileSync(join(standalone,'shell.js'),'utf8'),mode));
  writeFileSync(join(standalone,'modular-shell-'+mode+'.js'),specialize(readFileSync(join(standalone,'modular-shell.js'),'utf8'),mode).replace(/(['"])\.\/shell\.js\1/g,JSON.stringify('./shell-'+mode+'.js')));
  for(const prefix of ['', 'complete-', 'modular-']){
   const file=join(standalone,prefix+mode+'-entry.js');
   if(!existsSync(file))continue;
   let source=readFileSync(file,'utf8');
   source=source.replace(/(['"])\.\/shell\.js\1/g,JSON.stringify('./shell-'+mode+'.js')).replace(/(['"])\.\/modular-shell\.js\1/g,JSON.stringify('./modular-shell-'+mode+'.js'));
   writeFileSync(file,source);
  }
 }
 return {built:staged,entries:Object.fromEntries(Object.entries(entries).map(([key,path])=>[key,join(staged,relative(built,path))]))};
}
