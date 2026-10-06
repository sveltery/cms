import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const manifest = JSON.parse(readFileSync('parity/emdash/general-media-source/authority.json','utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const families = [];
for (const authority of manifest.authorities.filter(row=>row.source.endsWith('.test.ts'))) {
  const source = readFileSync(authority.retained,'utf8');
  const file = ts.createSourceFile(authority.source,source,ts.ScriptTarget.Latest,true);
  const declarations=[],expects=[],mocks=[],clocks=[];
  const chain = node => ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? chain(node.expression)+'.'+node.name.text : ts.isCallExpression(node) ? chain(node.expression)+'()' : '';
  function walk(node) {
    if(ts.isCallExpression(node)) {
      const callee=chain(node.expression);
      const entry={line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1,callee,expression:node.getText(file),sha256:hash(node.getText(file))};
      if(/^(it|test)(\.|$)/.test(callee)&&(!callee.endsWith('.each')||callee.includes('each()'))) declarations.push(entry);
      if(callee==='expect'||callee==='expect.element'||callee==='expect.poll') expects.push(entry);
      if(/^vi\.(mock|doMock|hoisted|fn|spyOn|stub)/.test(callee)) mocks.push(entry);
      if(/^vi\.(useFakeTimers|useRealTimers|setSystemTime|advanceTimers|runAllTimers)/.test(callee)||callee==='setTimeout') clocks.push(entry);
    }
    ts.forEachChild(node,walk);
  }
  walk(file); families.push({source:authority.source,sha256:authority.sha256,declarations,expects,mocks,clocks});
}
const totals = families.reduce((result,row)=>({families:result.families+1,declarations:result.declarations+row.declarations.length,expectRoots:result.expectRoots+row.expects.length,mocks:result.mocks+row.mocks.length,clocks:result.clocks+row.clocks.length}),{families:0,declarations:0,expectRoots:0,mocks:0,clocks:0});
writeFileSync('parity/emdash/general-media-source/test-inventory.json',JSON.stringify({pin:manifest.pin,kind:'Whole immutable source declaration expressions, including full each-datasets, assertions, mocks and original clock calls; static counts are not execution credit',totals,families},null,2)+'\n');
console.log(JSON.stringify(totals));
