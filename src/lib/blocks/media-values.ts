// Complete selected ImageFieldValue/mediaDisplayUrl/mediaItemToImageFieldValue declarations
// and complete FileFieldRenderer handleSelect callback from EmDash913cb1bb.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native exports/imports/closure wrapper; no whole React component/module credit.
import type {MediaItem} from '../media/picker-client';
import {canonicalMediaProviderId,localMediaFileUrl,metaString} from '../media/source/picker-media-utils';
export interface ImageFieldValue {
	id: string;
	/** Provider ID (e.g., "local", "cloudflare-images") */
	provider?: string;
	/** Direct URL for local media or legacy data */
	src?: string;
	/** Preview URL for admin display (separate from src used for rendering) */
	previewUrl?: string;
	filename?: string;
	mimeType?: string;
	alt?: string;
	width?: number;
	height?: number;
	focalX?: number;
	focalY?: number;
	/** LQIP blurhash placeholder (images only) */
	blurhash?: string;
	/** LQIP dominant-color placeholder, as a CSS color (images only) */
	dominantColor?: string;
	/** Provider-specific metadata */
	meta?: Record<string, unknown>;
	/** Image the site shows instead of this one in a dark color scheme */
	darkVariant?: ImageFieldValue;
}

export function mediaDisplayUrl(value: ImageFieldValue | string | undefined): string | undefined {
	if (typeof value === "string") return value;
	if (!value) return undefined;
	if (value.previewUrl || value.src) return value.previewUrl || value.src;
	if (!value.provider || value.provider === "local") {
		return localMediaFileUrl(
			typeof value.meta?.storageKey === "string" ? value.meta.storageKey : value.id,
		);
	}
	return undefined;
}

export function mediaItemToImageFieldValue(item: MediaItem): ImageFieldValue {
	const provider = canonicalMediaProviderId(item.provider);
	const isLocalProvider = provider === "local";
	const isDirectUrl = provider === "external";
	return {
		id: item.id,
		provider,
		src: isDirectUrl ? item.url : undefined,
		previewUrl: !isLocalProvider && !isDirectUrl ? item.url : undefined,
		alt: item.alt || "",
		width: item.width,
		height: item.height,
		focalX: item.focalX ?? undefined,
		focalY: item.focalY ?? undefined,
		filename: item.filename,
		mimeType: item.mimeType,
		blurhash: item.blurhash ?? metaString(item.meta, "blurhash"),
		dominantColor: item.dominantColor ?? metaString(item.meta, "dominantColor"),
		meta: isLocalProvider ? { ...item.meta, storageKey: item.storageKey } : item.meta,
	};
}

export function selectFileField(onChange:(value:Record<string,unknown>)=>void):(item:MediaItem)=>void {
const handleSelect = (item: MediaItem) => {
		const isLocalProvider = !item.provider || item.provider === "local";
		onChange({
			id: item.id,
			provider: item.provider || "local",
			src: isLocalProvider ? undefined : item.url,
			filename: item.filename,
			mimeType: item.mimeType,
			size: item.size,
			meta: isLocalProvider ? { ...item.meta, storageKey: item.storageKey } : item.meta,
		});
	};
return handleSelect;
}
