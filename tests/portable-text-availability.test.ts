import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Original implementation-availability requirements, not EmDash assertions.
test('the product supplies a native portable-text editor', () => {
  assert.equal(existsSync(new URL('../src/lib/ui/PortableTextEditor.svelte', import.meta.url)), true);
});
test('the product supplies Portable Text conversions for the native editor', () => {
  assert.equal(existsSync(new URL('../src/lib/portable-text/conversion.ts', import.meta.url)), true);
});
