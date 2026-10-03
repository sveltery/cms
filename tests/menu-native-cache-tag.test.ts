import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuTag } from '../src/lib/server/menus/cache-tags.ts';
import { menuTag as sourceMenuTag } from '../parity/emdash/menu-source/upstream/packages/core/src/cache/chrome-tags.ts';

test('native menu cache hints preserve the pinned Source tag value', () => {
  for (const name of ['primary', 'footer', 'primary:fr']) assert.equal(menuTag(name), sourceMenuTag(name));
});
