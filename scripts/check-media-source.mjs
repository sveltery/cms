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
const settings=JSON.parse(await readFile(new URL('docs/media-settings-ports.json',root),'utf8'));
for(const record of [settings,{...settings.fixture,sha256:settings.fixture.frozenSha256}]){
 const bytes=await readFile(new URL(record.frozenPath,root));
 if(createHash('sha256').update(bytes).digest('hex')!==record.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==record.blob)throw new Error(`Settings source changed: ${record.sourcePath}`);
}
const settingsPorts=new Map();
for(const path of new Set([settings.productPath,...settings.existingOverlaps.map(record=>record.productPath)])){
 const source=ts.createSourceFile(path,await readFile(new URL(path,root),'utf8'),ts.ScriptTarget.Latest,true),records=new Map();
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='it'&&ts.isStringLiteral(node.arguments[0]))records.set(node.arguments[0].text,createHash('sha256').update(node.getText(source)).digest('hex'));ts.forEachChild(node,visit);}visit(source);settingsPorts.set(path,records);
}
for(const record of [...settings.uniqueCallbacks.map(record=>({...record,productPath:settings.productPath})),...settings.existingOverlaps])if(settingsPorts.get(record.productPath)?.get(record.title)!==record.sha256)throw new Error(`Settings source callback changed: ${record.title}`);
const settingsFixture=ts.createSourceFile(settings.fixture.productPath,await readFile(new URL(settings.fixture.productPath,root),'utf8'),ts.ScriptTarget.Latest,true);
const fixtureFunction=settingsFixture.statements.find(node=>node.name?.getText(settingsFixture)===settings.fixture.function);
if(!fixtureFunction||createHash('sha256').update(fixtureFunction.getText(settingsFixture)).digest('hex')!==settings.fixture.sha256)throw new Error('Settings media collection fixture changed');
console.log(JSON.stringify({unchangedAdditionalSettingsCallbacks:settings.uniqueCallbacks.length,existingOverlaps:settings.existingOverlaps.length,unchangedCollectionFixture:1,productTestsRun:0}));
const imageEndpoints=JSON.parse(await readFile(new URL('docs/media-image-endpoints-source.json',root),'utf8'));
for(const file of imageEndpoints.files){const bytes=await readFile(new URL(file.frozenPath,root));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.blob)throw new Error(`Image endpoint source changed: ${file.sourcePath}`);}
for(const factory of imageEndpoints.factories??[]){
 const text=await readFile(new URL(factory.productPath,root),'utf8');
 if(createHash('sha256').update(text).digest('hex')!==factory.productSha256)throw new Error(`Image endpoint factory changed: ${factory.productPath}`);
 const product=ts.createSourceFile(factory.productPath,text,ts.ScriptTarget.Latest,true),declarations=new Map();
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.getText(product),node.getText(product));if(ts.isVariableStatement(node))for(const declaration of node.declarationList.declarations)declarations.set(declaration.name.getText(product),node.getText(product));ts.forEachChild(node,visit);}visit(product);
 for(const declaration of factory.declarations){let body=declarations.get(declaration.name);if(declaration.name==='GET')body=`export ${body}`;if(!body||createHash('sha256').update(body).digest('hex')!==declaration.sha256)throw new Error(`Image endpoint whole declaration changed: ${factory.sourcePath}:${declaration.name}`);}
}
console.log(JSON.stringify({verifiedWholeImageEndpointFiles:imageEndpoints.files.length,verifiedImageEndpointFactories:imageEndpoints.factories?.length??0,productTestsRun:0,passingSourceCredit:0}));
