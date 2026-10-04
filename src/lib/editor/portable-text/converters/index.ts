// Ported from EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/core/src/content/converters/index.ts
// MIT license: notices/emdash-MIT.txt.

/**
 * Portable Text Converters
 *
 * Bidirectional conversion between Portable Text and ProseMirror JSON.
 */

export { prosemirrorToPortableText } from "./prosemirror-to-portable-text.js";
export { portableTextToProsemirror } from "./portable-text-to-prosemirror.js";
export type { PortableTextToProsemirrorOptions } from "./portable-text-to-prosemirror.js";
export { portableTextIdentityExtensions } from "./portable-text-identity.js";
export { normalizeImageLink } from "./image-link.js";
export * from "./types.js";
