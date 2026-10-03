// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete selected declarations 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/plugins/types.ts; blob 4c70d4438aebb76eb711482a8ed1e312b452fe1a.

export interface PaginatedResult<T> {
	items: T[];
	cursor?: string;
	hasMore: boolean;
}

export interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	size: number | null;
	url: string;
	createdAt: string;
	width?: number | null;
	height?: number | null;
	alt?: string | null;
	caption?: string | null;
	focalX?: number | null;
	focalY?: number | null;
	blurhash?: string | null;
	dominantColor?: string | null;
	folderId?: string | null;
	status?: "ready";
}

export interface MediaBytes {
	bytes: Uint8Array;
	filename: string;
	mimeType: string;
	size: number;
	contentHash?: string;
}

export interface MediaMetadataPatch {
	alt?: string | null;
	caption?: string | null;
	focalX?: number | null;
	focalY?: number | null;
}

export interface MediaListOptions {
	limit?: number;
	cursor?: string;
	mimeType?: string; // Filter by mime type prefix, e.g., "image/"
}

export interface MediaAccess {
	// Read operations (requires read:media)
	get(id: string): Promise<MediaItem | null>;
	list(options?: MediaListOptions): Promise<PaginatedResult<MediaItem>>;
	/** Read ready media bytes, bounded by the caller's limit and the host maximum. */
	readBytes?(id: string, options?: { maxBytes?: number }): Promise<MediaBytes>;
	/** Change only alt text, caption, or the complete focal-point pair. */
	updateMetadata?(id: string, patch: MediaMetadataPatch): Promise<MediaItem>;

	// Write operations (requires write:media) - optional on interface
	getUploadUrl?(
		filename: string,
		contentType: string,
	): Promise<{ uploadUrl: string; mediaId: string }>;
	/**
	 * Upload media bytes directly. Preferred in sandboxed mode where
	 * plugins cannot make external requests to a presigned URL.
	 * Returns the created media item.
	 */
	upload?(
		filename: string,
		contentType: string,
		bytes: ArrayBuffer,
	): Promise<{ mediaId: string; storageKey: string; url: string }>;
	delete?(id: string): Promise<boolean>;
}
