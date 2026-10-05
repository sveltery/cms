// A genuinely failed lazy picker import is isolated in its own Native fixture.
// No Source module/assertion or production fallback is supplied by this mock.
import { expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { command, ordinarySlash, renderInDraftForm, texts } from '../helpers/rich-editor/native-authoring-dom';
vi.mock('../../src/lib/ui/sections-widgets/SectionPickerModal.svelte', () => { throw new Error('Controlled lazy picker import failure'); });
it('forgets a failed gutter picker import before an ordinary HTML slash insertion', async () => {
  const { host, gutter, editor, cleanup } = await renderInDraftForm();
  try {
    gutter(0); await tick(); await command(host, 'Section');
    await vi.waitFor(() => expect(host.textContent).toContain('Could not load the section picker. Try again.'));
    await ordinarySlash(host, editor, 'HTML');
    expect(texts(editor)).toEqual(['First', 'Last', 'htmlBlock']);
  } finally { await cleanup(); }
});
