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
   const visit=node=>ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='factories'&&node.name.text==='mode'?ts.factory.createStringLiteral(mode):ts.visitEachChild(node,visit,context);
   return root=>ts.visitNode(root,visit);
  }]);
  try{return ts.createPrinter().printFile(result.transformed[0]);}finally{result.dispose();}
 }
 const standalone=join(staged,'standalone/src');
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
