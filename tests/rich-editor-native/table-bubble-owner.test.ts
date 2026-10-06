// Supplemental Native plugin/lifecycle credit only. Actual floating geometry
// and visibility are covered by the separate official-browser tests.
import { afterEach, expect, it } from 'vitest';
import { tick } from 'svelte';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';
const release: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of release.splice(0)) await cleanup(); });
it('registers the actual contextual table plugin with its More actions owner', async () => {
  const result = await renderInDraftForm(); release.push(result.cleanup); await tick();
  expect(result.editor.state.plugins.some(plugin => (plugin as typeof plugin & { key: string }).key.startsWith('emdashTableBubbleMenu$'))).toBe(true);
  expect(result.host.querySelector('[data-emdash-table-bubble-menu] button[aria-label="More table actions"]')).toBeTruthy();
});
it('omits the contextual table plugin and controls in the original minimal editor mode', async () => {
  const result = await renderInDraftForm({ minimal: true }); release.push(result.cleanup); await tick();
  expect(result.editor.state.plugins.some(plugin => (plugin as typeof plugin & { key: string }).key.startsWith('emdashTableBubbleMenu$'))).toBe(false);
  expect(result.host.querySelector('[data-emdash-table-bubble-menu]')).toBeNull();
});

it('avoids unsupported Native Range geometry while retaining the real contextual plugin', async () => {
  expect(typeof Range.prototype.getBoundingClientRect).toBe('undefined');
  const result = await renderInDraftForm({ value: [{ _type: 'table', _key: 'table', rows: [{ _type: 'tableRow', _key: 'row', cells: [{ _type: 'tableCell', _key: 'cell', content: [{ _type: 'span', _key: 'span', text: 'Cell' }] }] }] }] });
  release.push(result.cleanup); result.editor.commands.setTextSelection(4); result.editor.view.focus();
  await new Promise<void>(resolve => setTimeout(resolve, 300)); await tick();
  expect(result.editor.state.plugins.some(plugin => (plugin as typeof plugin & { key: string }).key.startsWith('emdashTableBubbleMenu$'))).toBe(true);
  const menu = result.host.querySelector<HTMLElement>('[data-emdash-table-bubble-menu]');
  if (menu) expect(menu.style.visibility).toBe('hidden');
});
