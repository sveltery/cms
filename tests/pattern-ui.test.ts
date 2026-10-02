import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

// JavaScript regex sources cannot be copied into HTML pattern: HTML uses full
// matching and Unicode sets. Preview keeps legacy values readable and disabled.
test('compiled scalar preview displays values without an HTML regex constraint', async () => {
  const source = await readFile(new URL('../src/lib/ui/DraftPreview.svelte', import.meta.url), 'utf8');
  const directory = await mkdtemp(fileURLToPath(new URL('.pattern-preview-', import.meta.url)));
  try {
    const module = `${directory}/DraftPreview.js`;
    await writeFile(module, compile(source, { filename: 'DraftPreview.svelte', generate: 'server' }).js.code);
    const { default: DraftPreview } = await import(module);
    for (const type of ['string', 'text']) for (const pattern of ['', 'cat', '[']) {
      const { body } = render(DraftPreview, { props: {
        fields: [{ id: `${type}-${pattern}`, slug: 'value', label: 'Value', type, validation: { pattern }, defaultValue: 'default' }],
        values: { value: 'legacy value' }
      } });
      assert.match(body, /<fieldset disabled(?:[\s=>])/);
      assert.doesNotMatch(body, /\bpattern=/);
      assert.match(body, /legacy value/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
