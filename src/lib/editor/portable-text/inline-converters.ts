// Ported from EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/core/src/components/InlinePortableTextEditor.tsx
// MIT license: notices/emdash-MIT.txt.

import type { JSONContent } from '@tiptap/core';
import { htmlBlockFields } from './html-block.js';
import { resolveImageMedia } from './converters/gallery.js';
import { deriveLegacyListId, normalizeProseMirrorOrderedListJson, normalizeListId, normalizeListStart } from './converters/numbered-list.js';


// ── Portable Text types ────────────────────────────────────────────

interface PTSpan {
	_type: "span";
	_key: string;
	text: string;
	marks?: string[];
}

interface PTMarkDef {
	_type: string;
	_key: string;
	[key: string]: unknown;
}

interface PTTextBlock {
	_type: "block";
	_key: string;
	style?: "normal" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
	listItem?: "bullet" | "number";
	level?: number;
	listId?: string;
	listStart?: number;
	children: PTSpan[];
	markDefs?: PTMarkDef[];
	textAlign?: "left" | "center" | "right" | "justify";
}

type PTTableBlock = { _type: "table"; [key: string]: unknown };
type PTBlock = PTTextBlock | PTTableBlock | { _type: string; _key: string; [key: string]: unknown };

/** Type guard for PTTextBlock */
function isPTTextBlock(block: PTBlock): block is PTTextBlock {
	return block._type === "block";
}

// ── ProseMirror → Portable Text ────────────────────────────────────

type PMNode = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: PMNode[];
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
	text?: string;
};

function canonicalMediaProviderId(provider: string | undefined): string | undefined {
	return provider === "external-url" ? "external" : provider;
}

// ── Portable Text → ProseMirror ────────────────────────────────────

function portableTextToPM(blocks: PTBlock[]): JSONContent {
	if (!blocks || blocks.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };

	const content: PMNode[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i];
		if (!block) {
			i++;
			continue;
		}
		if (isPTTextBlock(block) && block.listItem) {
			const listBlocks: PTTextBlock[] = [];
			const listType = block.listItem;
			const runStart = i;
			const rootId = listType === "number" ? normalizeListId(block.listId) : undefined;
			while (i < blocks.length) {
				const cur = blocks[i];
				if (!cur || !isPTTextBlock(cur) || !cur.listItem) break;
				const level = cur.level || 1;
				const currentId = cur.listItem === "number" ? normalizeListId(cur.listId) : undefined;
				const sameIdentity =
					listType !== "number" ||
					level > 1 ||
					(rootId ? currentId === rootId : currentId === undefined);
				if (level > 1 || (cur.listItem === listType && sameIdentity)) {
					listBlocks.push(cur);
					i++;
				} else break;
			}
			content.push(convertPTList(listBlocks, listType, `root:${runStart}`));
		} else if (
			isPTTextBlock(block) &&
			block.style === "blockquote" &&
			block.listItem === undefined
		) {
			// Group consecutive blockquote blocks into ONE blockquote node —
			// PT is flat, so a multi-paragraph quote is stored as a run of
			// blockquote-styled blocks. Mirrors the grouping in
			// content/converters/portable-text-to-prosemirror.ts; without it
			// merges revert on reload in the inline editor too.
			const quoteBlocks: PTTextBlock[] = [];
			while (i < blocks.length) {
				const cur = blocks[i];
				if (
					!cur ||
					!isPTTextBlock(cur) ||
					cur.style !== "blockquote" ||
					cur.listItem !== undefined
				) {
					break;
				}
				quoteBlocks.push(cur);
				i++;
			}
			content.push({
				type: "blockquote",
				content: quoteBlocks.map((quoteBlock) => {
					const pmContent = convertPTSpans(quoteBlock.children, quoteBlock.markDefs || []);
					return {
						type: "paragraph",
						content: pmContent.length > 0 ? pmContent : undefined,
					};
				}),
			});
		} else {
			const c = convertPTBlock(block);
			if (c) content.push(c);
			i++;
		}
	}

	return normalizeProseMirrorOrderedListJson({
		type: "doc",
		content: content.length > 0 ? content : [{ type: "paragraph" }],
	});
}

function convertPTBlock(block: PTBlock): PMNode | null {
	if (isPTTextBlock(block)) {
		const { style = "normal", children, markDefs = [], textAlign } = block;
		const pmContent = convertPTSpans(children, markDefs);

		if (style === "blockquote") {
			return {
				type: "blockquote",
				content: [
					{
						type: "paragraph",
						content: pmContent.length > 0 ? pmContent : undefined,
					},
				],
			};
		}
		if (style?.startsWith("h")) {
			const level = parseInt(style.substring(1), 10);
			return {
				type: "heading",
				attrs: { level, ...(textAlign ? { textAlign } : {}) },
				content: pmContent.length > 0 ? pmContent : undefined,
			};
		}
		return {
			type: "paragraph",
			attrs: textAlign ? { textAlign } : undefined,
			content: pmContent.length > 0 ? pmContent : undefined,
		};
	}
	if (block._type === "code") {
		const cb = block as PTBlock & { code?: string; language?: string };
		const language = typeof cb.language === "string" && cb.language.length > 0 ? cb.language : null;
		return {
			type: "codeBlock",
			attrs: { language },
			content: cb.code ? [{ type: "text", text: cb.code }] : undefined,
		};
	}
	if (block._type === "break") {
		return { type: "horizontalRule" };
	}
	if (block._type === "htmlBlock") {
		return {
			type: "htmlBlock",
			attrs: { ...htmlBlockFields(block) },
		};
	}
	if (block._type === "image") {
		const ib = block as PTBlock & {
			asset?: {
				_ref?: string;
				url?: string;
				provider?: string;
				meta?: Record<string, unknown>;
			};
			url?: string;
			alt?: string;
			caption?: string;
			title?: string;
			width?: number;
			height?: number;
			/** LQIP — first-class field (legacy snapshots keep it in `asset.meta`). */
			blurhash?: string;
			dominantColor?: string;
			displayWidth?: number;
			displayHeight?: number;
		};
		const meta = ib.asset?.meta;
		const { asset, alt, width, height } = resolveImageMedia(ib);
		// Prefer first-class LQIP fields; fall back to `asset.meta` for legacy.
		const blurhash =
			typeof ib.blurhash === "string"
				? ib.blurhash
				: typeof meta?.blurhash === "string"
					? meta.blurhash
					: null;
		const dominantColor =
			typeof ib.dominantColor === "string"
				? ib.dominantColor
				: typeof meta?.dominantColor === "string"
					? meta.dominantColor
					: null;
		return {
			type: "image",
			attrs: {
				src: asset.url || ib.url || (asset._ref ? `/_emdash/api/media/file/${asset._ref}` : ""),
				alt: alt || "",
				title: ib.title || "",
				caption: Object.hasOwn(ib, "caption") ? ib.caption || "" : ib.title || "",
				mediaId: asset._ref || undefined,
				provider: canonicalMediaProviderId(asset.provider),
				width,
				height,
				blurhash,
				dominantColor,
				displayWidth: ib.displayWidth,
				displayHeight: ib.displayHeight,
			},
		};
	}
	if (block._type === "table") {
		return {
			type: "table",
			attrs: { rawTable: block },
		};
	}
	// Unknown block types — treat as plugin blocks. Capture every field other
	// than the well-known ones into `data` so the block round-trips losslessly,
	// even if no plugin currently registers this type. Matches the admin
	// editor's `convertCustomBlock`.
	// The identity lives under whichever of `id` / `url` the block arrived with,
	// so the PM → PT direction can write it back under the same key.
	const identityField =
		typeof block.id === "string" ? "id" : typeof block.url === "string" ? "url" : "";
	const identity = identityField ? block[identityField] : undefined;
	// Filter out _-prefixed keys to prevent accumulation across edit cycles.
	const data = Object.fromEntries(
		Object.entries(block).filter(([key]) => !key.startsWith("_") && key !== identityField),
	);
	return {
		type: "pluginBlock",
		attrs: {
			blockType: typeof block._type === "string" ? block._type : "embed",
			id: typeof identity === "string" ? identity : "",
			identityField,
			data,
		},
	};
}

function convertPTList(
	items: PTTextBlock[],
	listType: "bullet" | "number",
	context: string,
): PMNode {
	const rootItems: PMNode[] = [];
	let index = 0;

	while (index < items.length) {
		const item = items[index]!;
		const level = item.level || 1;
		if (level === 1) {
			const nestedItems: PTTextBlock[] = [];
			index++;
			while (index < items.length && (items[index]!.level || 1) > 1) {
				nestedItems.push(items[index]!);
				index++;
			}
			rootItems.push(
				convertPTListItem(item, nestedItems, listType, `${context}:${rootItems.length}`),
			);
		} else {
			rootItems.push(convertPTListItem(item, [], listType, `${context}:${rootItems.length}`));
			index++;
		}
	}

	const firstItem = items[0]!;
	const listId =
		normalizeListId(firstItem.listId) ?? deriveLegacyListId(`${context}:${firstItem._key}`);
	const listStart = normalizeListStart(firstItem.listStart);
	const metadata =
		listType === "number"
			? {
					listId,
					...(listStart === undefined ? {} : { listStart }),
				}
			: undefined;
	return {
		type: listType === "bullet" ? "bulletList" : "orderedList",
		attrs: metadata ? { ...metadata, start: metadata.listStart ?? 1 } : undefined,
		content: rootItems,
	};
}

function belongsToNestedPTGroup(
	item: PTTextBlock,
	minLevel: number,
	parentListType: "bullet" | "number",
	anchorType: "bullet" | "number",
	anchorId: string | undefined,
): boolean {
	if ((item.level || 2) > minLevel) return true;
	if ((item.listItem || parentListType) !== anchorType) return false;
	if (anchorType !== "number") return true;
	const itemId = normalizeListId(item.listId);
	return anchorId ? itemId === anchorId : itemId === undefined;
}

function convertPTListItem(
	item: PTTextBlock,
	nestedItems: PTTextBlock[],
	parentListType: "bullet" | "number",
	context: string,
): PMNode {
	const content: PMNode[] = [
		{
			type: "paragraph",
			content: convertPTSpans(item.children, item.markDefs || []),
		},
	];

	if (nestedItems.length > 0) {
		let minLevel = Infinity;
		for (const nestedItem of nestedItems) {
			const level = nestedItem.level || 2;
			if (level < minLevel) minLevel = level;
		}

		let index = 0;
		while (index < nestedItems.length) {
			const groupStart = index;
			const anchorType = nestedItems[index]!.listItem || parentListType;
			const anchorId =
				anchorType === "number" ? normalizeListId(nestedItems[index]!.listId) : undefined;
			const nestedGroup: PTTextBlock[] = [];
			do {
				nestedGroup.push(nestedItems[index]!);
				index++;
			} while (
				index < nestedItems.length &&
				belongsToNestedPTGroup(nestedItems[index]!, minLevel, parentListType, anchorType, anchorId)
			);

			content.push(
				convertPTList(
					nestedGroup.map((nestedItem) => ({
						...nestedItem,
						level: (nestedItem.level || 2) - 1,
					})),
					anchorType,
					`${context}:nested:${groupStart}`,
				),
			);
		}
	}

	return { type: "listItem", content };
}

function convertPTSpans(spans: PTSpan[], markDefs: PTMarkDef[]): PMNode[] {
	const nodes: PMNode[] = [];
	const mdMap = new Map(markDefs.map((md) => [md._key, md]));

	for (const span of spans) {
		if (span._type !== "span") continue;
		const parts = span.text.split("\n");
		for (let i = 0; i < parts.length; i++) {
			const text = parts[i];
			if (text && text.length > 0) {
				const marks = convertPTMarks(span.marks || [], mdMap);
				const node: PMNode = {
					type: "text",
					text,
				};
				if (marks.length > 0) node.marks = marks;
				nodes.push(node);
			}
			if (i < parts.length - 1) nodes.push({ type: "hardBreak" });
		}
	}
	return nodes;
}

type MarkJSON = { type: string; attrs?: Record<string, unknown>; [key: string]: unknown };

function convertPTMarks(marks: string[], markDefs: Map<string, PTMarkDef>): MarkJSON[] {
	const pm: MarkJSON[] = [];
	for (const mark of marks) {
		switch (mark) {
			case "strong":
				pm.push({ type: "bold" });
				break;
			case "em":
				pm.push({ type: "italic" });
				break;
			case "underline":
				pm.push({ type: "underline" });
				break;
			case "strike-through":
				pm.push({ type: "strike" });
				break;
			case "code":
				pm.push({ type: "code" });
				break;
			default: {
				const md = markDefs.get(mark);
				if (md && md._type === "link") {
					pm.push({
						type: "link",
						attrs: { href: md.href, target: md.blank ? "_blank" : null },
					});
				}
				break;
			}
		}
	}
	return pm;
}
export { portableTextToPM as _portableTextToPM };
