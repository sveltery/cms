// Whole AST-selected Source declarations 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
import { Extension, type Editor, type Range } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import type * as React from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
// Icons are Native display tokens; Source command values/operators are unchanged.
type Icon = string;
const TextHOne='H1', TextHTwo='H2', TextHThree='H3', TextHFour='H4', TextHFive='H5', TextHSix='H6', List='•', ListNumbers='1.', Quotes='“', CodeBlock='{}', BracketsAngle='</>', FrameCorners='▣', Minus='—', TableIcon='▦';


// =============================================================================
// Slash Commands
// =============================================================================

/**
 * Slash command item definition
 */
interface SlashCommandItem {
	id: string;
	/** Built-in commands use `msg`; plugin/API-sourced titles stay plain `string`. */
	title: MessageDescriptor | string;
	description: MessageDescriptor | string;
	icon: Icon | React.ComponentType<{ className?: string }>;
	command: (props: { editor: Editor; range: Range }) => void;
	/** Delay document insertion until a modal-backed command returns a selection. */
	deferInsertion?: boolean;
	opensTablePicker?: boolean;
	aliases?: string[];
	/**
	 * Display category. Built-in commands use `msg`-tagged descriptors;
	 * plugin-supplied categories arrive as plain strings via the manifest
	 * and are passed through verbatim when rendered.
	 */
	category?: MessageDescriptor | string;
}

/**
 * Insert a top-level block: at `position` when given, in place of an empty
 * top-level paragraph, before the top-level block whose start holds the
 * cursor, and otherwise after it. The new block is node-selected; its node
 * view takes focus itself.
 */
function insertTopLevelBlock(
	editor: Editor,
	block: ProseMirrorNode,
	range?: Range,
	position?: number,
) {
	const tr = closeHistory(editor.state.tr);
	if (range) tr.delete(range.from, range.to);
	const { selection } = tr;
	const { $from } = selection;
	const atBlockStart =
		$from.parentOffset === 0 &&
		Array.from({ length: $from.depth - 1 }, (_, depth) => $from.index(depth + 1)).every(
			(index) => index === 0,
		);
	let at: number;
	if (position !== undefined) {
		at = position;
		tr.insert(at, block);
	} else if (
		$from.depth === 1 &&
		$from.parent.type.name === "paragraph" &&
		!$from.parent.childCount
	) {
		at = $from.before(1);
		tr.replaceWith(at, $from.after(1), block);
	} else {
		at = $from.depth === 0 ? selection.to : atBlockStart ? $from.before(1) : $from.after(1);
		tr.insert(at, block);
	}
	tr.setSelection(NodeSelection.create(tr.doc, at));
	editor.view.dispatch(tr.scrollIntoView());
}

function insertIframeBlock(editor: Editor, range?: Range, position?: number) {
	insertTopLevelBlock(editor, editor.schema.nodes.iframeBlock!.create(), range, position);
}

function insertHtmlBlock(editor: Editor, range?: Range, position?: number) {
	insertTopLevelBlock(
		editor,
		editor.schema.nodes.htmlBlock!.create({ isolated: true }),
		range,
		position,
	);
}

/**
 * Default slash commands for built-in block types
 */
const defaultSlashCommands: SlashCommandItem[] = [
	{
		id: "heading1",
		title: msg`Heading 1`,
		description: msg`Large section heading`,
		icon: TextHOne,
		aliases: ["h1", "title"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
		},
	},
	{
		id: "heading2",
		title: msg`Heading 2`,
		description: msg`Medium section heading`,
		icon: TextHTwo,
		aliases: ["h2", "subtitle"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
		},
	},
	{
		id: "heading3",
		title: msg`Heading 3`,
		description: msg`Small section heading`,
		icon: TextHThree,
		aliases: ["h3"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
		},
	},
	{
		id: "heading4",
		title: msg`Heading 4`,
		description: msg`Smaller section heading`,
		icon: TextHFour,
		aliases: ["h4"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 4 }).run();
		},
	},
	{
		id: "heading5",
		title: msg`Heading 5`,
		description: msg`Minor section heading`,
		icon: TextHFive,
		aliases: ["h5"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 5 }).run();
		},
	},
	{
		id: "heading6",
		title: msg`Heading 6`,
		description: msg`Smallest section heading`,
		icon: TextHSix,
		aliases: ["h6"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setNode("heading", { level: 6 }).run();
		},
	},
	{
		id: "bulletList",
		title: msg`Bullet List`,
		description: msg`Create a bullet list`,
		icon: List,
		aliases: ["ul", "unordered"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		id: "numberedList",
		title: msg`Numbered List`,
		description: msg`Create a numbered list`,
		icon: ListNumbers,
		aliases: ["ol", "ordered"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		id: "quote",
		title: msg`Quote`,
		description: msg`Insert a blockquote`,
		icon: Quotes,
		aliases: ["blockquote", "cite"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		id: "codeBlock",
		title: msg`Code Block`,
		description: msg`Insert a code block`,
		icon: CodeBlock,
		aliases: ["code", "pre", "```"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		id: "htmlBlock",
		title: msg`HTML`,
		description: msg`Insert raw HTML`,
		icon: BracketsAngle,
		aliases: ["html", "raw", "markup"],
		command: ({ editor, range }) => insertHtmlBlock(editor, range),
	},
	{
		id: "iframe",
		title: msg`Iframe`,
		description: msg`Embed a page from another site`,
		icon: FrameCorners,
		aliases: ["embed", "youtube", "vimeo", "video", "map"],
		command: ({ editor, range }) => insertIframeBlock(editor, range),
	},
	{
		id: "divider",
		title: msg`Divider`,
		description: msg`Insert a horizontal rule`,
		icon: Minus,
		aliases: ["hr", "---", "separator"],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		id: "table",
		title: msg`Table`,
		description: msg`Insert a table`,
		icon: TableIcon,
		aliases: ["grid", "spreadsheet"],
		opensTablePicker: true,
		command: () => undefined,
	},
];

/**
 * Slash menu state
 */
interface SlashMenuState {
	isOpen: boolean;
	mode: "commands" | "table-size";
	items: SlashCommandItem[];
	selectedIndex: number;
	clientRect: (() => DOMRect | null) | null;
	range: Range | null;
	trigger: "slash" | "gutter";
	gutterBlockPos: number | null;
	dismissedSlashFrom: number | null;
}

/**
 * Create the slash commands TipTap extension
 */
function createSlashCommandsExtension(options: {
	filterCommands: (query: string) => SlashCommandItem[];
	onStateChange: React.Dispatch<React.SetStateAction<SlashMenuState>>;
	getState: () => SlashMenuState;
}) {
	const { filterCommands, onStateChange, getState } = options;
	const execute = (item: SlashCommandItem, editor: Editor, range: Range) => {
		if (item.opensTablePicker) {
			onStateChange((state) => ({ ...state, isOpen: true, mode: "table-size", range }));
			return;
		}
		item.command({ editor, range });
	};

	return Extension.create({
		name: "slashCommands",
		onTransaction() {
			const state = getState();
			if (state.dismissedSlashFrom === null) return;
			const to = Math.min(state.dismissedSlashFrom + 1, this.editor.state.doc.content.size);
			if (this.editor.state.doc.textBetween(state.dismissedSlashFrom, to) !== "/") {
				onStateChange((prev) => ({ ...prev, dismissedSlashFrom: null }));
			}
		},

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					char: "/",
					startOfLine: true,
					command: ({ editor, range, props }) => {
						const item = props as SlashCommandItem;
						execute(item, editor, range);
					},
					items: ({ query }) => filterCommands(query),
					allow: ({ range }) =>
						!this.editor.isActive("table") && getState().dismissedSlashFrom !== range.from,
					render: () => {
						return {
							onStart: (props) => {
								onStateChange({
									isOpen: true,
									mode: "commands",
									items: props.items,
									selectedIndex: 0,
									clientRect: props.clientRect ?? null,
									range: props.range,
									trigger: "slash",
									gutterBlockPos: null,
									dismissedSlashFrom: null,
								});
							},
							onUpdate: (props) => {
								onStateChange((prev) => ({
									...prev,
									items: props.items,
									selectedIndex: 0,
									clientRect: props.clientRect ?? null,
									range: props.range,
									trigger: "slash",
									gutterBlockPos: null,
									dismissedSlashFrom: null,
								}));
							},
							onKeyDown: (props) => {
								if (props.event.key === "Escape" || props.event.key === "Tab") {
									onStateChange((prev) => ({
										...prev,
										isOpen: false,
										dismissedSlashFrom: props.range.from,
									}));
									exitSuggestion(props.view);
									return props.event.key === "Escape";
								}

								if (props.event.key === "ArrowUp") {
									onStateChange((prev) => ({
										...prev,
										selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % prev.items.length,
									}));
									return true;
								}

								if (props.event.key === "ArrowDown") {
									onStateChange((prev) => ({
										...prev,
										selectedIndex: (prev.selectedIndex + 1) % prev.items.length,
									}));
									return true;
								}

								if (props.event.key === "Enter") {
									const state = getState();
									if (state.items.length > 0 && state.range) {
										const item = state.items[state.selectedIndex];
										if (item) {
											execute(item, this.editor, state.range);
											if (!item.opensTablePicker) {
												onStateChange((prev) => ({ ...prev, isOpen: false }));
											}
											return true;
										}
									}
									return false;
								}

								return false;
							},
							onExit: () => {
								onStateChange((prev) => ({ ...prev, isOpen: false }));
							},
						};
					},
				}),
			];
		},
	});
}

export { defaultSlashCommands, createSlashCommandsExtension, insertTopLevelBlock, insertIframeBlock, insertHtmlBlock };
export type { SlashCommandItem, SlashMenuState };
