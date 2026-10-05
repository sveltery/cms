// Derived from EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
/**
 * Per-collection sitemap endpoint
 *
 * GET /sitemap-{collection}.xml - Sitemap for a single content collection.
 *
 * Uses the collection's url_pattern to build URLs. Falls back to
 * /{collection}/{slug} when no pattern is configured.
 *
 * i18n behaviour: when Astro i18n is enabled, the locale prefix is
 * applied via Astro's own `getRelativeLocaleUrl` (which honours
 * `prefixDefaultLocale`, custom `path` mappings, and other `routing`
 * config). Each translation row is emitted as its own `<url>` with
 * `<xhtml:link rel="alternate" hreflang="...">` entries pointing to
 * its siblings (grouped by `translation_group`). The default-locale
 * variant is also linked as `hreflang="x-default"`.
 */

import type { Kysely } from "kysely";
import type { Database } from "./types.ts";
import type { CmsTables } from "../database/contract.ts";
import { NATIVE_SEO_STORAGE, seoStorage, type SeoStorage } from "./storage.ts";

import { handleSitemapData } from "./sitemap.ts";
import { getSiteSettingsWithDb } from "./read.ts";

import { getI18nConfig, isI18nEnabled } from "../menus/i18n-config.ts";
import { resolveLocalizedContentRoutePath } from "../menus/i18n-resolve.ts";
import { buildSeoImageUrl } from "../../seo/media-url.ts";

export interface CollectionSitemapInput {
  db: Kysely<Database> | null;
  collection: string | undefined;
  url: URL;
  /** Trusted server configuration; never read from forwarded request headers. */
  publicOrigin?: string;
  /** Existing trusted SvelteKit mount path, validated by runtime composition. */
  basePath?: string;
  trailingSlash?: "always" | "never" | "ignore";
}

const TRAILING_SLASH_RE = /\/$/;
const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const QUOT_RE = /"/g;
const APOS_RE = /'/g;

export async function collectionSitemapResponse(input: CollectionSitemapInput, storage: SeoStorage = NATIVE_SEO_STORAGE): Promise<Response> {
  const physical = seoStorage(storage);
  const { db, url } = input;
  const collectionSlug = input.collection;

	if (!db || !collectionSlug) {
		return new Response("<!-- EmDash not configured -->", {
			status: 500,
			headers: { "Content-Type": "application/xml" },
		});
	}

	try {
		const settings = await getSiteSettingsWithDb(db as unknown as Kysely<CmsTables>);
		const siteUrl = (settings.url || (input.publicOrigin || url.origin) + (input.basePath ?? "")).replace(
			TRAILING_SLASH_RE,
			"",
		);

		const result = await handleSitemapData(db, collectionSlug, physical);

		if (!result.success || !result.data) {
			return new Response("<!-- Failed to generate sitemap -->", {
				status: 500,
				headers: { "Content-Type": "application/xml" },
			});
		}

		const col = result.data.collections[0];
		if (!col) {
			return new Response("<!-- Collection not found or empty -->", {
				status: 404,
				headers: { "Content-Type": "application/xml" },
			});
		}

		const i18nEnabled = isI18nEnabled();
		const i18nConfig = getI18nConfig();

		// Group entries by `translation_group` so each <url> can advertise
		// its sibling translations via xhtml:link. Rows without a group
		// (legacy/single-locale data) are emitted individually.
		type Entry = (typeof col.entries)[number];
		const groups = new Map<string, Entry[]>();
		const ungrouped: Entry[] = [];
		for (const entry of col.entries) {
			if (i18nEnabled && entry.translationGroup) {
				const list = groups.get(entry.translationGroup);
				if (list) list.push(entry);
				else groups.set(entry.translationGroup, [entry]);
			} else {
				ungrouped.push(entry);
			}
		}

		// Resolve every URL up-front so we can reference sibling URLs
		// while emitting hreflang alternates without re-resolving.
		// `localizePath` returns `null` when the row's locale isn't in
		// the configured `i18n.locales` list -- the site can't serve a
		// route for it, so the entry is dropped from the sitemap and
		// omitted from sibling alternates.
		const urlByEntry = new Map<string, string | null>();
		const resolveEntryUrl = async (entry: Entry): Promise<string | null> => {
			if (urlByEntry.has(entry.id)) return urlByEntry.get(entry.id) ?? null;
			const absolutePath = await resolveLocalizedContentRoutePath({
				pattern: col.urlPattern,
				collection: col.collection,
				slug: entry.slug || entry.id,
				id: entry.id,
				// Published date keeps date-token permalinks stable across edits;
				// no updatedAt fallback — tokens stay literal without a publish
				// date, consistent with the resolver's documented behavior.
				date: entry.publishedAt,
				locale: entry.locale,
				trailingSlash: input.trailingSlash,
			});
			const absolute = absolutePath === null ? null : `${siteUrl}${absolutePath}`;
			urlByEntry.set(entry.id, absolute);
			return absolute;
		};

		const useXhtml = i18nEnabled;
		const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
		lines.push(
			useXhtml
				? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
				: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
		);

		const writeUrl = async (entry: Entry, siblings: Entry[] | null) => {
			const loc = await resolveEntryUrl(entry);
			// Skip rows whose locale isn't in the configured `i18n.locales`
			// list. Linking to a route the site can't serve is worse than
			// no link at all (search engines hit a 404 and downrank).
			if (loc === null) return;

			lines.push("  <url>");
			lines.push(`    <loc>${escapeXml(loc)}</loc>`);
			lines.push(`    <lastmod>${escapeXml(entry.updatedAt)}</lastmod>`);

			// Google image sitemap extension: advertise the entry's SEO
			// image (the same "preferred image" used for og:image) so it
			// can be discovered and indexed for Google Images.
			if (entry.image) {
				const imageLoc = buildSeoImageUrl(entry.image, siteUrl);
				lines.push("    <image:image>");
				lines.push(`      <image:loc>${escapeXml(imageLoc)}</image:loc>`);
				lines.push("    </image:image>");
			}

			const alternateEntries = siblings ?? (useXhtml ? [entry] : null);
			if (useXhtml && alternateEntries) {
				// Emit one xhtml:link per sibling (including self -- Google
				// recommends including the page's own hreflang annotation).
				// Siblings with unroutable locales are skipped here too.
				for (const sib of alternateEntries) {
					const sibLoc = await resolveEntryUrl(sib);
					if (sibLoc === null) continue;
					lines.push(
						`    <xhtml:link rel="alternate" hreflang="${escapeXml(sib.locale)}" href="${escapeXml(sibLoc)}" />`,
					);
				}

				// x-default: prefer the default-locale sibling, otherwise
				// the first sibling with a routable URL. Stable order:
				// rows arrive sorted by updated_at DESC from the handler.
				const defaultSibling =
					i18nConfig && alternateEntries.find((s) => s.locale === i18nConfig.defaultLocale);
				let xDefaultLoc: string | null = null;
				if (defaultSibling) {
					xDefaultLoc = await resolveEntryUrl(defaultSibling);
				}
				if (xDefaultLoc === null) {
					for (const sib of alternateEntries) {
						const sibLoc = await resolveEntryUrl(sib);
						if (sibLoc !== null) {
							xDefaultLoc = sibLoc;
							break;
						}
					}
				}
				if (xDefaultLoc !== null) {
					lines.push(
						`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultLoc)}" />`,
					);
				}
			}

			lines.push("  </url>");
		};

		for (const siblings of groups.values()) {
			for (const entry of siblings) {
				await writeUrl(entry, siblings);
			}
		}
		for (const entry of ungrouped) {
			await writeUrl(entry, null);
		}

		lines.push("</urlset>");

		return new Response(lines.join("\n"), {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch {
		return new Response("<!-- Internal error generating sitemap -->", {
			status: 500,
			headers: { "Content-Type": "application/xml" },
		});
	}
}

/** Escape special XML characters in a string */
function escapeXml(str: string): string {
	return str
		.replace(AMP_RE, "&amp;")
		.replace(LT_RE, "&lt;")
		.replace(GT_RE, "&gt;")
		.replace(QUOT_RE, "&quot;")
		.replace(APOS_RE, "&apos;");
}
