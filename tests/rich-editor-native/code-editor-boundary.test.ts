// Supplemental actual dependency-failure regression for Source CodeEditorBoundary.
// The production Native editor still mounts; the actual CodeMirror constructor
// fails before allocation, then its normal constructor is a positive control.
import { afterEach, expect, it, vi } from 'vitest';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';
const failure = vi.hoisted(() => ({ active: true }));
vi.mock('@codemirror/view', async importOriginal => {
  const original = await importOriginal<typeof import('@codemirror/view')>();
  class StartupEditorView extends original.EditorView {
    constructor(...args: ConstructorParameters<typeof original.EditorView>) {
      if (failure.active) throw new Error('CodeMirror constructor unavailable');
      super(...args);
    }
  }
  return { ...original, EditorView: StartupEditorView };
});
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
it('shows the Source reload fallback for real CodeMirror mount errors and mounts normally after recovery', async () => {
  const broken = await renderInDraftForm({ value: [{ _type: 'iframe', _key: 'broken', src: '' }] });
  cleanup.push(broken.cleanup);
  await vi.waitFor(() => expect(broken.host.querySelector('.code-load-error')?.textContent).toContain("The code editor couldn't load. Save your work, then reload the page."));
  expect(broken.host.querySelector<HTMLButtonElement>('.code-load-error button')?.type).toBe('button');
  expect(broken.host.querySelector('.cm-content')).toBeNull();
  await broken.cleanup(); cleanup.pop(); failure.active = false;
  const recovered = await renderInDraftForm({ value: [{ _type: 'iframe', _key: 'recovered', src: '' }] });
  cleanup.push(recovered.cleanup);
  await vi.waitFor(() => expect(recovered.host.querySelector('.cm-content')).toBeTruthy());
  expect(recovered.host.querySelector('.code-load-error')).toBeNull();
});
