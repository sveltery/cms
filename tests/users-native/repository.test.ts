// Original Native SQL requirements derived from the whole pinned UserRepository.
// EmDash 1.1.0 / 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e;
// Source authorities live in parity/emdash/users/source; MIT notice retained there.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import { identityAdapter } from '../../src/lib/server/auth/identity-store.ts';
import { UserRepository } from '@sveltery/user-repository-under-test';

const date = '2025-04-03 12:13:14';
async function insertProfile(database: CmsDatabase, id: string, role = 30, createdAt = date) {
  await database.atomicBatch([
    sql`INSERT INTO _cms_auth_users (id,role,disabled) VALUES (${id},${role},0)`.compile(database.db),
    sql`INSERT INTO _cms_auth_profiles
      (user_id,email,name,avatar_url,email_verified,data,created_at,updated_at)
      VALUES (${id},${id + '@example.com'},${'Name ' + id},NULL,0,NULL,${createdAt},${createdAt})`.compile(database.db)
  ]);
}
async function readRows(database: CmsDatabase) {
  return {
    users: (await database.db.selectFrom('_cms_auth_users').selectAll().orderBy('id').execute()).map(row => ({ ...row })),
    profiles: (await database.db.selectFrom('_cms_auth_profiles').selectAll().orderBy('user_id').execute()).map(row => ({ ...row }))
  };
}
async function catalogue(database: CmsDatabase) {
  return (await sql`SELECT name,type,tbl_name,sql FROM sqlite_master ORDER BY name,type`.execute(database.db)).rows;
}
async function created(repository: UserRepository, input: Parameters<UserRepository['create']>[0]) {
  let result: Awaited<ReturnType<UserRepository['create']>> | undefined;
  await assert.doesNotReject(async () => { result = await repository.create(input); },
    'Core user creation must execute on the actual migrated Native storage');
  assert.ok(result);
  return result;
}

for (const target of ['Node SQLite', 'raw workerd D1'] as const) {
  async function fixture() {
    let database: CmsDatabase;
    let dispose: () => Promise<void>;
    if (target === 'Node SQLite') {
      database = openSqlite(':memory:');
      dispose = async () => { await database.close(); };
    } else {
      const storage = await asyncD1Storage();
      database = openD1(storage.binding);
      dispose = async () => { await database.close(); await storage.runtime.dispose(); };
    }
    try { await migrateCms(database); }
    catch (cause) { await dispose(); throw cause; }
    return { database, repository: new UserRepository(database), dispose };
  }

  test(`${target}: creates a full default subscriber and preserves Source SQLite timestamps`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      const before = await catalogue(f.database);
      const user = await created(f.repository, { email: 'Ada@Example.COM' });
      assert.match(user.id, /^[0-9A-Z]{26}$/);
      assert.deepEqual({ email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified, data: user.data },
      { email: 'ada@example.com', name: null, role: 10, avatarUrl: null, emailVerified: false, data: null });
      assert.match(user.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      const rows = await readRows(f.database);
      assert.deepEqual(rows.users, [{ id: user.id, role: 10, disabled: 0 }]);
      assert.deepEqual(rows.profiles.map(row => ({ ...row })), [{ user_id: user.id, email: 'ada@example.com',
        name: null, avatar_url: null, email_verified: 0, data: null, created_at: user.createdAt, updated_at: user.createdAt }]);
      assert.deepEqual(await catalogue(f.database), before);
    } finally { await f.dispose(); }
  });

  test(`${target}: creates named roles, avatar URLs and full JSON profile data`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      const data = { welcomeDismissed: true, biography: 'Author', preferences: { language: 'fr' }, tags: ['a', 2] };
      const user = await created(f.repository, { email: 'author@example.com', name: 'Ada', role: 'author',
        avatarUrl: '/media/avatar.png', data });
      assert.equal(user.role, 30);
      assert.equal(user.name, 'Ada');
      assert.equal(user.avatarUrl, '/media/avatar.png');
      assert.deepEqual(user.data, data);
      assert.equal(await f.database.db.selectFrom('_cms_auth_users').select('role').where('id', '=', user.id)
        .executeTakeFirstOrThrow().then(row => row.role), 30);
    } finally { await f.dispose(); }
  });

  test(`${target}: email uniqueness rejects the whole atomic create without leaving an identity`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await created(f.repository, { email: 'same@example.com', role: 'editor' });
      const before = await readRows(f.database);
      await assert.rejects(() => f.repository.create({ email: 'SAME@EXAMPLE.COM', role: 'admin' }), /UNIQUE constraint failed/);
      assert.deepEqual(await readRows(f.database), before);
    } finally { await f.dispose(); }
  });

  test(`${target}: resolves complete existing profiles by ID and case-insensitive email`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'legacy-profile', 40);
      let user: Awaited<ReturnType<UserRepository['findById']>> | undefined;
      await assert.doesNotReject(async () => { user = await f.repository.findById('legacy-profile'); });
      assert.ok(user);
      assert.deepEqual(user, { id: 'legacy-profile', email: 'legacy-profile@example.com', name: 'Name legacy-profile',
        role: 40, avatarUrl: null, emailVerified: false, data: null, createdAt: date });
      assert.deepEqual(await f.repository.findByEmail('LEGACY-PROFILE@EXAMPLE.COM'), user);
      assert.equal(await f.repository.findById('missing'), null);
      assert.equal(await f.repository.findByEmail('missing@example.com'), null);
      assert.equal(await f.repository.emailExists('LEGACY-PROFILE@EXAMPLE.COM'), true);
      assert.equal(await f.repository.emailExists('missing@example.com'), false);
    } finally { await f.dispose(); }
  });

  test(`${target}: batches IDs while dropping duplicates, empty IDs and absent profiles`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      const ids = Array.from({ length: 121 }, (_, index) => `batch-${String(index).padStart(3, '0')}`);
      for (const id of ids) await insertProfile(f.database, id);
      let found: Awaited<ReturnType<UserRepository['findByIds']>> | undefined;
      await assert.doesNotReject(async () => { found = await f.repository.findByIds([...ids, ids[0], '', 'missing']); });
      assert.ok(found);
      assert.deepEqual(found.map(user => user.id).toSorted(), ids);
      assert.deepEqual(await f.repository.findByIds([]), []);
      assert.deepEqual(await f.repository.findByIds(['', 'missing']), []);
    } finally { await f.dispose(); }
  });

  test(`${target}: pages tied timestamps without duplicates and filters each exact role`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      for (const [index, role] of [10, 20, 30, 40, 50].entries()) await insertProfile(f.database, `page-${index}`, role);
      let first: Awaited<ReturnType<UserRepository['findMany']>> | undefined;
      await assert.doesNotReject(async () => { first = await f.repository.findMany({ limit: 1 }); });
      assert.ok(first);
      const seen = [...first.items.map(user => user.id)];
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await f.repository.findMany({ limit: 1, cursor });
        assert.equal(page.items.length, 1);
        seen.push(page.items[0].id);
        cursor = page.nextCursor;
      }
      assert.deepEqual(seen, ['page-4', 'page-3', 'page-2', 'page-1', 'page-0']);
      for (const role of [10, 20, 30, 40, 50] as const) {
        const page = await f.repository.findMany({ role });
        assert.equal(page.items.length, 1);
        assert.equal(page.items[0].role, role);
        assert.equal(await f.repository.count(role), 1);
      }
      assert.equal((await f.repository.findMany({ role: 'contributor' })).items[0].role, 20);
      assert.equal(await f.repository.count(), 5);
      assert.equal((await f.repository.findMany({ limit: -9 })).items.length, 1);
      assert.equal((await f.repository.findMany({ limit: 500 })).items.length, 5);
      await assert.rejects(() => f.repository.findMany({ cursor: 'not a valid cursor' }), { name: 'InvalidCursorError' });
    } finally { await f.dispose(); }
  });

  test(`${target}: updates role and profile fields together without changing core timestamps`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'update-profile', 20);
      let updated: Awaited<ReturnType<UserRepository['update']>> | undefined;
      await assert.doesNotReject(async () => { updated = await f.repository.update('update-profile', {
        name: 'Changed', role: 'admin', avatarUrl: '/avatar.png', data: { welcomeDismissed: true } }); });
      assert.ok(updated);
      assert.equal(updated.role, 50);
      assert.equal(updated.name, 'Changed');
      assert.equal(updated.avatarUrl, '/avatar.png');
      assert.deepEqual(updated.data, { welcomeDismissed: true });
      const rows = await readRows(f.database);
      assert.equal(rows.users[0].role, 50);
      assert.equal(rows.users[0].disabled, 0);
      assert.equal(rows.profiles[0].created_at, date);
      assert.equal(rows.profiles[0].updated_at, date);
      assert.equal(rows.profiles[0].email, 'update-profile@example.com');
      const cleared = await f.repository.update('update-profile', { avatarUrl: null, data: {} });
      assert.equal(cleared?.avatarUrl, null);
      assert.deepEqual(cleared?.data, {});
      const before = await readRows(f.database);
      assert.deepEqual(await f.repository.update('update-profile', {}), cleared);
      assert.deepEqual(await readRows(f.database), before);
      assert.equal(await f.repository.update('missing', { name: 'Missing' }), null);
    } finally { await f.dispose(); }
  });

  test(`${target}: an operator profile rejection rolls back both role and profile changes`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'operator-profile', 30);
      await sql`CREATE TRIGGER operator_reject_profile BEFORE UPDATE ON _cms_auth_profiles
        WHEN NEW.name='Rejected' BEGIN SELECT RAISE(ABORT,'operator profile rejection'); END`.execute(f.database.db);
      const before = await readRows(f.database);
      let existing: Awaited<ReturnType<UserRepository['findById']>> | undefined;
      await assert.doesNotReject(async () => { existing = await f.repository.findById('operator-profile'); });
      assert.ok(existing);
      await assert.rejects(() => f.repository.update(existing!.id, { role: 'admin', name: 'Rejected' }), /operator profile rejection/);
      assert.deepEqual(await readRows(f.database), before);
    } finally { await f.dispose(); }
  });

  test(`${target}: deleting a complete profile returns true once and uses the stored identity cascade`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'delete-profile', 40);
      let deleted: boolean | undefined;
      await assert.doesNotReject(async () => { deleted = await f.repository.delete('delete-profile'); });
      assert.equal(deleted, true);
      assert.equal(await f.repository.delete('delete-profile'), false);
      assert.equal(await f.repository.delete('missing'), false);
      assert.deepEqual(await readRows(f.database), { users: [], profiles: [] });
    } finally { await f.dispose(); }
  });

  test(`${target}: profileless historical identities are preserved without fabricated user rows`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await f.database.db.insertInto('_cms_auth_users').values({ id: 'profileless', role: 40, disabled: 1 }).execute();
      await insertProfile(f.database, 'complete-profile', 30);
      const before = await readRows(f.database);
      let missing: Awaited<ReturnType<UserRepository['findById']>> | undefined;
      await assert.doesNotReject(async () => { missing = await f.repository.findById('profileless'); });
      assert.equal(missing, null);
      assert.equal(await f.repository.update('profileless', { role: 'admin' }), null);
      assert.equal(await f.repository.delete('profileless'), false);
      assert.equal(await f.repository.count(), 1);
      assert.deepEqual((await f.repository.findMany()).items.map(user => user.id), ['complete-profile']);
      assert.deepEqual(await readRows(f.database), before);
    } finally { await f.dispose(); }
  });

  test(`${target}: reads preserve existing nonstandard timestamp bytes, disabled state and full JSON`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'stored-profile', 50, '2024-01-02T03:04:05.006Z');
      await f.database.db.updateTable('_cms_auth_profiles').set({ name: '', avatar_url: '', email_verified: 1,
        data: '{"welcomeDismissed":false,"custom":[1,{"a":"b"}]}' }).where('user_id', '=', 'stored-profile').execute();
      await f.database.db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', 'stored-profile').execute();
      const before = await readRows(f.database);
      let user: Awaited<ReturnType<UserRepository['findById']>> | undefined;
      await assert.doesNotReject(async () => { user = await f.repository.findById('stored-profile'); });
      assert.ok(user);
      assert.equal(user.createdAt, '2024-01-02T03:04:05.006Z');
      assert.equal(user.name, '');
      assert.equal(user.avatarUrl, '');
      assert.equal(user.emailVerified, true);
      assert.deepEqual(user.data, { welcomeDismissed: false, custom: [1, { a: 'b' }] });
      assert.deepEqual(await readRows(f.database), before);
    } finally { await f.dispose(); }
  });

  test(`${target}: existing identity adapter reads the same full newly created profile`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      const user = await created(f.repository, { email: 'shared@example.com', name: 'Shared', role: 'editor',
        avatarUrl: '/shared.png', data: { welcomeDismissed: true } });
      const identity = await identityAdapter(f.database).getUserById(user.id);
      assert.ok(identity);
      assert.equal(identity.id, user.id);
      assert.equal(identity.email, user.email);
      assert.equal(identity.role, user.role);
      assert.equal(identity.name, user.name);
      assert.equal(identity.avatarUrl, user.avatarUrl);
      assert.equal(identity.disabled, false);
      assert.deepEqual(identity.data, user.data);
    } finally { await f.dispose(); }
  });

  test(`${target}: malformed stored JSON preserves the Source parse error without rewriting data`, { timeout: 15000 }, async () => {
    const f = await fixture();
    try {
      await insertProfile(f.database, 'invalid-json', 30);
      await f.database.db.updateTable('_cms_auth_profiles').set({ data: '{invalid' }).where('user_id', '=', 'invalid-json').execute();
      let count: number | undefined;
      await assert.doesNotReject(async () => { count = await f.repository.count(); });
      assert.equal(count, 1);
      const before = await readRows(f.database);
      await assert.rejects(() => f.repository.findById('invalid-json'), SyntaxError);
      assert.deepEqual(await readRows(f.database), before);
    } finally { await f.dispose(); }
  });
}

test('Source role names and numeric levels preserve all five core repository values', () => {
  for (const [name, level] of [['subscriber', 10], ['contributor', 20], ['author', 30], ['editor', 40], ['admin', 50]] as const) {
    assert.equal(UserRepository.resolveRole(name), level);
    assert.equal(UserRepository.resolveRole(level), level);
  }
  for (const invalid of ['ADMIN', '', 'manager']) assert.throws(() => UserRepository.resolveRole(invalid as never), /Invalid role name/);
  for (const invalid of [0, 15, 99, NaN]) assert.throws(() => UserRepository.resolveRole(invalid as never), /Invalid role level/);
});
