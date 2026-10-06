// Native hosting/constructor controls; no copied Source callback credit.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {it,expect} from 'vitest';
const source='parity/emdash/full-seed-engine/source/packages/core/src/seed/apply.ts';
function budget(path:string){
 const text=readFileSync(path,'utf8'),file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
 const declaration=file.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='SeedBudget');
 if(!declaration)throw new Error('Missing complete real SeedBudget class');
 const code=ts.transpileModule(declaration.getText(file)+'\nSeedBudget;',{compilerOptions:{target:ts.ScriptTarget.ESNext,useDefineForClassFields:true}}).outputText;
 return vm.runInNewContext(code) as new(limits:unknown)=>{isSpent():boolean};
}
it('loads the actual public Seed domain exports in unchanged Node24 strip mode',()=>{
 const script="const engine=await import('./src/lib/server/seed/index.ts');console.log([typeof engine.applySeed,typeof engine.initializeDefaultSeed,typeof engine.applySetupSeedWithinBudget].join(','));";
 const child=spawnSync(process.execPath,['--input-type=module','--eval',script],{cwd:process.cwd(),encoding:'utf8'});
 expect(child.status,child.stderr).toBe(0);expect(child.stdout.trim()).toBe('function,function,function');
});
for(const path of ['src/lib/server/seed/apply.ts','src/lib/server/seed/apply-d1.ts'])it(`${path}: preserves Source constructor own fields, references, undefined and subclass order`,()=>{
 const Source=budget(source),Native=budget(path),limits={queries:1,mediaDownloads:1};
 const original=new Source(limits),actual=new Native(limits);
 expect(Object.getOwnPropertyDescriptors(actual)).toEqual(Object.getOwnPropertyDescriptors(original));
 expect(Reflect.get(actual,'limits')).toBe(limits);expect(actual.isSpent()).toBe(original.isSpent());
 limits.queries=0;expect(actual.isSpent()).toBe(original.isSpent());expect(actual.isSpent()).toBe(true);
 const originalUndefined=new Source(undefined),actualUndefined=new Native(undefined);
 expect(Object.getOwnPropertyDescriptors(actualUndefined)).toEqual(Object.getOwnPropertyDescriptors(originalUndefined));
 expect(()=>actualUndefined.isSpent()).toThrow();expect(()=>originalUndefined.isSpent()).toThrow();
 class SourceChild extends Source {child=1;}
 class NativeChild extends Native {child=1;}
 expect(Object.keys(new NativeChild(limits))).toEqual(Object.keys(new SourceChild(limits)));
});
