// Ported from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/PortableTextEditor.tsx; MIT, see notices/emdash-MIT.txt.

import { Extension, Mark, type Editor } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';


const PORTABLE_TEXT_BLOCK_ATTR = "emdashPortableTextBlock";
const PORTABLE_TEXT_KEY_ATTR = "emdashPortableTextKey";
const PORTABLE_TEXT_SPAN_MARK = "emdashPortableTextSpan";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Point the selected image at `href`, or clear its link when `href` is empty.
 * Keeps an existing "open in new tab" choice when only the destination changes.
 * Shared by the toolbar and the bubble menu, which both edit image links.
 */
function setSelectedImageLink(editor: Editor, href: string | null) {
	const trimmed = href?.trim() ?? "";
	const existing = editor.getAttributes("image").link as { blank?: boolean } | null;
	const link = trimmed ? { href: trimmed, ...(existing?.blank ? { blank: true } : {}) } : null;
	editor.chain().focus().updateAttributes("image", { link }).run();
}

function setSelectedTextLink(editor: Editor, href: string) {
	const chain = editor.chain().focus().extendMarkRange("link").setLink({ href });
	if (editor.state.selection.empty) {
		chain.run();
		return;
	}
	chain
		.command(({ tr, state }) => {
			const linkType = state.schema.marks.link;
			if (!linkType) return false;
			tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), -1));
			tr.removeStoredMark(linkType);
			return true;
		})
		.run();
}

const LinkBoundaryExit = Extension.create({
	name: "linkBoundaryExit",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction(transactions, _oldState, newState) {
					if (
						!transactions.some((transaction) => transaction.selectionSet && !transaction.docChanged)
					) {
						return null;
					}
					const { selection } = newState;
					if (!(selection instanceof TextSelection) || !selection.empty) return null;
					const linkType = newState.schema.marks.link;
					if (!linkType) return null;
					const linkBefore = linkType.isInSet(selection.$from.nodeBefore?.marks ?? []);
					const linkAfter = linkType.isInSet(selection.$from.nodeAfter?.marks ?? []);
					if (!linkBefore || (linkAfter && linkBefore.eq(linkAfter))) return null;
					return newState.tr.removeStoredMark(linkType);
				},
			}),
		];
	},
});

function equalJsonValues(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => equalJsonValues(value, right[index]))
		);
	}
	if (!isRecord(left) || !isRecord(right)) return false;
	const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
	const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every((key) => Object.hasOwn(right, key) && equalJsonValues(left[key], right[key]))
	);
}

const PortableTextIdentityExtension = Extension.create({
	name: "emdashPortableTextIdentity",

	addGlobalAttributes() {
		const hiddenAttribute = { default: null, rendered: false };
		return [
			{
				types: [
					"paragraph",
					"heading",
					"blockquote",
					"codeBlock",
					"htmlBlock",
					"iframeBlock",
					"image",
					"horizontalRule",
					"gallery",
					"table",
					"tableRow",
					"tableCell",
					"tableHeader",
					"pluginBlock",
				],
				attributes: { [PORTABLE_TEXT_KEY_ATTR]: hiddenAttribute },
			},
			{
				types: ["pluginBlock"],
				attributes: { [PORTABLE_TEXT_BLOCK_ATTR]: hiddenAttribute },
			},
		];
	},
});

// ProseMirror text nodes cannot carry schema attributes, so a non-rendered mark
// keeps each Portable Text span's key and referenced mark definitions attached.
const PortableTextSpanIdentity = Mark.create({
	name: PORTABLE_TEXT_SPAN_MARK,
	inclusive: false,
	spanning: false,

	addAttributes() {
		return {
			key: { default: null, rendered: false },
			markDefs: { default: [], rendered: false },
		};
	},

	parseHTML() {
		return [];
	},

	renderHTML() {
		return ["span", 0];
	},
});

// =============================================================================
// Editor Footer with Writing Metrics
// =============================================================================

// Reading speed used for the footer metrics. CJK characters get a separate,
// higher rate because they are denser than space-delimited words. These mirror
// the published reading-time util (templates/blog/src/utils/reading-time.ts,
// covered by packages/core/tests/unit/templates/blog-reading-time.test.ts) so
// the editor footer and the rendered site report the same numbers.
const WORDS_PER_MINUTE = 200;
const CJK_CHARACTERS_PER_MINUTE = 500;
const WHITESPACE_REGEX = /\s+/;
const URL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;
const WWW_PREFIX_REGEX = /^www\./i;

// CJK scripts do not separate words with spaces, so a split()-based count treats
// a whole paragraph as a single word. Count those characters individually.
const CJK_CHARACTER_REGEX =
	/\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/gu;

function countCjkCharacters(text: string): number {
	return text.match(CJK_CHARACTER_REGEX)?.length ?? 0;
}

function countNonCjkWords(text: string): number {
	return text.replace(CJK_CHARACTER_REGEX, " ").split(WHITESPACE_REGEX).filter(Boolean).length;
}

/**
 * Word count for the editor footer. CJK characters are counted individually
 * because they are not delimited by spaces; other scripts are counted by word.
 * Used as the `wordCounter` for the CharacterCount extension, whose default
 * (`text.split(' ')`) reports a spaceless CJK paragraph as a single word.
 */
export function countWords(text: string): number {
	return countNonCjkWords(text) + countCjkCharacters(text);
}

/**
 * Calculate reading time in minutes for the given text. Word-based scripts are
 * read at WORDS_PER_MINUTE and CJK characters at CJK_CHARACTERS_PER_MINUTE.
 * Returns 0 for an empty document.
 */
export function calculateReadingTime(text: string): number {
	return Math.ceil(
		countNonCjkWords(text) / WORDS_PER_MINUTE +
			countCjkCharacters(text) / CJK_CHARACTERS_PER_MINUTE,
	);
}

export { PortableTextIdentityExtension, PortableTextSpanIdentity, LinkBoundaryExit, equalJsonValues, URL_SCHEME_REGEX, WWW_PREFIX_REGEX, setSelectedImageLink, setSelectedTextLink };
