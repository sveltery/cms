import type { NodeViewState } from './node-view-state.svelte';
import { iframeEmbedAttrs, iframeEmbedToCode, parseIframeInput } from '../portable-text/iframe-embed';

// Pinned IframeBlockNode draft ownership: retain authored text until blur/tab,
// debounce parsing at the original delay, and keep unwritable valid input pending.
const PARSE_DELAY_MS = 250;
export function iframeDraft(viewState: NodeViewState, initialCode: string) {
  const state = $state({ typed: null as string | null, error: '' });
  let pending: string | null = null;
  let valid = true;
  let known = initialCode;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): boolean {
    clearTimeout(timer);
    if (pending === null) return false;
    const result = parseIframeInput(pending);
    valid = result.ok;
    if (!result.ok) {
      pending = null;
      state.error = result.reason === 'not-https'
        ? 'Only https links can be embedded.'
        : 'No iframe found in this code. For an embed that runs a script, use an HTML block.';
      return false;
    }
    state.error = '';
    if (viewState.editor.isDestroyed || !viewState.editor.isEditable || typeof viewState.getPos?.() !== 'number') return false;
    pending = null;
    known = result.embed ? iframeEmbedToCode(result.embed) : '';
    viewState.updateAttributes(iframeEmbedAttrs(result.embed));
    return true;
  }

  function synchronize(code: string) {
    if (code === known) return;
    // Undo, redo and other tools own external attribute changes. Own writes set
    // known before updating attributes, so they retain the focused authored text.
    known = code;
    pending = null;
    state.typed = null;
    state.error = '';
  }

  function change(text: string) {
    pending = text;
    state.typed = text;
    clearTimeout(timer);
    timer = setTimeout(flush, PARSE_DELAY_MS);
  }

  function blur() {
    // Queue writes outside the ProseMirror command that moved focus, then
    // canonicalize only text that could be saved while the document kept focus.
    queueMicrotask(flush);
    queueMicrotask(() => {
      if (!document.hasFocus() || !valid || pending !== null) return;
      if (state.typed !== null && state.typed !== known) state.typed = null;
    });
  }

  function changeTab() {
    flush();
    state.typed = null;
    state.error = '';
  }

  // The Source focus owner flushes during cleanup. Real editor/getPos guards
  // prevent writes to a deleted block or destroyed editor.
  return { state, synchronize, change, blur, changeTab, cleanup: () => queueMicrotask(flush) };
}
