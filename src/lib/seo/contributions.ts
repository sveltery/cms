// Derived from EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
// Pure contribution builders. Persistent settings and page-overlay integration are separate.
import type {ContentSeo,PublicPageContext,PageMetadataContribution,SeoSettings} from './types.ts';
import {buildSeoImageUrl,resolveSeoCanonicalUrl} from './media-url.ts';
import {buildBlogPostingJsonLd,buildWebSiteJsonLd} from './jsonld.ts';

export function generateBaseSeoContributions(
	page: PublicPageContext,
	defaultOgImage?: string | null,
): PageMetadataContribution[] {
	const contributions: PageMetadataContribution[] = [];

	const description = page.description;
	const ogTitle = page.seo?.ogTitle ?? page.pageTitle ?? page.title;
	const ogDescription = page.seo?.ogDescription || description;
	const ogImage = page.seo?.ogImage || page.image || defaultOgImage || null;
	const robots = page.seo?.robots;
	const canonical = page.canonical;
	const siteName = page.siteName;

	// -- Meta tags --

	if (description) {
		contributions.push({ kind: "meta", name: "description", content: description });
	}

	if (robots) {
		contributions.push({ kind: "meta", name: "robots", content: robots });
	}

	// -- Canonical link --

	if (canonical) {
		contributions.push({ kind: "link", rel: "canonical", href: canonical });
	}

	// -- Open Graph --

	contributions.push({
		kind: "property",
		property: "og:type",
		content: page.pageType === "article" ? "article" : "website",
	});

	if (ogTitle) {
		contributions.push({ kind: "property", property: "og:title", content: ogTitle });
	}

	if (ogDescription) {
		contributions.push({ kind: "property", property: "og:description", content: ogDescription });
	}

	if (ogImage) {
		contributions.push({ kind: "property", property: "og:image", content: ogImage });
	}

	if (canonical) {
		contributions.push({ kind: "property", property: "og:url", content: canonical });
	}

	if (siteName) {
		contributions.push({ kind: "property", property: "og:site_name", content: siteName });
	}

	// -- Twitter Card --

	contributions.push({
		kind: "meta",
		name: "twitter:card",
		content: ogImage ? "summary_large_image" : "summary",
	});

	if (ogTitle) {
		contributions.push({ kind: "meta", name: "twitter:title", content: ogTitle });
	}

	if (ogDescription) {
		contributions.push({ kind: "meta", name: "twitter:description", content: ogDescription });
	}

	if (ogImage) {
		contributions.push({ kind: "meta", name: "twitter:image", content: ogImage });
	}

	// -- Article metadata --

	if (page.pageType === "article" && page.articleMeta) {
		const { publishedTime, modifiedTime, author } = page.articleMeta;
		if (publishedTime) {
			contributions.push({
				kind: "property",
				property: "article:published_time",
				content: publishedTime,
			});
		}
		if (modifiedTime) {
			contributions.push({
				kind: "property",
				property: "article:modified_time",
				content: modifiedTime,
			});
		}
		if (author) {
			contributions.push({
				kind: "property",
				property: "article:author",
				content: author,
			});
		}
	}

	// -- JSON-LD --

	if (page.pageType === "article") {
		const blogPosting = buildBlogPostingJsonLd(page, defaultOgImage ?? null);
		if (blogPosting) {
			contributions.push({ kind: "jsonld", id: "primary", graph: blogPosting });
		}
	} else if (siteName) {
		const webSite = buildWebSiteJsonLd(page);
		if (webSite) {
			contributions.push({ kind: "jsonld", id: "primary", graph: webSite });
		}
	}

	return contributions;
}

export function applySeoPanelToPageContext(
	page: PublicPageContext,
	seo: ContentSeo,
	options: { siteUrl?: string | null } = {},
): PublicPageContext {
	const siteUrl = options.siteUrl ?? undefined;
	const image = seo.image ? buildSeoImageUrl(seo.image, siteUrl) : null;
	const canonical = seo.canonical ? resolveSeoCanonicalUrl(seo.canonical, siteUrl) : null;

	return {
		...page,
		description: seo.description || page.description,
		canonical: canonical || page.canonical,
		// Mirror the resolved image into the top-level field too, so consumers
		// reading page.image (e.g. page:metadata hooks) agree with og:image and
		// the JSON-LD graph.
		image: image || page.image,
		seo: {
			...page.seo,
			ogTitle: seo.title || page.seo?.ogTitle,
			ogDescription: seo.description || page.seo?.ogDescription,
			ogImage: image || page.seo?.ogImage,
			robots: seo.noIndex ? "noindex, nofollow" : page.seo?.robots,
		},
	};
}

export function generateSiteSeoContributions(
	seoSettings: SeoSettings | undefined,
): PageMetadataContribution[] {
	const contributions: PageMetadataContribution[] = [];

	if (!seoSettings) {
		return contributions;
	}

	if (seoSettings.googleVerification) {
		contributions.push({
			kind: "meta",
			name: "google-site-verification",
			content: seoSettings.googleVerification,
		});
	}

	if (seoSettings.bingVerification) {
		contributions.push({
			kind: "meta",
			name: "msvalidate.01",
			content: seoSettings.bingVerification,
		});
	}

	return contributions;
}
