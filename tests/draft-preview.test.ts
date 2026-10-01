import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

test('draft preview applies defaults only to absent persisted keys', async (t) => {
  const source = await readFile(new URL('../src/lib/ui/DraftPreview.svelte', import.meta.url), 'utf8');
  const directory = await mkdtemp(fileURLToPath(new URL('.draft-preview-', import.meta.url)));
  try {
    const module = `${directory}/DraftPreview.js`;
    await writeFile(module, compile(source, { filename: 'DraftPreview.svelte', generate: 'server' }).js.code);
    const { default: DraftPreview } = await import(module);
    for (const type of ['string', 'text']) {
      const field = { id: type, slug: 'value', label: 'Value', type, defaultValue: 'Schema default' };
      const cases = [
        { name: 'absent key', values: {}, expected: 'Schema default' },
        { name: 'explicit null', values: { value: null }, expected: '' },
        { name: 'empty string', values: { value: '' }, expected: '' },
        // Runtime rendering checks only: persisted schema support remains string/text.
        { name: 'false', values: { value: false }, expected: 'false' },
        { name: 'zero', values: { value: 0 }, expected: '0' },
        { name: 'stored string', values: { value: 'Saved value' }, expected: 'Saved value' },
        { name: 'inherited key', values: Object.create({ value: 'Inherited value' }), expected: 'Schema default' }
      ];
      for (const { name, values, expected } of cases) await t.test(`${type}: ${name}`, () => {
        const { body } = render(DraftPreview, { props: { fields: [field], values } });
        const displayed = type === 'text'
          ? body.match(/<textarea\b[^>]*>(.*?)<\/textarea>/s)?.[1]
          : body.match(/<input\b(?=[^>]*data-field="value")(?=[^>]*value="([^"]*)")[^>]*>/)?.[1];
        assert.equal(displayed, expected);
        assert.match(body, /<fieldset disabled(?:[\s=>])/);
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
