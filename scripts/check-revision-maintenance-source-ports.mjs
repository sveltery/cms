import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const ledger=JSON.parse(await readFile('docs/revision-maintenance-ports.json','utf8'));
const hash=text=>createHash('sha256').update(text).digest('hex');
function ast(text){return ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true);}
function callbacks(text) {
  const tree=ast(text),result=new Map();
  function visit(node){
    if(ts.isCallExpression(node)&&node.expression.getText(tree)==='it'&&ts.isStringLiteral(node.arguments[0])) {
      let assertions=0;
      function count(child){if(ts.isCallExpression(child)&&child.expression.getText(tree)==='expect')assertions++;ts.forEachChild(child,count);}
      count(node);
      result.set(node.arguments[0].text,{declaration:node.getText(tree),assertions});
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);return result;
}
function coordinator(text) {
  const tree=ast(text);
  const node=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='pruneQueuedRevisions');
  assert.ok(node,'Complete coordinator declaration is present');
  return node.getText(tree).replace(/^export /,'');
}
const local=new Map();
for(const file of ['tests/revision-maintenance-upstream.test.ts','tests/revision-maintenance-pruning-upstream.test.ts']) {
  for(const [title,item] of callbacks(await readFile(file,'utf8'))){assert.ok(!local.has(title));local.set(title,item);}
}
assert.equal(local.size,ledger.copiedDeclarations);
for(const item of ledger.callbacks) {
  const copied=local.get(item.title);assert.ok(copied,item.title);
  assert.equal(hash(copied.declaration),item.sha256,item.title);
  assert.equal(copied.assertions,item.assertions,item.title);
}
assert.equal([...local.values()].reduce((total,item)=>total+item.assertions,0),ledger.assertionExpressions);
const reference=coordinator(await readFile('tests/helpers/revision-maintenance/source-coordinator.ts','utf8'));
assert.equal(hash(reference),ledger.sourceCoordinatorSHA256);
const product=coordinator(await readFile('src/lib/server/maintenance/revisions.ts','utf8'));
assert.equal(product,reference.replaceAll('_emdash_revision_prune_queue','_cms_revision_prune_queue'));
assert.equal(hash(await readFile('tests/helpers/revision-maintenance/source-revision.ts','utf8')),ledger.sourceRevisionReferenceLocalSHA256);
const pluginTree=ast(await readFile('tests/revision-maintenance-pruning-upstream.test.ts','utf8'));
const plugin=pluginTree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='InsertAfterPruneSnapshotPlugin');
assert.ok(plugin);
const originalPlugin=plugin.getText(pluginTree).replace('private readonly insertRevision: () => Promise<void>;\n constructor(insertRevision: () => Promise<void>) { this.insertRevision=insertRevision; }','constructor(private readonly insertRevision: () => Promise<void>) {}');
assert.equal(hash(originalPlugin),ledger.snapshotPlugin.sha256);
const upstream=process.argv[2];
if(upstream) {
  for(const item of ledger.authority) {
    const blob=execFileSync('git',['rev-parse',`${ledger.pin}:${item.path}`],{cwd:upstream,encoding:'utf8'}).trim();
    const text=execFileSync('git',['show',`${ledger.pin}:${item.path}`],{cwd:upstream,encoding:'utf8'});
    assert.equal(blob,item.blob,item.path);assert.equal(hash(text),item.sha256,item.path);
    if(item.path.endsWith('.test.ts'))for(const identity of ledger.callbacks.filter(callback=>callback.path===item.path)) {
      const original=callbacks(text).get(identity.title);assert.ok(original,identity.title);
      assert.equal(hash(original.declaration),identity.sha256,identity.title);
    }
    if(item.path==='packages/core/src/cleanup.ts')assert.equal(coordinator(text),reference);
    if(item.path==='packages/core/src/database/repositories/revision.ts') {
      let expected=text.replaceAll('../content-datetime.js','../../../src/lib/server/database/lifecycle/upstream/database/content-datetime.ts')
        .replaceAll('../types.js','../../../src/lib/server/database/lifecycle/upstream/database/types.ts')
        .replaceAll('../validate.js','../../../src/lib/server/database/lifecycle/upstream/database/validate.ts')
        .replace('export class RevisionRepository {','export class RevisionRepository {\n private db: Kysely<Database>;')
        .replace('private db: Kysely<Database>,','db: Kysely<Database>,')
        .replace('this.datetimes = new ContentDatetimeNormalizer(db, datetimeContexts);','this.db = db;\n\t\tthis.datetimes = new ContentDatetimeNormalizer(db, datetimeContexts);');
      const copied=await readFile('tests/helpers/revision-maintenance/source-revision.ts','utf8');
      assert.equal(copied.slice(copied.indexOf('import { sql,')),expected);
    }
  }
}
console.log(JSON.stringify({pin:ledger.pin,wholeDeclarations:ledger.copiedDeclarations,expectExpressions:ledger.assertionExpressions,
  coordinatorNamespaceOnly:true,originalAuthorityBlobsVerified:upstream?ledger.authority.length:0,productTestsRun:0}));
