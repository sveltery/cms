// Supplemental bounded CMS contract shared by real Node SQLite and local workerd/D1.
import { sql } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';
import { createKyselySessionStore } from '../../src/lib/server/auth/store.ts';
import { hashSessionToken, resolvePrincipal, revokeSession } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

function check(value: unknown, label: string): asserts value { if (!value) throw new Error(label); }
async function rejects(operation: () => Promise<unknown>, code: string) {
  try { await operation(); } catch (cause) {
    check(cause instanceof Error && 'code' in cause && cause.code === code, `expected ${code}, got ${String(cause)}`);
    return;
  }
  throw new Error(`expected ${code}`);
}
export async function storageContract(database: CmsDatabase) {
  await migrateCms(database); await migrateCms(database);
  const db = database.db; const registry = new SchemaRegistry(database); const entries = new DraftRepository(database);
  check((await db.selectFrom('_cms_auth_users').selectAll().execute()).length === 0, 'no provisioned user');
  check((await db.selectFrom('_cms_auth_sessions').selectAll().execute()).length === 0, 'no provisioned session');
  await registry.createCollection({ slug: 'notes', label: 'Notes' });
  await registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', required: true, unique: true, defaultValue: "O'Brien" });
  await registry.createField('notes', { slug: 'body', label: 'Body', type: 'text' });
  await registry.createField('notes', { slug: 'constructor', label: 'Constructor', type: 'string' });
  const definition = await registry.getCollectionWithFields('notes');
  check(definition?.fields.length === 3 && definition.version === 4, 'persisted scalar schema');
  const draft = await entries.create({ type: 'notes', data: { body: 'one\u0000two', constructor: 'own key' } }, 'author');
  check(draft.data.title === "O'Brien" && draft.data.body === 'one\u0000two' && draft.data['constructor'] === 'own key', 'literal default and bound scalar');
  await rejects(() => entries.create({ type: 'notes', data: {} }, 'author'), 'CONFLICT');
  await rejects(() => entries.create({ type: 'notes', data: { title: null } }, 'author'), 'VALIDATION_ERROR');
  const outcomes = await Promise.allSettled([
    entries.update({ type: 'notes', id: draft.id, expected: { version: draft.version, updatedAt: draft.updatedAt }, data: { title: 'Winner A' } }),
    entries.update({ type: 'notes', id: draft.id, expected: { version: draft.version, updatedAt: draft.updatedAt }, data: { title: 'Winner B' } })
  ]);
  check(outcomes.filter(outcome => outcome.status === 'fulfilled').length === 1, 'one CAS winner');
  const lost = outcomes.find(outcome => outcome.status === 'rejected');
  check(lost?.status === 'rejected' && lost.reason.code === 'CONFLICT', 'one CAS conflict');
  const changed = await entries.findById('notes', draft.id);
  check(changed && changed.version === 2 && changed.data.body === draft.data.body, 'partial update preserves body');
  await entries.delete({ type: 'notes', id: draft.id, expected: { version: changed.version, updatedAt: changed.updatedAt } });
  check(await entries.findById('notes', draft.id) === null && (await entries.list('notes')).items.length === 0, 'soft deleted read/list');
  const row = (await sql<{ deleted_at: string; version: number }>`SELECT deleted_at, version FROM ec_notes WHERE id = ${draft.id}`.execute(db)).rows[0];
  check(row.deleted_at && row.version === 3, 'soft deleted row retained');
  const guardedSchema = await registry.getCollection('notes'); check(guardedSchema, 'collection exists');
  const fields = await Promise.allSettled([
    registry.createField('notes', { slug: 'first', label: 'First', type: 'string' }, guardedSchema.version),
    registry.createField('notes', { slug: 'second', label: 'Second', type: 'string' }, guardedSchema.version)
  ]);
  check(fields.filter(outcome => outcome.status === 'fulfilled').length === 1, 'one schema CAS winner');
  check(fields.some(outcome => outcome.status === 'rejected' && outcome.reason.code === 'CONFLICT'), 'one schema CAS conflict');
  check((await registry.getCollectionWithFields('notes'))?.fields.length === 4, 'schema CAS rolls back DDL');
  check((await db.selectFrom('_cms_guards').selectAll().execute()).length === 0, 'guards cleaned up');
  // Explicit test-only rows; no account/session creation API enters the product.
  const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; const hash = await hashSessionToken(token); check(hash, 'canonical token');
  await db.insertInto('_cms_auth_users').values({ id: 'author', role: Role.AUTHOR, disabled: 0 }).execute();
  await db.insertInto('_cms_auth_sessions').values({ hash, user_id: 'author', expires_at: 1001 }).execute();
  const store = createKyselySessionStore(db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>());
  check((await resolvePrincipal(token, store, { now: () => 1000 }))?.role === Role.AUTHOR, 'persisted session read');
  check(await resolvePrincipal(token, store, { now: () => 1001 }) === null, 'exact expiry');
  await db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).where('id', '=', 'author').execute();
  check((await resolvePrincipal(token, store, { now: () => 1000 }))?.role === Role.SUBSCRIBER, 'current role reload');
  await db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', 'author').execute();
  check(await resolvePrincipal(token, store, { now: () => 1000 }) === null, 'disabled user');
  await revokeSession(token, store);
  check(await resolvePrincipal(token, store, { now: () => 1000 }) === null, 'persisted revocation');
  return ['fresh/idempotent migration', 'empty auth tables', 'persisted scalar schema', 'literal defaults/NUL/own keys',
    'unique/required constraints', 'draft CAS/partial update', 'retained soft delete', 'schema CAS/DDL rollback',
    'persisted session/current role/disabled/expiry/revocation'];
}
