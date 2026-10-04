// Ported from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/editor/CodeMarkExtension.ts; MIT, see notices/emdash-MIT.txt.

/**
 * TipTap's default Code mark sets `excludes: '_'`, which drops every other
 * mark on the same span. Portable Text allows decorator + annotation stacks
 * (e.g. linked inline code), so override only that field.
 */

import Code from "@tiptap/extension-code";

export const CodeMarkExtension = Code.extend({
	excludes: "",
});
