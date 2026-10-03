// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete selected declarations 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/plugins/media.ts; blob ce0e20b9637daccde6fb90276844b34aef87f9c3.
import type {MediaItem as RepositoryMediaItem} from '../database/repositories/media.ts';
import type {MediaItem} from './types.ts';
function mediaUrl(item: RepositoryMediaItem): string {
	return `/_emdash/api/media/asset/${encodeURIComponent(item.id)}/${encodeURIComponent(item.filename)}`;
}

export function toPluginMediaItem(item: RepositoryMediaItem): MediaItem {
	return {
		id: item.id,
		filename: item.filename,
		mimeType: item.mimeType,
		size: item.size,
		url: mediaUrl(item),
		createdAt: item.createdAt,
		width: item.width,
		height: item.height,
		alt: item.alt,
		caption: item.caption,
		focalX: item.focalX,
		focalY: item.focalY,
		blurhash: item.blurhash,
		dominantColor: item.dominantColor,
		folderId: item.folderId ?? null,
		status: "ready",
	};
}
