// Ported from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/editor/EmbedBlockShell.tsx; MIT, see notices/emdash-MIT.txt.

import { Node, type Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import type { NodeType } from '@tiptap/pm/model';


/**
 * Written into the clipboard HTML of embed blocks. Other pages and tabs can't
 * know it, so blocks pasted from them can be told apart.
 */
export const CLIPBOARD_TOKEN = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
	n.toString(36),
).join("");

/**
 * Document node that also accepts `topBlock` nodes. Quotes, list items and
 * table cells accept only `block`, so ProseMirror can't nest a top-level
 * block there, where the Portable Text converters would drop it.
 */
export const TopBlockDocument = Node.create({
	name: "doc",
	topNode: true,
	content: "(block | topBlock)+",
});

/**
 * The code editor owns every event inside it, including dropped text, except
 * blocks dragged from the handle. ProseMirror handles drags and presses
 * elsewhere on the card, so the block can be moved and selected, and the
 * card's own controls handle their events.
 */
function stopEvent(event: Event, draggingBlock: boolean): boolean {
	const target = event.target instanceof Element ? event.target : null;
	const drag = event.type.startsWith("drag") || event.type === "drop";
	if (target?.closest(".cm-editor")) return !(drag && draggingBlock);
	if (drag) return false;
	if (target?.closest("input, button, select, textarea")) return true;
	return event.type !== "mousedown";
}

/** Focus an element inside the node-selected embed block. */
function focusInSelectedBlock(editor: Editor, type: NodeType, selector: string): boolean {
	const { selection } = editor.state;
	if (!(selection instanceof NodeSelection) || selection.node.type !== type) return false;
	const dom = editor.view.nodeDOM(selection.from);
	const target = dom instanceof HTMLElement ? dom.querySelector<HTMLElement>(selector) : null;
	target?.focus();
	return target !== null && document.activeElement === target;
}

const SELECTED_TAB = "[role='tab'][aria-selected='true']";

/**
 * Enter goes back into the selected block's code editor, and Tab to its tabs,
 * so keyboard users can reach any block's controls.
 */
export function embedBlockKeyboardShortcuts(type: NodeType) {
	return {
		Enter: ({ editor }: { editor: Editor }) =>
			focusInSelectedBlock(editor, type, ".cm-content") ||
			focusInSelectedBlock(editor, type, SELECTED_TAB),
		Tab: ({ editor }: { editor: Editor }) => focusInSelectedBlock(editor, type, SELECTED_TAB),
	};
}

export { stopEvent };
