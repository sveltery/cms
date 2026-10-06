const SUPPORTED_PORTABLE_TEXT_DECORATORS = new Set([
    "strong",
    "em",
    "underline",
    "strike-through",
    "subscript",
    "superscript",
    "code",
]);
const SUPPORTED_PROSEMIRROR_MARKS = new Set([
    "bold",
    "strong",
    "italic",
    "em",
    "underline",
    "strike",
    "strikethrough",
    "subscript",
    "superscript",
    "code",
    "link",
    "emdashPortableTextSpan",
]);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectPortableTextMarks(value, inheritedMarkDefs, unsupported) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectPortableTextMarks(item, inheritedMarkDefs, unsupported);
        }
        return;
    }
    if (!isRecord(value))
        return;
    let markDefs = inheritedMarkDefs;
    if (Array.isArray(value.markDefs)) {
        const localMarkDefs = new Map(inheritedMarkDefs);
        for (const markDef of value.markDefs) {
            if (isRecord(markDef) && typeof markDef._key === "string") {
                localMarkDefs.set(markDef._key, markDef);
            }
        }
        markDefs = localMarkDefs;
    }
    if (value._type === "span" && Array.isArray(value.marks)) {
        for (const mark of value.marks) {
            if (typeof mark !== "string" || SUPPORTED_PORTABLE_TEXT_DECORATORS.has(mark))
                continue;
            const markDef = markDefs.get(mark);
            if (markDef?._type === "link")
                continue;
            unsupported.add(typeof markDef?._type === "string" ? markDef._type : mark);
        }
    }
    for (const [key, child] of Object.entries(value)) {
        if (key !== "markDefs") {
            collectPortableTextMarks(child, markDefs, unsupported);
        }
    }
}
function collectProseMirrorMarks(node, unsupported) {
    for (const mark of node.marks ?? []) {
        if (!SUPPORTED_PROSEMIRROR_MARKS.has(mark.type)) {
            unsupported.add(mark.type);
        }
    }
    for (const child of node.content ?? []) {
        collectProseMirrorMarks(child, unsupported);
    }
}
export class UnsupportedPortableTextMarksError extends Error {
    marks;
    constructor(marks) {
        const sortedMarks = [...new Set(marks)].toSorted();
        super(`Unsupported Portable Text marks: ${sortedMarks.join(", ")}`);
        this.name = "UnsupportedPortableTextMarksError";
        this.marks = sortedMarks;
    }
}
export function findUnsupportedPortableTextMarks(blocks) {
    const unsupported = new Set();
    for (const block of blocks) {
        if (block._type === "block" || block._type === "table") {
            collectPortableTextMarks(block, new Map(), unsupported);
        }
    }
    return [...unsupported].toSorted();
}
export function assertPortableTextMarksSupported(blocks) {
    const unsupported = findUnsupportedPortableTextMarks(blocks);
    if (unsupported.length > 0) {
        throw new UnsupportedPortableTextMarksError(unsupported);
    }
}
export function assertProseMirrorMarksSupported(document) {
    const unsupported = new Set();
    for (const node of document.content) {
        collectProseMirrorMarks(node, unsupported);
    }
    if (unsupported.size > 0) {
        throw new UnsupportedPortableTextMarksError(unsupported);
    }
}
