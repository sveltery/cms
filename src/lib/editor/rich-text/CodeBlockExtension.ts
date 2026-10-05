import { CodeBlockLowlight, type CodeBlockLowlightOptions } from '@tiptap/extension-code-block-lowlight';
import { flushSync, mount, unmount } from 'svelte';
import CodeBlockControls from './CodeBlockControls.svelte';
import { nodeViewState } from './node-view-state.svelte';
import { editorLowlight } from './code-values';
import { sourceMessage, type Translate } from './types';

// Real ProseMirror contentDOM keeps Lowlight's live editable code. Native
// controls receive transactions; their language popup portals outside it.
export const CodeBlockExtension = CodeBlockLowlight.extend<CodeBlockLowlightOptions & { translate: Translate }>({
  addOptions() { return { ...this.parent!(), lowlight: editorLowlight, translate: sourceMessage }; },
  addKeyboardShortcuts() {
    const shortcuts = this.parent?.() ?? {};
    const selectionIsInCodeBlock = () => {
      const { $from, $to } = this.editor.state.selection;
      return $from.parent.type === this.type && $from.sameParent($to);
    };
    return { ...shortcuts,
      Tab: props => selectionIsInCodeBlock() ? (shortcuts.Tab?.(props) ?? false) : false,
      'Shift-Tab': props => selectionIsInCodeBlock() ? (shortcuts['Shift-Tab']?.(props) ?? false) : false
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;
      const dom = document.createElement('div'); dom.className = 'emdash-code-block-node relative my-4';
      const pre = document.createElement('pre'); pre.className = 'emdash-code-block';
      const contentDOM = document.createElement('code'); pre.append(contentDOM); dom.append(pre);
      const controls = document.createElement('div'); controls.contentEditable = 'false'; dom.append(controls);
      const state = nodeViewState(current, editor, attributes => {
        const position = getPos(); if (typeof position === 'number' && editor.isEditable) editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, ...attributes }));
      }, this.options.translate);
      const instance = flushSync(() => mount(CodeBlockControls, { target: controls, props: { state } }));
      function sync() {
        dom.dataset.language = typeof current.attrs.language === 'string' ? current.attrs.language : '';
        contentDOM.className = current.attrs.language ? `language-${current.attrs.language}` : '';
        state.editable = editor.isEditable;
      }
      sync();
      return { dom, contentDOM,
        update(next) { if (next.type !== current.type) return false; current = next; state.node = next; sync(); return true; },
        ignoreMutation(mutation) { return mutation.type !== 'selection' && !contentDOM.contains(mutation.target); },
        stopEvent(event) { return controls.contains(event.target as Node); },
        destroy() { void unmount(instance); }
      };
    };
  }
}).configure({ lowlight: editorLowlight, defaultLanguage: 'plaintext', enableTabIndentation: true, tabSize: 4 });
