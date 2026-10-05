// Supplemental pinned-method witness, not an original Source test family.
// All evaluated Source bytes are immutable authorities verified before use.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as kysely from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {localD1} from '../tests/helpers/local-d1-fixture.ts';
const root=fileURLToPath(new URL('..',import.meta.url));
const ledger=JSON.parse(readFileSync(new URL('../docs/schema-admin-completion-source.json',import.meta.url),'utf8'));
const witness=JSON.parse(readFileSync(new URL('../docs/schema-admin-index-trigger-source.json',import.meta.url),'utf8'));
assert.equal(witness.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
function load(record) {
  const path=record.destination??record.target;const bytes=readFileSync(root+'/'+path);
  assert.equal(bytes.length,record.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),record.sourceGitBlob??record.gitBlob);
  return bytes.toString('utf8');
}
function evaluate(source,imports={}) {
  const exports={};
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports',code)(name=>{assert.ok(name in imports,'Unmapped original Source import: '+name);return imports[name];},exports);
  return exports;
}
const record=source=>witness.records.find(item=>item.source===source);
const validator=evaluate(load(record('packages/core/src/database/validate.ts')));
const helpers=evaluate(load(record('packages/core/src/database/dialect-helpers.ts')),{'kysely':kysely,'./validate.js':validator});
const initial=evaluate(load(record('packages/core/src/database/migrations/001_initial.ts')),{'kysely':kysely,'../dialect-helpers.js':helpers});
const registryRecord=ledger.standardCollectionIndexesForwardRuntime.sourceAuthorities.find(item=>item.source==='packages/core/src/schema/registry.ts');
const registryText=load(registryRecord);
const typesRecord=ledger.authorities.find(item=>item.source==='packages/core/src/schema/types.ts');
const types=evaluate(load(typesRecord));
const ast=ts.createSourceFile('registry.ts',registryText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const registry=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='SchemaRegistry');
const methodNames=['createContentTable','getTableName','getColumnName','formatDefaultValue','getEmptyDefault'];
const methods=methodNames.map(name=>registry.members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)===name).getText(ast));
const names=['COLUMN_TYPE_TO_DATA_TYPE','SINGLE_QUOTE_PATTERN'];
const constants=names.map(name=>ast.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(ast)===name)).getText(ast));
const code=ts.transpileModule(constants.join('\n')+'\nclass SourceFixture {constructor(db){this.db=db;}\n'+methods.join('\n')+'\n}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const Reference=new Function('sql','currentTimestamp','validateIdentifier','FIELD_TYPE_TO_COLUMN','isStoragelessField',code+'\nreturn SourceFixture;')(kysely.sql,helpers.currentTimestamp,validator.validateIdentifier,types.FIELD_TYPE_TO_COLUMN,types.isStoragelessField);
for(const target of ['Node','D1']) {
  const fixture=target==='Node'?{database:openSqlite(':memory:')}:await localD1();
  try {
    await initial.up(fixture.database.db);
    await new Reference(fixture.database.db).createContentTable('posts',undefined,[{slug:'title',label:'Title',type:'string',unique:true,defaultValue:'Default'}]);
    await kysely.sql`INSERT INTO ec_posts(id,slug,status,locale,created_at,updated_at,deleted_at,version,title)
      VALUES('retained',NULL,'draft','fr','2026-10-05T00:00:00.000Z','2026-10-05T00:01:00.000Z','2026-10-05T00:01:00.000Z',2,'Retained')`.execute(fixture.database.db);
    const indexes=(await kysely.sql`SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='ec_posts' AND name NOT LIKE 'sqlite_%' ORDER BY name`.execute(fixture.database.db)).rows;
    assert.equal(indexes.length,16);
    const plan=(await kysely.sql`EXPLAIN QUERY PLAN SELECT id,locale,substr(title,1,200) AS title FROM ec_posts
      WHERE deleted_at IS NOT NULL AND status='draft' ORDER BY deleted_at DESC,id DESC LIMIT 50`.execute(fixture.database.db)).rows;
    assert.deepEqual(plan.map(row=>row.detail),['SCAN ec_posts','USE TEMP B-TREE FOR ORDER BY']);
    process.stdout.write(JSON.stringify({target,sourcePin:witness.pin,registryAuthority:registryRecord.sourceGitBlob,methods:methodNames,indexes,plan,originalSourceCallbackCredit:0})+'\n');
  }finally{await fixture.database.close();await fixture.runtime?.dispose();}
}
