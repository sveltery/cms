// Derived from EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
export interface ContentSeo {
	title: string | null;
	description: string | null;
	image: string | null;
	canonical: string | null;
	noIndex: boolean;
}
export interface ContentSeoInput {
	title?: string | null;
	description?: string | null;
	image?: string | null;
	canonical?: string | null;
	noIndex?: boolean;
}
export interface BreadcrumbItem {
	/** Display name for this crumb (e.g. "Home", "Blog", "My Post"). */
	name: string;
	/** Absolute or root-relative URL for this crumb. */
	url: string;
}
export interface PublicPageContext {
	url: string;
	path: string;
	locale: string | null;
	kind: "content" | "custom";
	pageType: string;
	/** Full document title for the rendered page */
	title: string | null;
	/** Page-only title for OG/Twitter/JSON-LD headline output */
	pageTitle?: string | null;
	description: string | null;
	canonical: string | null;
	image: string | null;
	content?: {
		collection: string;
		id: string;
		slug: string | null;
	};
	/** SEO meta for base metadata generation in EmDashHead */
	seo?: {
		ogTitle?: string | null;
		ogDescription?: string | null;
		ogImage?: string | null;
		robots?: string | null;
	};
	/** Article metadata for Open Graph article: tags */
	articleMeta?: {
		publishedTime?: string | null;
		modifiedTime?: string | null;
		author?: string | null;
	};
	/** Site name for structured data and og:site_name */
	siteName?: string;
	/**
	 * Optional breadcrumb trail for this page, root first. When set,
	 * SEO plugins should use this verbatim rather than deriving a trail
	 * from `path`. Themes typically populate this at the point they
	 * build the context (e.g. from a content hierarchy walk, taxonomy
	 * lookup, or per-`pageType` routing logic).
	 *
	 * Semantics for consumers:
	 *   - `undefined` — theme has no opinion; consumer falls back to
	 *     its own derivation.
	 *   - `[]` — this page has no breadcrumbs (e.g. homepage); consumer
	 *     should skip `BreadcrumbList` emission entirely.
	 *   - Non-empty array — used verbatim for `BreadcrumbList` output.
	 */
	breadcrumbs?: BreadcrumbItem[];
	/** Public-facing site URL (origin) for structured data */
	siteUrl?: string;
}
export type PageMetadataLinkRel =
	| "canonical"
	| "alternate"
	| "author"
	| "license"
	| "nlweb"
	| "site.standard.document";
export type PageMetadataContribution =
	| { kind: "meta"; name: string; content: string; key?: string }
	| { kind: "property"; property: string; content: string; key?: string }
	| { kind: "link"; rel: PageMetadataLinkRel; href: string; hreflang?: string; key?: string }
	| {
			kind: "jsonld";
			id?: string;
			graph: Record<string, unknown> | Array<Record<string, unknown>>;
	  };
export interface MediaReference {
	mediaId: string;
	alt?: string;
	/** Resolved URL. Populated by `resolveMediaReference`; absent on raw stored values. */
	url?: string;
	/** Stored MIME type (e.g. `image/svg+xml`). Populated alongside `url`. */
	contentType?: string;
	/** Pixel width if known. Populated alongside `url`. */
	width?: number;
	/** Pixel height if known. Populated alongside `url`. */
	height?: number;
}
export interface SeoSettings {
	/** Separator between page title and site title (e.g., " | ", " — ") */
	titleSeparator?: string;
	/** Default OG image when content has no seo_image */
	defaultOgImage?: MediaReference;
	/** Custom robots.txt content. If unset, a default is generated. */
	robotsTxt?: string;
	/** Google Search Console verification meta tag content */
	googleVerification?: string;
	/** Bing Webmaster Tools verification meta tag content */
	bingVerification?: string;
}
