// Whole selected EmDash1.1.0 913cb1bb declarations; MIT notices/emdash-MIT.txt.
import { Extension, type Editor } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import { selectionTouchesTable, selectionIsContainedInTableCells } from './TableExtensions';


type TextAlignment = "left" | "center" | "right" | "justify";

function setSelectionTextAlignment(editor: Editor, alignment: TextAlignment): boolean {
	if (selectionTouchesTable(editor.state) && !selectionIsContainedInTableCells(editor.state)) {
		return false;
	}
	if (!(editor.state.selection instanceof CellSelection)) {
		const chain = editor.chain().focus();
		return editor.isActive("table")
			? chain.setCellAttribute("textAlign", alignment).run()
			: chain.setTextAlign(alignment).run();
	}

	editor.commands.focus();
	const selection = editor.state.selection;
	if (!(selection instanceof CellSelection)) return false;
	const transaction = editor.state.tr;
	selection.forEachCell((_cell, position) => {
		const cell = transaction.doc.nodeAt(position);
		if (cell && cell.attrs.textAlign !== alignment) {
			transaction.setNodeMarkup(position, undefined, { ...cell.attrs, textAlign: alignment });
		}
	});
	if (!transaction.docChanged) return false;
	editor.view.dispatch(transaction);
	return true;
}

const TableSafetyShortcuts = Extension.create({
	name: "tableSafetyShortcuts",
	priority: 1_200,
	addKeyboardShortcuts() {
		const blockUnsafeStructure = () => selectionTouchesTable(this.editor.state);
		const setTableAlignment = (alignment: TextAlignment) => {
			if (!selectionTouchesTable(this.editor.state)) return false;
			setSelectionTextAlignment(this.editor, alignment);
			return true;
		};
		return {
			"Mod-Alt-1": blockUnsafeStructure,
			"Mod-Alt-2": blockUnsafeStructure,
			"Mod-Alt-3": blockUnsafeStructure,
			"Mod-Alt-4": blockUnsafeStructure,
			"Mod-Alt-5": blockUnsafeStructure,
			"Mod-Alt-6": blockUnsafeStructure,
			"Mod-Shift-7": blockUnsafeStructure,
			"Mod-Shift-8": blockUnsafeStructure,
			"Mod-Shift-b": blockUnsafeStructure,
			"Mod-Alt-c": blockUnsafeStructure,
			"Mod-Shift-l": () => setTableAlignment("left"),
			"Mod-Shift-e": () => setTableAlignment("center"),
			"Mod-Shift-r": () => setTableAlignment("right"),
			"Mod-Shift-j": () => setTableAlignment("justify"),
		};
	},
});
export { TableSafetyShortcuts, setSelectionTextAlignment };
export type { TextAlignment };
