// Supplemental actual Native regressions for configured P2 comments
// 4180773631/4180830585. Original Source bodies/data/clocks stay immutable.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { CellSelection } from '@tiptap/pm/tables';
import { getTableControlState } from '../../src/lib/editor/rich-text/TableActions';
import { iframeEmbedToCode } from '../../src/lib/editor/portable-text/iframe-embed';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.useRealTimers(); });
async function render(value: NonNullable<Parameters<typeof renderInDraftForm>[0]>['value']) {
  const result = await renderInDraftForm({ value }); cleanups.push(result.cleanup); return result;
}
function inputValue(input: HTMLTextAreaElement, value: string) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
async function iframe(src = '') {
  const result = await render([{ _type: 'iframe', _key: 'frame', src }]);
  const input = result.host.querySelector<HTMLTextAreaElement>('[data-type="iframeBlock"] textarea')!;
  expect(input).toBeTruthy(); input.focus(); result.onChange.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  return { ...result, input, attrs: () => result.editor.state.doc.firstChild!.attrs };
}
const table = { _type: 'table', _key: 'table', rows: [{ _type: 'tableRow', _key: 'row', cells: [
  { _type: 'tableCell', _key: 'left', content: [{ _type: 'span', _key: 'left-span', text: 'Left' }] },
  { _type: 'tableCell', _key: 'right', content: [{ _type: 'span', _key: 'right-span', text: 'Right' }] }
] }] };
async function tableMenu() {
  const result = await render([table]); const cells: number[] = [];
  result.editor.state.doc.descendants((node, position) => { if (node.type.name === 'tableCell') cells.push(position); });
  result.editor.view.dispatch(result.editor.state.tr.setSelection(CellSelection.create(result.editor.state.doc, cells[0])));
  await tick(); result.host.querySelector<HTMLButtonElement>('button[aria-label="Table"]')!.click(); await tick();
  const action = (label: string) => [...result.host.querySelectorAll<HTMLButtonElement>('[aria-label="Table actions"] button')].find(button => button.textContent === label)!;
  return { ...result, cells, action };
}
describe('Actual table capability bindings', () => {
  it.each([['merge', 'Merge selected cells'], ['split', 'Split merged cell'], ['reset-widths', 'Reset column widths']] as const)
    ('disables unavailable %s actions in a single unmerged cell', async (id, label) => {
      const { editor, action } = await tableMenu(); expect(getTableControlState(editor)!.can[id]).toBe(false);
      expect(action(label).disabled).toBe(true);
    });
  it('reacts to a real multi-cell selection and enables the now-available merge without disabling supported inserts', async () => {
    const { editor, cells, action } = await tableMenu();
    expect(action('Add row below').disabled).toBe(false);
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cells[0], cells[1]))); await tick();
    expect(getTableControlState(editor)!.can.merge).toBe(true); expect(action('Merge selected cells').disabled).toBe(false);
  });
});
describe('Actual iframe draft and Source250ms flush contract', () => {
  it('retains a valid intermediate URL as authored text while focused', async () => {
    const { input } = await iframe(); inputValue(input, 'https://e'); await tick(); expect(input.value).toBe('https://e');
  });
  it('writes nothing immediately or at249ms, then saves at the original250ms while retaining the focused draft', async () => {
    const { input, onChange, attrs } = await iframe(); inputValue(input, 'https://example.com/map'); await tick();
    expect(onChange).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(249); expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await tick(); expect(attrs().src).toBe('https://example.com/map');
    expect(onChange).toHaveBeenCalledTimes(1); expect(input.value).toBe('https://example.com/map');
  });
  it('restarts the250ms clock for the actual final draft rather than saving a valid intermediate', async () => {
    const { input, onChange, attrs } = await iframe(); inputValue(input, 'https://e'); await tick(); await vi.advanceTimersByTimeAsync(249);
    inputValue(input, 'https://example.com/complete'); await tick(); await vi.advanceTimersByTimeAsync(1);
    expect(onChange).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(249); await tick();
    expect(attrs().src).toBe('https://example.com/complete'); expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('keeps a pending draft while read-only, then flushes it on a real tab change once editing resumes', async () => {
    const { input, editor, attrs, host, onChange } = await iframe(); inputValue(input, 'https://example.com/pending'); editor.setEditable(false); await tick();
    await vi.advanceTimersByTimeAsync(250); expect(attrs().src).toBe(''); expect(input.value).toBe('https://example.com/pending'); expect(onChange).not.toHaveBeenCalled();
    editor.setEditable(true); [...host.querySelectorAll<HTMLButtonElement>('[data-type="iframeBlock"] [role="tab"]')].find(button => button.textContent === 'Preview' || button.textContent === 'preview')!.click(); await tick();
    expect(attrs().src).toBe('https://example.com/pending'); expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('flushes on blur and canonicalizes valid text when the document still has real control focus', async () => {
    const { input, save, attrs } = await iframe(); inputValue(input, 'https://example.com/blur'); await tick(); save.focus(); await tick();
    expect(document.hasFocus()).toBe(true); expect(attrs().src).toBe('https://example.com/blur');
    expect(input.value).toBe(iframeEmbedToCode({ src: 'https://example.com/blur' }));
  });
  it('drops obsolete pending text after a real external attribute update', async () => {
    const { input, editor, attrs, onChange } = await iframe(); inputValue(input, 'https://example.com/pending'); await tick();
    editor.view.dispatch(editor.state.tr.setNodeMarkup(0, undefined, { ...attrs(), src: 'https://example.com/external' })); await tick(); onChange.mockClear();
    await vi.advanceTimersByTimeAsync(250); expect(attrs().src).toBe('https://example.com/external');
    expect(input.value).toBe(iframeEmbedToCode({ src: 'https://example.com/external' })); expect(onChange).not.toHaveBeenCalled();
  });
  it('preserves invalid authored text and the saved embed after delayed rejection and blur', async () => {
    const { input, attrs, host, save, onChange } = await iframe('https://example.com/saved'); inputValue(input, 'http://example.com/insecure'); await tick();
    expect(host.querySelector('[role="alert"]')).toBeNull(); await vi.advanceTimersByTimeAsync(250); await tick();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Only https links can be embedded.');
    save.focus(); await tick(); expect(input.value).toBe('http://example.com/insecure'); expect(attrs().src).toBe('https://example.com/saved'); expect(onChange).not.toHaveBeenCalled();
  });
  it('cannot write a delayed pending draft after the owning node is deleted', async () => {
    const { input, editor, onChange } = await iframe(); inputValue(input, 'https://example.com/deleted'); await tick();
    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] }); await tick(); onChange.mockClear();
    await vi.advanceTimersByTimeAsync(250); expect(editor.state.doc.firstChild!.type.name).toBe('paragraph'); expect(onChange).not.toHaveBeenCalled();
  });
});
