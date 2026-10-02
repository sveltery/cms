import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Supplemental source invariants supporting the behavioral browser/HTTP suite.
test('options component owns a distinct registered instance with direct native spreads and explicit hidden values', async () => {
  const source = await readFile(new URL('../src/lib/ui/SchemaFieldOptions.svelte', import.meta.url), 'utf8');
  assert.match(source, /updateSchemaFieldOptions\.for\(`\$\{collection\}\/\$\{field\.slug\}`\)/);
  assert.match(source, /<form \{\.\.\.optionsForm\}>/);
  assert.match(source, /fields\.collection\.as\('hidden', collection\)/);
  assert.match(source, /fields\.field\.as\('hidden', field\.slug\)/);
  for (const field of ['labelMode', 'label', 'sortOrderMode', 'sortOrder', 'defaultValueMode', 'defaultValue', 'validationMode', 'minLength', 'maxLength']) {
    assert.match(source, new RegExp(`\\{\\.\\.\\.optionsForm\\.fields\\.${field}\\.as\\(`));
  }
  assert.doesNotMatch(source, /maxlength|expectedSchemaVersion|updatedAt|_rev/);
  assert.match(source, /disabled=\{optionsForm\.pending > 0\}/);
});
