import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type { Translate } from './types';

export function nodeViewState(node: Node, editor: Editor, updateAttributes: (attrs: Record<string, unknown>) => void, translate: Translate, deleteBlock?: () => void) {
  const viewState = $state({ node, editor, updateAttributes, translate, deleteBlock, editable: editor.isEditable });
  return viewState;
}
export type NodeViewState = ReturnType<typeof nodeViewState>;
