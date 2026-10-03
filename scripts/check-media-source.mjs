import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/media-ports.json', root), 'utf8'));
let declarations = 0, assertions = 0;
for (const file of ledger.files) {
  const bytes = await readFile(new URL(file.frozenPath, root));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== file.sha256) throw new Error(`Source changed: ${file.sourcePath}`);
  const gitHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (gitHash !== file.blob) throw new Error(`Source blob mismatch: ${file.sourcePath}`);
  const source = ts.createSourceFile(file.sourcePath, bytes.toString(), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const text = node.expression.getText(source);
      let root = node.expression;
      while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) root = root.expression;
      if (ts.isIdentifier(root) && ['it','test'].includes(root.text) && node.arguments.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) declarations++;
      if (text === 'expect') assertions++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(JSON.stringify({sourcePin:ledger.sourcePin, immutableSourceFiles:ledger.files.length, sourceDeclarations:declarations, literalExpectCalls:assertions, productTestsRun:0, passingSourceCredit:0}));
const modules=JSON.parse(await readFile(new URL('docs/media-source.json',root),'utf8'));
for(const module of modules.modules){
 const bytes=await readFile(new URL(module.productPath,root));
 if(createHash('sha256').update(bytes).digest('hex')!==module.productSha256)throw new Error(`Product source changed: ${module.productPath}`);
}
const fixtures=JSON.parse(await readFile(new URL('docs/media-source-fixtures.json',root),'utf8'));
for(const fixture of fixtures.files){const bytes=await readFile(new URL(fixture.frozenPath,root));if(createHash('sha256').update(bytes).digest('hex')!==fixture.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==fixture.blob)throw new Error(`Fixture changed: ${fixture.sourcePath}`);}
const browser=JSON.parse(await readFile(new URL('docs/media-browser-ports.json',root),'utf8'));
const port=ts.createSourceFile(browser.productPath,await readFile(new URL(browser.productPath,root),'utf8'),ts.ScriptTarget.Latest,true);
const actual=new Map();function callbacks(node){if(ts.isCallExpression(node)&&node.expression.getText(port)==='test'&&ts.isStringLiteral(node.arguments[0]))actual.set(node.arguments[0].text,createHash('sha256').update(node.getText(port)).digest('hex'));ts.forEachChild(node,callbacks);}callbacks(port);
for(const callback of browser.callbacks)if(actual.get(callback.title)!==callback.sha256)throw new Error(`Source browser callback changed: ${callback.title}`);
console.log(JSON.stringify({verifiedModuleChecksums:modules.modules.length,verifiedFrozenFixtures:fixtures.files.length,unchangedBrowserCallbacks:browser.callbacks.length,productTestsRun:0}));
