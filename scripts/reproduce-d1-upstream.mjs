// Isolated execution of the immutable upstream dialect, never the local adapter.
// Requires curl, tar, npm and the installed CMS dev tools. No live Cloudflare resources.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-d1-'));
const sources = [
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384'],
  ['packages/cloudflare/tests/db/d1-dialect.test.ts', '1a2fb80b94961c02c47b4ec5b6725f3493f63489']
];
sources.push(...['packages/cloudflare/src/db/d1-introspector.ts', 'packages/core/src/database/migration-lock.ts',
  'packages/core/src/database/pg-migration-lock.ts', 'packages/core/src/utils/db-errors.ts'].map(path => [path, null]));
try {
  for (const [path, blob] of sources) {
    const destination = join(directory, path); await mkdir(dirname(destination), { recursive: true });
    execFileSync('curl', ['-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    if (blob) {
      const contents = await readFile(destination);
      const actual = createHash('sha1').update(`blob ${contents.length}\0`).update(contents).digest('hex');
      if (actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
    }
  }
  execFileSync('npm', ['pack', 'kysely-d1@0.4.0', '--cache', join(directory, 'npm-cache'), '--pack-destination', directory], { cwd: directory });
  if (createHash('sha1').update(await readFile(join(directory, 'kysely-d1-0.4.0.tgz'))).digest('hex') !== '3122753e3d3d1d00d118ff756a329ae2318b1589') throw new Error('kysely-d1 tarball mismatch');
  execFileSync('tar', ['-xzf', join(directory, 'kysely-d1-0.4.0.tgz'), '-C', directory]);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  const bridge = join(directory, 'bridge.ts');
  await writeFile(bridge, `import { Kysely } from 'kysely';
import { RawBindingD1Dialect as UpstreamDialect } from './packages/cloudflare/src/db/d1-dialect.ts';
export class RawBindingD1Dialect extends UpstreamDialect { constructor(database) { super({ database }); } }
export function openD1(database) {
  const dialect = new RawBindingD1Dialect(database); const db = new Kysely({dialect});
  return { db, atomicBatch: queries => dialect.createAdapter().executeAtomicBatch(queries), close: () => db.destroy() };
}
`);
  const adaptedTests = (await readFile(join(root, 'tests/database-d1-upstream.test.ts'), 'utf8')).split('// Supplemental liveness')[0]
    .replace('../src/lib/server/database/d1.ts', './bridge.ts');
  await writeFile(join(directory, 'source-tests.ts'), adaptedTests);
  await writeFile(join(directory, 'entry.ts'), `import './source-tests.ts';
import test from 'node:test'; import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare'; import { CompiledQuery } from 'kysely'; import { openD1 } from './bridge.ts';
test('pin: real local D1 zero changes, raw parameters and first-write DDL rollback', async () => {
  const mf = new Miniflare({modules:true, script:'export default {fetch(){return new Response("fixture")}}', compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream'}});
  const database = openD1(await mf.getD1Database('DB'));
  try {
    const before = await database.db.executeQuery(CompiledQuery.raw('SELECT name FROM sqlite_master ORDER BY name'));
    await assert.rejects(() => database.atomicBatch([CompiledQuery.raw('CREATE TABLE transient (id INTEGER)'), CompiledQuery.raw('SELECT * FROM absent')]), /absent/);
    const after = await database.db.executeQuery(CompiledQuery.raw('SELECT name FROM sqlite_master ORDER BY name'));
    assert.deepEqual(before.rows, []); assert.deepEqual(after.rows, [{name:'_cf_METADATA'}]);
    await database.db.executeQuery(CompiledQuery.raw('CREATE TABLE parameters (value)'));
    for (const value of [undefined,7n,{},new Date(0),new Number(1)]) {
      await assert.rejects(() => database.atomicBatch([CompiledQuery.raw('INSERT INTO parameters VALUES (?)',['would commit']),CompiledQuery.raw('INSERT INTO parameters VALUES (?)',[value])]), /D1_TYPE_ERROR/);
      assert.deepEqual((await database.db.executeQuery(CompiledQuery.raw('SELECT * FROM parameters'))).rows, []);
    }
    for (const [value, expected] of [[null,null],[true,1],[false,0],[7,7],['text','text'],[new Uint8Array([1,2]),[1,2]],[new Uint8Array([1,2]).buffer,[1,2]],[[1,2],[1,2]]]) {
      assert.deepEqual((await database.db.executeQuery(CompiledQuery.raw('SELECT ? AS value',[value]))).rows,[{value:expected}]);
    }
    const result = await database.atomicBatch([CompiledQuery.raw('UPDATE parameters SET value = ? WHERE value = ?',['changed','absent'])]);
    assert.equal(result[0].numAffectedRows,undefined);
    assert.equal((await database.db.executeQuery(CompiledQuery.raw('UPDATE parameters SET value = ? WHERE value = ?',['changed','absent']))).numAffectedRows,undefined);
    console.log('Pinned upstream reproduced: zero=>undefined; unsupported undefined/bigint/object/Date/boxed number; byte array/ArrayBuffer/array BLOB support; only _cf_METADATA remains after first failed DDL batch.');
  } finally {await database.close(); await mf.dispose();}
});
`);
  const built = await build({ configFile: false, logLevel: 'error', resolve: { alias: [
    { find: /^kysely$/, replacement: resolve(root, 'node_modules/kysely/dist/index.js') },
    { find: 'kysely-d1', replacement: join(directory, 'package/dist/index.js') },
    { find: 'emdash/internal/database/migration-lock', replacement: join(directory, 'packages/core/src/database/migration-lock.ts') }
  ] }, build: { target: 'es2022', minify: false, write: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: 'upstream' },
    rollupOptions: { external: ['miniflare', /^node:/] }
  } });
  const output = Array.isArray(built) ? built[0] : built;
  const chunk = output.output.find(item => item.type === 'chunk');
  const executable = join(directory, 'upstream.mjs'); await writeFile(executable, chunk.code);
  execFileSync(process.execPath, ['--test', executable], { stdio: 'inherit', timeout: 30000 });
} finally { await rm(directory, { recursive: true, force: true }); }
