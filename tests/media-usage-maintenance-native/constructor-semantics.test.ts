// Constructor transport controls on complete immutable Source classes.
// These are Native Node compatibility controls; no Original callback credit.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect,it } from 'vitest';
const authority='parity/emdash/media-usage-maintenance-source/authority/packages/core/src/';
const native='src/lib/server/media-usage/upstream/';
const cases=[
  {name:'MediaUsageWorkRepository',path:'database/repositories/media-usage-work.ts'},
  {name:'MediaUsageReconciliationRepository',path:'media/usage/reconciliation.ts'},
  {name:'MediaUsageCollectionDeletionRepository',path:'media/usage/collection-deletion.ts'},
];
type Constructed=Record<string,unknown>;
type Constructor=new (...args:unknown[])=>Constructed;
function completeClass(path:string,name:string):Constructor {
  const text=readFileSync(path,'utf8');
  const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  const found=file.statements.filter(node=>ts.isClassDeclaration(node)&&node.name?.text===name);
  if(found.length!==1)throw new Error(`Expected complete actual ${name} in ${path}`);
  // Compile the entire original class, including all methods and its actual
  // constructor. Nothing is replaced by a synthetic constructor or receiver.
  const code=ts.transpileModule(found[0].getText(file).replace(/^export /,'')+`\n${name};`,{
    compilerOptions:{target:ts.ScriptTarget.ESNext,useDefineForClassFields:true}}).outputText;
  return vm.runInNewContext(code) as Constructor;
}
for(const item of cases){
  it(`${item.name} imports its actual Native graph in unchanged Node24 strip mode`,()=>{
    const child=spawnSync(process.execPath,['--input-type=module','--eval',
      `const m=await import(${JSON.stringify('./'+native+item.path)});console.log(typeof m[${JSON.stringify(item.name)}]);`],
      {cwd:process.cwd(),encoding:'utf8'});
    expect(child.status,child.stderr).toBe(0);expect(child.stdout.trim()).toBe('function');
  });
  it(`${item.name} preserves complete Source own descriptors and exact argument reference`,()=>{
    const Source=completeClass(authority+item.path+'.txt',item.name),Native=completeClass(native+item.path,item.name);
    const db={actualArgument:'same object'};
    const original=new Source(db),actual=new Native(db);
    expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(original));
    expect(Object.keys(actual)).toEqual(Object.keys(original));
    expect(Reflect.get(actual,'db')).toBe(db);expect(Reflect.get(original,'db')).toBe(db);
    expect(Object.getOwnPropertyDescriptor(actual,'db')).toEqual({value:db,writable:true,enumerable:true,configurable:true});
  });
  it(`${item.name} preserves Source undefined and mutable receiver semantics`,()=>{
    const Source=completeClass(authority+item.path+'.txt',item.name),Native=completeClass(native+item.path,item.name);
    const original=new Source(),actual=new Native();
    expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(original));
    expect(Object.hasOwn(actual,'db')).toBe(true);
    const replacement={actualReplacement:'same reference'};
    expect(Reflect.set(actual,'db',replacement)).toBe(Reflect.set(original,'db',replacement));
    expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(original));
    expect(Reflect.get(actual,'db')).toBe(replacement);
  });
  it(`${item.name} preserves Source subclass field ordering and database alias mutations`,()=>{
    const Source=completeClass(authority+item.path+'.txt',item.name),Native=completeClass(native+item.path,item.name);
    class SourceChild extends Source {child=1;}
    class NativeChild extends Native {child=1;}
    const db={value:1};const original=new SourceChild(db),actual=new NativeChild(db);
    db.value=2;
    expect(Reflect.get(actual,'db')).toBe(db);
    expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(original));
    expect(Object.keys(actual)).toEqual(Object.keys(original));
    expect(Object.keys(actual)).toEqual(['db','child']);
  });
}
