import type { NodeViewState } from './node-view-state.svelte';
import { iframeEmbedAttrs, iframeEmbedFromAttrs, iframeEmbedToCode, parseIframeInput } from '../portable-text/iframe-embed';

// Pinned IframeBlockNode draft ownership: retain authored text until blur/tab,
// debounce parsing at the original delay, and keep unwritable valid input pending.
const PARSE_DELAY_MS = 250;
export function iframeDraft(getViewState: () => NodeViewState) {
  const state = $state({ typed: null as string | null, error: '', revision: 0, loadable: null as string | null });
  let pending: string | null = null;
  let valid = true;
  const initialNode = getViewState().node;
  let known = initialNode.attrs.src ? iframeEmbedToCode(iframeEmbedFromAttrs(initialNode.attrs)) : '';
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
    const viewState = getViewState();
    if (viewState.editor.isDestroyed || !viewState.editor.isEditable || typeof viewState.getPos?.() !== 'number') return false;
    pending = null;
    known = result.embed ? iframeEmbedToCode(result.embed) : '';
    viewState.updateAttributes(iframeEmbedAttrs(result.embed));
    state.loadable = result.embed?.src ?? null;
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
    state.revision += 1;
  }

  function change(text: string) {
    pending = text;
    state.typed = text;
    clearTimeout(timer);
    timer = setTimeout(flush, PARSE_DELAY_MS);
  }

  function canonicalizeAfterBlur() {
    queueMicrotask(() => {
      if (!document.hasFocus() || !valid || pending !== null) return;
      if (state.typed !== null && state.typed !== known) { state.typed = null; state.revision += 1; }
    });
  }

  function changeTab() {
    flush();
    state.typed = null;
    state.error = '';
  }

  // The Source focus owner flushes during cleanup. Real editor/getPos guards
  // prevent writes to a deleted block or destroyed editor.
  return { state, synchronize, change, flush, canonicalizeAfterBlur, changeTab };
}
