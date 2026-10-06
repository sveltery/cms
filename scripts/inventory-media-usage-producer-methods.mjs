// Immutable Source method graph for finite descriptor qualification; no execution.
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const base='parity/emdash/media-usage-maintenance-source/authority/packages/core/src/';
const paths=['database/repositories/media-usage-work.ts','media/usage/reconciliation.ts',
  'media/usage/collection-deletion.ts','media/usage/collection-deletion-processor.ts',
  'media/usage/reconciliation-processor.ts','media/usage/work-processor.ts',
  'media/usage/maintenance-engine.ts','media/usage/content-repair.ts',
  'api/handlers/media-usage-work.ts','api/handlers/media-usage.ts'];
const records=[];
for(const path of paths){
  const text=readFileSync(resolve(root,base+path+'.txt'),'utf8');
  const syntax=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  function visit(node){
    if((ts.isMethodDeclaration(node)||ts.isFunctionDeclaration(node))&&node.name){
      const name=node.name.getText(syntax);
      if(path==='api/handlers/media-usage.ts'&&!['handleMediaUsageProgress','handleMediaUsageProgressAdvance','continuationDelayMs','handleMediaUsageRepair'].includes(name))return;
      const exact=node.getText(syntax);const calls=[];
      function inspect(child){
        if(ts.isCallExpression(child)){
          const call=child.expression.getText(syntax);
          if(/(?:\.execute(?:TakeFirst(?:OrThrow)?)?|withTransaction)$/.test(call))calls.push({
            callee:call,line:syntax.getLineAndCharacterOfPosition(child.getStart(syntax)).line+1,
            exactSourceCall:child.getText(syntax)});
        }
        ts.forEachChild(child,inspect);
      }
      inspect(node);
      records.push({sourcePath:'packages/core/src/'+path,name,
        className:ts.isClassDeclaration(node.parent)?node.parent.name?.getText(syntax):null,
        visibility:node.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword)?'private':'public-or-module',
        line:syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line+1,
        sha256:createHash('sha256').update(exact).digest('hex'),exactSourceFunction:exact,calls});
    }
    ts.forEachChild(node,visit);
  }
  visit(syntax);
}
const result={pin:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',
  state:'immutable finite whole method graph; descriptor association pending Root qualification',
  productMethodsExecutedByThisInventory:0,records};
writeFileSync(resolve(root,'parity/emdash/media-usage-maintenance-source/producer-method-review-inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({wholeModules:paths.length,methods:records.length,
  sourceExecutionCalls:records.reduce((n,r)=>n+r.calls.length,0),productMethodsExecuted:0}));
