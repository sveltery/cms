// Supplemental source-DDL/query-plan qualification, not upstream test credit.
// EmDash 1.1.0, MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { sql } from 'kysely';
import { collectionUpdateStorage } from '../tests/helpers/collection-update-fixture.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { currentTimestamp, listTablesLike } from '../src/lib/server/taxonomies/upstream/database/dialect-helpers.ts';
import { validateIdentifier } from '../src/lib/server/taxonomies/upstream/database/validate.ts';
import { FIELD_TYPE_TO_COLUMN, isStoragelessField } from '../src/lib/server/taxonomies/upstream/schema/types.ts';

const checkout = process.argv[2];
assert.ok(checkout, 'Pass the immutable EmDash checkout');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const digest = value => createHash('sha256').update(value).digest('hex');
const authority = source => execFileSync('git', ['-C', checkout, 'show', `${pin}:${source}`], { encoding: 'utf8' });
const source = authority('packages/core/src/schema/registry.ts');
assert.equal(source, readFileSync(`${checkout}/packages/core/src/schema/registry.ts`, 'utf8'));
const ast = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
const registry = ast.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'SchemaRegistry');
const names = ['createContentTable', 'getTableName', 'getColumnName', 'formatDefaultValue', 'getEmptyDefault'];
const methods = names.map(name => registry.members.find(member => member.name?.getText(ast) === name).getText(ast));
const declarations = ['SINGLE_QUOTE_PATTERN', 'COLUMN_TYPE_TO_DATA_TYPE'].map(name => ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name)).getText(ast));
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const SourceDDL = new Function('sql', 'currentTimestamp', 'validateIdentifier', 'FIELD_TYPE_TO_COLUMN', 'isStoragelessField', compile(`${declarations.join('\n')}\nclass SourceDDL {\n${methods.join('\n')}\n}\nreturn SourceDDL;`))(sql, currentTimestamp, validateIdentifier, FIELD_TYPE_TO_COLUMN, isStoragelessField);
const migration = authority('packages/core/src/database/migrations/055_content_translation_group_locale_index.ts');
const migrationAst = ts.createSourceFile('055.ts', migration, ts.ScriptTarget.Latest, true);
const up = migrationAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'up').getText(migrationAst).replace(/^export /, '');
const source055 = new Function('sql', 'listTablesLike', compile(`${up}\nreturn up;`))(sql, listTablesLike);
console.log(JSON.stringify({ pin, registrySha256: digest(source), completeMethods: names.map((name, index) => ({ name, sha256: digest(methods[index]) })), migration055Sha256: digest(migration), boundary: 'native registered metadata with complete pinned private DDL method/helpers; not complete source public registry/media activation' }));
for (const target of ['Node', 'D1']) {
 const storage = await collectionUpdateStorage(target);
 try {
  const database = storage.database, db = database.db;
  await migrateCms(database);
  const native = new SchemaRegistry(database);
  await native.createCollection({ slug: 'native_posts', label: 'Native Posts' });
  await native.createField('native_posts', { slug: 'title', label: 'Title', type: 'string' });
  await native.createCollection({ slug: 'source_posts', label: 'Source DDL Posts' });
  await sql`DROP TABLE ec_source_posts`.execute(db);
  const ddl = new SourceDDL();
  await ddl.createContentTable('source_posts', db, [{ slug: 'title', label: 'Title', type: 'string' }]);
  const explain = async table => (await sql`EXPLAIN QUERY PLAN SELECT id,locale,substr(title,1,200) AS title FROM ${sql.ref(table)} WHERE deleted_at IS NOT NULL AND status='draft' ORDER BY deleted_at DESC,id DESC LIMIT 50`.execute(db)).rows.map(row => row.detail);
  const indexes = async table => (await sql`SELECT rowid,name,sql FROM sqlite_master WHERE type='index' AND tbl_name=${table} ORDER BY rowid`.execute(db)).rows;
  console.log(JSON.stringify({ target, node: process.version, sqlite: target === 'Node' ? (await sql`SELECT sqlite_version() AS version`.execute(db)).rows[0].version : 'unavailable: D1 rejects sqlite_version introspection', phase: 'fresh', native: { plan: await explain('ec_native_posts'), indexes: await indexes('ec_native_posts') }, pinned: { plan: await explain('ec_source_posts'), indexes: await indexes('ec_source_posts') } }));
  await sql`DROP INDEX idx_ec_source_posts_del_tg_locale`.execute(db);
  await source055(db);
  console.log(JSON.stringify({ target, phase: 'source055-after-existing-trash', pinned: { plan: await explain('ec_source_posts'), indexes: await indexes('ec_source_posts') } }));
 } finally { await storage.close(); }
}
