// Reproduce exact pinned whole TaxonomyRepository; MIT Cloudflare Inc.2026.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',source='packages/core/src/database/repositories/taxonomy.ts';
const repository=process.env.CMS_EMDASH_REPOSITORY??'/tmp/cms-emdash-full';
const directory=await mkdtemp(join(tmpdir(),'cms-taxonomy-pin-')),root=new URL('../',import.meta.url).pathname;
try{
 const bytes=execFileSync('git',['-C',repository,'show',`${pin}:${source}`]);
 const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if(blob!=='a1eaae54f6d887e5647be69ef3aab15ebe862705')throw Error('immutable source blob mismatch');
 await mkdir(join(directory,'repository'));await writeFile(join(directory,'repository','taxonomy.ts'),bytes);
 await symlink(join(root,'node_modules'),join(directory,'node_modules'));
 await writeFile(join(directory,'entry.ts'),`
import assert from 'node:assert/strict';
import {Kysely,SqliteDialect,sql} from 'kysely';
import {NodeSqliteCompatDatabase} from ${JSON.stringify(join(root,'src/lib/server/database/node-sqlite-compat.ts'))};
import {TaxonomyRepository} from './repository/taxonomy.ts';
const db=new Kysely({dialect:new SqliteDialect({database:new NodeSqliteCompatDatabase(':memory:')})});
await sql\`CREATE TABLE taxonomies(id TEXT PRIMARY KEY,name TEXT,slug TEXT,label TEXT,parent_id TEXT,data TEXT,locale TEXT DEFAULT 'en',translation_group TEXT,sort_order INTEGER DEFAULT 0)\`.execute(db);
await sql\`CREATE TABLE ec_posts(id TEXT PRIMARY KEY,translation_group TEXT)\`.execute(db);
await sql\`CREATE TABLE content_taxonomies(collection TEXT,entry_id TEXT,taxonomy_id TEXT,PRIMARY KEY(collection,entry_id,taxonomy_id))\`.execute(db);
await sql\`INSERT INTO ec_posts VALUES ('entry','entry')\`.execute(db);
const repo=new TaxonomyRepository(db),old=await repo.create({name:'tag',slug:'old',label:'Old'}),next=await repo.create({name:'tag',slug:'next',label:'Next'});
await repo.setTermsForEntry('posts','entry','tag',[old.id]);
await sql\`CREATE TRIGGER reject_new_term BEFORE INSERT ON content_taxonomies WHEN NEW.taxonomy_id=\${sql.lit(next.translationGroup)} BEGIN SELECT RAISE(ABORT,'assignment failure'); END\`.execute(db);
await assert.rejects(repo.setTermsForEntry('posts','entry','tag',[next.id]),/assignment failure/);
const actual=(await repo.getTermsForEntry('posts','entry','tag')).map(term=>term.slug);
assert.deepEqual(actual,[]);console.log(JSON.stringify({pin:${JSON.stringify(pin)},blob:${JSON.stringify(blob)},actualAfterFailure:actual,priorAssignmentLost:true,hostEdges:['real native SQLite','default disabled object cache host','three test fixture tables; full whole pinned repository body']}));
await db.destroy();
`);
 await build({configFile:false,plugins:[{name:'exact-repository-host',enforce:'pre',resolveId(id,importer){if(importer?.endsWith('/repository/taxonomy.ts')){
  if(id==='../../object-cache/index.js')return join(root,'src/lib/server/taxonomies/upstream/object-cache/index.ts');
  if(id==='../../utils/slugify.js')return join(repository,'packages/core/src/utils/slugify.ts');
  if(id==='../../utils/chunks.js')return join(repository,'packages/core/src/utils/chunks.ts');
  if(id==='../transaction.js')return join(repository,'packages/core/src/database/transaction.ts');
  if(id==='../validate.js')return join(repository,'packages/core/src/database/validate.ts');
 }}}],build:{ssr:join(directory,'entry.ts'),outDir:join(directory,'output'),emptyOutDir:true,rollupOptions:{output:{entryFileNames:'entry.mjs'}}},logLevel:'error'});
 await import(pathToFileURL(join(directory,'output/entry.mjs')).href);
}finally{await rm(directory,{recursive:true,force:true});}
