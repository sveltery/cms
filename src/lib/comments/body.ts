// Complete selected immutable Source Comments.astro body formatting.
// EmDash MIT Cloudflare Inc.2026; see notices/emdash-MIT.txt.


const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

const AMP_RE = /&/g;

const LT_RE = /</g;

const GT_RE = />/g;

const QUOT_RE = /"/g;


function autoLinkUrls(text: string): string {
	return text.replace(
		URL_RE,
		(url) =>
			`<a href="${url}" rel="nofollow ugc noopener" target="_blank">${url}</a>`
	);
}


function escapeHtml(text: string): string {
	return text
		.replace(AMP_RE, "&amp;")
		.replace(LT_RE, "&lt;")
		.replace(GT_RE, "&gt;")
		.replace(QUOT_RE, "&quot;");
}


function formatBody(text: string): string {
	return autoLinkUrls(escapeHtml(text));
}
export { formatBody };
