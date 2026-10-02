// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Partial assertion scopes from EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Exact source IDs, storage-facade substitutions and omissions: docs/lifecycle-startup-ports.json.
import test from 'node:test';
import { expect } from './helpers/upstream-expect.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { createStoredContent, queryRevisionRows, installVersion4, legacyPost } from './helpers/lifecycle-startup.ts';

for (const target of ['Node','D1'] as const) for (const setup of ['fresh','v4'] as const) {
  async function fixture() {
    const storage = await schemaAdminStorage(target);
    try {
      if (setup === 'v4') { await installVersion4(storage.database); await legacyPost(storage.database); }
      await migrateCms(storage.database);
      if (setup === 'fresh') {
        const registry = new SchemaRegistry(storage.database);
        await registry.createCollection({slug:'post',label:'Posts'});
        await registry.createField('post',{slug:'title',label:'Title',type:'string'});
      }
      return storage;
    } catch (cause) {
      await storage.close(); throw cause;
    }
  }
  test(`${target} ${setup}: should create all tables from migrations [revisions-only scope]`, async () => {
    const storage = await fixture();
    try {
      const result = await queryRevisionRows(storage.database);
      expect(Array.isArray(result)).toBe(true);
    } finally { await storage.close(); }
  });
  test(`${target} ${setup}: should create content with all fields [status/author storage scope]`, async () => {
    const storage = await fixture();
    try {
      const content = await createStoredContent(storage.database,{slug:'test-post',status:'published',authorId:'author-1'});
      expect(content.status).toBe('published');
      expect(content.authorId).toBe('author-1');
    } finally { await storage.close(); }
  });
  test(`${target} ${setup}: should persist primaryBylineId on create [column storage scope]`, async () => {
    const storage = await fixture();
    try {
      const result = await createStoredContent(storage.database,{slug:'with-primary-byline',primaryBylineId:'byline_1'});
      expect(result.primaryBylineId).toBe('byline_1');
    } finally { await storage.close(); }
  });
}
