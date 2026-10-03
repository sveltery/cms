// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole selected declarations from immutable EmDash1.1.0 MediaPickerModal.tsx.
import type {MediaItem,MediaProviderItem} from "./picker-client";
import {canonicalMediaProviderId} from "./source/picker-media-utils";
export const URL_SOURCE="__url";
export interface SelectedMedia {
	key: string;
	providerId: string;
	item: MediaItem | MediaProviderItem;
	uploadJobId?: number;
}

export interface UploadedMedia {
	providerId: string;
	item: MediaItem | MediaProviderItem;
}

export function matchesAnyFilter(mime: string, filters: string[] | undefined): boolean {
	if (!filters || filters.length === 0) return true;
	return filters.some((entry) => {
		if (!entry || !entry.includes("/")) return false;
		return entry.endsWith("/")
			? mime.toLowerCase().startsWith(entry.toLowerCase())
			: mime.toLowerCase() === entry.toLowerCase();
	});
}

export function matchesFilenameSearch(filename: string, search: string): boolean {
	return !search || filename.toLowerCase().includes(search.toLowerCase());
}

export function filtersOverlap(first: string, second: string): string | null {
	const left = first.toLowerCase();
	const right = second.toLowerCase();
	if (left === right) return left;
	if (left.endsWith("/") && right.startsWith(left)) return right;
	if (right.endsWith("/") && left.startsWith(right)) return left;
	return null;
}

export function intersectMimeFilters(
	allowed: string[] | undefined,
	chosen: string | string[] | undefined,
): string[] | undefined {
	if (!allowed?.length) {
		if (!chosen) return undefined;
		return Array.isArray(chosen) ? chosen : [chosen];
	}
	if (!chosen) return allowed;
	const chosenFilters = Array.isArray(chosen) ? chosen : [chosen];
	return [
		...new Set(
			allowed.flatMap((allowedMime) =>
				chosenFilters.flatMap((chosenMime) => filtersOverlap(allowedMime, chosenMime) ?? []),
			),
		),
	];
}

export function selectionKey(providerId: string, item: MediaItem | MediaProviderItem): string {
	if (providerId === URL_SOURCE) return `external:${(item as MediaItem).url}`;
	return `${canonicalMediaProviderId(providerId)}:${item.id}`;
}

export function appendUniqueSelections(
	current: SelectedMedia[],
	additions: SelectedMedia[],
	sortUploads = true,
) {
	const keys = new Set(current.map((selected) => selected.key));
	const next = [...current];
	for (const selected of additions) {
		if (keys.has(selected.key)) continue;
		keys.add(selected.key);
		next.push(selected);
	}
	if (sortUploads) {
		const uploadPositions = next.flatMap((selected, index) =>
			selected.uploadJobId === undefined ? [] : [index],
		);
		const uploads = uploadPositions
			.map((index) => next[index]!)
			.toSorted((first, second) => first.uploadJobId! - second.uploadJobId!);
		uploadPositions.forEach((position, index) => {
			next[position] = uploads[index]!;
		});
	}
	return next;
}

export function withLocalMediaUrl(item: MediaItem): MediaItem {
	if (item.url || !item.storageKey) return item;
	return { ...item, url: `/_emdash/api/media/file/${item.storageKey}` };
}

export function probeImageDimensions(
	url: string,
	errorMessage: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new window.Image();
		image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => reject(new Error(errorMessage));
		image.src = url;
	});
}

