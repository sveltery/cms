/**
 * ProseMirror to Portable Text Converter
 *
 * Converts TipTap's ProseMirror JSON format to Portable Text for storage.
 */
import { htmlBlockFields } from "@emdash-cms/admin/html-block";
import { UnsafePortableTextTableError, proseMirrorTableToPortableText, } from "@emdash-cms/admin/portable-text-table";
import { sanitizeGalleryImages } from "./gallery.js";
import { UnsupportedPortableTextMarksError, assertProseMirrorMarksSupported, } from "./mark-safety.js";
import { readOrderedListMetadata } from "./numbered-list.js";
import { PORTABLE_TEXT_BLOCK_NODE, PORTABLE_TEXT_SPAN_MARK, portableTextBlockFromAttrs, portableTextKeyFromAttrs, portableTextMarkDefsFromMarks, portableTextSpanKeyFromMarks, } from "./portable-text-identity.js";
/**
 * Generate a unique key for Portable Text blocks
 */
function generateKey() {
    return Math.random().toString(36).substring(2, 11);
}
/**
 * Convert ProseMirror document to Portable Text
 */
export function prosemirrorToPortableText(doc) {
    if (!doc || doc.type !== "doc" || !doc.content) {
        return [];
    }
    assertProseMirrorMarksSupported(doc);
    const blocks = [];
    const usedBlockKeys = new Set();
    for (const [i, node] of doc.content.entries()) {
        if (i === doc.content.length - 1 && isUnkeyedEmptyParagraph(node))
            continue;
        const converted = convertNode(node, `root:${i}`);
        for (const block of converted ? (Array.isArray(converted) ? converted : [converted]) : []) {
            let key = block._key;
            if (usedBlockKeys.has(key)) {
                do
                    key = generateKey();
                while (usedBlockKeys.has(key));
            }
            usedBlockKeys.add(key);
            blocks.push(key === block._key ? block : { ...block, _key: key });
        }
    }
    return blocks;
}
function isUnkeyedEmptyParagraph(node) {
    return (node.type === "paragraph" &&
        (node.content?.length ?? 0) === 0 &&
        portableTextKeyFromAttrs(node.attrs) === undefined);
}
/**
 * Convert a single ProseMirror node to Portable Text block(s)
 */
function convertNode(node, path) {
    switch (node.type) {
        case PORTABLE_TEXT_BLOCK_NODE:
            return portableTextBlockFromAttrs(node.attrs) ?? null;
        case "paragraph":
            return convertParagraph(node);
        case "heading":
            return convertHeading(node);
        case "bulletList":
            return convertList(node, "bullet", path);
        case "orderedList":
            return convertList(node, "number", path);
        case "blockquote":
            return convertBlockquote(node);
        case "codeBlock":
            return convertCodeBlock(node);
        case "htmlBlock":
            return convertHtmlBlock(node);
        case "iframeBlock":
            return convertIframeBlock(node);
        case "image":
            return convertImage(node);
        case "gallery":
            return convertGallery(node);
        case "table": {
            const result = proseMirrorTableToPortableText(node, {
                path,
                createKey: generateKey,
                inlineToSpans: (content) => {
                    const { children, markDefs } = convertInlineContent(content, true);
                    return { content: children, markDefs };
                },
            });
            if (!result.ok) {
                throw new UnsafePortableTextTableError(result.reason, result.raw, result.renderFallback);
            }
            return result.table;
        }
        case "horizontalRule":
            return {
                _type: "break",
                _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
                style: "lineBreak",
            };
        default:
            // Preserve unknown blocks
            return {
                _type: node.type,
                _key: generateKey(),
                ...node.attrs,
                _pmContent: node.content,
            };
    }
}
/**
 * Convert paragraph to Portable Text block
 */
function convertParagraph(node) {
    const { children, markDefs } = convertInlineContent(node.content || []);
    // Skip empty paragraphs
    if (children.length === 0) {
        return null;
    }
    const ta = node.attrs?.textAlign;
    const textAlign = ta === "center" || ta === "right" || ta === "justify" ? ta : undefined;
    return {
        _type: "block",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        style: "normal",
        children,
        ...(markDefs.length > 0 ? { markDefs } : {}),
        ...(textAlign ? { textAlign } : {}),
    };
}
/** Map heading level number to Portable Text style */
function headingLevelToStyle(level) {
    switch (level) {
        case 1:
            return "h1";
        case 2:
            return "h2";
        case 3:
            return "h3";
        case 4:
            return "h4";
        case 5:
            return "h5";
        case 6:
            return "h6";
        default:
            return "h1";
    }
}
/**
 * Convert heading to Portable Text block
 */
function convertHeading(node) {
    const { children, markDefs } = convertInlineContent(node.content || []);
    const rawLevel = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
    const style = headingLevelToStyle(rawLevel);
    if (children.length === 0) {
        return null;
    }
    const ta = node.attrs?.textAlign;
    const textAlign = ta === "center" || ta === "right" || ta === "justify" ? ta : undefined;
    return {
        _type: "block",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        style,
        children,
        markDefs: markDefs.length > 0 ? markDefs : undefined,
        ...(textAlign ? { textAlign } : {}),
    };
}
/**
 * Convert list to Portable Text blocks
 */
function convertList(node, listItem, path) {
    const blocks = [];
    const metadata = listItem === "number" ? readOrderedListMetadata(node.attrs, path) : undefined;
    for (const [i, item] of (node.content ?? []).entries()) {
        if (item.type === "listItem") {
            const itemBlocks = convertListItem(item, listItem, 1, `${path}:${i}`, metadata);
            blocks.push(...itemBlocks);
        }
    }
    return blocks;
}
/**
 * Convert list item to Portable Text blocks
 */
function convertListItem(item, listItem, level, path, metadata) {
    const blocks = [];
    for (const [i, child] of (item.content ?? []).entries()) {
        if (child.type === "paragraph") {
            const { children, markDefs } = convertInlineContent(child.content || []);
            if (children.length > 0) {
                blocks.push({
                    _type: "block",
                    _key: portableTextKeyFromAttrs(child.attrs) ?? generateKey(),
                    style: "normal",
                    listItem,
                    level,
                    ...metadata,
                    children,
                    markDefs: markDefs.length > 0 ? markDefs : undefined,
                });
            }
        }
        else if (child.type === "bulletList") {
            blocks.push(...convertListItemNested(child, "bullet", level + 1, `${path}:${i}`));
        }
        else if (child.type === "orderedList") {
            blocks.push(...convertListItemNested(child, "number", level + 1, `${path}:${i}`));
        }
    }
    return blocks;
}
/**
 * Convert nested list
 */
function convertListItemNested(node, listItem, level, path) {
    const blocks = [];
    const metadata = listItem === "number" ? readOrderedListMetadata(node.attrs, path) : undefined;
    for (const [i, item] of (node.content ?? []).entries()) {
        if (item.type === "listItem") {
            blocks.push(...convertListItem(item, listItem, level, `${path}:${i}`, metadata));
        }
    }
    return blocks;
}
/**
 * Convert blockquote to Portable Text blocks
 */
function convertBlockquote(node) {
    // Blockquotes in PT are just blocks with style: "blockquote"
    const blocks = [];
    for (const child of node.content || []) {
        if (child.type === "paragraph") {
            const { children, markDefs } = convertInlineContent(child.content || []);
            if (children.length > 0) {
                blocks.push({
                    _type: "block",
                    _key: portableTextKeyFromAttrs(child.attrs) ??
                        portableTextKeyFromAttrs(node.attrs) ??
                        generateKey(),
                    style: "blockquote",
                    children,
                    markDefs: markDefs.length > 0 ? markDefs : undefined,
                });
            }
        }
    }
    return blocks.length === 1 ? blocks[0] : blocks.length > 0 ? blocks : null;
}
/**
 * Convert code block to Portable Text
 */
function convertCodeBlock(node) {
    const code = node.content?.map((n) => n.text || "").join("") || "";
    const language = typeof node.attrs?.language === "string" ? node.attrs.language : undefined;
    return {
        _type: "code",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        code,
        language: language || undefined,
    };
}
/**
 * Convert HTML block to Portable Text
 */
function convertHtmlBlock(node) {
    return {
        _type: "htmlBlock",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        ...htmlBlockFields(node.attrs ?? {}),
    };
}
/**
 * Convert iframe block to Portable Text, writing optional fields only when set
 */
function convertIframeBlock(node) {
    const { src, title, width, height, allow, allowFullscreen } = node.attrs ?? {};
    const block = {
        _type: "iframe",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        src: typeof src === "string" ? src : "",
    };
    if (typeof title === "string" && title)
        block.title = title;
    if (isFrameDimension(width))
        block.width = width;
    if (isFrameDimension(height))
        block.height = height;
    if (typeof allow === "string" && allow)
        block.allow = allow;
    if (allowFullscreen === true)
        block.allowFullscreen = true;
    return block;
}
function isFrameDimension(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10_000;
}
function imageDimension(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
/**
 * Convert image to Portable Text
 */
function convertImage(node) {
    const attrs = node.attrs;
    const provider = typeof attrs?.provider === "string" ? attrs.provider : undefined;
    const mediaId = typeof attrs?.mediaId === "string" ? attrs.mediaId : undefined;
    const src = typeof attrs?.src === "string" ? attrs.src : "";
    const alt = typeof attrs?.alt === "string" ? attrs.alt : undefined;
    const title = typeof attrs?.title === "string" ? attrs.title : undefined;
    const caption = attrs && Object.hasOwn(attrs, "caption")
        ? typeof attrs.caption === "string"
            ? attrs.caption
            : undefined
        : title;
    const width = imageDimension(attrs?.width);
    const height = imageDimension(attrs?.height);
    const displayWidth = imageDimension(attrs?.displayWidth);
    const displayHeight = imageDimension(attrs?.displayHeight);
    const alignment = attrs?.alignment;
    // Normalise link: drop entirely when href is missing or empty so half-populated
    // { blank: true } objects don't round-trip.
    let link;
    const rawLink = attrs?.link;
    if (rawLink && typeof rawLink === "object") {
        const linkObj = rawLink;
        const href = typeof linkObj.href === "string" ? linkObj.href.trim() : "";
        if (href) {
            link = { href };
            if (linkObj.blank === true)
                link.blank = true;
        }
    }
    return {
        _type: "image",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        asset: {
            // Use mediaId as _ref if available (for proper provider lookups)
            _ref: mediaId || src || "",
            // Store URL for admin preview and fallback rendering
            url: src || "",
            // Store provider for external media
            provider: provider && provider !== "local" ? provider : undefined,
        },
        alt: alt || undefined,
        caption: caption || (title ? "" : undefined),
        title: title || undefined,
        width: width || undefined,
        height: height || undefined,
        displayWidth: displayWidth || undefined,
        displayHeight: displayHeight || undefined,
        alignment: alignment === "left" ||
            alignment === "center" ||
            alignment === "right" ||
            alignment === "wide" ||
            alignment === "full"
            ? alignment
            : undefined,
        link,
    };
}
/**
 * Convert gallery node to Portable Text
 */
function convertGallery(node) {
    const columns = node.attrs?.columns;
    return {
        _type: "gallery",
        _key: portableTextKeyFromAttrs(node.attrs) ?? generateKey(),
        images: sanitizeGalleryImages(node.attrs?.images, generateKey),
        ...(typeof columns === "number" ? { columns } : {}),
    };
}
/**
 * Convert inline content (text nodes with marks) to Portable Text spans
 */
function convertInlineContent(nodes, preserveHardBreakBoundary = false) {
    const children = [];
    const markDefs = [];
    const markDefMap = new Map();
    const usedSpanKeys = new Set();
    const claimSpanKey = (preferred) => {
        if (preferred && !usedSpanKeys.has(preferred)) {
            usedSpanKeys.add(preferred);
            return preferred;
        }
        let key;
        do
            key = generateKey();
        while (usedSpanKeys.has(key));
        usedSpanKeys.add(key);
        return key;
    };
    for (const node of nodes) {
        if (node.type === "text" && node.text) {
            const marks = [];
            const originalMarkDefs = portableTextMarkDefsFromMarks(node.marks);
            for (const mark of node.marks || []) {
                const markType = convertMark(mark, markDefs, markDefMap, originalMarkDefs);
                if (markType) {
                    marks.push(markType);
                }
            }
            const preferredKey = portableTextSpanKeyFromMarks(node.marks) ?? portableTextKeyFromAttrs(node.attrs);
            const normalizedMarks = marks.length > 0 ? marks : undefined;
            const previous = children.at(-1);
            if (preferredKey &&
                previous?._key === preferredKey &&
                JSON.stringify(previous.marks) === JSON.stringify(normalizedMarks)) {
                previous.text += node.text;
                continue;
            }
            children.push({
                _type: "span",
                _key: claimSpanKey(preferredKey),
                text: node.text,
                marks: normalizedMarks,
            });
        }
        else if (node.type === "hardBreak") {
            // Hard breaks become newlines in the text
            if (children.length > 0 && !preserveHardBreakBoundary) {
                const lastChild = children.at(-1);
                lastChild.text += "\n";
            }
            else {
                children.push({
                    _type: "span",
                    _key: claimSpanKey(portableTextSpanKeyFromMarks(node.marks) ?? portableTextKeyFromAttrs(node.attrs)),
                    text: "\n",
                });
            }
        }
    }
    // Ensure at least one span exists
    if (children.length === 0) {
        children.push({
            _type: "span",
            _key: claimSpanKey(),
            text: "",
        });
    }
    return { children, markDefs };
}
/**
 * Convert a ProseMirror mark to Portable Text mark
 */
function convertMark(mark, markDefs, markDefMap, originalMarkDefs) {
    switch (mark.type) {
        case "bold":
        case "strong":
            return "strong";
        case "italic":
        case "em":
            return "em";
        case "underline":
            return "underline";
        case "strike":
        case "strikethrough":
            return "strike-through";
        case "subscript":
            return "subscript";
        case "superscript":
            return "superscript";
        case "code":
            return "code";
        case PORTABLE_TEXT_SPAN_MARK:
            return null;
        case "link": {
            const href = (typeof mark.attrs?.href === "string" ? mark.attrs.href : "") || "";
            const blank = mark.attrs?.target === "_blank";
            const originalMarkDef = originalMarkDefs.find((markDef) => markDef._type === "link");
            const mapKey = originalMarkDef
                ? `key:${originalMarkDef._key}`
                : `value:${JSON.stringify([href, blank])}`;
            // Check if we already have a mark def for this link
            if (markDefMap.has(mapKey)) {
                return markDefMap.get(mapKey);
            }
            // Create new mark def
            const key = originalMarkDef?._key || generateKey();
            markDefs.push({
                ...originalMarkDef,
                _type: "link",
                _key: key,
                href,
                ...(originalMarkDef
                    ? blank || Object.hasOwn(originalMarkDef, "blank")
                        ? { blank }
                        : {}
                    : { blank }),
            });
            markDefMap.set(mapKey, key);
            return key;
        }
        default:
            throw new UnsupportedPortableTextMarksError([mark.type]);
    }
}
