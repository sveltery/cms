import { onMount } from 'svelte';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import type { NodeViewState } from './node-view-state.svelte';

// Native lifecycle transport of pinned useEmbedBlockFocus; real selection,
// owning position, document pointer events and animation frame remain authoritative.
export function embedBlockFocus(getViewState: () => NodeViewState, flush: () => void,
  isEmpty: (attrs: Record<string, unknown>) => boolean) {
  const state = $state({ autoFocus: false });
  let card: HTMLElement | undefined, panel: HTMLElement | undefined;
  const flushOnOutsidePress = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.cm-editor') && card?.contains(target)) return;
    flush();
  };
  onMount(() => {
    const frame = requestAnimationFrame(() => {
      const { editor, getPos } = getViewState(), pos = getPos?.(), { selection } = editor.state;
      if (!editor.isEditable || typeof pos !== 'number') return;
      if (!(selection instanceof NodeSelection) || selection.from !== pos || !isEmpty(selection.node.attrs)) return;
      panel?.focus(); state.autoFocus = true;
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', flushOnOutsidePress, true);
      queueMicrotask(flush);
    };
  });
  function moveSelectionAfterBlock() {
    const { editor, getPos } = getViewState(), pos = getPos?.();
    if (typeof pos !== 'number' || editor.isDestroyed) return;
    const { state: editorState } = editor, block = editorState.doc.nodeAt(pos);
    if (!block) return;
    const afterBlock = editorState.doc.resolve(pos + block.nodeSize), next = afterBlock.nodeAfter;
    const selection = next && (next.isAtom || next.type.spec.isolating)
      ? new GapCursor(afterBlock)
      : Selection.findFrom(afterBlock, 1, true) ?? Selection.findFrom(editorState.doc.resolve(pos), -1, true);
    if (selection && !selection.eq(editorState.selection)) editor.view.dispatch(editorState.tr.setSelection(selection));
  }
  function onFocusChange(focused: boolean) {
    const { editor } = getViewState();
    if (focused) {
      state.autoFocus = false;
      if (editor.isEditable) moveSelectionAfterBlock();
      document.addEventListener('pointerdown', flushOnOutsidePress, true);
    } else {
      document.removeEventListener('pointerdown', flushOnOutsidePress, true);
      queueMicrotask(flush);
    }
  }
  function onEscape() {
    flush(); const { editor, getPos } = getViewState(), pos = getPos?.();
    if (typeof pos !== 'number') return;
    editor.commands.setNodeSelection(pos); editor.view.focus();
  }
  return { state, onFocusChange, onEscape,
    setElements: (nextCard: HTMLElement, nextPanel: HTMLElement) => { card = nextCard; panel = nextPanel; },
    onPanelBlur: (event: FocusEvent) => { if (!(event.relatedTarget instanceof Node) || !(event.currentTarget as HTMLElement).contains(event.relatedTarget)) state.autoFocus = false; }
  };
}
