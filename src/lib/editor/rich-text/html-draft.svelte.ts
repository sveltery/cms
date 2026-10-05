import type { NodeViewState } from './node-view-state.svelte';
export type HtmlField = 'html' | 'css' | 'js';
export const HTML_FIELDS: readonly HtmlField[] = ['html', 'css', 'js'];
export function htmlFieldValues(attrs: Record<string, unknown>): Record<HtmlField, string> {
  return { html: typeof attrs.html === 'string' ? attrs.html : '', css: typeof attrs.css === 'string' ? attrs.css : '', js: typeof attrs.js === 'string' ? attrs.js : '' };
}
// Whole immutable HtmlBlockNode field ownership, original 250ms batch delay.
export function htmlDraft(getViewState: () => NodeViewState) {
  let known = htmlFieldValues(getViewState().node.attrs);
  let pending: Partial<Record<HtmlField, string>> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const state = $state({ revisions: { html: 0, css: 0, js: 0 }, allowScripts: HTML_FIELDS.every(field => !known[field]) });
  function flush() {
    clearTimeout(timer);
    if (!Object.keys(pending).length) return;
    const { editor, getPos, updateAttributes } = getViewState();
    if (editor.isDestroyed || !editor.isEditable || typeof getPos?.() !== 'number') return;
    const changes = pending; pending = {}; Object.assign(known, changes); updateAttributes(changes);
  }
  function synchronize(values: Record<HtmlField, string>) {
    for (const field of HTML_FIELDS) {
      if (values[field] === known[field]) continue;
      known[field] = values[field]; delete pending[field]; state.revisions[field] += 1;
    }
  }
  function change(field: HtmlField, value: string) {
    state.allowScripts = true; pending[field] = value; clearTimeout(timer); timer = setTimeout(flush, 250);
  }
  return { state, flush, synchronize, change };
}
