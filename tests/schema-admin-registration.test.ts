import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Supplemental assertion-first red probe. Built registration is independently tested
// in production/schema-admin-remotes.test.ts; this probe detects the missing module.
test('schema administration declares the five unique native remote exports', async () => {
  const source = await readFile(new URL('../src/lib/schema.remote.ts', import.meta.url), 'utf8');
  for (const name of ['listSchemaCollections','getSchemaCollection','createSchemaCollection','updateSchemaCollection','addSchemaField']) {
    assert.match(source, new RegExp(`export const ${name}\\s*=\\s*(?:query|form)\\(`));
  }
});
