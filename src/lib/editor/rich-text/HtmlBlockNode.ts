// Pinned EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
// Whole Source schema/clipboard/keyboard declarations; node-view renderer adapts to Native Svelte only.
import { Node, mergeAttributes } from '@tiptap/core';
import { CLIPBOARD_TOKEN, embedBlockKeyboardShortcuts } from './top-block';
import { embedBlockNodeView } from './embed-node-view';



/**
 * TipTap extension: first-class HTML block.
 *
 * A top-level atom. The editor's global drag handle moves it.
 */
export const HtmlBlockExtension = Node.create({
	name: "htmlBlock",
	group: "topBlock",
	atom: true,
	draggable: false,
	selectable: true,

	addAttributes() {
		return {
			html: {
				default: "",
				// Store the raw markup in a semantic `data-html-content` attribute
				// rather than leaking it as a bare `html="..."` attribute on every
				// DOM/clipboard serialization (drag, copy, paste).
				parseHTML: (element) => element.getAttribute("data-html-content") ?? "",
				renderHTML: (attributes) => {
					const html = typeof attributes.html === "string" ? attributes.html : "";
					if (!html) return {};
					return { "data-html-content": html };
				},
			},
			css: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-html-css") ?? "",
				renderHTML: (attributes) =>
					typeof attributes.css === "string" && attributes.css
						? { "data-html-css": attributes.css }
						: {},
			},
			js: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-html-js") ?? "",
				renderHTML: (attributes) =>
					typeof attributes.js === "string" && attributes.js
						? { "data-html-js": attributes.js }
						: {},
			},
			isolated: {
				default: false,
				// Blocks pasted from other pages render inline, so their scripts don't run on the site.
				parseHTML: (element) => element.getAttribute("data-html-isolated") === CLIPBOARD_TOKEN,
				renderHTML: (attributes) =>
					attributes.isolated === true ? { "data-html-isolated": CLIPBOARD_TOKEN } : {},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "div[data-html-block]",
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-html-block": "" })];
	},

	addNodeView() {
		return embedBlockNodeView;
	},

	addKeyboardShortcuts() {
		return embedBlockKeyboardShortcuts(this.type);
	},
});
