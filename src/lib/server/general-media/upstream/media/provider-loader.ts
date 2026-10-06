// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Whole pinned body; native import paths only.
/**
 * Media Provider Loader
 *
 * Lazy-loads media providers from virtual module for frontend rendering.
 * Similar pattern to getDb() - providers are loaded on first use and cached.
 *
 * This allows EmDashMedia component to render media without requiring
 * the full EmDash runtime to be initialized.
 */

import type { MediaProvider, MediaProviderCapabilities } from "./types.ts";

/**
 * Media provider entry from virtual module
 */
interface MediaProviderEntry {
	id: string;
	name: string;
	icon?: string;
	capabilities: MediaProviderCapabilities;
	createProvider: (ctx: Record<string, unknown>) => MediaProvider;
}

// Cached provider entries from virtual module
let virtualMediaProviders: MediaProviderEntry[] | undefined;

// Cached provider instances (shared across calls)
const mediaProviderInstances = new Map<string, MediaProvider>();

/**
 * Load media providers from virtual module
 */
async function loadMediaProviders(): Promise<void> {
	if (virtualMediaProviders === undefined) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore - virtual module
		const providersModule = await import("virtual:emdash/media-providers");
		virtualMediaProviders = providersModule.mediaProviders || [];
	}
}

/**
 * Get a media provider by ID.
 *
 * Used by EmDashMedia component for frontend rendering.
 * Providers are lazy-loaded from virtual module and cached.
 *
 * @example
 * ```ts
 * const provider = await getMediaProvider("cloudflare-images");
 * if (provider) {
 *   const embed = provider.getEmbed(mediaValue, { width: 800 });
 * }
 * ```
 */
export async function getMediaProvider(providerId: string): Promise<MediaProvider | undefined> {
	// Check cache first
	const cached = mediaProviderInstances.get(providerId);
	if (cached) {
		return cached;
	}

	// Load media providers from virtual module
	await loadMediaProviders();

	// Find the provider entry
	const entry = virtualMediaProviders?.find((p) => p.id === providerId);
	if (!entry) {
		return undefined;
	}

	// Create the provider instance
	// For providers that don't need db/storage (like Cloudflare Images),
	// they'll get empty context and use env vars directly
	const provider = entry.createProvider({});
	mediaProviderInstances.set(providerId, provider);
	return provider;
}
