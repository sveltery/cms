// Complete selected ImageFieldValue/mediaDisplayUrl/mediaItemToImageFieldValue declarations
// and complete FileFieldRenderer value/display/selection declarations from EmDash913cb1bb.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native exports/imports/closure wrapper; no whole React component/module credit.
import {isSafeUrl} from './source-url';
// Native English tag for the complete selected display callback; no Lingui runtime credit.
const t=(strings:TemplateStringsArray)=>strings.join('');
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

export interface FileFieldValue {
	id: string;
	/** Provider ID (e.g., "local", "s3") */
	provider?: string;
	/** Direct URL for non-local media */
	src?: string;
	/** Legacy cached URL */
	url?: string;
	filename?: string;
	mimeType?: string;
	size?: number;
	/** Provider-specific metadata */
	meta?: Record<string, unknown>;
}

export function normalizeFileFieldValue(value: FileFieldValue | undefined) {
const normalized = () => {
		if (!value) return null;
		const isLocal = !value.provider || value.provider === "local";
		const storageKey =
			typeof value.meta?.storageKey === "string" ? value.meta.storageKey : undefined;
		const directUrl = value.src ?? value.url;
		const localSrc =
			typeof directUrl === "string" && directUrl.startsWith("/_emdash/") ? directUrl : undefined;
		// Clients can write meta.storageKey, so it is encoded per path segment: query or
		// fragment delimiters cannot escape the route path, and a key with folders still
		// reaches the [...key] route.
		const localUrl = isLocal
			? storageKey
				? localMediaFileUrl(storageKey)
				: (localSrc ?? localMediaFileUrl(value.id))
			: undefined;
		const externalUrl = !isLocal && directUrl && isSafeUrl(directUrl) ? directUrl : undefined;
		return {
			displayUrl: localUrl ?? externalUrl,
			filename: value.filename || t`Untitled file`,
			mimeType: value.mimeType || "",
			size: value.size,
		};
	};
return normalized();
}
