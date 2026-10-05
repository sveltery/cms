// Whole pinned CodeEditor types/configuration declarations; MIT notices/emdash-MIT.txt.
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import {
	HighlightStyle,
	bracketMatching,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type CodeEditorLanguage = "html" | "css" | "javascript";

export interface CodeEditorProps {
	language: CodeEditorLanguage;
	/** Initial content. Remount the editor to replace it. */
	value: string;
	onChange: (value: string) => void;
	onFocusChange: (focused: boolean) => void;
	onEscape: () => void;
	editable: boolean;
	autoFocus: boolean;
	ariaLabel: string;
	placeholder: string;
	/** The id of another element that describes the editor, such as an error. */
	describedBy?: string;
}

const LANGUAGES: Record<CodeEditorLanguage, () => Extension> = { html, css, javascript };

const highlightStyle = HighlightStyle.define([
	{ tag: [tags.comment, tags.angleBracket], color: "var(--emdash-code-muted)" },
	{
		tag: [tags.keyword, tags.modifier, tags.bool, tags.null, tags.atom],
		color: "var(--emdash-code-keyword)",
	},
	{
		tag: [tags.string, tags.special(tags.string), tags.regexp, tags.attributeValue],
		color: "var(--emdash-code-string)",
	},
	{ tag: [tags.attributeName, tags.propertyName], color: "var(--emdash-code-string)" },
	{ tag: [tags.number, tags.unit, tags.meta], color: "var(--emdash-code-number)" },
	{
		tag: [tags.tagName, tags.typeName, tags.className, tags.function(tags.variableName)],
		color: "var(--emdash-code-title)",
	},
]);

const theme = EditorView.theme({
	"&": {
		color: "var(--emdash-code-foreground)",
		backgroundColor: "var(--emdash-code-background)",
		maxHeight: "32rem",
	},
	"&.cm-focused": { outline: "none" },
	".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", lineHeight: "1.6" },
	".cm-content, .cm-gutter": { minHeight: "10rem" },
	".cm-content": { caretColor: "var(--emdash-code-foreground)", paddingBlock: "0.75rem" },
	".cm-cursor": { borderInlineStartColor: "var(--emdash-code-foreground)" },
	".cm-gutters": {
		backgroundColor: "transparent",
		color: "var(--emdash-code-muted)",
		border: "none",
	},
	".cm-placeholder": { color: "var(--emdash-code-muted)" },
	".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
		{ backgroundColor: "color-mix(in srgb, var(--emdash-code-title) 22%, transparent)" },
});

function editability(editable: boolean): Extension {
	return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
}

export { LANGUAGES, highlightStyle, theme, editability };
