import { flushSync, mount, unmount } from 'svelte';
import type { NodeViewRenderer } from '@tiptap/core';
import EmbedBlockEditor from './EmbedBlockEditor.svelte';
import { nodeViewState } from './node-view-state.svelte';
import { sourceMessage } from './types';
import { stopEvent } from './top-block';

export const embedBlockNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  let current = node;
  const dom = document.createElement('div'); dom.dataset.type = node.type.name;
  // Both controls resolve the owning position at activation. Never retain a
  // mount-time offset: inserting an earlier block can move this node view.
  function atEditablePosition(action: (position: number) => void) {
    if (!editor.isEditable || editor.isDestroyed) return;
    const position = getPos(); if (typeof position === 'number') action(position);
  }
  const state = nodeViewState(node, editor, attributes => {
    atEditablePosition(position => editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, ...attributes })));
  }, sourceMessage, () => {
    atEditablePosition(position => {
      editor.view.focus();
      editor.chain().setNodeSelection(position).deleteSelection().run();
    });
  }, getPos);
  const instance = flushSync(() => mount(EmbedBlockEditor, { target: dom, props: { state } }));
  return { dom,
    update(next) { if (next.type !== current.type) return false; current = next; state.node = next; state.editable = editor.isEditable; return true; },
    ignoreMutation() { return true; },
    stopEvent(event) { return stopEvent(event, editor.view.dragging !== null); },
    destroy() { void unmount(instance); }
  };
};
