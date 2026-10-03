// Original installed-package requirements. Zero new EmDash assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sql} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {seedMaintenance,observeMaintenance} from '../helpers/revision-maintenance/hosting-fixture.ts';

async function install(directory:string) {
  const app=join(directory,'app');
  await cp(new URL('../../node-package/',import.meta.url),app,{recursive:true});
  const pnpm=process.env.npm_execpath;
  assert.ok(pnpm,'Use pnpm test:node with the pinned package manager');
  const args=['install','--prod','--frozen-lockfile','--ignore-scripts','--store-dir',
    process.env.CMS_NODE_TEST_STORE??join(directory,'store'),
    ...(process.env.CMS_NODE_TEST_OFFLINE==='true'?['--offline']:[])];
  const transport=Object.fromEntries(['PATH','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE']
    .filter(name=>process.env[name]!==undefined).map(name=>[name,process.env[name]]));
  execFileSync(/\.[cm]?js$/.test(pnpm)?process.execPath:pnpm,/\.[cm]?js$/.test(pnpm)?[pnpm,...args]:args,
    {cwd:app,timeout:120_000,stdio:'pipe',env:{...transport,CI:'true'}});
  assert.ok(!(await readdir(join(app,'node_modules'))).includes('vite'));
  assert.ok(!(await readdir(join(app,'node_modules'))).includes('svelte'));
  return app;
}

async function runInstalled(app:string,body:string) {
  await writeFile(join(app,'operator.mjs'),`import assert from 'node:assert/strict';
let maintenance;try{maintenance=await import('@sveltery/cms/maintenance');}catch(error){maintenance={unavailable:error.code};}
assert.equal(typeof maintenance.runRevisionMaintenance,'function','The isolated production package must export callable revision maintenance');
${body}\n`);
  return execFileSync(process.execPath,['operator.mjs'],{cwd:app,timeout:30_000,encoding:'utf8',stdio:'pipe',env:{PATH:process.env.PATH}});
}

test('isolated Node maintenance export prunes real persistent history, protects pointers and works after process restart',{timeout:180_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-package-revisions-'));
  const path=join(directory,'database','cms.sqlite');
  let database:ReturnType<typeof openSqlite>|undefined;
  try {
    const app=await install(directory);
    await mkdir(join(directory,'database'));
    database=openSqlite(path);
    const protectedIds=await seedMaintenance(database);
    await database.close();database=undefined;
    const result=await runInstalled(app,`assert.deepEqual(await maintenance.runRevisionMaintenance({kind:'sqlite',path:${JSON.stringify(path)}}),{revisionsPruned:8});`);
    assert.equal(result,'');
    database=openSqlite(path);await observeMaintenance(database,protectedIds);await database.close();database=undefined;
    await runInstalled(app,`assert.deepEqual(await maintenance.runRevisionMaintenance({kind:'sqlite',path:${JSON.stringify(path)}}),{revisionsPruned:0});`);
    database=openSqlite(path);await observeMaintenance(database,protectedIds);
    const manifest=JSON.parse(await readFile(join(app,'package.json'),'utf8'));
    assert.equal(manifest.exports['./maintenance'],'./build/maintenance.js');
  }finally{await database?.close();await rm(directory,{recursive:true,force:true});}
});

test('isolated Node maintenance startup refusal closes storage and preserves operator data',{timeout:180_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-package-revision-refusal-'));
  const path=join(directory,'operator.sqlite');
  let database:ReturnType<typeof openSqlite>|undefined;
  try {
    const app=await install(directory);
    database=openSqlite(path);
    await sql`CREATE TABLE _cms_operator_private(id INTEGER PRIMARY KEY,value TEXT NOT NULL)`.execute(database.db);
    await sql`INSERT INTO _cms_operator_private VALUES(1,'preserved')`.execute(database.db);
    await database.close();database=undefined;
    await runInstalled(app,`await assert.rejects(maintenance.runRevisionMaintenance({kind:'sqlite',path:${JSON.stringify(path)}}),error=>error.code==='MIGRATION_REQUIRED');
await assert.rejects(maintenance.runRevisionMaintenance({kind:'sqlite',path:':memory:'}),/persistent SQLite/);`);
    database=openSqlite(path);
    assert.deepEqual((await sql`SELECT * FROM _cms_operator_private`.execute(database.db)).rows.map(row=>({...row})),[{id:1,value:'preserved'}]);
    assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`.execute(database.db)).rows.map(row=>({...row})),[{name:'_cms_operator_private'}]);
  }finally{await database?.close();await rm(directory,{recursive:true,force:true});}
});
