// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Complete selected Source type declarations; API transport is native.
export interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	url: string;
	/** Storage key for local media (e.g., "01ABC.jpg"). Not present for external URLs. */
	storageKey?: string;
	contentHash?: string | null;
	size: number;
	width?: number;
	height?: number;
	focalX?: number | null;
	focalY?: number | null;
	/** LQIP blurhash placeholder (images only) */
	blurhash?: string;
	/** LQIP dominant-color placeholder, as a CSS color (images only) */
	dominantColor?: string;
	alt?: string;
	caption?: string;
	createdAt: string;
	status?: "pending" | "ready" | "failed";
	/** Provider ID for external media (e.g., "cloudflare-images") */
	provider?: string;
	/** Provider-specific metadata */
	meta?: Record<string, unknown>;
}

export interface LocalMediaItem extends MediaItem {
	provider?: undefined;
	storageKey: string;
	authorId: string | null;
	folderId: string | null;
}

export interface MediaFolder {
	id: string;
	name: string;
}

export interface MediaProviderCapabilities {
	browse: boolean;
	search: boolean;
	upload: boolean;
	delete: boolean;
}

export interface MediaProviderInfo {
	id: string;
	name: string;
	icon?: string;
	capabilities: MediaProviderCapabilities;
}

export interface MediaProviderItem {
	id: string;
	filename: string;
	mimeType: string;
	size?: number;
	width?: number;
	height?: number;
	/** LQIP blurhash placeholder (images only) */
	blurhash?: string;
	/** LQIP dominant-color placeholder, as a CSS color (images only) */
	dominantColor?: string;
	alt?: string;
	previewUrl?: string;
	meta?: Record<string, unknown>;
}

