// Exact whole Source insertTable declaration at913cb1bb, MIT notices/emdash-MIT.txt.
import type { Editor, Range } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { TextSelection } from '@tiptap/pm/state';
import { cellAround } from '@tiptap/pm/tables';



export function insertTable(
	editor: Editor,
	rows: number,
	columns: number,
	withHeaderRow: boolean,
	range?: Range,
	insertPosition?: number,
): boolean {
	const chain = editor
		.chain()
		.focus()
		.command(({ tr }) => {
			closeHistory(tr);
			return true;
		});
	if (insertPosition !== undefined)
		chain
			.insertContentAt(insertPosition, { type: "paragraph" })
			.setTextSelection(insertPosition + 1);
	else if (range) chain.deleteRange(range);
	chain.command(({ tr }) => {
		const nested = Array.from(
			{ length: tr.selection.$from.depth },
			(_, index) => tr.selection.$from.node(index + 1).type.name,
		).some((name) => name === "blockquote" || name === "listItem");
		if (nested) {
			const position = tr.selection.$from.after(1);
			tr.insert(position, tr.doc.type.schema.nodes.paragraph!.create());
			tr.setSelection(TextSelection.create(tr.doc, position + 1));
		}
		return true;
	});
	return chain
		.insertTable({ rows, cols: columns, withHeaderRow })
		.command(({ tr }) => {
			const cell = cellAround(tr.selection.$from);
			if (cell && cell.after(-1) === tr.doc.content.size)
				tr.insert(cell.after(-1), tr.doc.type.schema.nodes.paragraph!.create());
			return true;
		})
		.run();
}
