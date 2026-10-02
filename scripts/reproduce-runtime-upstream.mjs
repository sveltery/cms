// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Run the pinned original SQLite adapter with the original expected PRAGMA rows.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Kysely, sql } from 'kysely';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const upstream = process.argv[2];
if (!upstream) throw new Error('Usage: node scripts/reproduce-runtime-upstream.mjs /path/to/pinned-emdash-clone');
const sources = {
  'sqlite.ts': ['packages/core/src/db/sqlite.ts', '7767c114295d08c9f62a4128a69b058cc47a3e86'],
  'node-sqlite-compat.ts': ['packages/core/src/db/node-sqlite-compat.ts', 'f9487f8a86262d8c28b0780cbdd097e0b4252a3b']
};
const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-source-'));
try {
  for (const [name, [path, expected]] of Object.entries(sources)) {
    const blob = execFileSync('git', ['rev-parse', `${pin}:${path}`], { cwd: upstream, encoding: 'utf8' }).trim();
    assert.equal(blob, expected);
    let source = execFileSync('git', ['show', `${pin}:${path}`], { cwd: upstream, encoding: 'utf8' });
    if (name === 'sqlite.ts') source = source.replace('./node-sqlite-compat.js', './node-sqlite-compat.ts');
    await writeFile(join(directory, name), source);
  }
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(directory, 'node_modules'), 'dir');
  const { createDialect } = await import(pathToFileURL(join(directory, 'sqlite.ts')).href);
  const db = new Kysely({ dialect: createDialect({ url: `file:${join(directory, 'data.db')}` }) });
  try {
    const { rows } = await sql`PRAGMA journal_mode`.execute(db);
    assert.deepEqual(rows.map(row => ({ ...row })), [{ journal_mode: 'wal' }]);
    const synchronous = await sql`PRAGMA synchronous`.execute(db);
    assert.deepEqual(synchronous.rows.map(row => ({ ...row })), [{ synchronous: 1 }]);
    console.log(JSON.stringify({ pin, sourceId: `${pin}:packages/core/tests/unit/db/sqlite.test.ts:25`, assertionsPassed: 2 }));
  } finally { await db.destroy(); }
} finally { await rm(directory, { recursive: true, force: true }); }
