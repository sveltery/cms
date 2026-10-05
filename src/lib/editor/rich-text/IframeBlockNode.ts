// Pinned EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
// Whole Source schema/clipboard/keyboard declarations; node-view renderer adapts to Native Svelte only.
import { Node, mergeAttributes } from '@tiptap/core';
import { CLIPBOARD_TOKEN, embedBlockKeyboardShortcuts } from './top-block';
import { embedBlockNodeView } from './embed-node-view';



// Iframes pasted from other pages arrive empty, so a page can't put its own embed on the site.
const copiedHere = (element: HTMLElement) =>
	element.getAttribute("data-iframe-token") === CLIPBOARD_TOKEN;

function textAttribute(name: string) {
	return {
		default: "",
		parseHTML: (element: HTMLElement) =>
			(copiedHere(element) && element.getAttribute(`data-iframe-${name}`)) || "",
		renderHTML: (attributes: Record<string, unknown>) =>
			typeof attributes[name] === "string" && attributes[name]
				? { [`data-iframe-${name}`]: attributes[name] }
				: {},
	};
}

function numberAttribute(name: string) {
	return {
		default: null,
		parseHTML: (element: HTMLElement) => {
			if (!copiedHere(element)) return null;
			const value = Number(element.getAttribute(`data-iframe-${name}`));
			return Number.isInteger(value) && value > 0 ? value : null;
		},
		renderHTML: (attributes: Record<string, unknown>) =>
			typeof attributes[name] === "number"
				? { [`data-iframe-${name}`]: String(attributes[name]) }
				: {},
	};
}

/**
 * TipTap extension: iframe block.
 *
 * A top-level atom. The editor's global drag handle moves it.
 */
export const IframeBlockExtension = Node.create({
	name: "iframeBlock",
	group: "topBlock",
	atom: true,
	draggable: false,
	selectable: true,

	addAttributes() {
		return {
			src: textAttribute("src"),
			title: textAttribute("title"),
			width: numberAttribute("width"),
			height: numberAttribute("height"),
			allow: textAttribute("allow"),
			allowFullscreen: {
				default: false,
				parseHTML: (element: HTMLElement) =>
					copiedHere(element) && element.hasAttribute("data-iframe-allowfullscreen"),
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes.allowFullscreen === true ? { "data-iframe-allowfullscreen": "" } : {},
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-iframe-block]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-iframe-block": "",
				"data-iframe-token": CLIPBOARD_TOKEN,
			}),
		];
	},

	addNodeView() {
		return embedBlockNodeView;
	},

	addKeyboardShortcuts() {
		return embedBlockKeyboardShortcuts(this.type);
	},
});
