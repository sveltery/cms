// EmDash 1.1.0 MIT; Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Immutable source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/escape.ts; blob 5845f302b684d3937dcfb93298467bc35c721852.
/** HTML-escape a string to prevent XSS when interpolated into HTML/JS */
export function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#x27;");
}
