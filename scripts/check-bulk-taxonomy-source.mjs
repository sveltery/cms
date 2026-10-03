import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const ledger=JSON.parse(readFileSync(new URL('../docs/bulk-taxonomy-source.json',import.meta.url),'utf8'));
for(const record of ledger.files){const data=readFileSync(new URL(`../${record.copiedPath}`,import.meta.url));if(data.length!==record.bytes||createHash('sha256').update(data).digest('hex')!==record.sha256||createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')!==record.blob)throw new Error(`Changed Source authority: ${record.path}`);}
const record=ledger.files.find(file=>file.path==='packages/admin/tests/components/BulkTagDialog.test.tsx'),source=ts.createSourceFile(record.path,readFileSync(new URL(`../${record.copiedPath}`,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declarations=0,expects=0,elements=0;function visit(node){if(ts.isCallExpression(node)){const callee=node.expression.getText(source).replace(/\s+/g,'');if(callee==='it'||callee==='test')declarations++;if(callee==='expect')expects++;if(callee==='expect.element')elements++;}ts.forEachChild(node,visit);}visit(source);
if(declarations!==ledger.testDeclarations||expects!==ledger.expectCalls||elements!==ledger.elementExpects)throw new Error(`Source inventory differs: ${JSON.stringify({declarations,expects,elements})}`);
console.log(JSON.stringify({pin:ledger.pin,sourceFiles:ledger.files.length,declarations,expects,elements,productTestsRun:0}));
